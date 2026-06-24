const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;

require("dotenv").config();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // save data
    const database = client.db("ticketbari_db");
    const ticketsCollection = database.collection("tickets");
    const bookingsCollection = database.collection("booking");

    // vendor-----
    // find tickets
    app.get(`/api/tickets`, async (req, res) => {
      try {
        const cursor = ticketsCollection.find({});
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed data fetching", error });
      }
    });

    // find ticket by id
    app.get("/api/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await ticketsCollection.findOne(query);
      res.send(result);
    });

    // added tickets
    app.post("/api/tickets", async (req, res) => {
      const tickets = req.body;
      const newTickets = {
        ...tickets,
        createdAt: new Date(),
      };
      const result = await ticketsCollection.insertOne(newTickets);
      res.send(result);
    });

    // booking
    // get api
    // app.get('/api/bookings', async(req, res)=>{
    //   const query = {};
    //   if(req.query.userId){
    //     query.userId = req.query.userId;
    //   }
    //   const cursor = bookingsCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // })

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

    // post api
    app.post("/api/bookings", async (req, res) => {
      const bookings = req.body;
      const newBookings = {
        ...bookings,
        createdAt: new Date(),
      };
      const result = await bookingsCollection.insertOne(newBookings);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
