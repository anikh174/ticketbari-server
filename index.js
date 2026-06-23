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

const { MongoClient, ServerApiVersion } = require("mongodb");
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

    // vendor-----
    // find tickets
    app.get(`/api/tickets`, async (req, res) => {
      try {
        const cursor = ticketsCollection.find({});
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "failed data fetching", error });
      }
    });

    // added tickets
    app.post("/api/tickets", async (req, res) => {
      const tickets = req.body;
      const result = await ticketsCollection.insertOne(tickets);
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
