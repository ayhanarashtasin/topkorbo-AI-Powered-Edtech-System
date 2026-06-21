const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { commentUpload } = require('../middleware/forumUpload');
const commentController = require('../controllers/commentController');

// Comments nested under posts
const postComments = express.Router({ mergeParams: true });
postComments.get('/', auth, commentController.list);
postComments.post(
  '/',
  auth,
  commentController.commentLimiter,
  commentUpload.array('images', 3),
  commentController.create
);

// Top-level comment operations (edit/delete)
router.patch('/:id', auth, commentController.update);
router.delete('/:id', auth, commentController.remove);

module.exports = { postComments, router };