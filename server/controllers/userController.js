const mongoose = require('mongoose');
const User = require('../models/User');
const { uploadImage, deleteImage } = require('../services/uploadService');
const { notify } = require('../services/notificationService');
const { getIO } = require('../socket');
const { ensureUsername } = require('../services/mentionService');

const PUBLIC_PROFILE_FIELDS =
  'name username avatar role bio collegeName hscBatch stream universityName department reputation rating maxRating contestPoints contestsPlayed followers following isBanned accountStatus forumRole createdAt';
const PRIVATE_PROFILE_FIELDS =
  `${PUBLIC_PROFILE_FIELDS} email phoneNumber areaName district division`;

function safeProfile(user) {
  if (!user) return user;
  const profile = { ...user };
  profile.followerCount = Array.isArray(profile.followers) ? profile.followers.length : 0;
  profile.followingCount = Array.isArray(profile.following) ? profile.following.length : 0;
  delete profile.followers;
  delete profile.following;
  delete profile.isBanned;
  delete profile.accountStatus;
  return profile;
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
      return res.json({ success: true, data: safeProfile(user) });
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
      return res.json({ success: true, data: safeProfile(user) });
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
      return res.json({ success: true, data: safeProfile(updated) });
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

      const meUpdate = await User.updateOne(
        { _id: req.user.id, following: { $ne: target._id } },
        { $addToSet: { following: target._id } }
      );
      if (meUpdate.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      try {
        const targetUpdate = await User.updateOne(
          { _id: target._id },
          { $addToSet: { followers: req.user.id } }
        );
        if (targetUpdate.matchedCount !== 1) {
          const error = new Error('User not found');
          error.statusCode = 404;
          throw error;
        }
      } catch (error) {
        if (meUpdate.modifiedCount === 1) {
          await User.updateOne(
            { _id: req.user.id },
            { $pull: { following: target._id } }
          );
        }
        throw error;
      }

      if (meUpdate.modifiedCount === 1) {
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

      const [targetCounts, meCounts] = await Promise.all([
        User.findById(target._id).select('followers').lean(),
        User.findById(req.user.id).select('following').lean()
      ]);
      return res.json({
        success: true,
        data: {
          following: true,
          followerCount: targetCounts?.followers?.length || 0,
          followingCount: meCounts?.following?.length || 0
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

      const meUpdate = await User.updateOne(
        { _id: req.user.id, following: target._id },
        { $pull: { following: target._id } }
      );
      if (meUpdate.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      try {
        const targetUpdate = await User.updateOne(
          { _id: target._id },
          { $pull: { followers: req.user.id } }
        );
        if (targetUpdate.matchedCount !== 1) {
          const error = new Error('User not found');
          error.statusCode = 404;
          throw error;
        }
      } catch (error) {
        if (meUpdate.modifiedCount === 1) {
          await User.updateOne(
            { _id: req.user.id },
            { $addToSet: { following: target._id } }
          );
        }
        throw error;
      }

      const [targetCounts, meCounts] = await Promise.all([
        User.findById(target._id).select('followers').lean(),
        User.findById(req.user.id).select('following').lean()
      ]);
      return res.json({
        success: true,
        data: {
          following: false,
          followerCount: targetCounts?.followers?.length || 0,
          followingCount: meCounts?.following?.length || 0
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
      const me = await User.findById(req.user.id).select('following');
      const target = await User.findById(targetId).select('followers');
      if (!target) return res.status(404).json({ success: false, message: 'User not found' });
      const following = !!me?.following.find((id) => String(id) === String(targetId));
      return res.json({
        success: true,
        data: {
          following,
          followerCount: target.followers.length
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = userController;
