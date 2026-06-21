const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { uploadImage, deleteImage } = require('../services/uploadService');
const { sanitize, htmlToText } = require('../services/sanitizeService');
const { ensureUsername, resolveMentions } = require('../services/mentionService');
const { notify } = require('../services/notificationService');
const { getIO } = require('../socket');
const rateLimit = require('express-rate-limit');

const PAGE_SIZE = 20;

const POPULATE_AUTHOR = 'name username avatar role collegeName universityName department hscBatch stream forumRole reputation';

/**
 * Compute a trending score. Simple time-decayed engagement.
 *   score = (reactions + 3*comments) / hoursSincePost^1.5
 * Stored in `score` so we can index it for fast sorting.
 */
function computeScore(post) {
  const likes = (post.reactionsCount?.like || 0) + 2 * (post.reactionsCount?.love || 0);
  const comments = post.commentsCount || 0;
  const hours = Math.max(1, (Date.now() - new Date(post.createdAt).getTime()) / 3.6e6);
  return (likes + 3 * comments) / Math.pow(hours, 1.5);
}

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { success: false, message: 'You are posting too fast — try again in a minute.' }
});

async function uploadPostImages(req) {
  const files = (req.files || []).slice(0, 8);
  const out = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    const uploaded = await uploadImage(f, req.user.id, 'topkorbo/forum/posts');
    out.push(uploaded);
  }
  return out;
}

