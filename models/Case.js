const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
    caseId: {
        type: String,
        unique: true,
        required: true
    },
    threatReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ThreatReport',
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
    reporterInfo: {
        name: { type: String },
        email: { type: String },
        phone: { type: String },
        isAnonymous: { type: Boolean }
    },
    dateTime: {
        type: Date,
        required: true
    },
    assignedOfficer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    assignedTeam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    status: {
        type: String,
        enum: ['NEW', 'IN_PROGRESS', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'],
        default: 'NEW'
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
    },
    investigation: {
        findings: [{
            type: String,
            addedAt: { type: Date, default: Date.now },
            addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        }],
        evidence: [{
            type: String, // URLs to evidence files
            evidenceType: {
                type: String,
                enum: ['PHOTO', 'VIDEO', 'DOCUMENT', 'REPORT'],
                required: true
            },
            description: { type: String },
            uploadedAt: { type: Date, default: Date.now },
            uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        }],
        actions: [{
            action: { type: String, required: true },
            takenAt: { type: Date, default: Date.now },
            takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            result: { type: String }
        }]
    },
    resolution: {
        actionSummary: { type: String },
        outcome: { type: String },
        resolvedAt: { type: Date },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    notifications: [{
        recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        type: {
            type: String,
            enum: ['CASE_ASSIGNED', 'STATUS_UPDATE', 'RESOLUTION', 'URGENT_ALERT']
        },
        message: { type: String },
        sentAt: { type: Date, default: Date.now },
        read: { type: Boolean, default: false }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

caseSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Case', caseSchema);
