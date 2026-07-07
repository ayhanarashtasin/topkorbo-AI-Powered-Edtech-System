const LoginHistory = require('../models/LoginHistory');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded) && forwarded.length) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return String(req.ip || req.socket?.remoteAddress || '').trim();
}

function detectBrowser(userAgent = '') {
  const source = String(userAgent).toLowerCase();
  if (!source) return 'Unknown';
  if (source.includes('edg/')) return 'Edge';
  if (source.includes('opr/') || source.includes('opera')) return 'Opera';
  if (source.includes('chrome/') && !source.includes('edg/')) return 'Chrome';
  if (source.includes('safari/') && !source.includes('chrome/')) return 'Safari';
  if (source.includes('firefox/')) return 'Firefox';
  if (source.includes('msie') || source.includes('trident/')) return 'Internet Explorer';
  return 'Unknown';
}

function detectDevice(userAgent = '') {
  const source = String(userAgent).toLowerCase();
  if (!source) return 'Unknown';
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(source)) return 'Tablet';
  if (/mobi|iphone|ipod|android/.test(source)) return 'Mobile';
  return 'Desktop';
}

async function recordLoginAttempt({
  req,
  user = null,
  email = '',
  status,
  failureReason = ''
}) {
  try {
    const userAgent = String(req.get('user-agent') || '').slice(0, 1000);
    await LoginHistory.create({
      user: user?._id || null,
      email: user?.email || String(email || '').trim(),
      role: user?.forumRole === 'admin' || user?.forumRole === 'moderator'
        ? user.forumRole
        : (user?.role || ''),
      status,
      ipAddress: getClientIp(req),
      userAgent,
      browser: detectBrowser(userAgent),
      device: detectDevice(userAgent),
      loginMethod: 'google_oauth',
      failureReason: status === 'failure' ? String(failureReason || '').slice(0, 300) : ''
    });
  } catch (_) {
    // Login history is best-effort and must never block auth.
  }
}

module.exports = {
  recordLoginAttempt
};
