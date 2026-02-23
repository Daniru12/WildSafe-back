const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const staffController = require('../controllers/resourceStaff/staffController');

router.post('/', authMiddleware, roleMiddleware(['ADMIN']), staffController.createStaff);
router.get('/', authMiddleware, roleMiddleware(['ADMIN']), staffController.listStaff);
router.get('/:id', authMiddleware, roleMiddleware(['ADMIN']), staffController.getStaff);
router.put('/:id', authMiddleware, roleMiddleware(['ADMIN']), staffController.updateStaff);
router.delete('/:id', authMiddleware, roleMiddleware(['ADMIN']), staffController.deleteStaff);

module.exports = router;
