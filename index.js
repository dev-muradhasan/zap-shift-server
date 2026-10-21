require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const crypto = require('crypto');

const generateTrackingId = () => {
    const date = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');

    const uniqueCode = crypto.randomBytes(3)
        .toString('hex')
        .toUpperCase();

    return `ZS-${date}-${uniqueCode}`;
};

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
        const parcelsCollection = db.collection('parcels');
        const paymentCollection = db.collection('payments');

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
                    parcelId : paymentInfo.parcelId,
                    parcelName: paymentInfo.parcelName,
                    receiverName: paymentInfo.receiverName,
                    receiverAddress: paymentInfo.receiverAddress,
                    receiverPhnNb: paymentInfo.receiverPhnNb,
                },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
            })
            res.send({url: session.url})
        })

        app.patch('/payment-success', async(req, res)=>{
            const sessionId = req.query.session_id;
            const trackingId = generateTrackingId();
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            console.log(session);
            const transactionId = session.payment_intent;
            const query = {transactionId: transactionId};
            const paymentExist = await paymentCollection.findOne(query);
            if(paymentExist){
                return res.send({ 
                    message: 'already exist', 
                    transactionId, 
                    trackingId: paymentExist.trackingId, 
                    paidAt: new Date(), 
                    amount: session.amount_total / 100 
                })
            }

            if (session.payment_status === "paid"){
                const id = session.metadata.parcelId;
                const query = {_id: new ObjectId(id)};
                const update = {
                    $set: {
                        paymentStatus: "paid",
                        trackingId: trackingId
                    }
                }
                const result = await parcelsCollection.updateOne(query, update);
                const paymentInfo = {
                    amount: session.amount_total/100,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    parcelId: session.metadata.parcelId,
                    parcelName: session.metadata.parcelName,
                    transactionId: session.payment_intent,
                    paymentStatus: session.payment_status,
                    receiverName: session.metadata.receiverName,
                    receiverAddress: session.metadata.receiverAddress,
                    receiverPhnNb: session.metadata.receiverPhnNb,
                    paidAt: new Date(),
                    trackingId: trackingId,
                }
                if(session.payment_status === 'paid'){
                    const paymentResult = await paymentCollection.insertOne(paymentInfo);
                    res.send({ 
                        success: true, 
                        amount: session.amount_total / 100,
                        trackingId: trackingId, 
                        transactionId: session.payment_intent, 
                        modifyParcel: result, 
                        paymentInfo: paymentResult,
                        paidAt: new Date(),
                    })
                }
            }
            res.send({success: false})
        })

        app.get('/payments', async(req, res)=>{
            const email = req.query.email;
            const query = {};
            if(email){
                query.customerEmail = email;
            };
            const options = { sort: { paidAt: -1 } };
            const result = await paymentCollection.find(query, options).toArray();
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
