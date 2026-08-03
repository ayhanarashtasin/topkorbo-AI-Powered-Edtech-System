const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { deleteImage } = require('./uploadService');
const { recomputePostScore } = require('./forumScoreService');
const { withMongoTransaction } = require('../utils/mongoTransaction');

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

async function hideComment(commentId, { session } = {}) {
  if (session) return hideCommentInTransaction(commentId, session);

  const result = await withMongoTransaction((transactionSession) =>
    hideCommentInTransaction(commentId, transactionSession)
  );

  await Promise.allSettled(
    (result.comment?.images || []).map((image) => deleteImage(image.publicId, image.url))
  );
  return result;
}

module.exports = { hideComment, hideCommentInTransaction };
