/**
 * Post Routes
 *
 * RESTful endpoints for creating, reading, updating, and deleting forum posts.
 * All routes require authentication. Write operations are rate-limited,
 * and image uploads are validated for size/type before processing.
 *
 * Route ordering matters: static paths (e.g. /bookmarks/mine) must come
 * before dynamic parameter routes (e.g. /:id) to avoid Express matching
 * "bookmarks" as an ID.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { postUpload, verifyImageBytes } = require('../middleware/forumUpload');
const { writeLimiter } = require('../middleware/rateLimiters');
const postController = require('../controllers/postController');

// --- Static routes (must precede /:id routes) ---

// GET /posts/bookmarks/mine - Retrieve current user's bookmarked posts
router.get('/bookmarks/mine', auth, postController.myBookmarks);

// --- Create ---
// POST /posts - Create a new post with optional image uploads (max 8)
// Middleware chain: authenticate → rate limit → upload images → verify image bytes → create
router.post('/', auth, writeLimiter, postUpload.array('images', 8), verifyImageBytes, postController.create);

// --- Read (list) ---
// GET /posts - Authenticated feed of posts (sorted by date or trending)
router.get('/', auth, postController.feed);

// --- Bookmark ---
// POST /posts/:id/bookmark - Toggle bookmark on/off for a post
router.post('/:id/bookmark', auth, writeLimiter, postController.toggleBookmark);

// --- Read (single) ---
// GET /posts/:id - Fetch a single post with comments
router.get('/:id', auth, postController.getOne);

// --- Update ---
// PATCH /posts/:id - Update post content and/or images
// Same middleware chain as create to handle re-uploaded images
router.patch(
  '/:id',
  auth,
  writeLimiter,
  postUpload.array('images', 8),
  verifyImageBytes,
  postController.update
);

// --- Delete ---
// DELETE /posts/:id - Soft-delete (hide) a post
router.delete('/:id', auth, writeLimiter, postController.remove);

module.exports = router;
