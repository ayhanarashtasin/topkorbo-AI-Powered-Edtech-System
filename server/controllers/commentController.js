const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const Reaction = require('../models/Reaction');
const { uploadImage, deleteImage } = require('../services/uploadService');
const { sanitize, htmlToText } = require('../services/sanitizeService');
const { resolveMentions, ensureUsername } = require('../services/mentionService');
const { notify } = require('../services/notificationService');
const { addReputation } = require('../services/reputationService');
const { recomputePostScore } = require('../services/forumScoreService');
const { getIO } = require('../socket');
const {
  clampLimit,
  ascendingCreatedAtCursorFilter,
  finalizePage
} = require('../utils/forumPagination');
const {
  COMMENT_HTML_MAX,
  validateHtmlLength
} = require('../utils/forumValidation');
const { hideComment } = require('../services/forumCommentService');

const PAGE_SIZE = 30;
const POPULATE_AUTHOR =
  'name username avatar role collegeName universityName department hscBatch stream forumRole reputation';

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

async function uploadCommentImages(req) {
  const images = [];
  try {
    for (const file of (req.files || []).slice(0, 3)) {
      // eslint-disable-next-line no-await-in-loop
      const uploaded = await uploadImage(
        file,
        req.user.id,
        'topkorbo/forum/comments'
      );
      images.push(uploaded);
    }
    return images;
  } catch (error) {
    await Promise.allSettled(
      images.map((image) => deleteImage(image.publicId, image.url))
    );
    throw error;
  }
}

async function decrementPostComments(postId) {
  await Post.updateOne(
    { _id: postId },
    [{
      $set: {
        commentsCount: {
          $max: [0, { $subtract: [{ $ifNull: ['$commentsCount', 0] }, 1] }]
        }
      }
    }]
  );
}

const commentController = {
  /**
   * GET /api/posts/:postId/comments?cursor=
   * Returns a flat list of comments for the post (caller assembles tree).
   */
  async list(req, res, next) {
    try {
      const postExists = await Post.exists({
        _id: req.params.postId,
        isHidden: false
      });
      if (!postExists) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }

      const limit = clampLimit(req.query.limit, PAGE_SIZE, 100);
      const filter = { post: req.params.postId, isHidden: false };
      const cursorFilter = ascendingCreatedAtCursorFilter(req.query.cursor);
      if (cursorFilter) Object.assign(filter, cursorFilter);
      const comments = await Comment.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .limit(limit + 1)
        .populate('author', POPULATE_AUTHOR)
        .lean();
        
      const page = finalizePage(comments, limit, ['createdAt']);
      await attachUserReactions(page.items, req.user?.id, 'comment');
      return res.json({
        success: true,
        data: page.items,
        nextCursor: page.nextCursor
      });
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
      const htmlError = validateHtmlLength(raw, COMMENT_HTML_MAX, 'Comment');
      if (htmlError) {
        return res.status(400).json({ success: false, message: htmlError });
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
        if (!parent || parent.isHidden || String(parent.post) !== String(post._id)) {
          return res.status(400).json({ success: false, message: 'Invalid parent comment' });
        }
        depth = Math.min((parent.depth || 0) + 1, 12); // visual cap
      }

      const { ids: mentionIds } = await resolveMentions(safe);
      const images = await uploadCommentImages(req);
      let comment;
      let postCounterChanged = false;
      try {
        comment = await Comment.create({
          post: post._id,
          author: author._id,
          parent: parent ? parent._id : null,
          depth,
          contentHtml: safe,
          contentText: htmlToText(safe, 2000),
          images,
          mentions: mentionIds
        });

        const postCounter = await Post.updateOne(
          { _id: post._id, isHidden: false },
          { $inc: { commentsCount: 1 } }
        );
        if (postCounter.modifiedCount !== 1) {
          const error = new Error('Post is no longer available.');
          error.statusCode = 409;
          throw error;
        }
        postCounterChanged = true;

        if (parent) {
          const parentCounter = await Comment.updateOne(
            { _id: parent._id, isHidden: false },
            { $inc: { repliesCount: 1 } }
          );
          if (parentCounter.modifiedCount !== 1) {
            const error = new Error('Parent comment is no longer available.');
            error.statusCode = 409;
            throw error;
          }
        }
      } catch (error) {
        const cleanup = images.map((image) =>
          deleteImage(image.publicId, image.url)
        );
        if (comment?._id) {
          cleanup.push(Comment.deleteOne({ _id: comment._id }));
        }
        if (postCounterChanged) {
          cleanup.push(decrementPostComments(post._id));
        }
        await Promise.allSettled(cleanup);
        throw error;
      }

      const populated = await Comment.findById(comment._id).populate(
        'author',
        POPULATE_AUTHOR
      );

      const sideEffects = [];

      // Reputation to post author
      if (String(post.author) !== String(author._id)) {
        sideEffects.push(addReputation(post.author, 2));
      }

      // Notifications
      const io = getIO();
      io.to(`post:${String(post._id)}`).emit('comment:new', populated);
      if (parent && String(parent.author) !== String(author._id)) {
        sideEffects.push(notify(io, {
          recipient: parent.author,
          actor: author._id,
          type: 'reply',
          post: post._id,
          comment: comment._id,
          message: `${author.name} replied to your comment.`,
          preview: comment.contentText.slice(0, 120)
        }));
      } else if (!parent && String(post.author) !== String(author._id)) {
        sideEffects.push(notify(io, {
          recipient: post.author,
          actor: author._id,
          type: 'comment',
          post: post._id,
          comment: comment._id,
          message: `${author.name} commented on your post.`,
          preview: comment.contentText.slice(0, 120)
        }));
      }
      for (const uid of mentionIds) {
        sideEffects.push(notify(io, {
          recipient: uid,
          actor: author._id,
          type: 'mention',
          post: post._id,
          comment: comment._id,
          message: `${author.name} mentioned you in a comment.`,
          preview: comment.contentText.slice(0, 120)
        }));
      }
      await Promise.allSettled(sideEffects);

      // Recompute trending score
      try {
        await recomputePostScore(post._id);
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
      const htmlError = validateHtmlLength(contentHtml, COMMENT_HTML_MAX, 'Comment');
      if (htmlError) {
        return res.status(400).json({ success: false, message: htmlError });
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
      if (!comment || comment.isHidden) {
        return res.status(404).json({ success: false, message: 'Comment not found' });
      }
      const isOwner = String(comment.author) === String(req.user.id);
      const isAdmin = req.user.forumRole === 'admin' || req.user.forumRole === 'moderator';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const hidden = await hideComment(comment._id);
      if (!hidden.changed) {
        return res.status(404).json({ success: false, message: 'Comment not found' });
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
