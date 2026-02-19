const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const rangerController = require('../controllers/rangerController');

// All ranger routes require auth and OFFICER or ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(['OFFICER', 'ADMIN']));

// Stub: confirm ranger API is mounted (Day 1)
router.get('/', (req, res) => {
    res.json({ message: 'Ranger API ok', user: req.user?.name });
});

// My assigned cases (creates RangerMission if missing). Query: rangerStatus, page, limit
router.get('/cases', rangerController.getMyAssignedCases);

// Accept mission (only when ASSIGNED)
router.post('/cases/:caseId/accept', rangerController.acceptMission);

// Decline mission (only when ASSIGNED); unassigns case. Body: { declineReason }
router.post('/cases/:caseId/decline', rangerController.declineMission);

module.exports = router;
