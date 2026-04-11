const Alert = require('../models/Alert');
const User = require('../models/User');
const SmartAlertService = require('../services/smartAlertService');
const AwarenessContent = require('../models/awareness/AwarenessContent');

const VALID_ALERT_TYPES = ['fire', 'poaching', 'illegal-logging', 'weather', 'general'];
const AWARENESS_GUIDELINE_LIMIT = 2;

const DEFAULT_AWARENESS_BY_TYPE = {
  fire: [
    {
      title: 'Fire Evacuation Basics',
      content: 'Move to a safe open area away from smoke. Follow ranger and emergency unit instructions. Do not return until officials clear the area.',
      category: 'fire-safety'
    },
    {
      title: 'Protect Wildlife During Fire',
      content: 'Avoid entering habitat zones during active fire response. Report trapped wildlife to officers and keep access roads clear for rescue teams.',
      category: 'fire-safety'
    }
  ],
  poaching: [
    {
      title: 'Report Poaching Safely',
      content: 'Do not confront suspects directly. Record location, time, and visible details, then report immediately through official WildSafe channels.',
      category: 'poaching'
    },
    {
      title: 'Preserve Evidence at Scene',
      content: 'Keep distance from traps, shells, footprints, or carcasses. Avoid touching items and wait for authorized officers to process the scene.',
      category: 'poaching'
    }
  ],
  'illegal-logging': [
    {
      title: 'Illegal Logging Response',
      content: 'Do not engage loggers directly. Share exact coordinates, vehicle details, and route information with enforcement teams as quickly as possible.',
      category: 'general'
    },
    {
      title: 'Protect Forest Access Routes',
      content: 'Keep ranger access routes open and avoid moving equipment or cut timber at the location until officials document the area.',
      category: 'general'
    }
  ],
  weather: [
    {
      title: 'Severe Weather Safety Steps',
      content: 'Move to safe shelter, avoid flood-prone streams and trees during storms, and follow official advisories before resuming field movement.',
      category: 'general'
    },
    {
      title: 'Post-Weather Area Check',
      content: 'Inspect trails for fallen trees, erosion, and blocked routes. Report hazards quickly to prevent secondary incidents.',
      category: 'general'
    }
  ],
  general: [
    {
      title: 'Emergency First Actions',
      content: 'Stay calm, move to safe ground, share your live location if possible, and wait for instructions from authorized officers.',
      category: 'general'
    },
    {
      title: 'Community Safety Coordination',
      content: 'Use verified channels for updates, avoid rumor sharing, and prioritize vulnerable people during emergency response.',
      category: 'general'
    }
  ]
};

const CATEGORY_TO_ALERT_TYPE = {
  EMERGENCY: 'fire',
  WARNING: 'poaching',
  INFO: 'general',
  ANNOUNCEMENT: 'general'
};

