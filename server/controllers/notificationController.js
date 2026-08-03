const Notification = require('../models/Notification');
const { getIO } = require('../socket');
const {
  clampLimit,
  descendingCursorFilter,
  finalizePage
} = require('../utils/forumPagination');

const notificationController = {
  /**
   * GET /api/notifications?limit=&before=
   */
  async list(req, res, next) {
    try {
      const limit = clampLimit(req.query.limit, 30, 100);
      const filter = { recipient: req.user.id };
      const cursorFields = ['createdAt'];
      const cursorFilter = descendingCursorFilter(req.query.cursor, cursorFields);
      if (cursorFilter) {
        Object.assign(filter, cursorFilter);
      } else if (req.query.before) {
        const before = new Date(req.query.before);
        if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
      }
      const [items, unreadCount] = await Promise.all([
        Notification.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit + 1)
          .populate('actor', 'name username avatar role')
          .populate('post', 'title contentText')
          .lean(),
        Notification.countDocuments({
          recipient: req.user.id,
          read: false
        })
      ]);

      const page = finalizePage(items, limit, cursorFields);
      return res.json({
        success: true,
        data: page.items,
        nextCursor: page.nextCursor,
        unreadCount
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/notifications/:id/read
   */
  async markRead(req, res, next) {
    try {
      const notif = await Notification.findOneAndUpdate({
        _id: req.params.id,
        recipient: req.user.id,
        read: false
      }, {
        $set: { read: true }
      }, {
        new: true
      });

      if (notif) {
        const io = getIO();
        io.to(`user:${String(req.user.id)}`).emit('notification:read', {
          _id: notif._id
        });
        return res.json({
          success: true,
          data: { _id: notif._id, read: true, changed: true }
        });
      }

      const existing = await Notification.exists({
        _id: req.params.id,
        recipient: req.user.id
      });
      if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

      return res.json({
        success: true,
        data: { _id: req.params.id, read: true, changed: false }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/notifications/read-all
   */
  async markAllRead(req, res, next) {
    try {
      const result = await Notification.updateMany(
        { recipient: req.user.id, read: false },
        { $set: { read: true } }
      );
      if (result.modifiedCount > 0) {
        const io = getIO();
        io.to(`user:${String(req.user.id)}`).emit('notification:read-all');
      }
      return res.json({
        success: true,
        data: { ok: true, changedCount: result.modifiedCount }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = notificationController;
