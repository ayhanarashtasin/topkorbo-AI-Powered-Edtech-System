const Post = require('../models/Post');

const SCORE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
let lastFullRefreshAt = 0;
let refreshPromise = null;

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
async function recomputePostScore(postId, { session } = {}) {
  if (!postId) return;
  await Post.updateOne(
    { _id: postId },
    [{ $set: { score: scoreExpression } }],
    { session, timestamps: false }
  );
}

async function refreshTrendingScores({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastFullRefreshAt < SCORE_REFRESH_INTERVAL_MS) return;
  if (refreshPromise) return refreshPromise;

  refreshPromise = Post.updateMany(
    { isHidden: false },
    [{ $set: { score: scoreExpression } }],
    { timestamps: false }
  )
    .then(() => {
      lastFullRefreshAt = Date.now();
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function startTrendingScoreRefresh() {
  const timer = setInterval(() => {
    refreshTrendingScores({ force: true }).catch((error) => {
      console.error('Forum trending-score refresh failed:', error.message);
    });
  }, SCORE_REFRESH_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = {
  recomputePostScore,
  refreshTrendingScores,
  startTrendingScoreRefresh,
  scoreExpression,
  SCORE_REFRESH_INTERVAL_MS
};
