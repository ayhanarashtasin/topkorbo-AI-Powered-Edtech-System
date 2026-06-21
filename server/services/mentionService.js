const User = require('../models/User');

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
  let candidate = base;
  let suffix = 0;
  // Try a handful of candidates before giving up with a random suffix.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await User.exists({ username: candidate, _id: { $ne: user._id } });
    if (!exists) break;
    suffix += 1;
    candidate = `${base}${suffix}`;
    if (suffix > 50) {
      candidate = `${base}_${Math.floor(Math.random() * 10000)}`;
      break;
    }
  }
  user.username = candidate;
  await user.save();
  return candidate;
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