function dedupeAwareness(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?._id?.toString?.() || item?._id || item?.id;
    const contentKey = `${(item?.title || '').trim().toLowerCase()}|${(item?.content || '').trim().toLowerCase()}`;
    const key = id || contentKey;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function ensureDefaultAwarenessForType(alertType) {
  const templates = DEFAULT_AWARENESS_BY_TYPE[alertType] || [];

  if (templates.length === 0) {
    return;
  }

  await Promise.all(
    templates.map((template) =>
      AwarenessContent.findOneAndUpdate(
        {
          title: template.title,
          triggers: alertType
        },
        {
          $setOnInsert: {
            title: template.title,
            content: template.content,
            category: template.category,
            triggers: [alertType],
            isActive: true
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      )
    )
  );
}

async function fetchAwarenessByQuery(query, limit = AWARENESS_GUIDELINE_LIMIT) {
  const items = await AwarenessContent.find(query)
    .select('_id title category content triggers')
    .sort({ createdAt: -1 })
    .limit(limit);

  return dedupeAwareness(items).slice(0, limit);
}

async function getAwarenessForAlertType(alertType, awarenessIds = []) {
  const query = { isActive: true };

  if (Array.isArray(awarenessIds) && awarenessIds.length > 0) {
    query._id = { $in: awarenessIds };
  } else {
    query.triggers = alertType;
  }

  let awarenessItems = await fetchAwarenessByQuery(query);

  if (awarenessItems.length === 0 && (!Array.isArray(awarenessIds) || awarenessIds.length === 0)) {
    await ensureDefaultAwarenessForType(alertType);
    awarenessItems = await fetchAwarenessByQuery({ isActive: true, triggers: alertType });
  }

  if (awarenessItems.length === 0 && alertType !== 'general' && (!Array.isArray(awarenessIds) || awarenessIds.length === 0)) {
    await ensureDefaultAwarenessForType('general');
    awarenessItems = await fetchAwarenessByQuery({ isActive: true, triggers: 'general' });
  }

  return awarenessItems;
}

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
      .populate('relatedAwareness', 'title category content triggers')
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

// Send emergency alert (URGENT)
exports.sendEmergencyAlert = async (req, res) => {
  try {
    const { title, message, location, expiresAt, targetRoles, alertType = 'fire', awarenessIds = [] } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    if (!VALID_ALERT_TYPES.includes(alertType)) {
      return res.status(400).json({
        message: `Invalid alertType. Valid values: ${VALID_ALERT_TYPES.join(', ')}`
      });
    }

    // Use provided targetRoles or default to OFFICER + ADMIN
    const validRoles = ['CITIZEN', 'OFFICER', 'ADMIN'];
    const roles = Array.isArray(targetRoles) && targetRoles.every(r => validRoles.includes(r))
      ? targetRoles
      : ['OFFICER', 'ADMIN'];

    const awarenessItems = await getAwarenessForAlertType(alertType, awarenessIds);

    const alert = await Alert.create({
      title,
      message,
      category: 'EMERGENCY',
      alertType,
      priority: 'URGENT',
      createdBy: req.user.id,
      targetRoles: roles,
      location,
      expiresAt,
      relatedAwareness: awarenessItems.map(item => item._id)
    });

    // Count target users for response
    const targetUserCount = await User.countDocuments({
      role: { $in: roles },
      status: 'ACTIVE'
    });

    // Trigger geo-alert notifications + awareness + WhatsApp for nearby users
    const alertResult = await SmartAlertService.handleNewAlert(alert).catch(err => {
      console.error('[sendEmergencyAlert] handleNewAlert error:', err);
      return { notified: 0, awarenessAttached: 0, whatsapp: { sent: 0, failed: 0, total: 0, recipients: [] } };
    });
    const whatsappDelivery = alertResult?.whatsapp || { sent: 0, failed: 0, total: 0, recipients: [] };

    res.status(201).json({
      message: `Emergency alert sent to ${targetUserCount} users`,
      alert,
      recipientsCount: targetUserCount,
      awarenessGuidelines: awarenessItems,
      whatsappDelivery: {
        sent: whatsappDelivery.sent ?? 0,
        failed: whatsappDelivery.failed ?? 0,
        total: whatsappDelivery.total ?? 0,
        recipients: whatsappDelivery.recipients ?? []
      }
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
      relatedIncident,
      alertType,
      awarenessIds = []
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

    const resolvedAlertType = alertType || CATEGORY_TO_ALERT_TYPE[category] || 'general';
    if (!VALID_ALERT_TYPES.includes(resolvedAlertType)) {
      return res.status(400).json({
        message: `Invalid alertType. Valid values: ${VALID_ALERT_TYPES.join(', ')}`
      });
    }

    const awarenessItems = await getAwarenessForAlertType(resolvedAlertType, awarenessIds);

    const alert = await Alert.create({
      title,
      message,
      category,
      alertType: resolvedAlertType,
      priority,
      createdBy: req.user.id,
      targetRoles,
      location,
      expiresAt,
      relatedIncident,
      relatedAwareness: awarenessItems.map(item => item._id)
    });

    // Count target users for response
    const targetUserCount = await User.countDocuments({
      role: { $in: targetRoles },
      status: 'ACTIVE'
    });

    // Trigger geo-alert notifications + awareness + WhatsApp for nearby users
    const alertResult = await SmartAlertService.handleNewAlert(alert).catch(err => {
      console.error('[sendCustomAlert] handleNewAlert error:', err);
      return { notified: 0, awarenessAttached: 0, whatsapp: { sent: 0, failed: 0, total: 0, recipients: [] } };
    });
    const whatsappDelivery = alertResult?.whatsapp || { sent: 0, failed: 0, total: 0, recipients: [] };

    res.status(201).json({
      message: `Alert sent to ${targetUserCount} users`,
      alert,
      recipientsCount: targetUserCount,
      awarenessGuidelines: awarenessItems,
      whatsappDelivery: {
        sent: whatsappDelivery.sent ?? 0,
        failed: whatsappDelivery.failed ?? 0,
        total: whatsappDelivery.total ?? 0,
        recipients: whatsappDelivery.recipients ?? []
      }
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
        .populate('relatedAwareness', 'title category content triggers')
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
      .populate('relatedAwareness', 'title category content triggers')
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