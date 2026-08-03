const User = require('../models/User');

function resolveAccountStatus(user) {
  if (!user) return 'active';
  return user.accountStatus || (user.isBanned ? 'banned' : 'active');
}

function hasExpiredTemporaryBan(user, now = new Date()) {
  if (!user?.banExpiresAt) return false;
  const expiresAt = new Date(user.banExpiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt > now) return false;
  return user.isBanned || resolveAccountStatus(user) === 'banned';
}

/**
 * Lazily restores an account after a temporary ban expires. The guarded
 * update makes concurrent HTTP/socket logins idempotent and avoids reviving an
 * account whose status was changed again by an administrator.
 */
async function reactivateExpiredBan(user, now = new Date()) {
  if (!hasExpiredTemporaryBan(user, now)) return user;

  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      banExpiresAt: { $ne: null, $lte: now },
      $or: [{ accountStatus: 'banned' }, { isBanned: true }]
    },
    {
      $set: {
        accountStatus: 'active',
        isBanned: false,
        statusReason: '',
        banReason: '',
        banExpiresAt: null,
        suspendedAt: null,
        statusChangedAt: now
      }
    },
    { new: true }
  );

  // If another request already performed the transition, re-read the current
  // state instead of using the stale banned document supplied by the caller.
  return updated || User.findById(user._id);
}

module.exports = {
  resolveAccountStatus,
  hasExpiredTemporaryBan,
  reactivateExpiredBan
};
