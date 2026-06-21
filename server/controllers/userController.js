const mongoose = require('mongoose');
const User = require('../models/User');
const { uploadImage } = require('../services/uploadService');
const { notify } = require('../services/notificationService');
const { getIO } = require('../socket');
const { ensureUsername } = require('../services/mentionService');

const PUBLIC_PROFILE_FIELDS =
  'name username avatar role collegeName hscBatch stream universityName department reputation followers following isBanned forumRole createdAt';

const userController = {
  /**
   * GET /api/users/me — extended forum-aware profile
   */
  async me(req, res, next) {
    try {
      const user = await User.findById(req.user.id)
        .select(PUBLIC_PROFILE_FIELDS + ' email phoneNumber areaName district division')
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
      return res.json({ success: true, data: user });
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
      if (!user || user.isBanned) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.json({ success: true, data: user });
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

      if (req.file) {
        const uploaded = await uploadImage(req.file, req.user.id, 'topkorbo/forum/avatars');
        me.avatar = uploaded.url;
      }
      await me.save();
      const safe = me.toObject();
      delete safe.bookmarks;
      return res.json({ success: true, data: safe });
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
      if (String(targetId) === String(req.user.id)) {
        return res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
      }
      const target = await User.findById(targetId);
      if (!target || target.isBanned) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const me = await User.findById(req.user.id);
      if (!me.following.find((id) => String(id) === String(targetId))) {
        me.following.push(target._id);
        target.followers.push(me._id);
        await Promise.all([me.save(), target.save()]);

        const io = getIO();
        await notify(io, {
          recipient: target._id,
          actor: me._id,
          type: 'follow',
          message: `${me.name} started following you.`,
          preview: ''
        });
      }
      return res.json({
        success: true,
        data: {
          following: true,
          followerCount: target.followers.length,
          followingCount: me.following.length
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
      const target = await User.findById(targetId);
      if (!target) return res.status(404).json({ success: false, message: 'User not found' });
      const me = await User.findById(req.user.id);
      me.following = me.following.filter((id) => String(id) !== String(targetId));
      target.followers = target.followers.filter((id) => String(id) !== String(me._id));
      await Promise.all([me.save(), target.save()]);
      return res.json({
        success: true,
        data: {
          following: false,
          followerCount: target.followers.length,
          followingCount: me.following.length
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