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

module.exports = router;
