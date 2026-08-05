const Notification = require('../models/Notification');

/**
 * Notification Service
 *
 * Single entry-point for creating and delivering notifications.
 * Callers pass the Socket.IO instance (`io`) when available so the
 * new notification is pushed to the recipient in real time.  If the
 * socket layer is down the database write still succeeds — delivery
 * is best-effort so transient socket errors never block core logic.
 */

/**
 * Create a notification and optionally push it via Socket.IO.
 *
 * @param {object|null} io  - Socket.IO server instance (null to skip push).
 * @param {object} opts
 * @param {ObjectId} opts.recipient - Target user.
 * @param {ObjectId} [opts.actor]   - User who performed the action.
 * @param {string}   opts.type      - Notification category.
 * @param {ObjectId} [opts.post]    - Related post.
 * @param {ObjectId} [opts.comment] - Related comment.
 * @param {string}   [opts.message] - Custom text.
 * @param {string}   [opts.preview] - Content snippet.
 * @returns {Promise<object|null>} The created notification, or null if skipped.
 */
async function notify(io, { recipient, actor, type, post, comment, message, preview }) {
  if (!recipient) return null;
  // Never create a notification when a user interacts with their own content.
  if (actor && String(actor) === String(recipient)) return null;

  const notif = await Notification.create({
    recipient,
    actor: actor || undefined,
    type,
    post: post || undefined,
    comment: comment || undefined,
    message: message || '',
    preview: preview || ''
  });

  if (io) {
    try {
      io.to(`user:${String(recipient)}`).emit('notification:new', notif);
    } catch (e) {
      // Best-effort push — socket failures are non-fatal.
    }
  }
  return notif;
}

module.exports = { notify };
