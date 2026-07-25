const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const moderationController = require('../controllers/moderationController');
const { reportLimiter } = require('../middleware/rateLimiters');

// User-facing: submit a report
router.post('/reports', auth, reportLimiter, moderationController.create);

// Admin-only
router.get('/admin/reports', auth, requireAdmin, moderationController.list);
router.post('/admin/reports/:id/action', auth, requireAdmin, moderationController.takeAction);

module.exports = router;
