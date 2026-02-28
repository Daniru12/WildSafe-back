const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const rangerController = require('../controllers/rangerController');
const { rangerEvidenceUpload } = require('../middleware/rangerUpload');

// All ranger routes require auth and OFFICER or ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(['OFFICER', 'ADMIN']));

// Stub: confirm ranger API is mounted 
router.get('/', (req, res) => {
    res.json({ message: 'Ranger API ok', user: req.user?.name });
});

// My assigned cases (creates RangerMission if missing). Query: rangerStatus, page, limit
router.get('/cases', rangerController.getMyAssignedCases);

// Suggested actions for ranger (Groq AI or rule-based) – must be before /cases/:caseId
router.get('/cases/:caseId/suggested-actions', rangerController.getSuggestedActions);

// Case detail for ranger
router.get('/cases/:caseId', rangerController.getCaseDetail);

// Accept mission (only when ASSIGNED)
router.post('/cases/:caseId/accept', rangerController.acceptMission);

// Decline mission (only when ASSIGNED); unassigns case. Body: { declineReason }
router.post('/cases/:caseId/decline', rangerController.declineMission);

// Start mission -> EN_ROUTE 
router.post('/cases/:caseId/start-mission', rangerController.startMission);

// Arrive on site -> ON_SITE . Body: { notes }
router.post('/cases/:caseId/arrive-on-site', rangerController.arriveOnSite);

// Action taken -> ACTION_TAKEN 
router.post('/cases/:caseId/action-taken', rangerController.actionTaken);

// Upload evidence - multipart photos + body: description, notes, conditionSummary, gpsLat, gpsLng (Day 4)
// Skip multer for JSON-only body (e.g. text evidence) so Cloudinary/multer does not throw
router.post(
    '/cases/:caseId/evidence',
    (req, res, next) => {
        const isMultipart = (req.headers['content-type'] || '').includes('multipart/form-data');
        if (!isMultipart) {
            req.files = [];
            return next();
        }
        rangerEvidenceUpload(req, res, (err) => {
            if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
            next();
        });
    },
    rangerController.addEvidence
);

// Delete one evidence item by id (ranger can remove uploaded evidence when ON_SITE or ACTION_TAKEN)
router.delete('/cases/:caseId/evidence/:evidenceId', rangerController.deleteEvidence);

// Close case with solution and proof; syncs to Case . Body: actionTaken, solutionProvided, proofUrls[], dateTime?
router.post('/cases/:caseId/close', rangerController.closeCase);

module.exports = router;
