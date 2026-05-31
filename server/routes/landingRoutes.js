const express = require('express');
const router = express.Router();
const landingController = require('../controllers/landingController');

router.post('/waitlist', landingController.joinWaitlist);
router.get('/stats', landingController.getStats);

module.exports = router;
