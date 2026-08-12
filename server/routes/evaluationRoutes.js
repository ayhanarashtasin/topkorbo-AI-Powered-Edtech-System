const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiQuota = require('../middleware/enforceAiQuota');
const evaluationController = require('../controllers/evaluationController');
const multer = require('multer');
const { aiLimiter } = require('../middleware/rateLimiters');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

// @desc    Evaluate CQ written image using AI Vision
// @route   POST /api/evaluate/cq
router.post('/cq', auth, aiQuota, aiLimiter, upload.single('answerImage'), evaluationController.evaluateCQ);

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
