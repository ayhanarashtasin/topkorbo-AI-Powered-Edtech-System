const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiController = require('../controllers/aiController');

// All AI chat routes require authentication
router.use(auth);

router.post('/chat', aiController.chat);
router.post('/study-routine', aiController.studyRoutine);
router.post('/extract-question', aiController.extractQuestion);
router.post('/answer-mcq', aiController.answerMcq);
router.get('/history', aiController.getHistory);
router.delete('/history', aiController.clearHistory);

module.exports = router;
