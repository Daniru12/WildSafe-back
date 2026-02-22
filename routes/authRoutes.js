const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateRole } = require('../controllers/authController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);
router.put('/users/:id/role', authMiddleware, roleMiddleware(['ADMIN']), updateRole);

module.exports = router;
