const Notification = require('../models/Notification');
const { getIO } = require('../socket');

const notificationController = {
  /**
   * GET /api/notifications?limit=&before=
   */
  async list(req, res, next) {
    try {
      const limit = Math.min(100, Number(req.query.limit) || 30);
      const filter = { recipient: req.user.id };
      if (req.query.before) {
        const before = new Date(req.query.before);
        if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
      }
      const items = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('actor', 'name username avatar role')
        .populate('post', 'title contentText')
        .lean();

      const unreadCount = await Notification.countDocuments({
        recipient: req.user.id,
        read: false
      });

      return res.json({ success: true, data: items, unreadCount });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/notifications/:id/read
   */
  async markRead(req, res, next) {
    try {
      const notif = await Notification.findOne({
        _id: req.params.id,
        recipient: req.user.id
      });
      if (!notif) return res.status(404).json({ success: false, message: 'Not found' });
      notif.read = true;
      await notif.save();
      const io = getIO();
      io.to(`user:${String(req.user.id)}`).emit('notification:read', {
        _id: notif._id
      });
      return res.json({ success: true, data: { _id: notif._id, read: true } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/notifications/read-all
   */
  async markAllRead(req, res, next) {
    try {
      await Notification.updateMany(
        { recipient: req.user.id, read: false },
        { $set: { read: true } }
      );
      const io = getIO();
      io.to(`user:${String(req.user.id)}`).emit('notification:read-all');
      return res.json({ success: true, data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = notificationController;