const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const Reaction = require('../models/Reaction');
const { uploadImage } = require('../services/uploadService');
const { sanitize, htmlToText } = require('../services/sanitizeService');
const { resolveMentions, ensureUsername } = require('../services/mentionService');
const { notify } = require('../services/notificationService');
const { addReputation } = require('../services/reputationService');
const { getIO } = require('../socket');
const rateLimit = require('express-rate-limit');

const PAGE_SIZE = 30;
const POPULATE_AUTHOR =
  'name username avatar role collegeName universityName department hscBatch stream forumRole reputation';

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { success: false, message: 'Slow down — too many comments in a short time.' }
});

async function attachUserReactions(docs, userId, targetType) {
  if (!userId || !docs || docs.length === 0) return docs;
  const ids = docs.map(d => d._id);
  const myReactions = await Reaction.find({
    targetType,
    target: { $in: ids },
    user: userId
  }).lean();
  const reactionMap = {};
  for (const r of myReactions) {
    reactionMap[String(r.target)] = r.type;
  }
  for (const d of docs) {
    d.userReaction = reactionMap[String(d._id)] || null;
  }
  return docs;
}

const commentController = {
  /** Rate limiter exposed for routes file to mount. */
  commentLimiter,

  /**
   * GET /api/posts/:postId/comments?cursor=
   * Returns a flat list of comments for the post (caller assembles tree).
   */
  async list(req, res, next) {
    try {
      const limit = Math.min(100, Number(req.query.limit) || PAGE_SIZE);
      const filter = { post: req.params.postId, isHidden: false };
      if (req.query.cursor && mongoose.Types.ObjectId.isValid(req.query.cursor)) {
        filter._id = { $gt: new mongoose.Types.ObjectId(req.query.cursor) };
      }
      const comments = await Comment.find(filter)
        .sort({ createdAt: 1 })
        .limit(limit + 1)
        .populate('author', POPULATE_AUTHOR)
        .lean();
        
      await attachUserReactions(comments, req.user?.id, 'comment');
      
      let nextCursor = null;
      if (comments.length > limit) {
        const last = comments.pop();
        nextCursor = last._id;
      }
      return res.json({ success: true, data: comments, nextCursor });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/posts/:postId/comments
   * Body: { contentHtml, parentId? } + multipart images[] (up to 3)
   */
  async create(req, res, next) {
    try {
      const post = await Post.findById(req.params.postId);
      if (!post || post.isHidden) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }
      const author = await User.findById(req.user.id);
      if (!author) return res.status(404).json({ success: false, message: 'User not found' });
      if (author.isBanned) {
        return res.status(403).json({ success: false, message: 'Account is suspended.' });
      }
      await ensureUsername(author);

      const { contentHtml: raw, parentId } = req.body;
      if (!raw || !String(raw).trim()) {
        return res.status(400).json({ success: false, message: 'contentHtml is required' });
      }
      const safe = sanitize(raw);
      if (!safe || !htmlToText(safe)) {
        return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });
      }

      let parent = null;
      let depth = 0;
      if (parentId) {
        // eslint-disable-next-line no-await-in-loop
        parent = await Comment.findById(parentId);
        if (!parent || String(parent.post) !== String(post._id)) {
          return res.status(400).json({ success: false, message: 'Invalid parent comment' });
        }
        depth = Math.min((parent.depth || 0) + 1, 12); // visual cap
      }

      const images = [];
      for (const f of (req.files || []).slice(0, 3)) {
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await uploadImage(f, req.user.id, 'topkorbo/forum/comments');
        images.push(uploaded);
      }

      const { ids: mentionIds } = await resolveMentions(safe);

      const comment = await Comment.create({
        post: post._id,
        author: author._id,
        parent: parent ? parent._id : null,
        depth,
        contentHtml: safe,
        contentText: htmlToText(safe, 2000),
        images,
        mentions: mentionIds
      });

      post.commentsCount = (post.commentsCount || 0) + 1;
      if (parent) parent.repliesCount = (parent.repliesCount || 0) + 1;
      await post.save();
      if (parent) await parent.save();

      const populated = await Comment.findById(comment._id).populate(
        'author',
        POPULATE_AUTHOR
      );

      // Reputation to post author
      if (String(post.author) !== String(author._id)) {
        await addReputation(post.author, 2);
      }

      // Notifications
      const io = getIO();
      io.to(`post:${String(post._id)}`).emit('comment:new', populated);
      if (parent && String(parent.author) !== String(author._id)) {
        await notify(io, {
          recipient: parent.author,
          actor: author._id,
          type: 'reply',
          post: post._id,
          comment: comment._id,
          message: `${author.name} replied to your comment.`,
          preview: comment.contentText.slice(0, 120)
        });
      } else if (!parent && String(post.author) !== String(author._id)) {
        await notify(io, {
          recipient: post.author,
          actor: author._id,
          type: 'comment',
          post: post._id,
          comment: comment._id,
          message: `${author.name} commented on your post.`,
          preview: comment.contentText.slice(0, 120)
        });
      }
      for (const uid of mentionIds) {
        // eslint-disable-next-line no-await-in-loop
        await notify(io, {
          recipient: uid,
          actor: author._id,
          type: 'mention',
          post: post._id,
          comment: comment._id,
          message: `${author.name} mentioned you in a comment.`,
          preview: comment.contentText.slice(0, 120)
        });
      }

      // Recompute trending score
      try {
        const hours = Math.max(1, (Date.now() - new Date(post.createdAt).getTime()) / 3.6e6);
        const likes = (post.reactionsCount?.like || 0) + 2 * (post.reactionsCount?.love || 0);
        post.score = (likes + 3 * post.commentsCount) / Math.pow(hours, 1.5);
        await post.save();
      } catch (e) {
        /* best-effort */
      }

      return res.status(201).json({ success: true, data: populated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/comments/:id  (author only)
   */
  async update(req, res, next) {
    try {
      const comment = await Comment.findById(req.params.id);
      if (!comment || comment.isHidden) {
        return res.status(404).json({ success: false, message: 'Comment not found' });
      }
      if (String(comment.author) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Not your comment' });
      }
      const { contentHtml } = req.body;
      if (!contentHtml) {
        return res.status(400).json({ success: false, message: 'contentHtml is required' });
      }
      const safe = sanitize(contentHtml);
      if (!safe || !htmlToText(safe)) {
        return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });
      }
      comment.contentHtml = safe;
      comment.contentText = htmlToText(safe, 2000);
      const { ids: mentionIds } = await resolveMentions(safe);
      comment.mentions = mentionIds;
      comment.isEdited = true;
      comment.editedAt = new Date();
      await comment.save();
      const populated = await Comment.findById(comment._id).populate(
        'author',
        POPULATE_AUTHOR
      );
      const io = getIO();
      io.to(`post:${String(comment.post)}`).emit('comment:update', populated);
      return res.json({ success: true, data: populated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/comments/:id  (owner or admin)
   */
  async remove(req, res, next) {
    try {
      const comment = await Comment.findById(req.params.id);
      if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
      const isOwner = String(comment.author) === String(req.user.id);
      const isAdmin = req.user.forumRole === 'admin' || req.user.forumRole === 'moderator';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      comment.isHidden = true;
      await comment.save();
      const post = await Post.findById(comment.post);
      if (post) {
        post.commentsCount = Math.max(0, (post.commentsCount || 0) - 1);
        await post.save();
      }
      const io = getIO();
      io.to(`post:${String(comment.post)}`).emit('comment:delete', {
        commentId: comment._id,
        postId: comment.post
      });
      return res.json({ success: true, data: { _id: comment._id } });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = commentController;