const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { avatarUpload, verifyImageBytes } = require('../middleware/forumUpload');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');

router.get('/me', auth, userController.me);
router.patch('/me', auth, avatarUpload.single('avatar'), verifyImageBytes, userController.updateMe);

// Follow
router.post('/:id/follow', auth, userController.follow);
router.delete('/:id/follow', auth, userController.unfollow);
router.get('/:id/follow-state', auth, userController.followState);

// Public profile (must be last so dynamic :id doesn't shadow /me)
router.get('/:id/posts', auth, postController.byUser);
router.get('/:id', auth, userController.getById);

module.exports = router;