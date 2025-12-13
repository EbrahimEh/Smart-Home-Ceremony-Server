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
let bookingsCollection;

async function run() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB!");
        
        const database = client.db("smart-home-db");
        usersCollection = database.collection("users");
        servicesCollection = database.collection("Dynamic_Services");
        decoratorsCollection = database.collection("decorators");
        bookingsCollection = database.collection("bookings");
        
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


app.get('/api/services/:id', async (req, res) => {
    try {
        const serviceId = req.params.id;
        
        console.log('🔍 Fetching service with ID:', serviceId);
        console.log('ID type:', typeof serviceId);
        console.log('ID length:', serviceId.length);
        
        let service;
        
        
        if (ObjectId.isValid(serviceId)) {
           
            if (serviceId.length === 24) {
                console.log('Trying as ObjectId...');
                service = await servicesCollection.findOne({
                    _id: new ObjectId(serviceId)
                });
                console.log('Found with ObjectId:', service ? 'Yes' : 'No');
            }
        }
        

        if (!service) {
            console.log('Trying as string ID...');
            service = await servicesCollection.findOne({
                _id: serviceId
            });
            console.log('Found with string ID:', service ? 'Yes' : 'No');
        }
        

        if (!service) {
            console.log('❌ Service not found');
            

            const sampleServices = await servicesCollection.find({})
                .limit(5)
                .project({ _id: 1, service_name: 1 })
                .toArray();
            
            console.log('Sample services in DB:', sampleServices);
            
            return res.status(404).json({ 
                error: 'Service not found',
                requestedId: serviceId,
                requestedIdType: typeof serviceId,
                sampleServices: sampleServices.map(s => ({
                    id: s._id,
                    idType: s._id.constructor.name,
                    name: s.service_name
                }))
            });
        }
        
        console.log('✅ Service found:', service.service_name);
        

        const responseService = { ...service };
        if (responseService._id && responseService._id.toString) {
            responseService._id = responseService._id.toString();
        }
        
        res.json(responseService);
        
    } catch (error) {
        console.error('❌ Error fetching service:', error);
        res.status(500).json({ 
            error: 'Failed to fetch service', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});


app.get('/api/services', async (req, res) => {
    try {
        console.log('📋 Fetching all services...');
        const services = await servicesCollection.find({}).toArray();
        console.log(`✅ Found ${services.length} services`);
     

        const formattedServices = services.map(service => ({
            ...service,
            _id: service._id.toString ? service._id.toString() : service._id
        }));
        
        res.json(formattedServices);
    } catch (error) {
        console.error('❌ Error fetching services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
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

// Decorators
app.get('/api/decorators/top', async (req, res) => {
    try {
        const topDecorators = await decoratorsCollection
            .find({})
            .sort({ rating: -1 })
            .limit(4)
            .toArray();
        
        res.json(topDecorators);
    } catch (error) {
        console.error('Error fetching decorators:', error);
        res.status(500).json({ 
            error: 'Failed to fetch decorators',
            message: error.message 
        });
    }
});


app.get('/api/services/categories', async (req, res) => {
    try {
        const categories = await servicesCollection.distinct("category");
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Bookings
app.post('/api/bookings', async (req, res) => {
    try {
        const bookingData = req.body;
        console.log('Booking data received:', bookingData);
    
        const requiredFields = ['serviceId', 'userId', 'date', 'location', 'contactNumber'];
        for (const field of requiredFields) {
            if (!bookingData[field]) {
                return res.status(400).json({
                    success: false,
                    error: `Missing required field: ${field}`
                });
            }
        }
        

        let service = await servicesCollection.findOne({
            _id: bookingData.serviceId
        });
        
        if (!service && ObjectId.isValid(bookingData.serviceId)) {
            service = await servicesCollection.findOne({
                _id: new ObjectId(bookingData.serviceId)
            });
        }
        
        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
            });
        }
        
        const booking = {
            ...bookingData,
            serviceName: service.service_name,
            serviceCost: service.cost,
            serviceCategory: service.category,
            serviceUnit: service.unit,
            status: 'pending',
            paymentStatus: 'unpaid',
            createdAt: new Date(),
            updatedAt: new Date(),
            bookingCode: `BK${Date.now()}${Math.floor(Math.random() * 1000)}`
        };
        
        const result = await bookingsCollection.insertOne(booking);
        
        res.json({
            success: true,
            message: 'Booking created successfully',
            bookingId: result.insertedId,
            bookingCode: booking.bookingCode,
            data: {
                ...booking,
                _id: result.insertedId
            }
        });
        
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create booking',
            details: error.message 
        });
    }
});


app.get('/api/bookings/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const bookings = await bookingsCollection.find({
            userId: userId
        }).sort({ createdAt: -1 }).toArray();
        
    
        const formattedBookings = bookings.map(booking => ({
            ...booking,
            _id: booking._id.toString ? booking._id.toString() : booking._id
        }));
        
        res.json({
            success: true,
            count: formattedBookings.length,
            data: formattedBookings
        });
        
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bookings'
        });
    }
});

