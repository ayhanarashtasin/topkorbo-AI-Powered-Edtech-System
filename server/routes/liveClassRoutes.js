const express = require('express');
const auth = require('../middleware/auth');
const requirePlan = require('../middleware/requirePlan');
const liveClassController = require('../controllers/liveClassController');

const router = express.Router();

router.get('/mentor/dashboard', auth, requirePlan('mentor_pro'), liveClassController.getMentorLiveClassDashboard);
router.post('/mentor/schedule', auth, requirePlan('mentor_pro'), liveClassController.scheduleMentorLiveClass);
router.patch('/mentor/schedule/:sessionId', auth, requirePlan('mentor_pro'), liveClassController.updateMentorScheduledLiveClass);
router.post('/mentor/schedule/:sessionId/cancel', auth, requirePlan('mentor_pro'), liveClassController.cancelMentorScheduledLiveClass);
router.post('/mentor/start', auth, requirePlan('mentor_pro'), liveClassController.startMentorLiveClass);
router.post('/mentor/:sessionId/end', auth, requirePlan('mentor_pro'), liveClassController.endMentorLiveClass);
router.get('/student/sessions', auth, liveClassController.listStudentLiveClasses);
router.post('/student/join', auth, liveClassController.joinStudentLiveClass);
router.post('/webhooks', liveClassController.handleLiveKitWebhook);

module.exports = router;
