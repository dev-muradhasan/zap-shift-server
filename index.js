require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const crypto = require('crypto');

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const firebaseKey = require('./zap-shift-firebase-verify-token.json');

if (!firebaseKey) {
    throw new Error('FIREBASE_SERVICE_KEY is missing');
}
if (getApps().length === 0) {
    initializeApp({
        credential: cert(firebaseKey)
    })
}

const verifyFBToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({
            message: 'unauthorized access'
        });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).send({
            message: 'unauthorized access'
        });
    }

    try {
        const userInfo = await getAuth().verifyIdToken(token)
        console.log('Token verified:', userInfo.email);
        req.user = userInfo;
        next();
    } catch (error) {
        console.log('Firebase Token Error:', error.message);
        return res.status(401).send({
            message: 'unauthorized access'
        });
    }
}


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
        const userCollection = db.collection('users');
        const ridersCollection = db.collection('riders');
        const parcelsCollection = db.collection('parcels');
        const paymentCollection = db.collection('payments');
        await paymentCollection.createIndex(
            { transactionId: 1 },
            { unique: true }
        );

        // verify admin 
        const verifyAdmin = async(req, res, next)=>{
            const email = req.user.email;
            const query = {email};
            const user = await userCollection.findOne(query);
            if(!user || user.role !== 'admin'){
                res.status(403).send({message: 'forbidden access'})
            }
            next();
        }

        // user related api
        app.get('/users', verifyFBToken, async(req, res)=>{
            const result = await userCollection.find().sort({createdAt: -1}).toArray();
            res.send(result)
        })

        app.get('/users/check', verifyFBToken, async (req, res) => {
            try {
                const email = req.user?.email;
                if (!email) {
                    return res.status(401).send({
                        message: 'Email not found in token'
                    });
                }
                const user = await userCollection.findOne({ email });
                res.send({ exists: !!user });
            } catch (error) {
                console.error('GET /users error:', error);
                res.status(500).send({
                    message: 'Failed to check user'
                });
            }
        });
        
        app.get('/users/:id', async(req, res)=>{})

        app.get('/users/:email/role', verifyFBToken, async(req, res)=>{
            const email = req.params.email;
            const query = {email};
            const user = await userCollection.findOne(query);
            res.send({role: user?.role || 'user'})
        })

        app.post('/users', verifyFBToken, async (req, res) => {
            const userInfo = req.body;
            if (req.user?.email !== userInfo.email) {
                return res.status(403).send({ message: 'Forbidden access' });
            }
            const existingUser = await userCollection.findOne({
                email: userInfo.email,
            });
            if (existingUser) {
                return res.send({
                    message: 'User already exists',
                    inserted: false,
                });
            }
            userInfo.createdAt = new Date();
            userInfo.role = 'user';
            const result = await userCollection.insertOne(userInfo);
            res.send({
                message: 'User created successfully',
                inserted: true,
                insertedId: result.insertedId,
            });
        });

        app.patch('/users/:id/role', verifyFBToken, verifyAdmin, async (req, res)=>{
            const roleInfo = req.body;
            const id = req.params.id;
            const updateDoc = {
                $set : {
                    role: roleInfo.role
                }
            }
            const result = await userCollection.updateOne({ _id: new ObjectId(id) }, updateDoc)
            res.send(result)
        })

        // rider related api
        app.post('/riders', verifyFBToken, async (req, res) => {
            const rider = req.body;
            rider.status = 'pending';
            rider.createdAt = new Date();
            const result = await ridersCollection.insertOne(rider);
            res.send(result)
        })

        app.get('/riders', verifyFBToken, async (req, res) => {
            const query = {};
            if (req.query.status) {
                query.status = req.query.status
            }
            const result = await ridersCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/riders/:id', verifyFBToken, async (req, res)=>{
            const id = req.params.id;
            const result = await ridersCollection.findOne({_id: new ObjectId(id)});
            if (!result) {
                return res.status(404).send({
                    message: "Rider not found",
                });
            }
            res.send(result)
        })

        app.patch('/riders/:id', verifyFBToken, verifyAdmin, async (req, res) => {
            const status = req.body.status;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: status
                }
            }
            const result = await ridersCollection.updateOne(query, updateDoc);
            if (status === 'approved') {
                const email = req.body.email;
                const userQuery = {email};
                const updateUser = {
                    $set : {
                        role: 'rider'
                    }
                }
                const userResult = await userCollection.updateOne(userQuery, updateUser);
            } else if(status === 'rejected') {
                const email = req.body.email;
                const userQuery = { email };
                const updateUser = {
                    $set: {
                        role: 'user'
                    }
                }
                const userResult = await userCollection.updateOne(userQuery, updateUser);
            }
            res.send(result)
        })

        app.delete('/riders/:id', verifyFBToken, async (req, res)=>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const result = await ridersCollection.deleteOne(query);
            res.send(result);
        })

        // parcel api
        app.get('/parcels', verifyFBToken, async (req, res) => {
            const query = {};
            const { email } = req.query;
            if (email) {
                query.senderEmail = email;
                if (email !== req.user.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }
            }
            const options = { sort: { createdAt: -1 } };
            const result = await parcelsCollection.find(query, options).toArray();
            res.send(result)
        })

        app.get("/parcels/:id",  async (req, res) => {
            const { id } = req.params;
            const parcel = await parcelsCollection.findOne({
                _id: new ObjectId(id),
            });
            if (!parcel) {
                return res.status(404).send({
                    message: "Parcel not found",
                });
            }
            res.send(parcel);
        });

        app.post('/parcels', async (req, res) => {
            const parcel = req.body;
            parcel.createdAt = new Date();
            const result = await parcelsCollection.insertOne(parcel);
            res.send(result)
        })

        app.delete('/parcels/:id', async (req, res) => {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({
                    message: 'Invalid parcel ID'
                });
            }
            const query = { _id: new ObjectId(id) };
            const result = await parcelsCollection.deleteOne(query);
            res.send(result);
        })

        //payment related api
        app.post('/create-checkout-session', verifyFBToken, async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt(paymentInfo.cost) * 100;

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'USD',
                            unit_amount: amount,
                            product_data: {
                                name: `Please pay for ${paymentInfo.parcelName}`
                            }
                        },
                        quantity: 1,
                    },
                ],
                customer_email: paymentInfo.senderEmail,
                mode: 'payment',
                metadata: {
                    parcelId: paymentInfo.parcelId,
                    parcelName: paymentInfo.parcelName,
                    receiverName: paymentInfo.receiverName,
                    receiverAddress: paymentInfo.receiverAddress,
                    receiverPhnNb: paymentInfo.receiverPhnNb,
                },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
            })
            res.send({ url: session.url })
        })

        app.patch('/payment-success', verifyFBToken, async (req, res) => {
            const sessionId = req.query.session_id;
            const trackingId = generateTrackingId();
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            // console.log(session);
            const transactionId = session.payment_intent;
            const query = { transactionId: transactionId };
            const paymentExist = await paymentCollection.findOne(query);
            if (paymentExist) {
                return res.send({
                    message: 'already exist',
                    transactionId,
                    trackingId: paymentExist.trackingId,
                    paidAt: new Date(),
                    amount: session.amount_total / 100
                })
            }

            if (session.payment_status === "paid") {
                const id = session.metadata.parcelId;
                const query = { _id: new ObjectId(id) };
                const update = {
                    $set: {
                        paymentStatus: "paid",
                        trackingId: trackingId
                    }
                }
                const result = await parcelsCollection.updateOne(query, update);
                const paymentInfo = {
                    amount: session.amount_total / 100,
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
                if (session.payment_status === 'paid') {
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
            res.send({ success: false })
        })

        app.get('/payments', verifyFBToken, async (req, res) => {
            const email = req.query.email;
            console.log(req.headers);
            const query = {};
            if (email) {
                query.customerEmail = email;
                if (email !== req.user.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }
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
