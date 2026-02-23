const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Improve mongoose debug & connection handling
mongoose.set('strictQuery', false);

// Express routes and middleware
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/incidents', require('./routes/incidentRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

app.use('/api/threat-reports', require('./routes/threatReportRoutes'));
app.use('/api/cases', require('./routes/caseRoutes'));
app.use('/api/assignment', require('./routes/assignmentRoutes'));

app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/ranger', require('./routes/rangerRoutes'));

// Resource & Staff management routes (commented out for testing)
// app.use('/api/staff', require('./routes/resourceStaff/staffRoutes'));
// app.use('/api/resources', require('./routes/resourceStaff/resourceRoutes'));

// Basic Route
app.get('/', (req, res) => {
    res.send('WildSafe API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled route error:', err.stack || err);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

module.exports = app;
