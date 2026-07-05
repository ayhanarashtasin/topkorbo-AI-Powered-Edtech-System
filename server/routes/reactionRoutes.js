const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiters');
const reactionController = require('../controllers/reactionController');

router.post('/', auth, writeLimiter, reactionController.toggle);

module.exports = router;