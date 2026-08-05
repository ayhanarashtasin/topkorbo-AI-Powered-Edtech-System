/**
 * Mock Test Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Mounted at /api/mock-tests in server.js.
 *
 *   POST /attempts → save a completed mock test result (auth required)
 */

const express = require('express');
const auth = require('../middleware/auth');
const mockTestController = require('../controllers/mockTestController');

const router = express.Router();

router.post('/attempts', auth, mockTestController.createAttempt);

module.exports = router;
