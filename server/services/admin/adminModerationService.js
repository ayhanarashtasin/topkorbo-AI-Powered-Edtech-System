const mongoose = require('mongoose');
const Report = require('../../models/Report');
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const Question = require('../../models/Question');
const User = require('../../models/User');
const ModerationAppeal = require('../../models/ModerationAppeal');
const { notify } = require('../notificationService');
const { getIO } = require('../../socket');
const { createAdminAuditLog } = require('./adminAuditService');
const { updateUserStatus, resolveAccountStatus } = require('./adminUserService');

const REPORT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'];
const REPORT_TARGET_TYPES = ['post', 'comment', 'user', 'question'];
const REPORT_REASONS = [
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
const APPEAL_STATUSES = ['pending', 'under_review', 'approved', 'rejected'];

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeReportStatus(status = '') {
  return status === 'action_taken' ? 'resolved' : status || 'open';
}

function formatPreview(text = '', fallback = 'No preview available') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function buildReportMatch({ status = '', itemType = '', reason = '', createdFrom = '', createdTo = '' }) {
  const match = {};

  if (status && REPORT_STATUSES.includes(status)) {
    match.status = status === 'resolved' ? { $in: ['resolved', 'action_taken'] } : status;
  }
  if (itemType && REPORT_TARGET_TYPES.includes(itemType)) {
    match.targetType = itemType;
  }
  if (reason && REPORT_REASONS.includes(reason)) {
    match.reason = reason;
  }
  if (createdFrom || createdTo) {
    match.createdAt = {};
    if (createdFrom) {
      match.createdAt.$gte = new Date(createdFrom);
    }
    if (createdTo) {
      const endDate = new Date(createdTo);
      endDate.setHours(23, 59, 59, 999);
      match.createdAt.$lte = endDate;
    }
  }

  return match;
}

async function populateGroupedReportTargets(groups) {
  const idsByType = groups.reduce((accumulator, group) => {
    accumulator[group.targetType] = accumulator[group.targetType] || [];
    accumulator[group.targetType].push(group.targetId);
    return accumulator;
  }, {});

  const [posts, comments, users, questions] = await Promise.all([
    idsByType.post?.length
      ? Post.find({ _id: { $in: idsByType.post } }).populate('author', 'name email username').lean()
      : [],
    idsByType.comment?.length
      ? Comment.find({ _id: { $in: idsByType.comment } }).populate('author', 'name email username').populate('post', 'title contentText').lean()
      : [],
    idsByType.user?.length
      ? User.find({ _id: { $in: idsByType.user } }).select('name email username avatar accountStatus isBanned statusReason banReason').lean()
      : [],
    idsByType.question?.length
      ? Question.find({ _id: { $in: idsByType.question } }).populate('teacher', 'name email').lean()
      : []
  ]);

  return {
    post: new Map(posts.map((item) => [String(item._id), item])),
    comment: new Map(comments.map((item) => [String(item._id), item])),
    user: new Map(users.map((item) => [String(item._id), item])),
    question: new Map(questions.map((item) => [String(item._id), item]))
  };
}

function mapTargetSummary(group, targetMaps) {
  const target = targetMaps[group.targetType]?.get(group.targetId) || null;

  if (group.targetType === 'post') {
    return {
      id: group.targetId,
      type: 'post',
      preview: formatPreview(target?.title || target?.contentText, 'Community post'),
      owner: target?.author
        ? {
            id: String(target.author._id),
            name: target.author.name || target.author.username || 'Unknown user',
            email: target.author.email || ''
          }
        : null,
      isHidden: !!target?.isHidden,
      linkPath: target ? `/community/posts/${group.targetId}` : ''
    };
  }

  if (group.targetType === 'comment') {
    return {
      id: group.targetId,
      type: 'comment',
      preview: formatPreview(target?.contentText, 'Comment'),
      owner: target?.author
        ? {
            id: String(target.author._id),
            name: target.author.name || target.author.username || 'Unknown user',
            email: target.author.email || ''
          }
        : null,
      isHidden: !!target?.isHidden,
      linkPath: target?.post ? `/community/posts/${target.post._id || target.post}` : ''
    };
  }

  if (group.targetType === 'question') {
    return {
      id: group.targetId,
      type: 'question',
      preview: formatPreview(target?.questionText, 'Question'),
      owner: target?.teacher
        ? {
            id: String(target.teacher._id),
            name: target.teacher.name || 'Unknown teacher',
            email: target.teacher.email || ''
          }
        : null,
      isHidden: false,
      linkPath: `/admin/questions/reports`
    };
  }

  if (group.targetType === 'user') {
    return {
      id: group.targetId,
      type: 'user',
      preview: target ? `${target.name || target.username || 'User'} account` : 'Reported user',
      owner: target
        ? {
            id: String(target._id),
            name: target.name || target.username || 'Unknown user',
            email: target.email || ''
          }
        : null,
      isHidden: false,
      linkPath: `/admin/users`
    };
  }

  return {
    id: group.targetId,
    type: group.targetType,
    preview: 'Unsupported content',
    owner: null,
    isHidden: false,
    linkPath: ''
  };
}

async function listReports({
  search = '',
  status = '',
  itemType = '',
  reason = '',
  createdFrom = '',
  createdTo = '',
  page = 1,
  limit = 10
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const match = buildReportMatch({ status, itemType, reason, createdFrom, createdTo });

  const grouped = await Report.aggregate([
    { $match: match },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: { targetType: '$targetType', target: '$target' },
        reportId: { $last: '$_id' },
        targetType: { $last: '$targetType' },
        targetId: { $last: '$target' },
        latestReporterId: { $last: '$reporter' },
        latestReason: { $last: '$reason' },
        latestDescription: { $last: '$description' },
        latestStatus: { $last: '$status' },
        latestCreatedAt: { $max: '$createdAt' },
        statuses: { $addToSet: '$status' },
        reportCount: { $sum: 1 }
      }
    },
    { $sort: { latestCreatedAt: -1 } }
  ]);

  const reporterIds = Array.from(
    new Set(grouped.map((item) => String(item.latestReporterId || '')).filter(Boolean))
  );
  const [reporters, targetMaps] = await Promise.all([
    reporterIds.length
      ? User.find({ _id: { $in: reporterIds } }).select('name email username').lean()
      : [],
    populateGroupedReportTargets(grouped)
  ]);

  const reporterMap = new Map(reporters.map((item) => [String(item._id), item]));

  let items = grouped.map((group) => {
    const target = mapTargetSummary(group, targetMaps);
    const reporter = reporterMap.get(String(group.latestReporterId)) || null;
    return {
      id: String(group.reportId),
      reportCount: group.reportCount,
      itemType: group.targetType,
      reason: group.latestReason || 'other',
      description: group.latestDescription || '',
      status: group.statuses.includes('open')
        ? 'open'
        : group.statuses.includes('under_review')
          ? 'under_review'
          : group.statuses.some((item) => normalizeReportStatus(item) === 'resolved')
            ? 'resolved'
            : 'dismissed',
      createdAt: group.latestCreatedAt || null,
      reportedBy: reporter
        ? {
            id: String(reporter._id),
            name: reporter.name || reporter.username || 'Unknown user',
            email: reporter.email || ''
          }
        : null,
      target
    };
  });

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    items = items.filter((item) =>
      regex.test(item.reportedBy?.name || '') ||
      regex.test(item.reportedBy?.email || '') ||
      regex.test(item.target.owner?.name || '') ||
      regex.test(item.target.owner?.email || '') ||
      regex.test(item.target.preview || '')
    );
  }

  const summary = items.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      accumulator[item.status] += 1;
      return accumulator;
    },
    { total: 0, open: 0, under_review: 0, resolved: 0, dismissed: 0 }
  );

  const total = items.length;
  const pagedItems = items.slice((safePage - 1) * safeLimit, (safePage - 1) * safeLimit + safeLimit);

  return {
    items: pagedItems,
    summary,
    filters: {
      statuses: REPORT_STATUSES,
      itemTypes: REPORT_TARGET_TYPES,
      reasons: REPORT_REASONS
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function resolveRelatedReports(reportId) {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    throw err;
  }

  const anchor = await Report.findById(reportId);
  if (!anchor) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    throw err;
  }

  const reports = await Report.find({
    targetType: anchor.targetType,
    target: anchor.target
  })
    .populate('reporter', 'name email username')
    .populate('reviewer', 'name email')
    .populate('adminNotes.addedBy', 'name email')
    .sort({ createdAt: -1, _id: -1 });

  return { anchor, reports };
}

