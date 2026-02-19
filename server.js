const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Improve mongoose debug & connection handling
mongoose.set('strictQuery', false);

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Express routes and middleware registered after DB connection
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/incidents', require('./routes/incidentRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));


app.use('/api/threat-reports', require('./routes/threatReportRoutes'));
app.use('/api/cases', require('./routes/caseRoutes'));
app.use('/api/assignment', require('./routes/assignmentRoutes'));

app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/ranger', require('./routes/rangerRoutes'));

// Resource & Staff management routes (centralized under routes/resourceStaff)
app.use('/api/staff', require('./routes/resourceStaff/staffRoutes'));
app.use('/api/resources', require('./routes/resourceStaff/resourceRoutes'));

// Basic Route
app.get('/', (req, res) => {
    res.send('WildSafe API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled route error:', err.stack || err);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start server only after successful DB connection
const startServer = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('MongoDB connection error:', err);
        // exit so process manager can restart or you can fix the URI
        process.exit(1);
    }
};

startServer();
