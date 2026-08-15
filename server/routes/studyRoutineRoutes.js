const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiQuota = require('../middleware/enforceAiQuota');
const { aiLimiter } = require('../middleware/rateLimiters');
const ctrl = require('../controllers/studyRoutineController');

router.use(auth);

// CRUD
router.get('/', ctrl.getRoutine);
router.post('/', ctrl.saveRoutine);
router.put('/', ctrl.replaceRoutine);
router.delete('/', ctrl.deleteRoutine);
router.get('/stats', ctrl.getStats);
router.patch('/:dayIndex/:segmentId/toggle', ctrl.toggleSegment);
router.put('/:dayIndex/:segmentId', ctrl.editSegment);

// Session
router.post('/session/start', ctrl.startSession);
router.post('/session/stop', ctrl.stopSession);

// AI (rate-limited + quota-metered)
router.post('/ai/chat', aiLimiter, aiQuota, ctrl.aiChat);
router.post('/ai/modify', aiLimiter, aiQuota, ctrl.aiModify);
router.post('/ai/generate-week', aiLimiter, aiQuota, ctrl.aiGenerateWeek);

module.exports = router;
