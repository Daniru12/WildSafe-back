const mongoose = require('mongoose');

const RANGER_STATUS = [
    'ASSIGNED',
    'ACCEPTED',
    'EN_ROUTE',
    'ON_SITE',
    'ACTION_TAKEN',
    'CLOSED'
];

const statusHistorySchema = new mongoose.Schema({
    status: { type: String, enum: RANGER_STATUS, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true }
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
    url: { type: String, required: true },
    evidenceType: {
        type: String,
        enum: ['PHOTO', 'VIDEO', 'DOCUMENT', 'REPORT'],
        required: true
    },
    description: { type: String, trim: true },
    notes: { type: String, trim: true },
    conditionSummary: { type: String, trim: true },
    gps: {
        lat: { type: Number },
        lng: { type: Number }
    },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const resolutionSchema = new mongoose.Schema({
    actionSummary: { type: String, trim: true },
    outcome: { type: String, trim: true },
    proofUrls: [{ type: String }],
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const rangerMissionSchema = new mongoose.Schema({
    caseId: {
        type: String,
        required: true,
        trim: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rangerStatus: {
        type: String,
        enum: RANGER_STATUS,
        default: 'ASSIGNED'
    },
    rangerStatusHistory: [statusHistorySchema],
    declineReason: {
        type: String,
        trim: true
    },
    evidence: [evidenceSchema],
    resolution: resolutionSchema,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Unique per case: one RangerMission per caseId
rangerMissionSchema.index({ caseId: 1 }, { unique: true });

rangerMissionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Push to rangerStatusHistory when rangerStatus changes (existing docs only; create sets initial entry)
rangerMissionSchema.pre('save', function (next) {
    if (this.isModified('rangerStatus') && !this.isNew) {
        if (!this.rangerStatusHistory) {
            this.rangerStatusHistory = [];
        }
        this.rangerStatusHistory.push({
            status: this.rangerStatus,
            changedAt: new Date(),
            changedBy: this.assignedTo
        });
    }
    next();
});

module.exports = mongoose.model('RangerMission', rangerMissionSchema);
