// require("dotenv").config();
// const express = require("express");
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const cors = require("cors");
// const app = express();
// const port = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());

// // কানেকশন ক্যাশ করার জন্য গ্লোবাল ভেরিয়েবল
// // let cachedDb = null;

// // async function connectToDatabase() {
// //   if (cachedDb) return cachedDb; // যদি কানেকশন থাকে, সেটিই ব্যবহার করুন
// //   await client.connect();
// //   cachedDb = client.db("ticketbari_db");
// //   return cachedDb;
// // }

// // Root API
// app.get("/", (req, res) => {
//   res.send("TicketBari Server is Running!");
// });

// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const uri = process.env.MONGODB_URI;

// // MongoDB client setup
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
// });

// async function run() {
//   try {
//     await client.connect();

//     // Database Collections
//     const database = client.db("ticketbari_db");
//     const ticketsCollection = database.collection("tickets");
//     const bookingsCollection = database.collection("booking");

//     // ==================== PUBLIC / GENERAL TICKETS API ====================

//     // Get all approved tickets
//     app.get(`/api/tickets`, async (req, res) => {
//       try {
//         const query = { status: "approved" };
//         const cursor = ticketsCollection.find(query);
//         const result = await cursor.toArray();
//         res.send(result);
//       } catch (error) {
//         res.status(500).send({ message: "failed data fetching", error });
//       }
//     });

//     // Get a single ticket by ID
//     app.get("/api/tickets/:id", async (req, res) => {
//       try {
//         const id = req.params.id;
//         const query = { _id: new ObjectId(id) };
//         const result = await ticketsCollection.findOne(query);
//         if (!result) {
//           return res.status(404).send({ message: "Ticket not found" });
//         }
//         res.send(result);
//       } catch (error) {
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // Get only advertised and approved tickets
//     app.get("/api/advertised-tickets", async (req, res) => {
//       try {
//         const query = { isAdvertised: true, status: "approved" };
//         const cursor = ticketsCollection.find(query);
//         const result = await cursor.toArray();
//         res.send(result);
//       } catch (error) {
//         console.error("Error fetching advertised tickets:", error);
//         res
//           .status(500)
//           .send({
//             message: "Failed to fetch advertised tickets",
//             error: error.message,
//           });
//       }
//     });

//     // ==================== USER / CUSTOMER API ====================

//     // Book a ticket (Initial status: pending)
//     app.post("/api/bookings", async (req, res) => {
//       try {
//         const bookings = req.body;

//         if (!bookings.ticketId) {
//           return res.status(400).send({ message: "Missing ticketId" });
//         }
//         const ticket = await ticketsCollection.findOne({
//           _id: new ObjectId(bookings.ticketId),
//         });
//         if (!ticket || ticket.status !== "approved") {
//           return res
//             .status(400)
//             .send({
//               message:
//                 "This ticket is not approved or available for booking yet.",
//             });
//         }

//         // বাড়তি নিরাপত্তা: স্টকে পর্যাপ্ত টিকিট আছে কিনা চেক করা হচ্ছে
//         const bookedQuantity = parseInt(bookings.quantity) || 1;
//         if (ticket.quantity < bookedQuantity) {
//           return res
//             .status(400)
//             .send({ message: "Requested ticket quantity exceeds availability!" });
//         }

//         const newBookings = {
//           ...bookings,
//           status: "pending",
//           createdAt: new Date(),
//         };
//         const result = await bookingsCollection.insertOne(newBookings);
//         res.send(result);
//       } catch (error) {
//         res
//           .status(500)
//           .send({ message: "Booking failed", error: error.message });
//       }
//     });

//     // Get user's own bookings (Filtered by userId)
//     app.get("/api/bookings", async (req, res) => {
//       try {
//         const query = {};
//         if (req.query.userId) {
//           query.userId = req.query.userId;
//         }
//         const cursor = bookingsCollection.find(query).sort({ _id: -1 });
//         const result = await cursor.toArray();
//         res.send(result);
//       } catch (error) {
//         console.error("Error fetching bookings:", error);
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // Initialize Stripe Checkout Session
//     app.post("/api/checkout", async (req, res) => {
//       try {
//         const { bookingId, amount, email } = req.body;

//         if (!bookingId || !amount) {
//           return res
//             .status(400)
//             .send({ message: "Missing bookingId or amount" });
//         }

//         const unitAmount = Math.round(amount * 100);

