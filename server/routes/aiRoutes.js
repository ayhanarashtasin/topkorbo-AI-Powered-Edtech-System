const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiQuota = require('../middleware/enforceAiQuota');
const requirePlan = require('../middleware/requirePlan');
const { aiLimiter } = require('../middleware/rateLimiters');
const aiController = require('../controllers/aiController');

// All AI chat routes require authentication + a per-user rate limit to cap
// LLM cost abuse and request amplification.
router.use(auth);
router.use(aiLimiter);

router.post('/chat', aiQuota, aiController.chat);
// Book tutor chat is a Pro+ reading feature (not metered against aiActions).
router.post('/book-chat', requirePlan('pro_plus'), aiController.bookChat);
router.post('/study-routine', aiQuota, aiController.studyRoutine);
router.post('/extract-question', aiQuota, aiController.extractQuestion);
// AI-battle opponent moves are bounded by the battle-room limit and the shared
// aiLimiter above (previously this endpoint was entirely unmetered).
router.post('/answer-mcq', aiController.answerMcq);
router.get('/history', aiController.getHistory);
router.delete('/history', aiController.clearHistory);
router.get('/book-history', aiController.bookHistory);
router.delete('/book-history', aiController.bookHistoryClear);

module.exports = router;
