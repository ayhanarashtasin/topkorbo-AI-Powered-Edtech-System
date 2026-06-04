const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const questionController = require('../controllers/questionController');

// @desc    Create a new question
// @route   POST /api/questions
router.post('/', auth, questionController.createQuestion);

// @desc    Get current teacher's uploaded questions
// @route   GET /api/questions/mine
router.get('/mine', auth, questionController.getMyQuestions);

// @desc    Get topics by subject, paper, and chapter
// @route   GET /api/questions/topics
router.get('/topics', auth, questionController.getTopicsForMockTest);

// @desc    Fetch questions for mock test with filters
// @route   POST /api/questions/mock-test
router.post('/mock-test', auth, questionController.fetchMockTestQuestions);

module.exports = router;
