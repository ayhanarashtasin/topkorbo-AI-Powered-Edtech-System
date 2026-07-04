const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  return token || null;
}

async function requireAuth(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      'name email role forumRole isBanned accountStatus statusReason banReason banExpiresAt lastActiveAt'
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found for this token' });
    }

    req.user = {
      id: String(user._id),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      forumRole: user.forumRole,
      isBanned: user.isBanned,
      accountStatus: user.accountStatus || (user.isBanned ? 'banned' : 'active'),
      statusReason: user.statusReason,
      banReason: user.banReason,
      banExpiresAt: user.banExpiresAt,
      tokenIssuedRole: decoded.role,
      tokenIssuedForumRole: decoded.forumRole || 'user'
    };

    const now = Date.now();
    const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
    if (!lastActiveAt || now - lastActiveAt > 15 * 60 * 1000) {
      User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date(now) } }).catch(() => {});
    }

    next();
  } catch (_err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user && req.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  const forumRole = req.user && req.user.forumRole;
  if (forumRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin privileges required.'
    });
  }
  next();
}

requireAuth.requireAuth = requireAuth;
requireAuth.requireRole = requireRole;
requireAuth.requireAdmin = requireAdmin;

module.exports = requireAuth;
