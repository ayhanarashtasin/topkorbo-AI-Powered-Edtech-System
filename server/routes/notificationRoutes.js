const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiters');
const notificationController = require('../controllers/notificationController');

router.get('/', auth, notificationController.list);
router.patch('/:id/read', auth, writeLimiter, notificationController.markRead);
router.post('/read-all', auth, writeLimiter, notificationController.markAllRead);

module.exports = router;
