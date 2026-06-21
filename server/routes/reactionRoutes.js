const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const reactionController = require('../controllers/reactionController');

router.post('/', auth, reactionController.toggle);

module.exports = router;