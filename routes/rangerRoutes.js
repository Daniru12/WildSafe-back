const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// All ranger routes require auth and OFFICER or ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(['OFFICER', 'ADMIN']));

// Stub: confirm ranger API is mounted (Day 1)
router.get('/', (req, res) => {
    res.json({ message: 'Ranger API ok', user: req.user?.name });
});

module.exports = router;