async function resolveTargetForReport(report) {
  if (!report) return null;

  if (report.targetType === 'post') {
    const post = await Post.findById(report.target).populate('author', 'name email username').lean();
    return {
      entityId: String(report.target),
      entityType: 'post',
      entityName: formatPreview(post?.title || post?.contentText, 'Community post'),
      targetUserId: post?.author?._id || null,
      preview: formatPreview(post?.title || post?.contentText, 'Community post'),
      owner: post?.author
        ? {
            id: String(post.author._id),
            name: post.author.name || post.author.username || 'Unknown user',
            email: post.author.email || ''
          }
        : null,
      linkPath: post ? `/community/posts/${post._id}` : '',
      isHidden: !!post?.isHidden
    };
  }

  if (report.targetType === 'comment') {
    const comment = await Comment.findById(report.target)
      .populate('author', 'name email username')
      .populate('post', 'title')
      .lean();
    return {
      entityId: String(report.target),
      entityType: 'comment',
      entityName: formatPreview(comment?.contentText, 'Comment'),
      targetUserId: comment?.author?._id || null,
      preview: formatPreview(comment?.contentText, 'Comment'),
      owner: comment?.author
        ? {
            id: String(comment.author._id),
            name: comment.author.name || comment.author.username || 'Unknown user',
            email: comment.author.email || ''
          }
        : null,
      linkPath: comment?.post ? `/community/posts/${comment.post._id}` : '',
      isHidden: !!comment?.isHidden
    };
  }

  if (report.targetType === 'question') {
    const question = await Question.findById(report.target).populate('teacher', 'name email').lean();
    return {
      entityId: String(report.target),
      entityType: 'question',
      entityName: formatPreview(question?.questionText, 'Question'),
      targetUserId: question?.teacher?._id || null,
      preview: formatPreview(question?.questionText, 'Question'),
      owner: question?.teacher
        ? {
            id: String(question.teacher._id),
            name: question.teacher.name || 'Unknown teacher',
            email: question.teacher.email || ''
          }
        : null,
      linkPath: `/admin/questions/reports`,
      isHidden: false
    };
  }

  if (report.targetType === 'user') {
    const user = await User.findById(report.target).select('name email username accountStatus isBanned statusReason banReason').lean();
    return {
      entityId: String(report.target),
      entityType: 'user',
      entityName: user?.name || user?.username || 'Reported user',
      targetUserId: user?._id || null,
      preview: user ? `${user.name || user.username || 'User'} account` : 'Reported user',
      owner: user
        ? {
            id: String(user._id),
            name: user.name || user.username || 'Unknown user',
            email: user.email || '',
            accountStatus: resolveAccountStatus(user)
          }
        : null,
      linkPath: `/admin/users`,
      isHidden: false
    };
  }

  return null;
}

