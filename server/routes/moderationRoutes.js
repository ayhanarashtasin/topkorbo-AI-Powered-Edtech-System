const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const moderationController = require('../controllers/moderationController');
const { reportLimiter } = require('../middleware/rateLimiters');

// User-facing: submit a report
router.post('/reports', auth, reportLimiter, moderationController.create);

module.exports = router;
