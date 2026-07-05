const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { postUpload, verifyImageBytes } = require('../middleware/forumUpload');
const { writeLimiter } = require('../middleware/rateLimiters');
const postController = require('../controllers/postController');

// /posts/:id/bookmark MUST come before /posts/:id so Express doesn't
// send the bookmark request into the dynamic getOne handler.
router.get('/bookmarks/mine', auth, postController.myBookmarks);
router.post('/', auth, writeLimiter, postUpload.array('images', 8), verifyImageBytes, postController.create);
router.get('/', auth, postController.feed);
router.post('/:id/bookmark', auth, postController.toggleBookmark);
router.get('/:id', auth, postController.getOne);
router.patch('/:id', auth, postController.update);
router.delete('/:id', auth, postController.remove);

module.exports = router;