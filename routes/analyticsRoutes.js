const express = require('express');
const router = express.Router();
const {
    getIncidentsByCategory,
    getIncidentsByStatus,
    getIncidentTrends
} = require('../controllers/analyticsController');
const {
    getPredictiveInsights,
    getIncidentPrediction,
    getAllIncidentsPrediction
} = require('../controllers/predictiveAnalyticsController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Legacy analytics routes
router.get('/incidents-by-category', getIncidentsByCategory);
router.get('/incidents-by-status', getIncidentsByStatus);
router.get('/trends', getIncidentTrends);

// Predictive analytics routes
router.get('/predictive/insights', getPredictiveInsights);           // last 30 days
router.get('/predictive/all', getAllIncidentsPrediction);         // ALL incidents ever
router.get('/predictive/incident/:id', getIncidentPrediction);       // single incident

module.exports = router;