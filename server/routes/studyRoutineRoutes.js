const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const aiQuota = require('../middleware/enforceAiQuota');
const studyRoutineController = require('../controllers/studyRoutineController');
const aiController = require('../controllers/aiController');

router.use(auth);

// Rate limiter for AI-powered endpoints: 10 requests per minute per user
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const userId = req.user?.id || req.user?._id;
    return userId
      ? `u:${String(userId)}`
      : `ip:${rateLimit.ipKeyGenerator(req.ip)}`;
  },
  message: { success: false, message: 'Too many requests. Please slow down and try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/', studyRoutineController.getRoutine);
router.get('/stats', studyRoutineController.getStats);
router.post('/', studyRoutineController.saveRoutine);
router.patch('/segment', studyRoutineController.toggleSegment);
router.patch('/segment/edit', studyRoutineController.updateSegment);
router.put('/replace', studyRoutineController.replaceRoutine);
router.post('/modify', aiRateLimiter, aiQuota, aiController.modifyStudyRoutine);
router.post('/generate-week', aiRateLimiter, aiQuota, aiController.generateNextWeek);
router.delete('/', studyRoutineController.deleteRoutine);

router.post('/session/start', studyRoutineController.startSession);
router.post('/session/stop', studyRoutineController.stopSession);

module.exports = router;
