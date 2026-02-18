const Notification = require('../models/Notification');
const User = require('../models/User');

// Get all notifications for the logged-in user
exports.getNotifications = async (req, res) => {
  try {
    const { type, priority, isRead, limit = 50, page = 1 } = req.query;
    
    // Build filter
    const filter = { userId: req.user.id };
    
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get notifications
    const notifications = await Notification.find(filter)
      .populate('relatedIncident', 'title status category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    // Get total count
    const total = await Notification.countDocuments(filter);
    
    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false
    });
    
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
};

// Get notification statistics
exports.getNotificationStats = async (req, res) => {
  try {
    const [unreadCount, totalCount, byType, byPriority] = await Promise.all([
      // Unread count
      Notification.countDocuments({ userId: req.user.id, isRead: false }),
      
      // Total count
      Notification.countDocuments({ userId: req.user.id }),
      
      // Count by type
      Notification.aggregate([
        { $match: { userId: req.user.id, isRead: false } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      
      // Count by priority
      Notification.aggregate([
        { $match: { userId: req.user.id, isRead: false } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);
    
    res.json({
      unreadCount,
      totalCount,
      readCount: totalCount - unreadCount,
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ message: 'Error fetching notification stats', error: error.message });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOne({
      _id: id,
      userId: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    notification.isRead = true;
    await notification.save();
    
    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error updating notification', error: error.message });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );
    
    res.json({ 
      message: 'All notifications marked as read', 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
};
// -------------------------------------------------
// Shared helper functions (used by other controllers)
// -------------------------------------------------

// Create a single notification (used by incidents/cases/etc.)
exports.createNotification = async (userId, {
  title,
  message,
  type = 'SYSTEM',
  priority = 'MEDIUM',
  relatedIncident = null,
  metadata = null
}) => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      priority,
      relatedIncident,
      metadata
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Notify all active users with specific roles
exports.notifyByRole = async (roles, {
  title,
  message,
  type = 'SYSTEM',
  priority = 'MEDIUM',
  relatedIncident = null,
  metadata = null
}) => {
  try {
    const roleArray = Array.isArray(roles) ? roles : [roles];

    const users = await User.find({
      role: { $in: roleArray },
      status: 'ACTIVE'
    }).select('_id');

    const notifications = users.map(user => ({
      userId: user._id,
      title,
      message,
      type,
      priority,
      relatedIncident,
      metadata
    }));

    if (notifications.length === 0) return 0;

    await Notification.insertMany(notifications);
    return notifications.length;
  } catch (error) {
    console.error('Error notifying by role:', error);
    throw error;
  }
};

// -------------------------------------------------
// Alert & admin management endpoints (single backend)
// -------------------------------------------------

// OFFICER/ADMIN: send emergency alert to all officers/admins (URGENT)
exports.sendEmergencyAlert = async (req, res) => {
  try {
    const { title, message, metadata } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const count = await exports.notifyByRole(['OFFICER', 'ADMIN'], {
      title,
      message,
      type: 'ALERT',
      priority: 'URGENT',
      metadata: {
        ...(metadata || {}),
        category: 'EMERGENCY'
      }
    });

    res.status(201).json({
      message: `Emergency alert sent to ${count} users`,
      recipientsCount: count
    });
  } catch (error) {
    console.error('Error sending emergency alert:', error);
    res.status(500).json({ message: 'Error sending emergency alert', error: error.message });
  }
};

// OFFICER/ADMIN: send custom alert to specific users
exports.sendCustomAlert = async (req, res) => {
  try {
    const { userIds, title, message, type, priority, metadata } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds (non-empty array) is required' });
    }

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const notifications = userIds.map(userId => ({
      userId,
      title,
      message,
      type: type || 'SYSTEM',
      priority: priority || 'MEDIUM',
      metadata: metadata || null
    }));

    const created = await Notification.insertMany(notifications);

    res.status(201).json({
      message: `Alert sent to ${created.length} users`,
      recipientsCount: created.length
    });
  } catch (error) {
    console.error('Error sending custom alert:', error);
    res.status(500).json({ message: 'Error sending custom alert', error: error.message });
  }
};

// ADMIN: send system-wide / awareness announcement
exports.sendAnnouncement = async (req, res) => {
  try {
    const { title, message, targetRoles, metadata } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const roles = Array.isArray(targetRoles) && targetRoles.length > 0
      ? targetRoles
      : ['CITIZEN', 'OFFICER', 'ADMIN'];

    const count = await exports.notifyByRole(roles, {
      title,
      message,
      type: 'SYSTEM',
      priority: 'LOW',
      metadata: {
        ...(metadata || {}),
        isAnnouncement: true,
        category: metadata?.category || 'AWARENESS'
      }
    });

    res.status(201).json({
      message: `Announcement sent to ${count} users`,
      recipientsCount: count
    });
  } catch (error) {
    console.error('Error sending announcement:', error);
    res.status(500).json({ message: 'Error sending announcement', error: error.message });
  }
};

// ADMIN: get all notifications (for moderation/monitoring)
exports.getAllNotificationsAdmin = async (req, res) => {
  try {
    const { type, priority, userId, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (userId) filter.userId = userId;

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('userId', 'name email role')
        .populate('relatedIncident', 'title status category')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Notification.countDocuments(filter)
    ]);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all notifications (admin):', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// ADMIN: delete any notification (e.g., inappropriate alert)
exports.adminDeleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully (admin)' });
  } catch (error) {
    console.error('Error deleting notification (admin):', error);
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
};
