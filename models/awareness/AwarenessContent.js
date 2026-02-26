const mongoose = require('mongoose');

/**
 * AwarenessContent Model
 * Stores educational/safety awareness content that can be triggered
 * automatically based on active alerts and geo-location.
 */
const awarenessSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },

  content: {
    type: String,
    required: true
  },

  category: {
    type: String,
    enum: ['fire-safety', 'poaching', 'general'],
    required: true
  },

  // Alert types that trigger this awareness content (e.g. ['fire', 'poaching'])
  triggers: [{
    type: String,
    enum: ['fire', 'poaching', 'illegal-logging', 'weather', 'general']
  }],

  // Optional geo-tiles / named areas this content is relevant to
  locations: [{
    name: { type: String },
    coordinates: { type: [Number] } // [lng, lat]
  }],

  // Whether this content is currently active / visible
  isActive: {
    type: Boolean,
    default: true
  },

  // Optional schedule hint – used by periodic sending logic
  schedule: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', null],
    default: null
  },

  // Who created this content
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true
});

// Indexes
awarenessSchema.index({ category: 1, isActive: 1 });
awarenessSchema.index({ triggers: 1, isActive: 1 });
awarenessSchema.index({ schedule: 1, isActive: 1 });

module.exports = mongoose.model('AwarenessContent', awarenessSchema);
