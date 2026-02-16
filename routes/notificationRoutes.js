const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Case = require('../models/Case');
const ThreatReport = require('../models/ThreatReport');
const { authMiddleware } = require('../middleware/auth');

// GET /api/notifications - Get user notifications
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 10, unreadOnly = false } = req.query;
        const userId = req.user.id;
        
        // Get notifications from cases
        const caseNotifications = await Case.find({
            'notifications.recipient': userId,
            ...(unreadOnly === 'true' && { 'notifications.read': false })
        })
        .select('notifications caseId')
        .sort({ 'notifications.sentAt': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
        
        // Flatten notifications from all cases
        let notifications = [];
        caseNotifications.forEach(case_ => {
            case_.notifications.forEach(notification => {
                if (notification.recipient.toString() === userId) {
                    if (unreadOnly === 'true' && notification.read) return;
                    
                    notifications.push({
                        _id: notification._id,
                        type: notification.type,
                        message: notification.message,
                        sentAt: notification.sentAt,
                        read: notification.read,
                        caseId: case_.caseId,
                        case: case_._id
                    });
                }
            });
        });
        
        // Sort by sentAt descending
        notifications.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
        
        // Apply pagination
        const startIndex = (page - 1) * limit;
        const paginatedNotifications = notifications.slice(startIndex, startIndex + parseInt(limit));
        
        res.json({
            notifications: paginatedNotifications,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(notifications.length / limit),
                total: notifications.length
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
});

// PUT /api/notifications/:notificationId/read - Mark notification as read
router.put('/:notificationId/read', authMiddleware, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        
        // Find the case containing this notification
        const case_ = await Case.findOne({
            'notifications._id': notificationId,
            'notifications.recipient': userId
        });
        
        if (!case_) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        
        // Mark the specific notification as read
        const notification = case_.notifications.id(notificationId);
        if (notification) {
            notification.read = true;
            await case_.save();
        }
        
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Error marking notification as read', error: error.message });
    }
});

// PUT /api/notifications/read-all - Mark all notifications as read for user
router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Update all notifications for this user
        await Case.updateMany(
            { 'notifications.recipient': userId },
            { $set: { 'notifications.$[elem].read': true } },
            { arrayFilters: [{ 'elem.recipient': userId }] }
        );
        
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
    }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const casesWithNotifications = await Case.find({
            'notifications.recipient': userId,
            'notifications.read': false
        }).select('notifications');
        
        let unreadCount = 0;
        casesWithNotifications.forEach(case_ => {
            case_.notifications.forEach(notification => {
                if (notification.recipient.toString() === userId && !notification.read) {
                    unreadCount++;
                }
            });
        });
        
        res.json({ unreadCount });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Error fetching unread count', error: error.message });
    }
});

// POST /api/notifications - Create custom notification (admin only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { recipientIds, type, message, caseId } = req.body;
        
        // Check if user is admin
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
            return res.status(400).json({ message: 'Recipient IDs are required' });
        }
        
        if (!type || !message) {
            return res.status(400).json({ message: 'Type and message are required' });
        }
        
        let targetCase;
        if (caseId) {
            targetCase = await Case.findOne({ caseId });
            if (!targetCase) {
                return res.status(404).json({ message: 'Case not found' });
            }
        }
        
        // Create notifications for each recipient
        const notifications = recipientIds.map(recipientId => ({
            recipient: recipientId,
            type: type,
            message: message,
            sentAt: new Date(),
            read: false
        }));
        
        if (targetCase) {
            // Add to specific case
            targetCase.notifications.push(...notifications);
            await targetCase.save();
        } else {
            // Create a system-wide notification (would need a separate notifications collection in production)
            // For now, we'll add to a dummy case or handle differently
            res.status(400).json({ message: 'Case ID is required for notifications' });
            return;
        }
        
        res.json({ 
            message: 'Notifications sent successfully',
            notificationsSent: recipientIds.length
        });
    } catch (error) {
        console.error('Error creating notifications:', error);
        res.status(500).json({ message: 'Error creating notifications', error: error.message });
    }
});

// DELETE /api/notifications/:notificationId - Delete notification
router.delete('/:notificationId', authMiddleware, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        
        // Find and remove the notification
        const case_ = await Case.findOne({
            'notifications._id': notificationId,
            'notifications.recipient': userId
        });
        
        if (!case_) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        
        case_.notifications.pull(notificationId);
        await case_.save();
        
        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Error deleting notification', error: error.message });
    }
});

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const casesWithNotifications = await Case.find({
            'notifications.recipient': userId
        }).select('notifications');
        
        let totalNotifications = 0;
        let unreadNotifications = 0;
        const typeStats = {};
        
        casesWithNotifications.forEach(case_ => {
            case_.notifications.forEach(notification => {
                if (notification.recipient.toString() === userId) {
                    totalNotifications++;
                    if (!notification.read) unreadNotifications++;
                    
                    typeStats[notification.type] = (typeStats[notification.type] || 0) + 1;
                }
            });
        });
        
        res.json({
            totalNotifications,
            unreadNotifications,
            readNotifications: totalNotifications - unreadNotifications,
            typeBreakdown: typeStats
        });
    } catch (error) {
        console.error('Error fetching notification stats:', error);
        res.status(500).json({ message: 'Error fetching notification stats', error: error.message });
    }
});

module.exports = router;
