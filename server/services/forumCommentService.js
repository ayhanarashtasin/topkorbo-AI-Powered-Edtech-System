/**
 * Comment deletion service.
 *
 * Handles hiding comments while maintaining data consistency across
 * related counters (Post.commentsCount, Comment.repliesCount) and
 * the post's engagement score. All mutations run inside a single
 * MongoDB transaction to prevent partial updates on failure.
 */
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { deleteImage } = require('./uploadService');
const { recomputePostScore } = require('./forumScoreService');
const { withMongoTransaction } = require('../utils/mongoTransaction');

/**
 * Atomically decrements a numeric field on a document by 1.
 * Uses $max to floor the value at 0, preventing negative counts.
 * Accepts an optional session to participate in a caller's transaction.
 */
async function decrementCounter(model, id, field, session) {
  if (!id) return null;
  return model.updateOne(
    { _id: id },
    [{
      $set: {
        [field]: {
          $max: [0, { $subtract: [{ $ifNull: [`$${field}`, 0] }, 1] }]
        }
      }
    }],
    { session, timestamps: false }
  );
}

/**
 * Core hide logic that runs inside a MongoDB transaction.
 * Soft-deletes the comment, decrements parent counters, and
 * recomputes the post's score — all atomically.
 */
async function hideCommentInTransaction(commentId, session) {
  const comment = await Comment.findOneAndUpdate(
    { _id: commentId, isHidden: false },
    { $set: { isHidden: true } },
    { new: false, session }
  ).lean();

  if (!comment) return { changed: false, comment: null };

  await decrementCounter(Post, comment.post, 'commentsCount', session);
  await decrementCounter(Comment, comment.parent, 'repliesCount', session);
  await recomputePostScore(comment.post, { session });

  return { changed: true, comment };
}

/**
 * Public API: hides a comment and cleans up its attached images.
 * Wraps the transaction and image cleanup so callers don't need
 * to manage sessions or handle Cloudinary deletion.
 */
async function hideComment(commentId, { session } = {}) {
  if (session) return hideCommentInTransaction(commentId, session);

  const result = await withMongoTransaction((transactionSession) =>
    hideCommentInTransaction(commentId, transactionSession)
  );

  // Clean up Cloudinary images after the transaction commits.
  // Fire-and-forget: image deletion failures are non-critical.
  await Promise.allSettled(
    (result.comment?.images || []).map((image) => deleteImage(image.publicId, image.url))
  );
  return result;
}

module.exports = { hideComment, hideCommentInTransaction };
