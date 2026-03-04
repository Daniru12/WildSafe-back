const express = require('express');
const router = express.Router();

const awarenessController = require('../controllers/awarenessController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /awareness/active  →  All active awareness content
router.get('/active', awarenessController.getActiveContent);

// GET /awareness/relevant/:alertType  →  e.g. /relevant/fire
router.get('/relevant/:alertType', awarenessController.getRelevantAwareness);

// GET /awareness/:id  →  Single awareness item
router.get('/:id', awarenessController.getAwarenessById);


// POST /awareness/  →  Create new awareness content
router.post(
    '/',
    roleMiddleware(['OFFICER', 'ADMIN']),
    awarenessController.createAwareness
);

// PATCH /awareness/:id  →  Update awareness content
router.patch(
    '/:id',
    roleMiddleware(['OFFICER', 'ADMIN']),
    awarenessController.updateAwareness
);

// POST /awareness/periodic  →  Send scheduled awareness notifications
router.post(
    '/periodic',
    roleMiddleware(['ADMIN']),
    awarenessController.sendPeriodicUpdate
);

// DELETE /awareness/:id  →  Soft-delete (deactivate)
router.delete(
    '/:id',
    roleMiddleware(['ADMIN']),
    awarenessController.deleteAwareness
);

module.exports = router;
