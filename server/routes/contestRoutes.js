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

// @desc    Get all upcoming/active contests
// @route   GET /api/contests/upcoming
router.get('/upcoming', auth, contestController.getUpcomingContests);

// @desc    Delete a contest owned by current teacher
// @route   DELETE /api/contests/:id
router.delete('/:id', auth, contestController.deleteContest);

// @desc    Get a single contest by ID (populated questions)
// @route   GET /api/contests/:id
router.get('/:id', auth, contestController.getContestById);

// @desc    Submit a student's contest result
// @route   POST /api/contests/:id/submit
router.post('/:id/submit', auth, contestController.submitContestResult);

// @desc    Get contest rank/results
// @route   GET /api/contests/:id/result
router.get('/:id/result', auth, contestController.getContestResult);

module.exports = router;
