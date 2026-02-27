const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    department: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['AVAILABLE', 'UNAVAILABLE', 'ASSIGNED'],
        default: 'AVAILABLE'
    },
    permissions: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Staff', staffSchema);
