const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const evaluationController = require('../controllers/evaluationController');

// @desc    Evaluate written exam answers using Groq AI
// @route   POST /api/evaluate/written
router.post('/written', auth, evaluationController.evaluateWrittenAnswers);

// @desc    Generate AI explanation for a question
// @route   POST /api/evaluate/explain
router.post('/explain', auth, evaluationController.explainQuestion);

// @desc    Tutoring chat regarding a question
// @route   POST /api/evaluate/chat
router.post('/chat', auth, evaluationController.chatQuestion);

module.exports = router;
