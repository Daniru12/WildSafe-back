const express = require('express');
const router = express.Router();
const { getIncidentsByCategory, getIncidentsByStatus, getIncidentTrends } = require('../controllers/analyticsController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(roleMiddleware(['OFFICER', 'ADMIN']));

router.get('/incidents-by-category', getIncidentsByCategory);
router.get('/incidents-by-status', getIncidentsByStatus);
router.get('/trends', getIncidentTrends);

module.exports = router;
