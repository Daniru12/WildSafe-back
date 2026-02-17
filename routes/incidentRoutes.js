const express = require('express');
const router = express.Router();
const {
    createIncident,
    getMyIncidents,
    getIncidentById,
    getAllIncidents,
    updateStatus,
    assignIncident
} = require('../controllers/incidentController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');

router.use(authMiddleware);

router.post('/', uploadMultiple, createIncident);
router.get('/mine', getMyIncidents);
router.get('/all', roleMiddleware(['OFFICER', 'ADMIN']), getAllIncidents);
router.get('/:id', getIncidentById);
router.patch('/:id/status', roleMiddleware(['OFFICER', 'ADMIN']), updateStatus);
router.patch('/:id/assign', roleMiddleware(['ADMIN']), assignIncident);

module.exports = router;
