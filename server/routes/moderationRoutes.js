const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const moderationController = require('../controllers/moderationController');

// User-facing: submit a report
router.post('/reports', auth, moderationController.create);

// Admin-only
router.get('/admin/reports', auth, admin, moderationController.list);
router.post('/admin/reports/:id/action', auth, admin, moderationController.takeAction);

module.exports = router;