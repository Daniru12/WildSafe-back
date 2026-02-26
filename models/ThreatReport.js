const mongoose = require('mongoose');

const threatReportSchema = new mongoose.Schema({
    reportId: {
        type: String,
        unique: true,
        required: true
    },
    threatType: {
        type: String,
        enum: ['POACHING', 'FOREST_FIRE', 'INJURED_ANIMAL', 'ILLEGAL_LOGGING', 'HUMAN_WILDLIFE_CONFLICT', 'OTHER'],
        required: true
    },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String, required: true }
    },
    dateTime: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    reporterInfo: {
        name: { type: String, required: true },
        email: { type: String },
        phone: { type: String },
        isAnonymous: { type: Boolean, default: false }
    },
    media: [{
        url: { type: String, required: true }, // URL or blob URL
        mediaType: {
            type: String,
            enum: ['IMAGE', 'VIDEO'],
            default: 'IMAGE'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['PENDING', 'VALIDATED', 'REJECTED'],
        default: 'PENDING'
    },
    validationNotes: {
        type: String
    },
    urgencyLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
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

threatReportSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    if (typeof next === 'function') {
        next();
    }
});

module.exports = mongoose.model('ThreatReport', threatReportSchema);
