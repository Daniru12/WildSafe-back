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

// -------------------------------------------------
// Admin notification management
// -------------------------------------------------

// Admin: get all notifications (for monitoring)
router.get(
	'/admin/all',
	roleMiddleware(['ADMIN']),
	notificationController.getAllNotificationsAdmin
);

// Admin: delete any notification
router.delete(
	'/admin/:id',
	roleMiddleware(['ADMIN']),
	notificationController.adminDeleteNotification
);

module.exports = router;