const postController = {
  /** Rate limiter exposed for the routes file to mount separately. */
  createLimiter,

  /**
   * POST /api/posts
   * multipart/form-data with fields:
   *   - contentHtml (required)
   *   - title (optional)
   *   - category (optional, default "General")
   *   - type ("text" | "question", default "text")
   *   - tags (comma-separated)
   *   - images (up to 8 files)
   */
  async create(req, res, next) {
    try {
      const author = await User.findById(req.user.id);
      if (!author) return res.status(404).json({ success: false, message: 'User not found' });
      if (author.isBanned) {
        return res.status(403).json({ success: false, message: 'Account is suspended.' });
      }
      await ensureUsername(author);

      const { contentHtml: rawHtml, title, category, type, tags } = req.body;
      if (!rawHtml || !String(rawHtml).trim()) {
        return res.status(400).json({ success: false, message: 'contentHtml is required' });
      }
      const safeHtml = sanitize(rawHtml);
      if (!safeHtml || !htmlToText(safeHtml)) {
        return res.status(400).json({ success: false, message: 'Post body cannot be empty.' });
      }

      const images = await uploadPostImages(req);
      const { ids: mentionIds } = await resolveMentions(safeHtml);
      const tagList = String(tags || '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);

      const post = await Post.create({
        author: author._id,
        type: type === 'question' ? 'question' : 'text',
        category: category || 'General',
        title: title ? String(title).trim().slice(0, 200) : undefined,
        contentHtml: safeHtml,
        contentText: htmlToText(safeHtml, 5000),
        images,
        mentions: mentionIds,
        tags: tagList,
        groupVisibility: author.stream ? [author.stream] : []
      });

      post.score = computeScore(post);
      await post.save();

      const populated = await Post.findById(post._id).populate('author', POPULATE_AUTHOR);

      // Broadcast + mention notifications
      const io = getIO();
      io.emit('post:new', populated);
      for (const uid of mentionIds) {
        // eslint-disable-next-line no-await-in-loop
        await notify(io, {
          recipient: uid,
          actor: author._id,
          type: 'mention',
          post: post._id,
          message: `${author.name} mentioned you in a post.`,
          preview: post.contentText.slice(0, 120)
        });
      }

      return res.status(201).json({ success: true, data: populated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/posts?feed=latest|trending|following|discussed&category=&cursor=
   */
  async feed(req, res, next) {
    try {
      const feed = String(req.query.feed || 'latest');
      const category = req.query.category ? String(req.query.category) : null;
      const cursor = req.query.cursor;
      const limit = Math.min(50, Number(req.query.limit) || PAGE_SIZE);

      const baseFilter = { isHidden: false };
      if (category && category !== 'All') baseFilter.category = category;

      if (feed === 'following' && req.user) {
        const me = await User.findById(req.user.id).select('following');
        const ids = (me?.following || []).map((id) => id);
        if (!ids.length) {
          return res.json({ success: true, data: [], nextCursor: null });
        }
        baseFilter.author = { $in: ids };
      }

      let sort = { createdAt: -1 };
      if (feed === 'trending') sort = { score: -1, createdAt: -1 };
      else if (feed === 'discussed') sort = { commentsCount: -1, createdAt: -1 };

      if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
        baseFilter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      }

      const posts = await Post.find(baseFilter)
        .sort(sort)
        .limit(limit + 1)
        .populate('author', POPULATE_AUTHOR)
        .lean({ virtuals: true });

      let nextCursor = null;
      if (posts.length > limit) {
        const last = posts.pop();
        nextCursor = last._id;
      }

      return res.json({ success: true, data: posts, nextCursor });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/posts/:id
   */
  async getOne(req, res, next) {
    try {
      const post = await Post.findById(req.params.id).populate(
        'author',
        POPULATE_AUTHOR
      );
      if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
      if (post.isHidden) {
        const isOwner = req.user && String(req.user.id) === String(post.author._id);
        const isAdmin = req.user && (req.user.forumRole === 'admin' || req.user.forumRole === 'moderator');
        if (!isOwner && !isAdmin) {
          return res.status(404).json({ success: false, message: 'Post not found' });
        }
      }
      return res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/posts/:id  (author only)
   */
  async update(req, res, next) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
      if (String(post.author) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Not your post' });
      }
      const { contentHtml, title, category, tags, type } = req.body;
      if (contentHtml !== undefined) {
        const safe = sanitize(contentHtml);
        if (!safe || !htmlToText(safe)) {
          return res.status(400).json({ success: false, message: 'Post body cannot be empty.' });
        }
        post.contentHtml = safe;
        post.contentText = htmlToText(safe, 5000);
        const { ids: mentionIds } = await resolveMentions(safe);
        post.mentions = mentionIds;
      }
      if (title !== undefined) post.title = String(title).trim().slice(0, 200);
      if (category) post.category = category;
      if (type === 'text' || type === 'question') post.type = type;
      if (tags !== undefined) {
        post.tags = String(tags)
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8);
      }
      post.isEdited = true;
      post.editedAt = new Date();
      await post.save();

      const populated = await Post.findById(post._id).populate('author', POPULATE_AUTHOR);
      const io = getIO();
      io.to(`post:${String(post._id)}`).emit('post:update', populated);

      return res.json({ success: true, data: populated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/posts/:id  (owner or admin)
   */
  async remove(req, res, next) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
      const isOwner = String(post.author) === String(req.user.id);
      const isAdmin = req.user.forumRole === 'admin' || req.user.forumRole === 'moderator';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      post.isHidden = true;
      post.hiddenReason = isAdmin && !isOwner ? 'Removed by moderator' : 'Deleted by author';
      await post.save();
      // Best-effort delete images
      for (const img of post.images) {
        // eslint-disable-next-line no-await-in-loop
        await deleteImage(img.publicId, img.url);
      }
      const io = getIO();
      io.to(`post:${String(post._id)}`).emit('post:delete', { postId: post._id });
      return res.json({ success: true, data: { _id: post._id } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/posts/:id/bookmark  (toggle)
   */
  async toggleBookmark(req, res, next) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post || post.isHidden) return res.status(404).json({ success: false, message: 'Post not found' });
      const me = await User.findById(req.user.id).select('bookmarks');
      if (!me) return res.status(404).json({ success: false, message: 'User not found' });
      
      const isBookmarked = me.bookmarks.some((b) => String(b) === String(post._id));
      
      if (isBookmarked) {
        await User.updateOne({ _id: me._id }, { $pull: { bookmarks: post._id } });
        await Post.updateOne({ _id: post._id }, { $inc: { bookmarksCount: -1 } });
        return res.json({ success: true, data: { bookmarked: false, bookmarksCount: Math.max(0, (post.bookmarksCount || 0) - 1) } });
      } else {
        await User.updateOne({ _id: me._id }, { $addToSet: { bookmarks: post._id } });
        await Post.updateOne({ _id: post._id }, { $inc: { bookmarksCount: 1 } });
        return res.json({ success: true, data: { bookmarked: true, bookmarksCount: (post.bookmarksCount || 0) + 1 } });
      }
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/:id/posts — posts by a user
   */
  async byUser(req, res, next) {
    try {
      const limit = Math.min(50, Number(req.query.limit) || PAGE_SIZE);
      const cursor = req.query.cursor;
      const filter = { author: req.params.id, isHidden: false };
      if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
        filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      }
      const posts = await Post.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .populate('author', POPULATE_AUTHOR)
        .lean({ virtuals: true });
      let nextCursor = null;
      if (posts.length > limit) {
        const last = posts.pop();
        nextCursor = last._id;
      }
      return res.json({ success: true, data: posts, nextCursor });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/me/bookmarks
   */
  async myBookmarks(req, res, next) {
    try {
      const me = await User.findById(req.user.id).select('bookmarks');
      const ids = me?.bookmarks || [];
      if (!ids.length) return res.json({ success: true, data: [] });
      // Preserve bookmark order (most recent first), then sort by createdAt
      const posts = await Post.find({ _id: { $in: ids }, isHidden: false })
        .sort({ createdAt: -1 })
        .populate('author', POPULATE_AUTHOR)
        .lean({ virtuals: true });
      return res.json({ success: true, data: posts });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Recompute score for one post (called after reaction/comment changes).
   */
  async recomputeScore(postId) {
    try {
      const post = await Post.findById(postId);
      if (!post) return;
      post.score = computeScore(post);
      await post.save();
    } catch (e) {
      // best-effort
    }
  }
};

module.exports = postController;