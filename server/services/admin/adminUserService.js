const mongoose = require('mongoose');
const User = require('../../models/User');
const TeacherApplication = require('../../models/TeacherApplication');
const Question = require('../../models/Question');
const Book = require('../../models/Book');
const Contest = require('../../models/Contest');
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const Follow = require('../../models/Follow');
const PracticeAttempt = require('../../models/PracticeAttempt');
const { createAdminAuditLog } = require('./adminAuditService');

const MANAGEABLE_ROLES = ['student', 'tutor', 'teacher', 'moderator', 'admin'];
const MANAGEABLE_STATUSES = ['active', 'suspended', 'banned'];

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveAccountStatus(user) {
  if (user.accountStatus) return user.accountStatus;
  return user.isBanned ? 'banned' : 'active';
}

function resolveAdminRoleLabel(user) {
  if (user.forumRole === 'admin') return 'admin';
  if (user.forumRole === 'moderator') return 'moderator';
  return user.role;
}

function isActiveAdmin(user) {
  return user?.forumRole === 'admin' && resolveAccountStatus(user) === 'active';
}

async function assertAnotherActiveAdminExists(excludingUserId, { session } = {}) {
  const otherActiveAdmins = await User.countDocuments({
    _id: { $ne: excludingUserId },
    forumRole: 'admin',
    $or: [
      { accountStatus: 'active' },
      { accountStatus: { $exists: false }, isBanned: { $ne: true } }
    ]
  }).session(session || null);

  if (otherActiveAdmins < 1) {
    const err = new Error('This action would remove the last active admin account.');
    err.statusCode = 409;
    throw err;
  }
}

function sanitizeUserListItem(user) {
  return {
    id: String(user._id),
    name: user.name || '',
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    role: resolveAdminRoleLabel(user),
    baseRole: user.role,
    forumRole: user.forumRole || 'user',
    accountStatus: resolveAccountStatus(user),
    statusReason: user.statusReason || user.banReason || '',
    createdAt: user.createdAt || null,
    lastActiveAt: user.lastActiveAt || null,
    avatar: user.avatar || ''
  };
}

function buildUserQuery(filters) {
  const query = {};

  if (filters.search) {
    const searchRegex = new RegExp(escapeRegex(filters.search), 'i');
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phoneNumber: searchRegex }
    ];
  }

  if (filters.role) {
    if (filters.role === 'admin' || filters.role === 'moderator') {
      query.forumRole = filters.role;
    } else {
      query.role = filters.role;
      query.forumRole = { $ne: 'admin' };
    }
  }

  if (filters.status) {
    if (filters.status === 'active') {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { accountStatus: 'active' },
            { accountStatus: { $exists: false }, isBanned: { $ne: true } }
          ]
        }
      ];
    } else if (filters.status === 'banned') {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { accountStatus: 'banned' },
            { accountStatus: { $exists: false }, isBanned: true }
          ]
        }
      ];
    } else {
      query.accountStatus = filters.status;
    }
  }

  if (filters.createdFrom || filters.createdTo) {
    query.createdAt = {};
    if (filters.createdFrom) {
      query.createdAt.$gte = new Date(filters.createdFrom);
    }
    if (filters.createdTo) {
      const endDate = new Date(filters.createdTo);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }

  return query;
}

