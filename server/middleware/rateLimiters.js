/**
 * Centralised rate limiters (express-rate-limit v7).
 *
 * Sensitive endpoints — auth/OAuth, payment init, AI (LLM cost), and forum
 * writes — are brute-force / spam / cost-amplification targets. Authenticated
 * limiters key on the user id; public ones key on IP. A relaxed global limiter
 * backstops everything else.
 *
 * NOTE: for correct client-IP detection behind a proxy (Vercel/Render/Nginx),
 * server.js sets `app.set('trust proxy', 1)` in production.
 */
const rateLimit = require('express-rate-limit');

const standard = {
  standardHeaders: true,
  legacyHeaders: false
};

// Key by authenticated user id when present, else fall back to IP.
function userOrIpKey(req, res) {
  return (req.user && req.user.id) ? `u:${req.user.id}` : `ip:${req.ip}`;
}

const message = (msg) => ({ success: false, message: msg, code: 'RATE_LIMITED' });

// Global backstop — generous, protects the whole API surface.
const globalLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000,
  max: 300,
  message: message('Too many requests. Please slow down and try again shortly.')
});

// Auth / OAuth — brute force + callback flooding.
const authLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: message('Too many authentication attempts. Try again in a few minutes.')
});

// Payments — checkout session creation. Gateway callbacks are intentionally
// NOT limited here (they must be able to retry) and are validated server-side.
const paymentLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  message: message('Too many payment attempts. Please wait a moment.')
});

// AI / LLM — protects against cost abuse and request amplification.
const aiLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  message: message('You are sending AI requests too quickly. Please slow down.')
});

// Forum writes (posts/comments/reactions) — spam control.
const writeLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  message: message('You are posting too quickly. Please slow down.')
});

// Uploads — heavier disk/network cost per request.
const uploadLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  message: message('Too many uploads. Please wait before uploading more.')
});

module.exports = {
  globalLimiter,
  authLimiter,
  paymentLimiter,
  aiLimiter,
  writeLimiter,
  uploadLimiter
};
