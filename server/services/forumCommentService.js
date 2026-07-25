const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { deleteImage } = require('./uploadService');
const { recomputePostScore } = require('./forumScoreService');

async function decrementCounter(model, id, field) {
  if (!id) return null;
  return model.updateOne(
    { _id: id },
    [{
      $set: {
        [field]: {
          $max: [0, { $subtract: [{ $ifNull: [`$${field}`, 0] }, 1] }]
        }
      }
    }]
  );
}

async function incrementCounter(model, id, field) {
  if (!id) return null;
  return model.updateOne({ _id: id }, { $inc: { [field]: 1 } });
}

async function hideComment(commentId) {
  const comment = await Comment.findOneAndUpdate(
    { _id: commentId, isHidden: false },
    { $set: { isHidden: true } },
    { new: false }
  ).lean();

  if (!comment) return { changed: false, comment: null };

  const counterResults = await Promise.allSettled([
    decrementCounter(Post, comment.post, 'commentsCount'),
    decrementCounter(Comment, comment.parent, 'repliesCount')
  ]);
  const failed = counterResults.find((result) => result.status === 'rejected');
  if (failed) {
    const rollback = [
      Comment.updateOne(
        { _id: comment._id, isHidden: true },
        { $set: { isHidden: false } }
      )
    ];
    if (counterResults[0].status === 'fulfilled') {
      rollback.push(incrementCounter(Post, comment.post, 'commentsCount'));
    }
    if (comment.parent && counterResults[1].status === 'fulfilled') {
      rollback.push(incrementCounter(Comment, comment.parent, 'repliesCount'));
    }
    await Promise.allSettled(rollback);
    throw failed.reason;
  }

  await Promise.allSettled(
    (comment.images || []).map((image) => deleteImage(image.publicId, image.url))
  );
  await recomputePostScore(comment.post).catch(() => {});

  return { changed: true, comment };
}

module.exports = { hideComment };