function buildReportDetails(anchor, reports, targetSummary) {
  const latest = reports[0] || anchor;
  const adminNotes = (latest?.adminNotes || []).map((item) => ({
    note: item.note || '',
    addedAt: item.addedAt || null,
    addedBy: item.addedBy
      ? {
          id: String(item.addedBy._id || item.addedBy),
          name: item.addedBy.name || 'Unknown admin',
          email: item.addedBy.email || ''
        }
      : null
  }));

  return {
    id: String(anchor._id),
    itemType: anchor.targetType,
    reason: latest?.reason || anchor.reason || 'other',
    description: latest?.description || anchor.description || '',
    status: reports.some((item) => item.status === 'open')
      ? 'open'
      : reports.some((item) => item.status === 'under_review')
        ? 'under_review'
        : reports.some((item) => normalizeReportStatus(item.status) === 'resolved')
          ? 'resolved'
          : 'dismissed',
    reportCount: reports.length,
    createdAt: latest?.createdAt || anchor.createdAt || null,
    target: targetSummary,
    reporters: reports.map((item) => ({
      id: String(item._id),
      reason: item.reason || '',
      description: item.description || '',
      status: normalizeReportStatus(item.status),
      createdAt: item.createdAt || null,
      reviewedAt: item.reviewedAt || null,
      actionTaken: item.actionTaken || '',
      reportedBy: item.reporter
        ? {
            id: String(item.reporter._id),
            name: item.reporter.name || item.reporter.username || 'Unknown user',
            email: item.reporter.email || ''
          }
        : null,
      reviewer: item.reviewer
        ? {
            id: String(item.reviewer._id),
            name: item.reviewer.name || 'Unknown admin',
            email: item.reviewer.email || ''
          }
        : null
    })),
    adminNotes
  };
}

async function getReportDetails(reportId) {
  const { anchor, reports } = await resolveRelatedReports(reportId);
  const targetSummary = await resolveTargetForReport(anchor);
  return buildReportDetails(anchor, reports, targetSummary);
}

