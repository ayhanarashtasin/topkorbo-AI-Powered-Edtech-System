const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const battleController = require('../controllers/battleController');

router.post('/rooms', auth, battleController.createRoom);
router.get('/rooms/:roomId', auth, battleController.getRoom);
router.post('/rooms/:roomId/join', auth, battleController.joinRoom);
router.post('/rooms/:roomId/start', auth, battleController.startRoom);
router.post('/rooms/:roomId/answer', auth, battleController.submitAnswer);

module.exports = router;
