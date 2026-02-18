const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },
    status: {
        type: String,
        enum: ['AVAILABLE', 'ASSIGNED', 'ARCHIVED'],
        default: 'AVAILABLE'
    },
    metadata: {
        type: Object
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Resource', resourceSchema);
