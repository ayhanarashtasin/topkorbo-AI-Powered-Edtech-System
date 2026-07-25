const Post = require('../models/Post');

const scoreExpression = {
  $divide: [
    {
      $add: [
        { $ifNull: ['$reactionsCount.like', 0] },
        { $multiply: [2, { $ifNull: ['$reactionsCount.love', 0] }] },
        { $multiply: [3, { $ifNull: ['$commentsCount', 0] }] }
      ]
    },
    {
      $pow: [
        {
          $max: [
            1,
            {
              $divide: [
                { $subtract: ['$$NOW', '$createdAt'] },
                60 * 60 * 1000
              ]
            }
          ]
        },
        1.5
      ]
    }
  ]
};

/**
 * Recalculate a post's time-decayed score from the counters that exist at the
 * instant MongoDB applies this pipeline. This avoids a stale read/save cycle
 * overwriting a score produced by a concurrent comment or reaction.
 */
async function recomputePostScore(postId) {
  if (!postId) return;
  await Post.updateOne(
    { _id: postId },
    [{ $set: { score: scoreExpression } }]
  );
}

module.exports = { recomputePostScore, scoreExpression };
