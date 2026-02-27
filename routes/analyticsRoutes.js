const express = require('express');
const router = express.Router();
const {
    getIncidentsByCategory,
    getIncidentsByStatus,
    getIncidentTrends
} = require('../controllers/analyticsController');
const {
    getPredictiveInsights,
    getIncidentPrediction
} = require('../controllers/predictiveAnalyticsController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Legacy analytics routes
router.get('/incidents-by-category', getIncidentsByCategory);
router.get('/incidents-by-status', getIncidentsByStatus);
router.get('/trends', getIncidentTrends);

// New predictive analytics routes
router.get('/predictive/insights', getPredictiveInsights);
router.get('/predictive/incident/:id', getIncidentPrediction);

module.exports = router;
