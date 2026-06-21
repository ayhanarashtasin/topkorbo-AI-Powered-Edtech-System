const Reaction = require('../models/Reaction');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { notify } = require('../services/notificationService');
const { addReputation } = require('../services/reputationService');
const { getIO } = require('../socket');

const REPUTATION_DELTAS = { like: 5, love: 10 };

const reactionController = {
  /**
   * POST /api/reactions
   * Body: { targetType: 'post'|'comment', target: id, type: 'like'|'love' }
   * Toggle behaviour: if a reaction of this type already exists, remove it;
   * otherwise remove any other-type reaction (one reaction per user per target),
   * then create the new one.
   */
  async toggle(req, res, next) {
    try {
      const { targetType, target, type } = req.body;
      if (!['post', 'comment'].includes(targetType)) {
        return res.status(400).json({ success: false, message: 'Invalid targetType' });
      }
      if (!['like', 'love'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid reaction type' });
      }
      if (!target) return res.status(400).json({ success: false, message: 'target required' });

      const Model = targetType === 'post' ? Post : Comment;
      const doc = await Model.findById(target);
      if (!doc || doc.isHidden) {
        return res.status(404).json({ success: false, message: `${targetType} not found` });
      }

      // Check if reaction of this exact type already exists
      const existing = await Reaction.findOne({
        targetType,
        target,
        user: req.user.id,
        type
      });

      let userReaction = null;
      const counts = {
        like: doc.reactionsCount?.like || 0,
        love: doc.reactionsCount?.love || 0
      };

      if (existing) {
        // Toggle off
        await Reaction.deleteOne({ _id: existing._id });
        counts[type] = Math.max(0, counts[type] - 1);
        userReaction = null;
      } else {
        // Remove any other-type reaction first
        const other = await Reaction.findOneAndDelete({
          targetType,
          target,
          user: req.user.id
        });
        if (other && other.type !== type) {
          counts[other.type] = Math.max(0, counts[other.type] - 1);
          // revert reputation delta for old reaction
          if (String(doc.author) !== String(req.user.id)) {
            await addReputation(doc.author, -REPUTATION_DELTAS[other.type]);
          }
        }
        // Create new
        await Reaction.create({
          targetType,
          target,
          user: req.user.id,
          type
        });
        counts[type] = counts[type] + 1;
        userReaction = type;

        // Reputation + notification (only for the target author, only on new reactions)
        if (String(doc.author) !== String(req.user.id)) {
          await addReputation(doc.author, REPUTATION_DELTAS[type]);
          const actor = await User.findById(req.user.id).select('name');
          const io = getIO();
          await notify(io, {
            recipient: doc.author,
            actor: req.user.id,
            type: type,
            post: targetType === 'post' ? target : doc.post,
            comment: targetType === 'comment' ? target : undefined,
            message: `${actor?.name || 'Someone'} reacted with ${type} on your ${targetType}.`,
            preview: doc.contentText?.slice(0, 120) || ''
          });
        }
      }

      // Persist updated counts
      doc.reactionsCount = counts;
      await doc.save();

      // Update trending score if it's a post
      if (targetType === 'post') {
        try {
          const hours = Math.max(1, (Date.now() - new Date(doc.createdAt).getTime()) / 3.6e6);
          doc.score =
            (counts.like + 2 * counts.love + 3 * (doc.commentsCount || 0)) /
            Math.pow(hours, 1.5);
          await doc.save();
        } catch (e) {
          /* best-effort */
        }
      }

      const io = getIO();
      const roomKey =
        targetType === 'post'
          ? `post:${String(target)}`
          : `post:${String(doc.post)}`;
      io.to(roomKey).emit('reaction:update', {
        targetType,
        target: String(target),
        counts,
        userId: String(req.user.id),
        userReaction
      });

      return res.json({
        success: true,
        data: { counts, userReaction }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = reactionController;