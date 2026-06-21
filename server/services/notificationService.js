const Notification = require('../models/Notification');

/**
 * Create a notification and (if io is provided) push it via Socket.IO to the
 * recipient's private room.
 */
async function notify(io, { recipient, actor, type, post, comment, message, preview }) {
  if (!recipient) return null;
  // Don't notify yourself
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
      // Best-effort — never let socket errors break DB writes.
    }
  }
  return notif;
}

module.exports = { notify };