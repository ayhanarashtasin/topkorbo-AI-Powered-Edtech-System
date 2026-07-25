const User = require('../models/User');
const crypto = require('node:crypto');

/**
 * Generate a URL-safe, unique username slug from a display name.
 * Falls back to the email local-part when no display name is present.
 */
function slugifyName(name, email) {
  const base =
    (name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) ||
    (email || '')
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) ||
    'user';
  return base;
}

/**
 * Ensure the user has a unique `username` field. Run on first forum access.
 */
async function ensureUsername(user) {
  if (user.username) return user.username;
  const base = slugifyName(user.name, user.email);

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix < 50
      ? `${base}${suffix || ''}`
      : `${base}_${crypto.randomBytes(3).toString('hex')}`;
    try {
      const updated = await User.findOneAndUpdate(
        {
          _id: user._id,
          $or: [
            { username: { $exists: false } },
            { username: null },
            { username: '' }
          ]
        },
        { $set: { username: candidate } },
        { new: true, runValidators: true }
      ).select('username');

      if (updated?.username) {
        user.username = updated.username;
        return updated.username;
      }

      const current = await User.findById(user._id).select('username').lean();
      if (current?.username) {
        user.username = current.username;
        return current.username;
      }
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  const error = new Error('Could not allocate a unique username. Please try again.');
  error.statusCode = 409;
  throw error;
}

/**
 * Extract @mentions from HTML content. Returns unique ObjectIds of mentioned users.
 * Match patterns:
 *   <a class="mention" data-uid="...">@name</a>     (preferred — set by client editor)
 *   @username                                          (plain-text fallback)
 */
function extractMentionTokens(html) {
  if (!html) return [];
  const tokens = new Set();

  // 1) Pre-rendered <a class="mention" data-uid="..."> tags
  const anchorRegex = /<a[^>]*class=["']mention["'][^>]*data-uid=["']([a-f0-9]{24})["']/gi;
  let m;
  while ((m = anchorRegex.exec(html)) !== null) {
    tokens.add(m[1]);
  }

  // 2) Plain @username tokens (lowercased, alnum + underscore + dot, up to 24 chars)
  const plainRegex = /(?:^|[^a-zA-Z0-9_])@([a-z0-9_.]{2,24})/gi;
  while ((m = plainRegex.exec(html)) !== null) {
    tokens.add(`@${m[1].toLowerCase()}`);
  }

  return Array.from(tokens);
}

/**
 * Resolve mention tokens to a list of { user, raw } pairs.
 * `raw` is the original token (uid hex OR @username); for notifications we
 * only need unique user IDs, so duplicates are removed.
 */
async function resolveMentions(html) {
  const tokens = extractMentionTokens(html);
  if (!tokens.length) return { ids: [], users: [] };

  const uids = tokens.filter((t) => /^[a-f0-9]{24}$/.test(t));
  const names = tokens.filter((t) => t.startsWith('@')).map((t) => t.slice(1));

  const orClauses = [];
  if (uids.length) orClauses.push({ _id: { $in: uids } });
  if (names.length) orClauses.push({ username: { $in: names } });

  if (!orClauses.length) return { ids: [], users: [] };

  const users = await User.find({ $or: orClauses, isBanned: { $ne: true } })
    .select('_id name username avatar role')
    .limit(50);

  const ids = users.map((u) => u._id.toString());
  return { ids, users };
}

module.exports = {
  slugifyName,
  ensureUsername,
  extractMentionTokens,
  resolveMentions
};