//         const sessionData = {
//           payment_method_types: ["card"],
//           mode: "payment",
//           success_url: `https://ticket-barii.vercel.app/dashboard/user/payment/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
//           cancel_url: `https://ticket-barii.vercel.app/user/payment/cancel?canceled=true`,
//           line_items: [
//             {
//               price_data: {
//                 currency: "usd",
//                 product_data: {
//                   name: `Ticket Booking #${bookingId.substring(0, 8)}`,
//                   description: `Payment for Booking ID: ${bookingId}`,
//                 },
//                 unit_amount: unitAmount,
//               },
//               quantity: 1,
//             },
//           ],
//         };

//         if (email) {
//           sessionData.customer_email = email;
//         }

//         const session = await stripe.checkout.sessions.create(sessionData);
//         res.send({ url: session.url });
//       } catch (error) {
//         console.error("Stripe Error:", error);
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // Verify Stripe payment, update booking status to 'paid' & decrease ticket quantity
//     app.post("/api/bookings/verify-payment", async (req, res) => {
//       try {
//         const { sessionId, bookingId } = req.body;

//         if (!sessionId || !bookingId) {
//           return res
//             .status(400)
//             .send({
//               success: false,
//               message: "Missing sessionId or bookingId",
//             });
//         }

//         const session = await stripe.checkout.sessions.retrieve(sessionId);

//         if (session.payment_status === "paid") {
//           const filter = { _id: new ObjectId(bookingId) };
          
//           // ১. প্রথমে বুকিং-এর ডিটেইলস ডাটাবেজ থেকে খুঁজে বের করছি
//           const booking = await bookingsCollection.findOne(filter);
          
//           if (!booking) {
//             return res.status(404).send({ success: false, message: "Booking not found" });
//           }

//           // ডাবল পেমেন্ট ভেরিফিকেশন রিকোয়েস্টে ডাবল মাইনাস হওয়া রোধ করতে এই চেক
//           if (booking.status === "paid") {
//             return res.status(400).send({ success: false, message: "Booking is already paid" });
//           }

//           const updateDoc = {
//             $set: {
//               status: "paid",
//               stripeSessionId: sessionId,
//               paidAt: new Date(),
//             },
//           };

//           // ২. বুকিং স্ট্যাটাস 'paid' আপডেট করছি
//           const result = await bookingsCollection.updateOne(filter, updateDoc);

//           if (result.modifiedCount > 0) {
            
//             // ৩. মেইন টিকিট থেকে সিট/কোয়ান্টিটি মাইনাস (বিয়োগ) করার লজিক
//             if (booking.ticketId && booking.quantity) {
//               const ticketFilter = { _id: new ObjectId(booking.ticketId) };
//               const bookedQuantity = parseInt(booking.quantity) || 1;

//               // আপনার অবজেক্টের স্ট্রাকচার অনুযায়ী 'quantity' ফিল্ড আপডেট করা হয়েছে
//               await ticketsCollection.updateOne(ticketFilter, {
//                 $inc: { quantity: -bookedQuantity } 
//               });
//             }

//             res.send({
//               success: true,
//               message: "Payment verified and ticket stock updated successfully",
//             });
//           } else {
//             res
//               .status(404)
//               .send({
//                 success: false,
//                 message: "Booking not found or already paid",
//               });
//           }
//         } else {
//           res
//             .status(400)
//             .send({
//               success: false,
//               message: "Payment verification failed on Stripe",
//             });
//         }
//       } catch (error) {
//         res
//           .status(500)
//           .send({
//             success: false,
//             message: "Failed to update booking status",
//             error: error.message,
//           });
//       }
//     });

//     // Get successful transaction history for a specific user
//     app.get("/api/transactions", async (req, res) => {
//       try {
//         const { email } = req.query;

//         if (!email) {
//           return res
//             .status(400)
//             .send({ message: "Email query parameter is required" });
//         }

//         const query = { userEmail: email, status: "paid" };
//         const result = await bookingsCollection
//           .find(query)
//           .sort({ paidAt: -1 })
//           .toArray();
//         res.send(result);
//       } catch (error) {
//         console.error("Error fetching transactions:", error);
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // ==================== VENDOR API ====================

//     // Add a new ticket
//     app.post("/api/tickets", async (req, res) => {
//       try {
//         const tickets = req.body;
//         const newTickets = {
//           ...tickets,
//           status: "pending", 
//           isAdvertised: false, 
//           createdAt: new Date(),
//         };
//         const result = await ticketsCollection.insertOne(newTickets);
//         res.send(result);
//       } catch (error) {
//         res
//           .status(500)
//           .send({ message: "Failed to add ticket", error: error.message });
//       }
//     });

