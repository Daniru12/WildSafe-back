const express = require('express');
const router = express.Router();
const aiSuggestionService = require('../services/aiSuggestionService');
const aiRateLimiter = require('../middleware/rateLimitAi');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// @route   GET /api/ai/suggest/staff/:resourceId
// @desc    Get AI suggestions for staff assignment
router.get('/suggest/staff/:resourceId', aiRateLimiter, async (req, res) => {
    try {
        const suggestion = await aiSuggestionService.suggestStaffForResource(req.params.resourceId);
        res.json({ suggestion });
    } catch (err) {
        res.status(500).json({ message: 'AI suggestion failed', error: err.message });
    }
});

// @route   POST /api/ai/suggest/action
// @desc    Get AI suggestions for user actions
router.post('/suggest/action', aiRateLimiter, async (req, res) => {
    try {
        const { kycStatus, assetDetails } = req.body;
        const suggestion = await aiSuggestionService.suggestUserAction(kycStatus, assetDetails);
        res.json({ suggestion });
    } catch (err) {
        res.status(500).json({ message: 'AI suggestion failed', error: err.message });
    }
});

// @route   POST /api/ai/search/resources
// @desc    Semantic search for resources
router.post('/search/resources', aiRateLimiter, async (req, res) => {
    try {
        const { query } = req.body;
        const resources = await aiSuggestionService.matchResources(query);
        res.json(resources);
    } catch (err) {
        res.status(500).json({ message: 'AI search failed', error: err.message });
    }
});

module.exports = router;
