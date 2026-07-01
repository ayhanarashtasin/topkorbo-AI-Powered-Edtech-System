const express = require('express');
const auth = require('../middleware/auth');
const mentorController = require('../controllers/mentorController');

const router = express.Router();

router.get('/mentors', auth, mentorController.listMentors);
router.get('/mentors/:mentorId', auth, mentorController.getMentorProfile);
router.post('/mentors/:mentorId/reviews', auth, mentorController.submitMentorReview);
router.get('/student-dashboard', auth, mentorController.studentDashboard);
router.get('/mentor-dashboard', auth, mentorController.mentorDashboard);
router.post('/requests', auth, mentorController.requestMentor);
router.patch('/requests/:connectionId', auth, mentorController.respondToRequest);

module.exports = router;
