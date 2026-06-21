/**
 * Admin middleware — must be used AFTER the `auth` middleware.
 * Allows the request if req.user.forumRole === 'admin' or 'moderator'.
 */
module.exports = function adminOnly(req, res, next) {
  const role = req.user && req.user.forumRole;
  if (role !== 'admin' && role !== 'moderator') {
    return res.status(403).json({
      success: false,
      message: 'Admin privileges required.'
    });
  }
  next();
};