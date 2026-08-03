const mongoose = require('mongoose');
const User = require('../models/User');
const { uploadImage, deleteImage } = require('../services/uploadService');
const { notify } = require('../services/notificationService');
const { getIO } = require('../socket');
const { ensureUsername } = require('../services/mentionService');
const Follow = require('../models/Follow');

const PUBLIC_PROFILE_FIELDS =
  'name username avatar role bio collegeName hscBatch stream universityName department reputation rating maxRating contestPoints contestsPlayed isBanned accountStatus forumRole createdAt';
const PRIVATE_PROFILE_FIELDS =
  `${PUBLIC_PROFILE_FIELDS} email phoneNumber areaName district division`;

function safeProfile(user) {
  if (!user) return user;
  const profile = { ...user };
  delete profile.isBanned;
  delete profile.accountStatus;
  return profile;
}

async function profileWithFollowCounts(user) {
  if (!user) return user;
  const [followerCount, followingCount] = await Promise.all([
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id })
  ]);
  return { ...safeProfile(user), followerCount, followingCount };
}

const userController = {
  /**
   * GET /api/users/me — extended forum-aware profile
   */
  async me(req, res, next) {
    try {
      const user = await User.findById(req.user.id)
        .select(PRIVATE_PROFILE_FIELDS)
        .lean();
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      // Lazily create a username if missing
      if (!user.username) {
        const u = await User.findById(req.user.id);
        if (u) {
          await ensureUsername(u);
          user.username = u.username;
        }
      }
      return res.json({ success: true, data: await profileWithFollowCounts(user) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/:id — public profile
   */
  async getById(req, res, next) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const user = await User.findById(req.params.id)
        .select(PUBLIC_PROFILE_FIELDS)
        .lean();
      if (!user || user.isBanned || (user.accountStatus && user.accountStatus !== 'active')) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.json({ success: true, data: await profileWithFollowCounts(user) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/users/me — edit profile (multipart)
   * Body fields: name, bio, collegeName, universityName, department, hscBatch, avatar (file)
   */
  async updateMe(req, res, next) {
    try {
      const me = await User.findById(req.user.id);
      if (!me) return res.status(404).json({ success: false, message: 'User not found' });
      if (me.isBanned) {
        return res.status(403).json({ success: false, message: 'Account is suspended.' });
      }
      const { name, bio, collegeName, universityName, department, hscBatch, stream } = req.body;
      if (name) me.name = String(name).trim().slice(0, 80);
      if (bio !== undefined) me.bio = String(bio).slice(0, 280);
      if (collegeName !== undefined) me.collegeName = String(collegeName).slice(0, 120);
      if (universityName !== undefined) me.universityName = String(universityName).slice(0, 120);
      if (department !== undefined) me.department = String(department).slice(0, 120);
      if (hscBatch !== undefined) me.hscBatch = String(hscBatch).slice(0, 40);
      if (stream && ['Science', 'Business Studies', 'Humanities'].includes(stream)) me.stream = stream;

      let uploadedAvatar = null;
      if (req.file) {
        uploadedAvatar = await uploadImage(req.file, req.user.id, 'topkorbo/forum/avatars');
        me.avatar = uploadedAvatar.url;
      }
      try {
        await me.save();
      } catch (error) {
        if (uploadedAvatar) {
          await deleteImage(uploadedAvatar.publicId, uploadedAvatar.url);
        }
        throw error;
      }
      const updated = await User.findById(me._id).select(PRIVATE_PROFILE_FIELDS).lean();
      return res.json({ success: true, data: await profileWithFollowCounts(updated) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/users/:id/follow
   */
  async follow(req, res, next) {
    try {
      const targetId = req.params.id;
      if (!mongoose.isValidObjectId(targetId)) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      if (String(targetId) === String(req.user.id)) {
        return res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
      }
      const target = await User.findById(targetId).select('_id isBanned accountStatus');
      if (
        !target ||
        target.isBanned ||
        (target.accountStatus && target.accountStatus !== 'active')
      ) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      let created = false;
      try {
        const follow = await Follow.updateOne(
          { follower: req.user.id, following: target._id },
          { $setOnInsert: { follower: req.user.id, following: target._id } },
          { upsert: true }
        );
        created = follow.upsertedCount === 1;
      } catch (error) {
        // A concurrent request may win the unique-key race. The desired state
        // already exists, so treat it as an idempotent success.
        if (error.code !== 11000) throw error;
      }

      if (created) {
        const me = await User.findById(req.user.id).select('name').lean();
        const io = getIO();
        await notify(io, {
          recipient: target._id,
          actor: req.user.id,
          type: 'follow',
          message: `${me?.name || 'Someone'} started following you.`,
          preview: ''
        }).catch(() => {});
      }

      const [followerCount, followingCount] = await Promise.all([
        Follow.countDocuments({ following: target._id }),
        Follow.countDocuments({ follower: req.user.id })
      ]);
      return res.json({
        success: true,
        data: {
          following: true,
          followerCount,
          followingCount
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/users/:id/follow
   */
  async unfollow(req, res, next) {
    try {
      const targetId = req.params.id;
      if (!mongoose.isValidObjectId(targetId)) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const target = await User.findById(targetId).select('_id');
      if (!target) return res.status(404).json({ success: false, message: 'User not found' });

      await Follow.deleteOne({ follower: req.user.id, following: target._id });

      const [followerCount, followingCount] = await Promise.all([
        Follow.countDocuments({ following: target._id }),
        Follow.countDocuments({ follower: req.user.id })
      ]);
      return res.json({
        success: true,
        data: {
          following: false,
          followerCount,
          followingCount
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/me/follow-state/:id  — lightweight check used by the UI
   */
  async followState(req, res, next) {
    try {
      const targetId = req.params.id;
      if (!mongoose.isValidObjectId(targetId)) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const [target, following, followerCount] = await Promise.all([
        User.findById(targetId).select('_id').lean(),
        Follow.exists({ follower: req.user.id, following: targetId }),
        Follow.countDocuments({ following: targetId })
      ]);
      if (!target) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({
        success: true,
        data: {
          following: Boolean(following),
          followerCount
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = userController;
