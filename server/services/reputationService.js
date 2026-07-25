const User = require('../models/User');

/**
 * Adjust a user's reputation by `delta` (can be negative).
 * Reputation can never drop below 0.
 */
async function addReputation(userId, delta) {
  if (!userId || !delta) return;
  await User.updateOne(
    { _id: userId },
    [{
      $set: {
        reputation: {
          $max: [0, { $add: [{ $ifNull: ['$reputation', 0] }, delta] }]
        }
      }
    }]
  );
}

module.exports = { addReputation };