async function addReportNote({ adminUser, reportId, note }) {
  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) {
    const err = new Error('Admin note is required');
    err.statusCode = 400;
    throw err;
  }

  const { anchor, reports } = await resolveRelatedReports(reportId);
  const targetSummary = await resolveTargetForReport(anchor);
  const noteEntry = {
    note: trimmedNote,
    addedBy: adminUser.id,
    addedAt: new Date()
  };

  await Promise.all(
    reports.map((report) =>
      Report.updateOne(
        { _id: report._id },
        {
          $push: { adminNotes: noteEntry },
          $set: {
            reviewer: adminUser.id,
            reviewedAt: noteEntry.addedAt
          }
        }
      )
    )
  );

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: targetSummary?.targetUserId || undefined,
    targetEntityId: targetSummary?.entityId,
    targetEntityType: targetSummary?.entityType,
    targetEntityName: targetSummary?.entityName,
    actionType: 'REPORT_NOTE_ADDED',
    previousValue: { status: normalizeReportStatus(anchor.status) },
    newValue: { status: normalizeReportStatus(anchor.status), reportId: String(anchor._id) },
    reason: trimmedNote
  });

  return getReportDetails(reportId);
}

async function updateReportStatus({ adminUser, reportId, nextStatus, note = '', actionType }) {
  if (!REPORT_STATUSES.includes(nextStatus)) {
    const err = new Error('Invalid report status');
    err.statusCode = 400;
    throw err;
  }

  const { anchor, reports } = await resolveRelatedReports(reportId);
  const targetSummary = await resolveTargetForReport(anchor);
  const previousStatuses = Array.from(new Set(reports.map((item) => normalizeReportStatus(item.status))));
  const now = new Date();
  const trimmedNote = String(note || '').trim();

  await Promise.all(
    reports.map((report) => {
      const update = {
        $set: {
          status: nextStatus,
          reviewer: adminUser.id,
          reviewedAt: now,
          actionTaken: trimmedNote || report.actionTaken || ''
        }
      };
      if (trimmedNote) {
        update.$push = {
          adminNotes: {
            note: trimmedNote,
            addedBy: adminUser.id,
            addedAt: now
          }
        };
      }
      return Report.updateOne({ _id: report._id }, update);
    })
  );

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: targetSummary?.targetUserId || undefined,
    targetEntityId: targetSummary?.entityId,
    targetEntityType: targetSummary?.entityType,
    targetEntityName: targetSummary?.entityName,
    actionType,
    previousValue: { statuses: previousStatuses },
    newValue: { status: nextStatus, reportId: String(anchor._id) },
    reason: trimmedNote
  });

  return getReportDetails(reportId);
}

async function warnReportedUser({ adminUser, reportId, note = '' }) {
  const { anchor } = await resolveRelatedReports(reportId);
  const targetSummary = await resolveTargetForReport(anchor);
  const userId = targetSummary?.targetUserId;

  if (!userId) {
    const err = new Error('No target user is available for this report');
    err.statusCode = 400;
    throw err;
  }

  const warningReason = String(note || '').trim() || anchor.reason;
  await User.findByIdAndUpdate(userId, {
    $push: {
      warnings: {
        reason: warningReason,
        issuedBy: adminUser.id
      }
    }
  });

  try {
    const io = getIO();
    await notify(io, {
      recipient: userId,
      actor: adminUser.id,
      type: 'warning',
      message: `You have received a warning: ${warningReason}`,
      preview: 'Please review our community guidelines.'
    });
  } catch (_) {
    // Notification delivery should not block the moderation action.
  }

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: userId,
    targetEntityId: targetSummary?.entityId,
    targetEntityType: targetSummary?.entityType,
    targetEntityName: targetSummary?.entityName,
    actionType: 'USER_WARNED',
    previousValue: { reportId: String(anchor._id) },
    newValue: { warned: true },
    reason: warningReason
  });

  return updateReportStatus({
    adminUser,
    reportId,
    nextStatus: 'resolved',
    note: warningReason,
    actionType: 'REPORT_RESOLVED'
  });
}

