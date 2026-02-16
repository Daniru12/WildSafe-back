const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String
    },
    specialization: {
        type: String,
        enum: ['POACHING', 'FOREST_FIRE', 'WILDLIFE_RESCUE', 'GENERAL', 'RESEARCH'],
        required: true
    },
    members: [{
        officer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: {
            type: String,
            enum: ['LEADER', 'MEMBER', 'SPECIALIST'],
            default: 'MEMBER'
        },
        joinedAt: { type: Date, default: Date.now }
    }],
    jurisdiction: {
        type: String,
        description: 'Geographical area or region the team covers'
    },
    isActive: {
        type: Boolean,
        default: true
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

teamSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Team', teamSchema);