//     // Get vendor's own tickets
//     app.get("/api/vendor/tickets", async (req, res) => {
//       try {
//         const query = {};
//         if (req.query.email) {
//           query.vendorEmail = req.query.email; 
//         }

//         const cursor = ticketsCollection.find(query).sort({ _id: -1 });
//         const result = await cursor.toArray();
//         res.send(result);
//       } catch (error) {
//         res
//           .status(500)
//           .send({
//             message: "Failed to fetch vendor tickets",
//             error: error.message,
//           });
//       }
//     });

//     // Admin/Vendor-দের নিজস্ব ড্যাশবোর্ডের জন্য সব টিকিট দেখার API
//     app.get("/api/admin/all-tickets", async (req, res) => {
//       try {
//         const cursor = ticketsCollection.find({}).sort({ _id: -1 });
//         const result = await cursor.toArray();
//         res.send(result);
//       } catch (error) {
//         res
//           .status(500)
//           .send({
//             message: "Failed to fetch all tickets",
//             error: error.message,
//           });
//       }
//     });

//     // Update ticket details
//     app.put("/api/tickets/:id", async (req, res) => {
//       try {
//         const id = req.params.id;
//         const filter = { _id: new ObjectId(id) };
//         const updatedTicket = req.body;

//         const { _id, ...updateData } = updatedTicket;

//         const updateDoc = {
//           $set: {
//             ...updateData,
//             updatedAt: new Date(),
//           },
//         };

//         const result = await ticketsCollection.updateOne(filter, updateDoc);

//         if (result.matchedCount === 0) {
//           return res.status(404).send({ message: "Ticket not found" });
//         }
//         res.send(result);
//       } catch (error) {
//         res
//           .status(500)
//           .send({ message: "Failed to update ticket", error: error.message });
//       }
//     });

//     // Delete a ticket
//     app.delete("/api/tickets/:id", async (req, res) => {
//       try {
//         const id = req.params.id;
//         const query = { _id: new ObjectId(id) };
//         const result = await ticketsCollection.deleteOne(query);

//         if (result.deletedCount === 0) {
//           return res.status(404).send({ message: "Ticket not found" });
//         }
//         res.send(result);
//       } catch (error) {
//         res
//           .status(500)
//           .send({ message: "Failed to delete ticket", error: error.message });
//       }
//     });

//     // Fetch all bookings for vendor management
//     app.get("/api/vendor/bookings", async (req, res) => {
//       try {
//         const cursor = bookingsCollection.find({}).sort({ _id: -1 });
//         const result = await cursor.toArray();
//         res.send(result);
//       } catch (error) {
//         console.error("Error fetching vendor bookings:", error);
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // Update booking status (Accept / Reject)
//     app.patch("/api/bookings/:id/status", async (req, res) => {
//       try {
//         const id = req.params.id;
//         const { status } = req.body;

//         if (!["accepted", "rejected"].includes(status)) {
//           return res
//             .status(400)
//             .send({
//               message: "Invalid status type. Must be accepted or rejected.",
//             });
//         }

//         const filter = { _id: new ObjectId(id) };
//         const updateDoc = {
//           $set: { status: status },
//         };

//         const result = await bookingsCollection.updateOne(filter, updateDoc);

//         if (result.modifiedCount > 0) {
//           res.send({
//             success: true,
//             message: `Booking status successfully updated to ${status}`,
//           });
//         } else {
//           res
//             .status(404)
//             .send({
//               success: false,
//               message: "Booking item not found or status went unchanged",
//             });
//         }
//       } catch (error) {
//         console.error("Error updating booking status:", error);
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // Get vendor analytics
//     app.get("/api/vendor/revenue-stats", async (req, res) => {
//       try {
//         const totalTicketsAdded = await ticketsCollection.countDocuments({});
//         const paidBookings = await bookingsCollection
//           .find({ status: "paid" })
//           .toArray();

//         let totalTicketsSold = 0;
//         let totalRevenue = 0;
//         const monthlyDataMap = {};

//         paidBookings.forEach((booking) => {
//           const count = parseInt(booking.quantity) || 1;
//           totalTicketsSold += count;

//           const bookingAmount = parseFloat(booking.totalPrice) || 0;
//           totalRevenue += bookingAmount;

//           const paidDate = booking.paidAt
//             ? new Date(booking.paidAt)
//             : new Date(booking.createdAt);
//           const monthName = paidDate.toLocaleString("default", {
//             month: "short",
//           });

