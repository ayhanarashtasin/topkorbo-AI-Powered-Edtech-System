const User = require('../models/User');

/**
 * Adjust a user's reputation by `delta` (can be negative).
 * Reputation can never drop below 0.
 */
async function addReputation(userId, delta) {
  if (!userId || !delta) return;
  const user = await User.findById(userId);
  if (!user) return;
  
  user.reputation = Math.max(0, (user.reputation || 0) + delta);
  await user.save();
}

module.exports = { addReputation };