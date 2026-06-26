const express = require('express');
const auth = require('../middleware/auth');
const liveClassController = require('../controllers/liveClassController');

const router = express.Router();

router.get('/mentor/dashboard', auth, liveClassController.getMentorLiveClassDashboard);
router.post('/mentor/start', auth, liveClassController.startMentorLiveClass);
router.post('/mentor/:sessionId/end', auth, liveClassController.endMentorLiveClass);
router.get('/student/sessions', auth, liveClassController.listStudentLiveClasses);
router.post('/student/join', auth, liveClassController.joinStudentLiveClass);
router.post('/webhooks', liveClassController.handleLiveKitWebhook);

module.exports = router;