//           if (!monthlyDataMap[monthName]) {
//             monthlyDataMap[monthName] = {
//               name: monthName,
//               revenue: 0,
//               sales: 0,
//             };
//           }
//           monthlyDataMap[monthName].revenue += bookingAmount;
//           monthlyDataMap[monthName].sales += count;
//         });

//         const chartData = Object.values(monthlyDataMap);

//         res.send({
//           totalTicketsAdded,
//           totalTicketsSold,
//           totalRevenue: Number(totalRevenue.toFixed(2)),
//           chartData,
//         });
//       } catch (error) {
//         console.error("Error fetching revenue stats:", error);
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // ==================== ADMIN API ====================

//     // Update ticket status (Approve / Reject)
//     app.patch("/api/tickets/:id/status", async (req, res) => {
//       try {
//         const id = req.params.id;
//         const { status } = req.body;

//         if (!["approved", "rejected"].includes(status)) {
//           return res
//             .status(400)
//             .send({ message: "Invalid status status type" });
//         }

//         const filter = { _id: new ObjectId(id) };
//         const updateDoc = {
//           $set: { status: status },
//         };

//         const result = await ticketsCollection.updateOne(filter, updateDoc);

//         if (result.modifiedCount > 0) {
//           res.send({
//             success: true,
//             message: `Ticket status updated to ${status}`,
//           });
//         } else {
//           res
//             .status(404)
//             .send({
//               success: false,
//               message: "Ticket not found or status unchanged",
//             });
//         }
//       } catch (error) {
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // Toggle Ticket Advertisement Status (Limit: Max 6)
//     app.patch("/api/tickets/:id/advertise", async (req, res) => {
//       try {
//         const id = req.params.id;
//         const { isAdvertised } = req.body;

//         if (typeof isAdvertised !== "boolean") {
//           return res
//             .status(400)
//             .send({ message: "Invalid advertisement status type" });
//         }

//         if (isAdvertised) {
//           const advertisedCount = await ticketsCollection.countDocuments({
//             isAdvertised: true,
//           });
//           if (advertisedCount >= 6) {
//             return res.status(400).send({
//               success: false,
//               message:
//                 "Limit reached! You cannot advertise more than 6 tickets at a time.",
//             });
//           }
//         }

//         const filter = { _id: new ObjectId(id), status: "approved" };
//         const updateDoc = {
//           $set: { isAdvertised: isAdvertised },
//         };

//         const result = await ticketsCollection.updateOne(filter, updateDoc);

//         if (result.modifiedCount > 0) {
//           res.send({
//             success: true,
//             message: isAdvertised
//               ? "Ticket added to advertisements"
//               : "Ticket removed from advertisements",
//           });
//         } else {
//           res.status(404).send({
//             success: false,
//             message:
//               "Ticket not found, not approved, or advertisement status unchanged",
//           });
//         }
//       } catch (error) {
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // Get overview metrics for admin dashboard
//     app.get("/api/admin/stats", async (req, res) => {
//       try {
//         let totalBookings = 0;
//         try {
//           totalBookings = await bookingsCollection.countDocuments({});
//         } catch (err) {
//           console.error("Error counting bookings:", err);
//         }

//         let activeBuses = 0;
//         try {
//           activeBuses = await ticketsCollection.countDocuments({
//             status: "approved",
//           });
//         } catch (err) {
//           console.error("Error counting active buses:", err);
//         }

//         let totalUsers = 0;
//         try {
//           const uniqueUsersArray =
//             await bookingsCollection.distinct("userEmail");
//           totalUsers = uniqueUsersArray.length;
//         } catch (err) {
//           console.error("Error counting distinct users:", err);
//           totalUsers = totalBookings;
//         }

//         res.send({
//           totalBookings,
//           totalUsers,
//           activeBuses,
//         });
//       } catch (error) {
//         console.error("Global Admin Stats Error:", error);
//         res
//           .status(500)
//           .send({ message: "Internal server error", error: error.message });
//       }
//     });

