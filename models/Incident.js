const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        required: true
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    changedAt: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        trim: true
    }
}, { _id: false });

const incidentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['ILLEGAL_LOGGING', 'FOREST_FIRE', 'POACHING', 'ANIMAL_CONFLICT', 'TRAPPED_INJURED_ANIMAL', 'OTHER'],
        required: true
    },
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    location: {
        lat: { 
            type: Number, 
            required: true,
            min: -90,
            max: 90,
            validate: {
                validator: function(v) {
                    return !isNaN(v) && v >= -90 && v <= 90;
                },
                message: 'Latitude must be between -90 and 90'
            }
        },
        lng: { 
            type: Number, 
            required: true,
            min: -180,
            max: 180,
            validate: {
                validator: function(v) {
                    return !isNaN(v) && v >= -180 && v <= 180;
                },
                message: 'Longitude must be between -180 and 180'
            }
        },
        address: { type: String }
    },
    photos: [{
        type: String // URLs to photos
    }],
    status: {
        type: String,
        enum: ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        default: 'SUBMITTED'
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // New fields for enhanced reporting
    urgencyLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    estimatedTime: {
        type: Date
    },
    contactInfo: {
        phone: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true }
    },
    additionalNotes: {
        type: String,
        trim: true
    },
    // Status history tracking
    statusHistory: [statusHistorySchema],
    // Integration with Wildlife Threat & Case Management module
    forwardedTo: {
        type: String,
        trim: true
    },
    forwardedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to update updatedAt timestamp
incidentSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Middleware to automatically add status to history when status changes
incidentSchema.pre('save', function (next) {
    if (this.isModified('status') && !this.isNew) {
        // If statusHistory doesn't exist or is empty, initialize it
        if (!this.statusHistory || this.statusHistory.length === 0) {
            this.statusHistory = [{
                status: this.status,
                changedAt: new Date()
            }];
        } else {
            // Add new status to history
            this.statusHistory.push({
                status: this.status,
                changedAt: new Date()
            });
        }
    }
    next();
});

module.exports = mongoose.model('Incident', incidentSchema);