async function hideReportedContent({ adminUser, reportId, note = '' }) {
  const { anchor } = await resolveRelatedReports(reportId);
  const targetSummary = await resolveTargetForReport(anchor);
  const hiddenReason = String(note || '').trim() || 'Hidden by admin moderation';

  if (anchor.targetType === 'post') {
    await Post.findByIdAndUpdate(anchor.target, { isHidden: true, hiddenReason });
  } else if (anchor.targetType === 'comment') {
    await Comment.findByIdAndUpdate(anchor.target, { isHidden: true });
  } else {
    const err = new Error('Hide content is only supported for posts and comments');
    err.statusCode = 400;
    throw err;
  }

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: targetSummary?.targetUserId || undefined,
    targetEntityId: targetSummary?.entityId,
    targetEntityType: targetSummary?.entityType,
    targetEntityName: targetSummary?.entityName,
    actionType: 'CONTENT_HIDDEN',
    previousValue: { isHidden: false, reportId: String(anchor._id) },
    newValue: { isHidden: true },
    reason: hiddenReason
  });

  return updateReportStatus({
    adminUser,
    reportId,
    nextStatus: 'resolved',
    note: hiddenReason,
    actionType: 'REPORT_RESOLVED'
  });
}

async function changeReportedUserStatus({ adminUser, reportId, status, reason = '' }) {
  if (!['suspended', 'banned'].includes(status)) {
    const err = new Error('Only suspend or ban actions are supported from moderation');
    err.statusCode = 400;
    throw err;
  }

  const { anchor } = await resolveRelatedReports(reportId);
  const targetSummary = await resolveTargetForReport(anchor);
  const userId = targetSummary?.targetUserId;

  if (!userId) {
    const err = new Error('No target user is available for this report');
    err.statusCode = 400;
    throw err;
  }

  const finalReason = String(reason || '').trim() || anchor.reason;
  await updateUserStatus({
    adminUser,
    targetUserId: userId,
    nextStatus: status,
    reason: finalReason
  });

  return updateReportStatus({
    adminUser,
    reportId,
    nextStatus: 'resolved',
    note: finalReason,
    actionType: 'REPORT_RESOLVED'
  });
}

function buildAppealQuery({ status = '', createdFrom = '', createdTo = '' }) {
  const query = {};

  if (status && APPEAL_STATUSES.includes(status)) {
    query.status = status;
  }

  if (createdFrom || createdTo) {
    query.createdAt = {};
    if (createdFrom) query.createdAt.$gte = new Date(createdFrom);
    if (createdTo) {
      const endDate = new Date(createdTo);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }

  return query;
}

async function listAppeals({
  search = '',
  status = '',
  createdFrom = '',
  createdTo = '',
  page = 1,
  limit = 10
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const query = buildAppealQuery({ status, createdFrom, createdTo });

  const [appeals, totalRaw] = await Promise.all([
    ModerationAppeal.find(query)
      .populate('user', 'name email username accountStatus isBanned statusReason banReason')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean(),
    ModerationAppeal.countDocuments(query)
  ]);

  let items = appeals.map((appeal) => ({
    id: String(appeal._id),
    user: appeal.user
      ? {
          id: String(appeal.user._id),
          name: appeal.user.name || appeal.user.username || 'Unknown user',
          email: appeal.user.email || '',
          accountStatus: resolveAccountStatus(appeal.user)
        }
      : null,
    accountStatusAtSubmission: appeal.accountStatusAtSubmission || 'active',
    reason: appeal.reason || '',
    status: appeal.status || 'pending',
    submittedAt: appeal.createdAt || null,
    reviewedAt: appeal.reviewedAt || null
  }));

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    items = items.filter((item) =>
      regex.test(item.user?.name || '') ||
      regex.test(item.user?.email || '') ||
      regex.test(item.reason || '')
    );
  }

  const summary = items.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      if (accumulator[item.status] !== undefined) {
        accumulator[item.status] += 1;
      }
      return accumulator;
    },
    { total: 0, pending: 0, under_review: 0, approved: 0, rejected: 0 }
  );

  const total = items.length;
  items = items.slice((safePage - 1) * safeLimit, (safePage - 1) * safeLimit + safeLimit);

  return {
    items,
    summary,
    filters: {
      statuses: APPEAL_STATUSES
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: search ? total : totalRaw,
      totalPages: Math.max(1, Math.ceil((search ? total : totalRaw) / safeLimit))
    }
  };
}