//     // MongoDB connection verification ping
//     await client.db("admin").command({ ping: 1 });
//     console.log(
//       "Pinged your deployment. You successfully connected to MongoDB!",
//     );
//   } finally {
//     // client.close() is omitted to keep connection alive
//   }
// }
// run().catch(console.dir);

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`);
// });

// module.exports = app;

require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  maxPoolSize: 10,
});

let cachedDb = null;
async function getDb() {
  if (cachedDb) return cachedDb;
  await client.connect();
  cachedDb = client.db("ticketbari_db");
  return cachedDb;
}

app.get("/", (req, res) => res.send("TicketBari Server is Running!"));

// --- সব রাউটস ---

app.get("/api/tickets", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").find({ status: "approved" }).toArray();
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});


app.get("/api/tickets/:id", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").findOne({ _id: new ObjectId(req.params.id) });
    res.send(result || { message: "Not found" });
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/advertised-tickets", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").find({ isAdvertised: true, status: "approved" }).toArray();
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const db = await getDb();
    const booking = req.body;
    const ticket = await db.collection("tickets").findOne({ _id: new ObjectId(booking.ticketId) });
    if (!ticket || ticket.status !== "approved" || ticket.quantity < (parseInt(booking.quantity) || 1)) {
      return res.status(400).send({ message: "Invalid ticket or out of stock" });
    }
    const result = await db.collection("booking").insertOne({ ...booking, status: "pending", createdAt: new Date() });
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/bookings", async (req, res) => {
  try {
    const db = await getDb();
    const query = req.query.userId ? { userId: req.query.userId } : {};
    const result = await db.collection("booking").find(query).sort({ _id: -1 }).toArray();
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.post("/api/checkout", async (req, res) => {
  try {
    const { bookingId, amount, email } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `https://ticket-barii.vercel.app/dashboard/user/payment/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
      cancel_url: `https://ticket-barii.vercel.app/user/payment/cancel`,
      line_items: [{ price_data: { currency: "usd", product_data: { name: `Booking #${bookingId.substring(0, 8)}` }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
      customer_email: email,
    });
    res.send({ url: session.url });
  } catch (e) { res.status(500).send(e.message); }
});

app.post("/api/bookings/verify-payment", async (req, res) => {
  try {
    const db = await getDb();
    const { sessionId, bookingId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      const booking = await db.collection("booking").findOne({ _id: new ObjectId(bookingId) });
      if (booking.status !== "paid") {
        await db.collection("booking").updateOne({ _id: new ObjectId(bookingId) }, { $set: { status: "paid", paidAt: new Date() } });
        await db.collection("tickets").updateOne({ _id: new ObjectId(booking.ticketId) }, { $inc: { quantity: -parseInt(booking.quantity) } });
      }
      res.send({ success: true });
    }
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/transactions", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("booking").find({ userEmail: req.query.email, status: "paid" }).sort({ paidAt: -1 }).toArray();
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.post("/api/tickets", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").insertOne({ ...req.body, status: "pending", isAdvertised: false, createdAt: new Date() });
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/vendor/tickets", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").find({ vendorEmail: req.query.email }).sort({ _id: -1 }).toArray();
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/admin/all-tickets", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").find({}).sort({ _id: -1 }).toArray();
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.put("/api/tickets/:id", async (req, res) => {
  try {
    const db = await getDb();
    const { _id, ...data } = req.body;
    const result = await db.collection("tickets").updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...data, updatedAt: new Date() } });
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.delete("/api/tickets/:id", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/vendor/bookings", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("booking").find({}).sort({ _id: -1 }).toArray();
    res.send(result);
  } catch (e) { res.status(500).send(e.message); }
});

app.patch("/api/bookings/:id/status", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("booking").updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: req.body.status } });
    res.send({ success: true });
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/vendor/revenue-stats", async (req, res) => {
  try {
    const db = await getDb();
    const paidBookings = await db.collection("booking").find({ status: "paid" }).toArray();
    let totalTicketsSold = 0;
    let totalRevenue = 0;
    paidBookings.forEach(b => { totalTicketsSold += (parseInt(b.quantity) || 1); totalRevenue += parseFloat(b.totalPrice) || 0; });
    res.send({ totalTicketsSold, totalRevenue: Number(totalRevenue.toFixed(2)) });
  } catch (e) { res.status(500).send(e.message); }
});

app.patch("/api/tickets/:id/status", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: req.body.status } });
    res.send({ success: true });
  } catch (e) { res.status(500).send(e.message); }
});

app.patch("/api/tickets/:id/advertise", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("tickets").updateOne({ _id: new ObjectId(req.params.id) }, { $set: { isAdvertised: req.body.isAdvertised } });
    res.send({ success: true });
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/admin/stats", async (req, res) => {
  try {
    const db = await getDb();
    res.send({
      totalBookings: await db.collection("booking").countDocuments({}),
      totalUsers: (await db.collection("booking").distinct("userEmail")).length,
      activeBuses: await db.collection("tickets").countDocuments({ status: "approved" })
    });
  } catch (e) { res.status(500).send(e.message); }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
module.exports = app;