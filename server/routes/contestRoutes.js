const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const contestController = require('../controllers/contestController');

// @desc    Create a new contest
// @route   POST /api/contests/create
router.post('/create', auth, contestController.createContest);

// @desc    Get current teacher's contests
// @route   GET /api/contests/mine
router.get('/mine', auth, contestController.getMyContests);

module.exports = router;
