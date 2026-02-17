const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const resourceController = require('../controllers/resourceController');

router.post('/', authMiddleware, roleMiddleware(['ADMIN','OFFICER']), resourceController.createResource);
router.get('/', authMiddleware, resourceController.listResources);
router.get('/:id', authMiddleware, resourceController.getResource);
router.put('/:id', authMiddleware, roleMiddleware(['ADMIN','OFFICER']), resourceController.updateResource);
router.put('/:id/assign', authMiddleware, roleMiddleware(['ADMIN','OFFICER']), resourceController.assignResource);
router.delete('/:id', authMiddleware, roleMiddleware(['ADMIN']), resourceController.archiveResource);

module.exports = router;
