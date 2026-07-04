const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiQuota = require('../middleware/enforceAiQuota');
const evaluationController = require('../controllers/evaluationController');

// @desc    Evaluate written exam answers using Groq AI
// @route   POST /api/evaluate/written
router.post('/written', auth, aiQuota, evaluationController.evaluateWrittenAnswers);

// @desc    Generate AI explanation for a question
// @route   POST /api/evaluate/explain
router.post('/explain', auth, aiQuota, evaluationController.explainQuestion);

// @desc    Tutoring chat regarding a question
// @route   POST /api/evaluate/chat
router.post('/chat', auth, aiQuota, evaluationController.chatQuestion);

module.exports = router;
