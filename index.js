const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@smart-home.zmw9aso.mongodb.net/?retryWrites=true&w=majority&appName=Smart-Home`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let usersCollection;
let servicesCollection;
let decoratorsCollection;


async function run() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB!");
        
        const database = client.db("smart-home-db");
        usersCollection = database.collection("users");
        servicesCollection = database.collection("Dynamic_Services");
        decoratorsCollection = database.collection("decorators");
        
        console.log("📁 Database collections ready");
        
    } catch (error) {
        console.error("❌ MongoDB Error:", error);
    }
}
run();

app.get('/', (req, res) => {
    res.json({ 
        message: 'Smart Home Server is Running!',
        status: 'OK'
    });
});

app.get('/test', async (req, res) => {
    try {
        const result = await usersCollection.find({}).limit(1).toArray();
        res.json({ 
            success: true, 
            message: 'MongoDB is working',
            data: result 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/users', async (req, res) => {
    try {
        const userData = req.body;
        
        const existingUser = await usersCollection.findOne({ email: userData.email });
        
        if (existingUser) {
            const result = await usersCollection.updateOne(
                { email: userData.email },
                { 
                    $set: { 
                        ...userData,
                        updatedAt: new Date()
                    }
                }
            );
            
            return res.json({
                success: true,
                message: 'User updated',
                userId: existingUser._id
            });
        } else {
            const newUser = {
                ...userData,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await usersCollection.insertOne(newUser);
            
            return res.json({
                success: true,
                message: 'User created',
                userId: result.insertedId
            });
        }
        
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error' 
        });
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await usersCollection.find({}).toArray();
        res.json({
            success: true,
            count: users.length,
            users: users
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/services', async (req, res) => {
    try {
        const services = await servicesCollection.find({}).toArray();
        res.json(services);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

app.get('/api/decorators/top', async (req, res) => {
    try {
        const database = client.db("smart-home-db");
        const decorators = await database.collection("decorators")
            .find({})
            .toArray();
        
        const topDecorators = decorators
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 4);
        
        res.json(topDecorators);
    } catch (error) {
        console.error('Error fetching decorators:', error);
        res.status(500).json({ 
            error: 'Failed to fetch decorators',
            message: error.message 
        });
    }
});

app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Route not found' 
    });
});

app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});