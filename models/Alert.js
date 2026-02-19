const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },

  message: {
    type: String,
    required: true,
    trim: true
  },

  category: {
    type: String,
    enum: ['EMERGENCY', 'WARNING', 'INFO', 'ANNOUNCEMENT'],
    required: true
  },

  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Target roles (CITIZEN, OFFICER, ADMIN)
  targetRoles: [{
    type: String,
    enum: ['CITIZEN', 'OFFICER', 'ADMIN']
  }],

  // Optional: link alert to an incident
  relatedIncident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident'
  },

  // For enabling/disabling alerts
  isActive: {
    type: Boolean,
    default: true
  },

  // Optional expiry date
  expiresAt: {
    type: Date
  },

  // For location-based smart alerts
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      validate: {
        validator: function(val) {
          return !val || val.length === 2;
        },
        message: 'Location must have [longitude, latitude]'
      }
    }
  }

}, {
  timestamps: true
});

// Indexes
alertSchema.index({ category: 1, priority: 1 });
alertSchema.index({ createdBy: 1, createdAt: -1 });
alertSchema.index({ targetRoles: 1, isActive: 1 });
alertSchema.index({ expiresAt: 1 });
alertSchema.index({ location: '2dsphere' });

// Check if alert is expired
alertSchema.methods.isExpired = function () {
  return this.expiresAt && new Date() > this.expiresAt;
};

module.exports = mongoose.model('Alert', alertSchema);
