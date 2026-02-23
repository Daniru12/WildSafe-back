const express = require('express');
const router = express.Router();

const alertController = require('../controllers/alertController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Basic alert operations
router.get('/', alertController.getAlerts);
router.get('/mine', alertController.getAlerts);
router.get('/all', roleMiddleware(['ADMIN']), alertController.getAllAlerts);
router.get('/stats', alertController.getAlertStats);
router.get('/unread-count', alertController.getUnreadCount);
router.get('/location', alertController.getLocationBasedAlerts);
router.put('/:id/read', alertController.markAsRead);
router.put('/read-all', alertController.markAllAsRead);
router.delete('/:id', roleMiddleware(['ADMIN']), alertController.deleteAlert);

// Alert creation (role-based)
router.post('/emergency', roleMiddleware(['OFFICER', 'ADMIN']), alertController.sendEmergencyAlert);
router.post('/custom', roleMiddleware(['OFFICER', 'ADMIN']), alertController.sendCustomAlert);
router.post('/announcement', roleMiddleware(['ADMIN']), alertController.sendAnnouncement);

module.exports = router;