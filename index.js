require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); 
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("TicketBari Server is Running!");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    // Database Collections
    const database = client.db("ticketbari_db");
    const ticketsCollection = database.collection("tickets");
    const bookingsCollection = database.collection("booking");

    // ==================== TICKETS API ====================
    
    // Find all tickets
    app.get(`/api/tickets`, async (req, res) => {
      try {
        const cursor = ticketsCollection.find({});
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed data fetching", error });
      }
    });

    // Find ticket by id
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

    // Added new tickets
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

    // ==================== BOOKINGS & STRIPE API ====================

    // Get bookings (filtered by userId if provided)
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
        res
          .status(500)
          .send({ message: "Internal server error", error: error.message });
      }
    });

    // Create new booking
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

    // ১. Stripe Checkout Session তৈরি করার API
    app.post("/api/checkout", async (req, res) => {
      try {
        const { bookingId, amount, email } = req.body;

        if (!bookingId || !amount) {
          return res
            .status(400)
            .send({ message: "Missing bookingId or amount" });
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
        res
          .status(500)
          .send({ message: "Internal server error", error: error.message });
      }
    });

    // ২. পেমেন্ট সফল হওয়ার পর ব্যাকএন্ডে ভেরিফাই করার এপিআই
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
            res.send({
              success: true,
              message: "Payment verified and booking status updated to paid",
            });
          } else {
            res
              .status(404)
              .send({
                success: false,
                message: "Booking not found or already paid",
              });
          }
        } else {
          res.status(400).send({ success: false, message: "Payment verification failed on Stripe" });
        }
      } catch (error) {
        res
          .status(500)
          .send({
            success: false,
            message: "Failed to update booking status",
            error: error.message,
          });
      }
    });

// ==================== TRANSACTIONS HISTORY API ====================
// নির্দিষ্ট ইউজারের সফল ট্রানজেকশন হিস্ট্রি পাওয়ার এন্ডপয়েন্ট
app.get("/api/transactions", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).send({ message: "Email query parameter is required" });
    }

    // 🌟 এখানে 'email'-এর জায়গায় 'userEmail' ব্যবহার করা হয়েছে (আপনার ফ্রন্টএন্ড অনুযায়ী)
    const query = { 
      userEmail: email, 
      status: "paid" // স্ট্রাইপ পেমেন্ট সফল হলে আপনার কোড এটিকে ছোট হাতের "paid" করে দেয়
    };

    // লেটেস্ট পেমেন্ট সবার উপরে দেখানোর জন্য sort করা হয়েছে
    const result = await bookingsCollection.find(query).sort({ paidAt: -1 }).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).send({ message: "Internal server error", error: error.message });
  }
});

// ==================== ADMIN TICKETS MANAGEMENT API ====================

// Update ticket status (Approve / Reject)
app.patch("/api/tickets/:id/status", async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body; // Expecting 'approved' or 'rejected'

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

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});