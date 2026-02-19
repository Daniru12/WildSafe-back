const Alert = require('../models/Alert');
const User = require('../models/User');

// Get all alerts for the logged-in user
exports.getAlerts = async (req, res) => {
  try {
    const { category, priority, limit = 50, page = 1 } = req.query;
    
    // Build filter for alerts targeting user's role
    const filter = {
      targetRoles: req.user.role,
      isActive: true
    };
    
    // Add expired check
    filter.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
    
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get alerts
    const alerts = await Alert.find(filter)
      .populate('createdBy', 'name email role')
      .populate('relatedIncident', 'title status category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    // Get total count
    const total = await Alert.countDocuments(filter);
    
    res.json({
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Error fetching alerts', error: error.message });
  }
};

// Get alert count for the logged-in user
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Alert.countDocuments({
      targetRoles: req.user.role,
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });
    
    res.json({ count });
  } catch (error) {
    console.error('Error fetching alert count:', error);
    res.status(500).json({ message: 'Error fetching alert count', error: error.message });
  }
};

// Get alert statistics
exports.getAlertStats = async (req, res) => {
  try {
    const [totalCount, byCategory, byPriority] = await Promise.all([
      Alert.countDocuments({
        targetRoles: req.user.role,
        isActive: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }),
      
      Alert.aggregate([
        {
          $match: {
            targetRoles: req.user.role,
            isActive: true,
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
              { expiresAt: { $gt: new Date() } }
            ]
          }
        },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      
      Alert.aggregate([
        {
          $match: {
            targetRoles: req.user.role,
            isActive: true,
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
              { expiresAt: { $gt: new Date() } }
            ]
          }
        },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);
    
    res.json({
      totalCount,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({ message: 'Error fetching alert stats', error: error.message });
  }
};

// Mark an alert as read (not supported in simplified model)
exports.markAsRead = async (req, res) => {
  try {
    res.json({ 
      message: 'Alert acknowledgment received',
      note: 'Individual read tracking not supported in current model'
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
};

// Mark all alerts as read (not supported in simplified model)
exports.markAllAsRead = async (req, res) => {
  try {
    res.json({ 
      message: 'All alerts acknowledgment received',
      note: 'Individual read tracking not supported in current model'
    });
  } catch (error) {
    console.error('Error acknowledging alerts:', error);
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
};

// Send emergency alert to all officers/admins (URGENT)
exports.sendEmergencyAlert = async (req, res) => {
  try {
    const { title, message, location, expiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const alert = await Alert.create({
      title,
      message,
      category: 'EMERGENCY',
      priority: 'URGENT',
      createdBy: req.user.id,
      targetRoles: ['OFFICER', 'ADMIN'],
      location,
      expiresAt
    });

    // Count target users for response
    const targetUserCount = await User.countDocuments({
      role: { $in: ['OFFICER', 'ADMIN'] },
      status: 'ACTIVE'
    });

    res.status(201).json({
      message: `Emergency alert sent to ${targetUserCount} users`,
      alert,
      recipientsCount: targetUserCount
    });
  } catch (error) {
    console.error('Error sending emergency alert:', error);
    res.status(500).json({ message: 'Error sending emergency alert', error: error.message });
  }
};

// Send custom alert to specific roles
exports.sendCustomAlert = async (req, res) => {
  try {
    const { 
      targetRoles = ['OFFICER'], 
      title, 
      message, 
      category = 'INFO', 
      priority = 'MEDIUM', 
      location, 
      expiresAt,
      relatedIncident 
    } = req.body;

    if (!Array.isArray(targetRoles) || targetRoles.length === 0) {
      return res.status(400).json({ message: 'targetRoles (non-empty array) is required' });
    }

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    // Validate target roles
    const validRoles = ['CITIZEN', 'OFFICER', 'ADMIN'];
    const invalidRoles = targetRoles.filter(role => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      return res.status(400).json({ message: `Invalid roles: ${invalidRoles.join(', ')}` });
    }

    const alert = await Alert.create({
      title,
      message,
      category,
      priority,
      createdBy: req.user.id,
      targetRoles,
      location,
      expiresAt,
      relatedIncident
    });

    // Count target users for response
    const targetUserCount = await User.countDocuments({
      role: { $in: targetRoles },
      status: 'ACTIVE'
    });

    res.status(201).json({
      message: `Alert sent to ${targetUserCount} users`,
      alert,
      recipientsCount: targetUserCount
    });
  } catch (error) {
    console.error('Error sending custom alert:', error);
    res.status(500).json({ message: 'Error sending custom alert', error: error.message });
  }
};

// Send system-wide announcement
exports.sendAnnouncement = async (req, res) => {
  try {
    const { 
      title, 
      message, 
      targetRoles = ['CITIZEN', 'OFFICER', 'ADMIN'], 
      expiresAt 
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const alert = await Alert.create({
      title,
      message,
      category: 'ANNOUNCEMENT',
      priority: 'LOW',
      createdBy: req.user.id,
      targetRoles,
      expiresAt
    });

    // Count target users for response
    const targetUserCount = await User.countDocuments({
      role: { $in: targetRoles },
      status: 'ACTIVE'
    });

    res.status(201).json({
      message: `Announcement sent to ${targetUserCount} users`,
      alert,
      recipientsCount: targetUserCount
    });
  } catch (error) {
    console.error('Error sending announcement:', error);
    res.status(500).json({ message: 'Error sending announcement', error: error.message });
  }
};

// Get all alerts (admin only)
exports.getAllAlerts = async (req, res) => {
  try {
    const { category, priority, createdBy, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (createdBy) filter.createdBy = createdBy;

    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .populate('createdBy', 'name email role')
        .populate('relatedIncident', 'title status category')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Alert.countDocuments(filter)
    ]);

    res.json({
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all alerts (admin):', error);
    res.status(500).json({ message: 'Error fetching alerts', error: error.message });
  }
};

// Deactivate/delete an alert (admin only)
exports.deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await Alert.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json({ message: 'Alert deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating alert:', error);
    res.status(500).json({ message: 'Error deactivating alert', error: error.message });
  }
};

// Get location-based alerts (for mobile apps)
exports.getLocationBasedAlerts = async (req, res) => {
  try {
    const { longitude, latitude, radius = 1000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Longitude and latitude are required' });
    }

    const alerts = await Alert.find({
      targetRoles: req.user.role,
      isActive: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(radius)
        }
      },
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    })
    .populate('createdBy', 'name role')
    .sort({ createdAt: -1 });

    res.json({
      alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error fetching location-based alerts:', error);
    res.status(500).json({ message: 'Error fetching location-based alerts', error: error.message });
  }
};