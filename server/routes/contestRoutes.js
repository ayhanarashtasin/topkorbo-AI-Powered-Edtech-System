const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const contestController = require('../controllers/contestController');
const proctorController = require('../controllers/proctorController');

// @desc    Create a new contest
// @route   POST /api/contests/create
router.post('/create', auth, contestController.createContest);

// @desc    Get current teacher's contests
// @route   GET /api/contests/mine
router.get('/mine', auth, contestController.getMyContests);

// @desc    Get all upcoming/active contests
// @route   GET /api/contests/upcoming
router.get('/upcoming', auth, contestController.getUpcomingContests);

// @desc    Get current student's contest rating history
// @route   GET /api/contests/rating/me
router.get('/rating/me', auth, contestController.getMyRating);

// @desc    Global leaderboard by points or rating
// @route   GET /api/contests/leaderboard?by=points|rating
// NOTE: must be declared before the '/:id' catch-all route below.
router.get('/leaderboard', auth, contestController.getGlobalLeaderboard);

// @desc    Log an AI proctor violation (mobile phone detected)
// @route   POST /api/contests/:id/proctor/violation
router.post('/:id/proctor/violation', auth, proctorController.logViolation);

// @desc    Get proctor violations for a contest
// @route   GET /api/contests/:id/proctor/violations
router.get('/:id/proctor/violations', auth, proctorController.getViolations);

// @desc    Get proctor violations across the teacher's own contests
// @route   GET /api/contests/proctor/violations/mine
router.get('/proctor/violations/mine', auth, proctorController.getMyContestViolations);

// @desc    Review a proctor violation (admin/teacher)
// @route   PATCH /api/contests/proctor/violations/:violationId/review
router.patch('/proctor/violations/:violationId/review', auth, proctorController.reviewViolation);

// @desc    Batch review all proctor violations for a student in a contest (admin/teacher)
// @route   PATCH /api/contests/:id/proctor/students/:studentId/review
router.patch('/:id/proctor/students/:studentId/review', auth, proctorController.reviewStudentContestViolations);

// @desc    Delete all proctor violations for a student in a contest (admin/teacher)
// @route   DELETE /api/contests/:id/proctor/students/:studentId
router.delete('/:id/proctor/students/:studentId', auth, proctorController.deleteStudentContestViolations);

// @desc    Delete a single proctor violation (admin/teacher)
// @route   DELETE /api/contests/proctor/violations/:violationId
router.delete('/proctor/violations/:violationId', auth, proctorController.deleteViolation);

// @desc    Delete a contest owned by current teacher
// @route   DELETE /api/contests/:id
router.delete('/:id', auth, contestController.deleteContest);

// @desc    Get a single contest by ID (populated questions)
// @route   GET /api/contests/:id
router.get('/:id', auth, contestController.getContestById);

// @desc    Update a contest owned by current teacher
// @route   PUT /api/contests/:id
router.put('/:id', auth, contestController.updateContest);

// @desc    Register a student for a contest
// @route   POST /api/contests/:id/register
router.post('/:id/register', auth, contestController.registerForContest);

// @desc    Submit a single answer live during a running contest (point-based)
// @route   POST /api/contests/:id/answer
router.post('/:id/answer', auth, contestController.submitAnswer);

// @desc    Finalize a student's contest attempt
// @route   POST /api/contests/:id/submit
router.post('/:id/submit', auth, contestController.submitContestResult);

// @desc    Get contest rank/results
// @route   GET /api/contests/:id/result
router.get('/:id/result', auth, contestController.getContestResult);

module.exports = router;