app.get('/api/bookings/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        
        let booking = await bookingsCollection.findOne({
            _id: bookingId
        });
        
        if (!booking && ObjectId.isValid(bookingId)) {
            booking = await bookingsCollection.findOne({
                _id: new ObjectId(bookingId)
            });
        }
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }
        

        if (booking._id && booking._id.toString) {
            booking._id = booking._id.toString();
        }
        
        res.json({
            success: true,
            data: booking
        });
        
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch booking'
        });
    }
});

app.patch('/api/bookings/:id/status', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'confirmed', 'assigned', 'in-progress', 'completed', 'cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }
        
        let result;
        result = await bookingsCollection.updateOne(
            { _id: bookingId },
            { 
                $set: { 
                    status: status,
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.modifiedCount === 0 && ObjectId.isValid(bookingId)) {
            result = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                { 
                    $set: { 
                        status: status,
                        updatedAt: new Date()
                    }
                }
            );
        }
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found or status unchanged'
            });
        }
        
        res.json({
            success: true,
            message: `Booking status updated to ${status}`
        });
        
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update booking status'
        });
    }
});


app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        
        let result;
        result = await bookingsCollection.updateOne(
            { _id: bookingId },
            { 
                $set: { 
                    status: 'cancelled',
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.modifiedCount === 0 && ObjectId.isValid(bookingId)) {
            result = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                { 
                    $set: { 
                        status: 'cancelled',
                        updatedAt: new Date()
                    }
                }
            );
        }
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Booking cancelled successfully'
        });
        
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel booking'
        });
    }
});

app.get('/api/payment-test', (req, res) => {
    res.json({
        success: true,
        message: 'Payment API is working',
        timestamp: new Date().toISOString()
    });
});

app.patch('/api/bookings/:id/payment', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { paymentStatus, paymentMethod, transactionId } = req.body;
        
        console.log('Updating payment for booking:', bookingId);
        
        const validPaymentStatuses = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];
        
        if (!validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment status'
            });
        }
        
        let result;
        result = await bookingsCollection.updateOne(
            { _id: bookingId },
            { 
                $set: { 
                    paymentStatus: paymentStatus,
                    paymentMethod: paymentMethod,
                    transactionId: transactionId,
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.modifiedCount === 0 && ObjectId.isValid(bookingId)) {
            result = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                { 
                    $set: { 
                        paymentStatus: paymentStatus,
                        paymentMethod: paymentMethod,
                        transactionId: transactionId,
                        updatedAt: new Date()
                    }
                }
            );
        }
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }
        
        res.json({
            success: true,
            message: `Payment status updated to ${paymentStatus}`
        });
        
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update payment status'
        });
    }
});

app.post('/api/bookings/:id/complete-payment', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { paymentMethod, transactionId } = req.body;
        
        console.log('Completing payment for booking:', bookingId);
        
        let result;
        result = await bookingsCollection.updateOne(
            { _id: bookingId },
            { 
                $set: { 
                    paymentStatus: 'paid',
                    status: 'confirmed',
                    paymentMethod: paymentMethod || 'manual',
                    transactionId: transactionId || `MANUAL_${Date.now()}`,
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.modifiedCount === 0 && ObjectId.isValid(bookingId)) {
            result = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                { 
                    $set: { 
                        paymentStatus: 'paid',
                        status: 'confirmed',
                        paymentMethod: paymentMethod || 'manual',
                        transactionId: transactionId || `MANUAL_${Date.now()}`,
                        updatedAt: new Date()
                    }
                }
            );
        }
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Payment completed successfully'
        });
        
    } catch (error) {
        console.error('Error completing payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete payment'
        });
    }
});

app.get('/api/user/:userId/payments', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const bookings = await bookingsCollection.find({
            userId: userId,
            paymentStatus: 'paid'
        }).sort({ updatedAt: -1 }).toArray();
        
       
        const formattedBookings = bookings.map(booking => ({
            ...booking,
            _id: booking._id.toString ? booking._id.toString() : booking._id
        }));
        
        res.json({
            success: true,
            count: formattedBookings.length,
            data: formattedBookings
        });
        
    } catch (error) {
        console.error('Error fetching user payments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payments'
        });
    }
});


app.post('/api/simulate-payment', async (req, res) => {
    try {
        const { bookingId } = req.body;
        
        if (!bookingId) {
            return res.status(400).json({
                success: false,
                error: 'bookingId is required'
            });
        }
        
        console.log('Simulating payment for booking:', bookingId);
        
        let result;
        result = await bookingsCollection.updateOne(
            { _id: bookingId },
            { 
                $set: { 
                    paymentStatus: 'paid',
                    status: 'confirmed',
                    paymentMethod: 'test',
                    transactionId: `TEST_${Date.now()}`,
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.modifiedCount === 0 && ObjectId.isValid(bookingId)) {
            result = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                { 
                    $set: { 
                        paymentStatus: 'paid',
                        status: 'confirmed',
                        paymentMethod: 'test',
                        transactionId: `TEST_${Date.now()}`,
                        updatedAt: new Date()
                    }
                }
            );
        }
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Payment simulated successfully',
            transactionId: `TEST_${Date.now()}`
        });
        
    } catch (error) {
        console.error('Error simulating payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to simulate payment'
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


module.exports = app;