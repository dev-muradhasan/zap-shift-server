require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRET);

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
            const options = { sort: { createdAt: -1 } };
            const result = await parcelsCollection.find(query, options).toArray();
            res.send(result)
        })

        app.get('/parcels/:id', async(req, res)=>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const result = await parcelsCollection.findOne(query);
            res.send(result)
        })

        app.post('/parcels', async(req, res)=>{
            const parcel = req.body;
            parcel.createdAt = new Date();
            const result = await parcelsCollection.insertOne(parcel);
            res.send(result)
        })

        app.delete('/parcels/:id', async(req, res)=>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const result = await parcelsCollection.deleteOne(query);
            res.send(result);
        })

        //payment related api
        app.post('/create-checkout-session', async (req, res) =>{
            const paymentInfo = req.body;
            const amount = parseInt(paymentInfo.cost) * 100;

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'USD',
                            unit_amount: amount,
                            product_data: {
                                name:`Please pay for ${paymentInfo.parcelName}`
                            }
                        },
                        quantity: 1,
                    },
                ],
                customer_email: paymentInfo.senderEmail,
                mode: 'payment',
                metadata: {
                    parcelId : paymentInfo.parcelId
                },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
            })
            res.send({url: session.url})
        })


.
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
