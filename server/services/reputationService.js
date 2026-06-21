const User = require('../models/User');

/**
 * Adjust a user's reputation by `delta` (can be negative).
 * Reputation can never drop below 0.
 */
async function addReputation(userId, delta) {
  if (!userId || !delta) return;
  await User.findByIdAndUpdate(userId, {
    $inc: { reputation: delta },
    $max: { reputation: 0 }
  });
}

module.exports = { addReputation };