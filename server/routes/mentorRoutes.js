const express = require('express');
const auth = require('../middleware/auth');
const mentorController = require('../controllers/mentorController');

const router = express.Router();

router.get('/mentors', auth, mentorController.listMentors);
router.get('/student-dashboard', auth, mentorController.studentDashboard);
router.get('/mentor-dashboard', auth, mentorController.mentorDashboard);
router.post('/requests', auth, mentorController.requestMentor);
router.patch('/requests/:connectionId', auth, mentorController.respondToRequest);

module.exports = router;
