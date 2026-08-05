/**
 * Comment controller — CRUD operations for forum comments.
 *
 * Each method follows a consistent pattern:
 * 1. Validate input and permissions
 * 2. Perform atomic mutations inside a MongoDB transaction
 * 3. Emit real-time updates via Socket.IO
 * 4. Send async notifications (fire-and-forget)
 */
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
const { withMongoTransaction } = require('../utils/mongoTransaction');

const PAGE_SIZE = 30;
const POPULATE_AUTHOR =
  'name username avatar role collegeName universityName department hscBatch stream forumRole reputation';

/**
 * Enriches comment documents with the current user's reaction type.
 * Batch-fetches reactions for all comments in one query instead of N+1 lookups.
 */
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

/**
 * Uploads comment images to Cloudinary.
 * Rolls back (deletes) any already-uploaded images if a later upload fails.
 * Capped at 3 images per comment.
 */
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

const commentController = {
  /**
   * GET /api/posts/:postId/comments?cursor=
   * Cursor-paginated list of comments for a post.
   * Returns a flat list; the client assembles the tree using `parent` and `depth`.
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
   * Creates a new comment (or reply) with optional image attachments.
   *
   * Workflow:
   * 1. Validate post exists, author is not banned, content is safe
   * 2. Upload images (with rollback on failure)
   * 3. Inside a transaction: create comment, increment counters,
   *    award reputation to post author, recompute post score
   * 4. Emit real-time updates and send notifications asynchronously
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

      const { ids: mentionIds } = await resolveMentions(safe);
      const images = await uploadCommentImages(req);
      let created;
      try {
        // Transaction ensures comment creation, counter increments,
        // and score recomputation all succeed or all fail atomically.
        created = await withMongoTransaction(async (session) => {
          const currentPost = await Post.findOne({ _id: post._id, isHidden: false })
            .session(session);
          if (!currentPost) {
            const error = new Error('Post is no longer available.');
            error.statusCode = 409;
            throw error;
          }

          let parent = null;
          let depth = 0;
          if (parentId) {
            parent = await Comment.findOne({
              _id: parentId,
              post: currentPost._id,
              isHidden: false
            }).session(session);
            if (!parent) {
              const error = new Error('Invalid parent comment');
              error.statusCode = 400;
              throw error;
            }
            // Cap nesting depth to prevent UI overflow on deep threads.
            depth = Math.min((parent.depth || 0) + 1, 12);
          }

          const [comment] = await Comment.create([{
            post: currentPost._id,
            author: author._id,
            parent: parent ? parent._id : null,
            depth,
            contentHtml: safe,
            contentText: htmlToText(safe, 2000),
            images,
            mentions: mentionIds
          }], { session });

          const updatedPost = await Post.findOneAndUpdate(
            { _id: currentPost._id, isHidden: false },
            { $inc: { commentsCount: 1 } },
            { new: true, session, timestamps: false }
          );
          if (!updatedPost) {
            const error = new Error('Post is no longer available.');
            error.statusCode = 409;
            throw error;
          }

          if (parent) {
            const parentCounter = await Comment.updateOne(
              { _id: parent._id, isHidden: false },
              { $inc: { repliesCount: 1 } },
              { session, timestamps: false }
            );
            if (parentCounter.modifiedCount !== 1) {
              const error = new Error('Parent comment is no longer available.');
              error.statusCode = 409;
              throw error;
            }
          }

          // Award reputation points to the post author for receiving engagement.
          if (String(currentPost.author) !== String(author._id)) {
            await addReputation(currentPost.author, 2, { session });
          }
          await recomputePostScore(currentPost._id, { session });

          return {
            commentId: comment._id,
            parentAuthor: parent ? String(parent.author) : null,
            postAuthor: String(currentPost.author),
            commentsCount: updatedPost.commentsCount || 0
          };
        });
      } catch (error) {
        // Roll back uploaded images if the transaction fails.
        await Promise.allSettled(
          images.map((image) => deleteImage(image.publicId, image.url))
        );
        throw error;
      }

      const populated = await Comment.findById(created.commentId).populate(
        'author',
        POPULATE_AUTHOR
      );

      const sideEffects = [];

      const io = getIO();
      io.to(`post:${String(post._id)}`).emit('comment:new', populated);
      io.to('forum').emit('post:stats', {
        postId: String(post._id),
        commentsCount: created.commentsCount
      });
      // Notify the parent comment author (reply notification)
      // or the post author (top-level comment notification).
      if (created.parentAuthor && created.parentAuthor !== String(author._id)) {
        sideEffects.push(notify(io, {
          recipient: created.parentAuthor,
          actor: author._id,
          type: 'reply',
          post: post._id,
          comment: created.commentId,
          message: `${author.name} replied to your comment.`,
          preview: populated.contentText.slice(0, 120)
        }));
      } else if (!created.parentAuthor && created.postAuthor !== String(author._id)) {
        sideEffects.push(notify(io, {
          recipient: post.author,
          actor: author._id,
          type: 'comment',
          post: post._id,
          comment: created.commentId,
          message: `${author.name} commented on your post.`,
          preview: populated.contentText.slice(0, 120)
        }));
      }
      // Notify all mentioned users.
      for (const uid of mentionIds) {
        sideEffects.push(notify(io, {
          recipient: uid,
          actor: author._id,
          type: 'mention',
          post: post._id,
          comment: created.commentId,
          message: `${author.name} mentioned you in a comment.`,
          preview: populated.contentText.slice(0, 120)
        }));
      }
      await Promise.allSettled(sideEffects);

      return res.status(201).json({ success: true, data: populated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/comments/:id
   * Allows the comment author to edit their own comment.
   * Updates HTML content, plain-text version, mentions, and edit timestamp.
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
   * DELETE /api/comments/:id
   * Soft-deletes a comment. Only the author or an admin/moderator can delete.
   * Delegates to forumCommentService which handles the transactional
   * hide logic, counter decrements, and score recomputation.
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
      const updatedPost = await Post.findById(comment.post).select('commentsCount').lean();
      io.to('forum').emit('post:stats', {
        postId: String(comment.post),
        commentsCount: updatedPost?.commentsCount || 0
      });
      return res.json({ success: true, data: { _id: comment._id } });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = commentController;
