/**
 * Mention Service - Handles user mention functionality for the forum system.
 * 
 * This service manages the lifecycle of @mentions in forum posts and comments:
 * 1. Username generation: Creates unique, URL-safe usernames from user display names
 * 2. Mention extraction: Parses HTML content to find @mentions (both structured and plain text)
 * 3. Mention resolution: Converts mention tokens to actual user objects for notifications
 * 
 * The service supports two mention formats:
 * - Structured: <a class="mention" data-uid="...">@username</a> (preferred, set by client editor)
 * - Plain text: @username (fallback, parsed from raw text)
 */

const User = require('../models/User');
const crypto = require('node:crypto');

/**
 * Generate a URL-safe, unique username slug from a display name.
 * Falls back to the email local-part when no display name is present.
 * 
 * WHY: Users need unique, URL-safe identifiers for forum mentions and profiles.
 * The slugification process ensures consistency and handles edge cases like
 * special characters, long names, and missing display names.
 * 
 * @param {string} name - User's display name
 * @param {string} email - User's email (fallback for username generation)
 * @returns {string} URL-safe username slug (max 24 characters)
 */
function slugifyName(name, email) {
  // Process display name first, fall back to email local-part, then generic 'user'
  const base =
    (name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscores
      .replace(/^_+|_+$/g, '')      // Trim leading/trailing underscores
      .slice(0, 24) ||              // Limit length for URL safety
    (email || '')
      .split('@')[0]                // Get email local-part
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) ||
    'user';                         // Ultimate fallback
  return base;
}

/**
 * Ensure the user has a unique `username` field. Run on first forum access.
 * 
 * WHY: Each user needs a unique username for @mentions to work correctly.
 * This function handles the race condition where multiple requests might
 * try to claim the same username simultaneously.
 * 
 * @param {Object} user - Mongoose user document
 * @returns {Promise<string>} The allocated username
 * @throws {Error} If unable to allocate a unique username after 100 attempts
 */
async function ensureUsername(user) {
  // Early return if username already exists
  if (user.username) return user.username;
  
  const base = slugifyName(user.name, user.email);

  // Try up to 100 times to find a unique username
  // First 50 attempts use sequential numbering (base0, base1, etc.)
  // After 50, switch to random hex suffixes to avoid collisions
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix < 50
      ? `${base}${suffix || ''}`  // No suffix for first attempt
      : `${base}_${crypto.randomBytes(3).toString('hex')}`;  // Random suffix after 50
    
    try {
      // Atomic update: only set username if it doesn't exist yet
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

      // Check if another process already set the username
      const current = await User.findById(user._id).select('username').lean();
      if (current?.username) {
        user.username = current.username;
        return current.username;
      }
    } catch (error) {
      // Ignore duplicate key errors (another process set the same username)
      if (error.code !== 11000) throw error;
    }
  }

  // If we exhaust all attempts, something is seriously wrong
  const error = new Error('Could not allocate a unique username. Please try again.');
  error.statusCode = 409;
  throw error;
}

/**
 * Extract @mentions from HTML content. Returns unique ObjectIds of mentioned users.
 * 
 * WHY: Forum posts can contain mentions in two formats that need to be normalized
 * for notification delivery. The extraction process identifies both structured
 * mentions (from the rich editor) and plain text mentions (from raw input).
 * 
 * Match patterns:
 *   <a class="mention" data-uid="...">@name</a>     (preferred — set by client editor)
 *   @username                                          (plain-text fallback)
 * 
 * @param {string} html - HTML content to search for mentions
 * @returns {Array<string>} Array of unique mention tokens (ObjectIds or @usernames)
 */
function extractMentionTokens(html) {
  if (!html) return [];
  const tokens = new Set();  // Use Set to automatically deduplicate

  // 1) Extract structured mentions from rich editor
  // Pattern: <a class="mention" data-uid="...">@name</a>
  // These are the most reliable as they contain the user's ObjectId directly
  const anchorRegex = /<a[^>]*class=["']mention["'][^>]*data-uid=["']([a-f0-9]{24})["']/gi;
  let m;
  while ((m = anchorRegex.exec(html)) !== null) {
    tokens.add(m[1]);  // Add just the ObjectId (24 hex chars)
  }

  // 2) Extract plain text @username mentions
  // Pattern: @username (alphanumeric + underscore + dot, 2-24 chars)
  // These are fallback mentions when the rich editor isn't used
  const plainRegex = /(?:^|[^a-zA-Z0-9_])@([a-z0-9_.]{2,24})/gi;
  while ((m = plainRegex.exec(html)) !== null) {
    tokens.add(`@${m[1].toLowerCase()}`);  // Normalize to lowercase
  }

  return Array.from(tokens);
}

/**
 * Resolve mention tokens to a list of { user, raw } pairs.
 * `raw` is the original token (uid hex OR @username); for notifications we
 * only need unique user IDs, so duplicates are removed.
 * 
 * WHY: After extracting mention tokens, we need to convert them to actual
 * user objects for notification delivery. This function handles the database
 * lookup and filters out banned users to prevent notifications to suspended accounts.
 * 
 * @param {string} html - HTML content containing mentions
 * @returns {Promise<{ids: string[], users: Object[]}>} Resolved user IDs and user objects
 */
async function resolveMentions(html) {
  const tokens = extractMentionTokens(html);
  if (!tokens.length) return { ids: [], users: [] };

  // Separate tokens into ObjectIds and @usernames for different query strategies
  const uids = tokens.filter((t) => /^[a-f0-9]{24}$/.test(t));
  const names = tokens.filter((t) => t.startsWith('@')).map((t) => t.slice(1));

  // Build MongoDB query to find users by either ID or username
  const orClauses = [];
  if (uids.length) orClauses.push({ _id: { $in: uids } });
  if (names.length) orClauses.push({ username: { $in: names } });

  if (!orClauses.length) return { ids: [], users: [] };

  // Fetch users, excluding banned accounts to prevent unwanted notifications
  const users = await User.find({ $or: orClauses, isBanned: { $ne: true } })
    .select('_id name username avatar role')
    .limit(50);  // Safety limit to prevent abuse

  const ids = users.map((u) => u._id.toString());
  return { ids, users };
}

module.exports = {
  slugifyName,
  ensureUsername,
  extractMentionTokens,
  resolveMentions
};