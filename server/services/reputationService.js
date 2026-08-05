/**
 * Reputation service — manages per-user reputation scores.
 * Reputation is a non-negative integer that increases when other users
 * react to a user's posts/comments. Uses atomic MongoDB updates so
 * concurrent reactions don't cause lost writes.
 */

const User = require('../models/User');

/**
 * Atomically adjusts a user's reputation by `delta` (can be negative for
 * reaction removals/switches). The $max clamp ensures reputation never
 * drops below 0. Accepts an optional session for transactional callers.
 */
async function addReputation(userId, delta, { session } = {}) {
  if (!userId || !delta) return;
  await User.updateOne(
    { _id: userId },
    [{
      $set: {
        reputation: {
          $max: [0, { $add: [{ $ifNull: ['$reputation', 0] }, delta] }]
        }
      }
    }],
    { session }
  );
}

module.exports = { addReputation };
