const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// -------------------------------------------------
// Basic notification APIs (all roles)
// -------------------------------------------------

// Get all notifications for logged-in user
router.get('/', notificationController.getNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Get notification statistics (for current user)
router.get('/stats', notificationController.getNotificationStats);

// Mark a notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', notificationController.markAllAsRead);

// Delete a notification (own notification)
router.delete('/:id', notificationController.deleteNotification);


// Alert creation & management (role-based)
// -------------------------------------------------

// Send emergency alert to all officers/admins (URGENT)
router.post(
	'/alerts/emergency',
	roleMiddleware(['OFFICER', 'ADMIN']),
	notificationController.sendEmergencyAlert
);

// Send custom alert to specific users
router.post(
	'/alerts/custom',
	roleMiddleware(['OFFICER', 'ADMIN']),
	notificationController.sendCustomAlert
);

// Send system-wide / awareness announcement
router.post(
	'/alerts/announcement',
	roleMiddleware(['ADMIN']),
	notificationController.sendAnnouncement
);

// Admin: get all notifications (for moderation/monitoring)
router.get(
	'/admin/all',
	roleMiddleware(['ADMIN']),
	notificationController.getAllNotificationsAdmin
);

// Admin: delete any notification (e.g., inappropriate alerts)
router.delete(
	'/admin/:id',
	roleMiddleware(['ADMIN']),
	notificationController.adminDeleteNotification
);

module.exports = router;
