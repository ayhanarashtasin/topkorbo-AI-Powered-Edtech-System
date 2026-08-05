const Report = require('../models/Report');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Question = require('../models/Question');
const { notify } = require('../services/notificationService');
const { getIO } = require('../socket');
const { hideComment } = require('../services/forumCommentService');

const REPORT_TARGETS = ['post', 'comment', 'user', 'question'];
const VALID_REASONS = [
  'spam',
  'harassment',
  'hate',
  'nudity',
  'misinformation',
  'cheating',
  'wrong_answer',
  'wrong_explanation',
  'typo',
  'duplicate',
  'outdated',
  'other'
];

/**
 * Moderation Controller - Manages the content moderation workflow.
 *
 * Provides endpoints for:
 * - User report submission (create)
 * - Admin report review (list)
 * - Admin action execution (dismiss, warn, hide, ban)
 *
 * Actions include content hiding, user warnings, and temporary bans.
 */
const moderationController = {
  /**
   * Create a new report for content moderation.
   *
   * Validates target existence and prevents duplicate active reports per user+target.
   * Uses polymorphic references to support reporting different content types.
   */
  async create(req, res, next) {
    try {
      const { targetType, target, reason, description } = req.body;
      if (!REPORT_TARGETS.includes(targetType)) {
        return res.status(400).json({ success: false, message: 'Invalid targetType' });
      }
      if (!target) return res.status(400).json({ success: false, message: 'target required' });
      if (!VALID_REASONS.includes(reason)) {
        return res.status(400).json({ success: false, message: 'Invalid reason' });
      }

      // Verify the reported content actually exists before creating a report
      let exists = false;
      if (targetType === 'post') exists = !!(await Post.exists({ _id: target }));
      else if (targetType === 'comment') exists = !!(await Comment.exists({ _id: target }));
      else if (targetType === 'user') exists = !!(await User.exists({ _id: target }));
      else if (targetType === 'question') exists = !!(await Question.exists({ _id: target }));
      if (!exists) return res.status(404).json({ success: false, message: 'Target not found' });

      // Prevent duplicate reports: only one active report per user+target combination
      const existing = await Report.exists({
        reporter: req.user.id,
        targetType,
        target,
        status: { $in: ['open', 'under_review'] }
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'You already have an active report for this item.'
        });
      }

      const report = await Report.create({
        reporter: req.user.id,
        targetType,
        target,
        reason,
        description: description ? String(description).slice(0, 1000) : ''
      });
      return res.status(201).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  },

  /**
   * List reports filtered by status (admin only).
   *
   * Supports pagination with configurable limit (max 100).
   * Populates reporter and reviewer info for admin dashboard display.
   */
  async list(req, res, next) {
    try {
      const status = req.query.status || 'open';
      const filter = { status };
      const limit = Math.min(100, Number(req.query.limit) || 50);
      const reports = await Report.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('reporter', 'name username avatar')
        .populate('reviewer', 'name username avatar')
        .lean();
      return res.json({ success: true, data: reports });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Execute a moderation action on a report (admin only).
   *
   * Actions:
   * - dismiss: Close report without action
   * - hide: Hide post/comment from public view
   * - warn: Issue official warning to user
   * - ban: Temporary 7-day account ban
   *
   * Resolves target user from post/comment author when needed.
   * Sends real-time notifications for warnings.
   */
  async takeAction(req, res, next) {
    try {
      const { action, note } = req.body;
      const allowed = ['dismiss', 'warn', 'hide', 'ban'];
      if (!allowed.includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action' });
      }
      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

      let actionTaken = '';
      if (action === 'dismiss') {
        report.status = 'dismissed';
        actionTaken = 'dismissed';
      } else if (action === 'hide') {
        if (report.targetType === 'post') {
          await Post.findByIdAndUpdate(report.target, { isHidden: true, hiddenReason: note || 'Hidden by moderator' });
        } else if (report.targetType === 'comment') {
          await hideComment(report.target);
        }
        report.status = 'action_taken';
        actionTaken = 'hidden';
      } else if (action === 'warn' || action === 'ban') {
        // Resolve user ID: direct for 'user' reports, lookup author for content reports
        let userId;
        if (report.targetType === 'user') userId = report.target;
        else if (report.targetType === 'post') {
          const p = await Post.findById(report.target);
          userId = p?.author;
        } else if (report.targetType === 'comment') {
          const c = await Comment.findById(report.target);
          userId = c?.author;
        }
        if (!userId) {
          return res.status(400).json({ success: false, message: 'Could not resolve target user' });
        }
        if (action === 'warn') {
          await User.findByIdAndUpdate(userId, {
            $push: { warnings: { reason: note || report.reason, issuedBy: req.user.id } }
          });
          // Notify user in real-time about the warning via WebSocket
          const io = getIO();
          await notify(io, {
            recipient: userId,
            actor: req.user.id,
            type: 'warning',
            message: `You have received a warning: ${note || report.reason}`,
            preview: 'Please review our community guidelines.'
          });
          report.status = 'action_taken';
          actionTaken = 'warned';
        } else {
          // Default 7-day ban with automatic expiration
          await User.findByIdAndUpdate(userId, {
            isBanned: true,
            accountStatus: 'banned',
            statusReason: note || report.reason,
            banReason: note || report.reason,
            banExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            suspendedAt: new Date(),
            statusChangedAt: new Date()
          });
          report.status = 'action_taken';
          actionTaken = 'banned';
        }
      }

      report.actionTaken = actionTaken;
      report.reviewer = req.user.id;
      report.reviewedAt = new Date();
      await report.save();
      return res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = moderationController;