async function listUsers({
  search = '',
  role = '',
  status = '',
  createdFrom = '',
  createdTo = '',
  page = 1,
  limit = 10
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const query = buildUserQuery({ search, role, status, createdFrom, createdTo });

  const [items, total] = await Promise.all([
    User.find(query)
      .select('name email phoneNumber role forumRole accountStatus statusReason banReason createdAt lastActiveAt avatar')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    User.countDocuments(query)
  ]);

  return {
    items: items.map(sanitizeUserListItem),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function getUserDetails(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const user = await User.findById(userId)
    .select('-studentIdCardPhoto -nidPhoto -ieltsTrf -googleId')
    .lean();

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const [
    teacherApplication,
    questionsCount,
    booksCount,
    contestsCount,
    postsCount,
    commentsCount,
    practiceAttemptsCount,
    followersCount,
    followingCount
  ] = await Promise.all([
    TeacherApplication.findOne({ userId: user._id }).lean(),
    Question.countDocuments({ teacher: user._id }),
    Book.countDocuments({ uploadedBy: user._id }),
    Contest.countDocuments({ creator: user._id }),
    Post.countDocuments({ author: user._id }),
    Comment.countDocuments({ author: user._id }),
    PracticeAttempt.countDocuments({ userId: user._id }),
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id })
  ]);

  return {
    id: String(user._id),
    name: user.name || '',
    email: user.email || '',
    avatar: user.avatar || '',
    phoneNumber: user.phoneNumber || '',
    role: resolveAdminRoleLabel(user),
    baseRole: user.role,
    forumRole: user.forumRole || 'user',
    accountStatus: resolveAccountStatus(user),
    statusReason: user.statusReason || user.banReason || '',
    createdAt: user.createdAt || null,
    lastActiveAt: user.lastActiveAt || null,
    collegeName: user.collegeName || '',
    hscBatch: user.hscBatch || '',
    universityName: user.universityName || '',
    department: user.department || '',
    district: user.district || '',
    division: user.division || '',
    areaName: user.areaName || '',
    plan: user.plan || 'free',
    planExpiresAt: user.planExpiresAt || null,
    reputation: user.reputation || 0,
    warningsCount: Array.isArray(user.warnings) ? user.warnings.length : 0,
    joinedDate: user.createdAt || null,
    teacherApplication: teacherApplication
      ? {
          status: teacherApplication.status,
          aboutYou: teacherApplication.aboutYou || '',
          updatedAt: teacherApplication.updatedAt || teacherApplication.createdAt || null
        }
      : null,
    activitySummary: {
      questionsCount,
      booksCount,
      contestsCount,
      postsCount,
      commentsCount,
      practiceAttemptsCount,
      followersCount,
      followingCount
    }
  };
}

async function updateUserRole({ adminUser, targetUserId, nextRole, reason = '', confirmSelfDowngrade = false }) {
  if (!MANAGEABLE_ROLES.includes(nextRole)) {
    const err = new Error('Invalid role');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    role: user.role,
    forumRole: user.forumRole || 'user',
    effectiveRole: resolveAdminRoleLabel(user)
  };

  const nextValue = {
    role: user.role,
    forumRole: user.forumRole || 'user',
    effectiveRole: nextRole
  };

  if (nextRole === 'admin' || nextRole === 'moderator') {
    nextValue.forumRole = nextRole;
  } else {
    nextValue.role = nextRole;
    nextValue.forumRole = 'user';
  }

  const isSelf = String(adminUser.id) === String(user._id);
  const removingOwnAdminRole = isSelf && previousValue.forumRole === 'admin' && nextValue.forumRole !== 'admin';
  if (removingOwnAdminRole && !confirmSelfDowngrade) {
    const err = new Error('Confirm self-downgrade before removing your own admin role.');
    err.statusCode = 400;
    throw err;
  }

  if (
    previousValue.role === nextValue.role &&
    previousValue.forumRole === nextValue.forumRole
  ) {
    return sanitizeUserListItem(user);
  }

  if (isActiveAdmin(user) && nextValue.forumRole !== 'admin') {
    await assertAnotherActiveAdminExists(user._id);
  }

  user.role = nextValue.role;
  user.forumRole = nextValue.forumRole;
  await user.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: user._id,
    actionType: 'ROLE_CHANGED',
    previousValue,
    newValue: nextValue,
    reason
  });

  return sanitizeUserListItem(user);
}

async function updateUserStatus({ adminUser, targetUserId, nextStatus, reason = '', session }) {
  if (!MANAGEABLE_STATUSES.includes(nextStatus)) {
    const err = new Error('Invalid account status');
    err.statusCode = 400;
    throw err;
  }

  if ((nextStatus === 'banned' || nextStatus === 'suspended') && !String(reason).trim()) {
    const err = new Error('Reason is required for ban or suspend actions');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(targetUserId).session(session || null);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    accountStatus: resolveAccountStatus(user),
    isBanned: !!user.isBanned,
    statusReason: user.statusReason || user.banReason || ''
  };

  if (isActiveAdmin(user) && nextStatus !== 'active') {
    await assertAnotherActiveAdminExists(user._id, { session });
  }

  const now = new Date();
  user.accountStatus = nextStatus;
  user.statusChangedAt = now;
  user.suspendedAt = nextStatus === 'suspended' ? now : null;
  user.isBanned = nextStatus !== 'active';
  user.statusReason = nextStatus === 'active' ? '' : String(reason).trim();
  user.banReason = nextStatus === 'banned' ? String(reason).trim() : '';
  user.banExpiresAt = nextStatus === 'banned' ? user.banExpiresAt || null : null;
  await user.save({ session });

  const actionTypeByStatus = {
    banned: previousValue.accountStatus === 'banned' ? 'USER_BANNED' : 'USER_BANNED',
    suspended: 'USER_SUSPENDED',
    active: previousValue.accountStatus === 'banned' ? 'USER_UNBANNED' : 'USER_REACTIVATED'
  };

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: user._id,
    actionType: actionTypeByStatus[nextStatus],
    previousValue,
    newValue: {
      accountStatus: user.accountStatus,
      isBanned: user.isBanned,
      statusReason: user.statusReason || user.banReason || ''
    },
    reason,
    session
  });

  return sanitizeUserListItem(user);
}

module.exports = {
  MANAGEABLE_ROLES,
  MANAGEABLE_STATUSES,
  resolveAccountStatus,
  resolveAdminRoleLabel,
  listUsers,
  getUserDetails,
  updateUserRole,
  updateUserStatus
};
