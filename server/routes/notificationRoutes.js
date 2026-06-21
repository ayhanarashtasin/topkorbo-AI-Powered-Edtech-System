const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.get('/', auth, notificationController.list);
router.patch('/:id/read', auth, notificationController.markRead);
router.post('/read-all', auth, notificationController.markAllRead);

module.exports = router;