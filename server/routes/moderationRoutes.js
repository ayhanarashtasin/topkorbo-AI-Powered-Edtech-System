const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const moderationController = require('../controllers/moderationController');

// User-facing: submit a report
router.post('/reports', auth, moderationController.create);

// Admin-only
router.get('/admin/reports', auth, requireAdmin, moderationController.list);
router.post('/admin/reports/:id/action', auth, requireAdmin, moderationController.takeAction);

module.exports = router;
