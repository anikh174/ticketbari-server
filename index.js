require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); 
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Root API
app.get("/", (req, res) => {
  res.send("TicketBari Server is Running!");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// MongoDB client setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // Database Collections
    const database = client.db("ticketbari_db");
    const ticketsCollection = database.collection("tickets");
    const bookingsCollection = database.collection("booking");


    // ==================== PUBLIC / GENERAL TICKETS API ====================
    
    // Get all tickets
    app.get(`/api/tickets`, async (req, res) => {
      try {
        const cursor = ticketsCollection.find({});
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed data fetching", error });
      }
    });

    // Get a single ticket by ID
    app.get("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await ticketsCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: "Ticket not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });

    // Get only advertised and approved tickets
    app.get("/api/advertised-tickets", async (req, res) => {
      try {
        const query = { isAdvertised: true, status: "approved" };
        const cursor = ticketsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching advertised tickets:", error);
        res.status(500).send({ message: "Failed to fetch advertised tickets", error: error.message });
      }
    });


    // ==================== USER / CUSTOMER API ====================

    // Book a ticket (Initial status: pending)
    app.post("/api/bookings", async (req, res) => {
      try {
        const bookings = req.body;
        const newBookings = {
          ...bookings,
          status: "pending", 
          createdAt: new Date(),
        };
        const result = await bookingsCollection.insertOne(newBookings);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Booking failed", error: error.message });
      }
    });

    // Get user's own bookings (Filtered by userId)
    app.get("/api/bookings", async (req, res) => {
      try {
        const query = {};
        if (req.query.userId) {
          query.userId = req.query.userId;
        }
        const cursor = bookingsCollection.find(query).sort({ _id: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });

    // Initialize Stripe Checkout Session
    app.post("/api/checkout", async (req, res) => {
      try {
        const { bookingId, amount, email } = req.body;

        if (!bookingId || !amount) {
          return res.status(400).send({ message: "Missing bookingId or amount" });
        }

        const unitAmount = Math.round(amount * 100);

        const sessionData = {
          payment_method_types: ["card"],
          mode: "payment",
          success_url: `http://localhost:3000/dashboard/user/payment/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
          cancel_url: `http://localhost:3000/dashboard/user/payment/cancel?canceled=true`,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Ticket Booking #${bookingId.substring(0, 8)}`,
                  description: `Payment for Booking ID: ${bookingId}`,
                },
                unit_amount: unitAmount,
              },
              quantity: 1,
            },
          ],
        };

        if (email) {
          sessionData.customer_email = email;
        }

        const session = await stripe.checkout.sessions.create(sessionData);
        res.send({ url: session.url });
      } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });

    // Verify Stripe payment and update booking status to 'paid'
    app.post("/api/bookings/verify-payment", async (req, res) => {
      try {
        const { sessionId, bookingId } = req.body;

        if (!sessionId || !bookingId) {
          return res.status(400).send({ success: false, message: "Missing sessionId or bookingId" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === "paid") {
          const filter = { _id: new ObjectId(bookingId) };
          const updateDoc = {
            $set: {
              status: "paid", 
              stripeSessionId: sessionId,
              paidAt: new Date(),
            },
          };

          const result = await bookingsCollection.updateOne(filter, updateDoc);

          if (result.modifiedCount > 0) {
            res.send({ success: true, message: "Payment verified and booking status updated to paid" });
          } else {
            res.status(404).send({ success: false, message: "Booking not found or already paid" });
          }
        } else {
          res.status(400).send({ success: false, message: "Payment verification failed on Stripe" });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: "Failed to update booking status", error: error.message });
      }
    });

    // Get successful transaction history for a specific user
    app.get("/api/transactions", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).send({ message: "Email query parameter is required" });
        }

        const query = { userEmail: email, status: "paid" };
        const result = await bookingsCollection.find(query).sort({ paidAt: -1 }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });


    // ==================== VENDOR API ====================

    // Add a new ticket
    app.post("/api/tickets", async (req, res) => {
      try {
        const tickets = req.body;
        const newTickets = {
          ...tickets,
          createdAt: new Date(),
        };
        const result = await ticketsCollection.insertOne(newTickets);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add ticket", error: error.message });
      }
    });

    // Update ticket details (excluding _id to avoid MongoDB error)
    app.put("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedTicket = req.body;

        const { _id, ...updateData } = updatedTicket;

        const updateDoc = {
          $set: {
            ...updateData,
            updatedAt: new Date()
          },
        };

        const result = await ticketsCollection.updateOne(filter, updateDoc);
        
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Ticket not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update ticket", error: error.message });
      }
    });

    // Delete a ticket
    app.delete("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await ticketsCollection.deleteOne(query);
        
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Ticket not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete ticket", error: error.message });
      }
    });

    // Fetch all bookings for vendor management
    app.get("/api/vendor/bookings", async (req, res) => {
      try {
        const cursor = bookingsCollection.find({}).sort({ _id: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching vendor bookings:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });

    // Update booking status (Accept / Reject)
    app.patch("/api/bookings/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!["accepted", "rejected"].includes(status)) {
          return res.status(400).send({ message: "Invalid status type. Must be accepted or rejected." });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: status },
        };

        const result = await bookingsCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: `Booking status successfully updated to ${status}` });
        } else {
          res.status(404).send({ success: false, message: "Booking item not found or status went unchanged" });
        }
      } catch (error) {
        console.error("Error updating booking status:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });

    // Get vendor analytics (Total tickets, sales, total revenue, and monthly chart data)
    app.get("/api/vendor/revenue-stats", async (req, res) => {
      try {
        const totalTicketsAdded = await ticketsCollection.countDocuments({});
        const paidBookings = await bookingsCollection.find({ status: "paid" }).toArray();

        let totalTicketsSold = 0;
        let totalRevenue = 0;
        const monthlyDataMap = {};

        paidBookings.forEach((booking) => {
          const count = parseInt(booking.quantity) || 1; 
          totalTicketsSold += count;
          
          const bookingAmount = parseFloat(booking.totalPrice) || 0;
          totalRevenue += bookingAmount;

          const paidDate = booking.paidAt ? new Date(booking.paidAt) : new Date(booking.createdAt);
          const monthName = paidDate.toLocaleString("default", { month: "short" });

          if (!monthlyDataMap[monthName]) {
            monthlyDataMap[monthName] = { name: monthName, revenue: 0, sales: 0 };
          }
          monthlyDataMap[monthName].revenue += bookingAmount;
          monthlyDataMap[monthName].sales += count;
        });

        const chartData = Object.values(monthlyDataMap);

        res.send({
          totalTicketsAdded,
          totalTicketsSold,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          chartData
        });
      } catch (error) {
        console.error("Error fetching revenue stats:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });


    // ==================== ADMIN API ====================

    // Update ticket status (Approve / Reject)
    app.patch("/api/tickets/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
          return res.status(400).send({ message: "Invalid status status type" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: status },
        };

        const result = await ticketsCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: `Ticket status updated to ${status}` });
        } else {
          res.status(404).send({ success: false, message: "Ticket not found or status unchanged" });
        }
      } catch (error) {
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });

    // Toggle Ticket Advertisement Status (Limit: Max 6)
    app.patch("/api/tickets/:id/advertise", async (req, res) => {
      try {
        const id = req.params.id;
        const { isAdvertised } = req.body;

        if (typeof isAdvertised !== "boolean") {
          return res.status(400).send({ message: "Invalid advertisement status type" });
        }

        if (isAdvertised) {
          const advertisedCount = await ticketsCollection.countDocuments({ isAdvertised: true });
          if (advertisedCount >= 6) {
            return res.status(400).send({ 
              success: false, 
              message: "Limit reached! You cannot advertise more than 6 tickets at a time." 
            });
          }
        }

        const filter = { _id: new ObjectId(id), status: "approved" };
        const updateDoc = {
          $set: { isAdvertised: isAdvertised },
        };

        const result = await ticketsCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ 
            success: true, 
            message: isAdvertised ? "Ticket added to advertisements" : "Ticket removed from advertisements" 
          });
        } else {
          res.status(404).send({ 
            success: false, 
            message: "Ticket not found, not approved, or advertisement status unchanged" 
          });
        }
      } catch (error) {
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });

    // Get overview metrics for admin dashboard
    app.get("/api/admin/stats", async (req, res) => {
      try {
        let totalBookings = 0;
        try {
          totalBookings = await bookingsCollection.countDocuments({});
        } catch (err) {
          console.error("Error counting bookings:", err);
        }

        let activeBuses = 0;
        try {
          activeBuses = await ticketsCollection.countDocuments({ status: "approved" });
        } catch (err) {
          console.error("Error counting active buses:", err);
        }

        let totalUsers = 0;
        try {
          const uniqueUsersArray = await bookingsCollection.distinct("userEmail");
          totalUsers = uniqueUsersArray.length;
        } catch (err) {
          console.error("Error counting distinct users:", err);
          totalUsers = totalBookings; 
        }

        res.send({
          totalBookings,
          totalUsers,
          activeBuses
        });
      } catch (error) {
        console.error("Global Admin Stats Error:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });


    // MongoDB connection verification ping
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // client.close() is omitted to keep connection alive
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});