async function getAppealDetails(appealId) {
  if (!mongoose.Types.ObjectId.isValid(appealId)) {
    const err = new Error('Appeal not found');
    err.statusCode = 404;
    throw err;
  }

  const appeal = await ModerationAppeal.findById(appealId)
    .populate('user', 'name email username accountStatus isBanned statusReason banReason')
    .populate('reviewedBy', 'name email')
    .populate('adminNotes.addedBy', 'name email')
    .lean();

  if (!appeal) {
    const err = new Error('Appeal not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    id: String(appeal._id),
    reason: appeal.reason || '',
    status: appeal.status || 'pending',
    submittedAt: appeal.createdAt || null,
    reviewedAt: appeal.reviewedAt || null,
    user: appeal.user
      ? {
          id: String(appeal.user._id),
          name: appeal.user.name || appeal.user.username || 'Unknown user',
          email: appeal.user.email || '',
          accountStatus: resolveAccountStatus(appeal.user),
          statusReason: appeal.user.statusReason || appeal.user.banReason || ''
        }
      : null,
    accountStatusAtSubmission: appeal.accountStatusAtSubmission || 'active',
    reviewedBy: appeal.reviewedBy
      ? {
          id: String(appeal.reviewedBy._id),
          name: appeal.reviewedBy.name || 'Unknown admin',
          email: appeal.reviewedBy.email || ''
        }
      : null,
    adminNotes: (appeal.adminNotes || []).map((item) => ({
      note: item.note || '',
      addedAt: item.addedAt || null,
      addedBy: item.addedBy
        ? {
            id: String(item.addedBy._id || item.addedBy),
            name: item.addedBy.name || 'Unknown admin',
            email: item.addedBy.email || ''
          }
        : null
    }))
  };
}

async function addAppealNote({ adminUser, appealId, note }) {
  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) {
    const err = new Error('Admin note is required');
    err.statusCode = 400;
    throw err;
  }

  const appeal = await ModerationAppeal.findById(appealId);
  if (!appeal) {
    const err = new Error('Appeal not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = appeal.status;
  appeal.adminNotes.push({
    note: trimmedNote,
    addedBy: adminUser.id,
    addedAt: new Date()
  });
  if (appeal.status === 'pending') {
    appeal.status = 'under_review';
  }
  appeal.reviewedBy = adminUser.id;
  appeal.reviewedAt = new Date();
  await appeal.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: appeal.user,
    targetEntityId: appeal._id,
    targetEntityType: 'appeal',
    targetEntityName: 'Moderation appeal',
    actionType: 'APPEAL_NOTE_ADDED',
    previousValue: { status: previousStatus },
    newValue: { status: appeal.status },
    reason: trimmedNote
  });

  return getAppealDetails(appealId);
}

async function approveAppeal({ adminUser, appealId, note = '' }) {
  const appeal = await ModerationAppeal.findById(appealId).populate('user');
  if (!appeal) {
    const err = new Error('Appeal not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = appeal.status;
  const reason = String(note || '').trim() || 'Appeal approved by admin';
  await updateUserStatus({
    adminUser,
    targetUserId: appeal.user._id,
    nextStatus: 'active',
    reason
  });

  appeal.status = 'approved';
  appeal.reviewedBy = adminUser.id;
  appeal.reviewedAt = new Date();
  if (reason) {
    appeal.adminNotes.push({
      note: reason,
      addedBy: adminUser.id,
      addedAt: appeal.reviewedAt
    });
  }
  await appeal.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: appeal.user._id,
    targetEntityId: appeal._id,
    targetEntityType: 'appeal',
    targetEntityName: 'Moderation appeal',
    actionType: 'APPEAL_APPROVED',
    previousValue: { status: previousStatus },
    newValue: { status: appeal.status },
    reason
  });

  return getAppealDetails(appealId);
}

async function rejectAppeal({ adminUser, appealId, note = '' }) {
  const appeal = await ModerationAppeal.findById(appealId);
  if (!appeal) {
    const err = new Error('Appeal not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = appeal.status;
  const reason = String(note || '').trim();
  appeal.status = 'rejected';
  appeal.reviewedBy = adminUser.id;
  appeal.reviewedAt = new Date();
  if (reason) {
    appeal.adminNotes.push({
      note: reason,
      addedBy: adminUser.id,
      addedAt: appeal.reviewedAt
    });
  }
  await appeal.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: appeal.user,
    targetEntityId: appeal._id,
    targetEntityType: 'appeal',
    targetEntityName: 'Moderation appeal',
    actionType: 'APPEAL_REJECTED',
    previousValue: { status: previousStatus },
    newValue: { status: appeal.status },
    reason
  });

  return getAppealDetails(appealId);
}

module.exports = {
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  REPORT_REASONS,
  APPEAL_STATUSES,
  listReports,
  getReportDetails,
  addReportNote,
  updateReportStatus,
  warnReportedUser,
  hideReportedContent,
  changeReportedUserStatus,
  listAppeals,
  getAppealDetails,
  addAppealNote,
  approveAppeal,
  rejectAppeal
};
