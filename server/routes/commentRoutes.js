const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { commentUpload, verifyImageBytes } = require('../middleware/forumUpload');
const commentController = require('../controllers/commentController');
const { writeLimiter } = require('../middleware/rateLimiters');

// Comments nested under posts
const postComments = express.Router({ mergeParams: true });
postComments.get('/', auth, commentController.list);
postComments.post(
  '/',
  auth,
  writeLimiter,
  commentUpload.array('images', 3),
  verifyImageBytes,
  commentController.create
);

// Top-level comment operations (edit/delete)
router.patch('/:id', auth, writeLimiter, commentController.update);
router.delete('/:id', auth, writeLimiter, commentController.remove);

module.exports = { postComments, router };
