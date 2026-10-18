require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const uri = process.env.MONGODB_URI;
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

        const db = client.db('zap_shift_db');
        const parcelsCollection = db.collection('parcels')

        // parcel api
        app.get('/parcels', async(req, res)=>{
            const query = {};
            const {email} = req.query;
            if(email){
                query.senderEmail = email;
            }
            const result = await parcelsCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/parcels', async(req, res)=>{
            const parcel = req.body;
            const result = await parcelsCollection.insertOne(parcel);
            res.send(result)
        })

        console.log("Connected to MongoDB");
    } catch (error) {
        console.error(error);
    }
}

run();

app.get('/', (req, res) => {
  res.send('zap is shifting shifting!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
