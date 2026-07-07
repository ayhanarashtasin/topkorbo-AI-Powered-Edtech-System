const LoginHistory = require('../../models/LoginHistory');
const ContestResult = require('../../models/ContestResult');
const User = require('../../models/User');
const AdminAuditLog = require('../../models/AdminAuditLog');
const Report = require('../../models/Report');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveUserRole(user) {
  if (!user) return '';
  if (user.forumRole === 'admin' || user.forumRole === 'moderator') return user.forumRole;
  return user.role || '';
}

function formatDate(value) {
  return value ? new Date(value) : null;
}

async function getLoginHistory({ search = '', status = '', page = 1, limit = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const query = {};

  if (status && ['success', 'failure'].includes(status)) {
    query.status = status;
  }

  if (search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    const users = await User.find({
      $or: [{ name: regex }, { email: regex }]
    }).select('_id').lean();
    const userIds = users.map((item) => item._id);
    query.$or = [
      { email: regex },
      { ipAddress: regex },
      { browser: regex },
      { device: regex },
      { userAgent: regex },
      ...(userIds.length ? [{ user: { $in: userIds } }] : [])
    ];
  }

  const [items, total, summary] = await Promise.all([
    LoginHistory.find(query)
      .populate('user', 'name email role forumRole')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    LoginHistory.countDocuments(query),
    LoginHistory.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const stats = summary.reduce((accumulator, item) => {
    accumulator[item._id] = item.count;
    return accumulator;
  }, { success: 0, failure: 0 });

  const serializedItems = items.map((entry) => ({
    id: String(entry._id),
    user: entry.user
      ? {
          id: String(entry.user._id),
          name: entry.user.name || '',
          email: entry.user.email || ''
        }
      : null,
    email: entry.email || entry.user?.email || '',
    role: entry.role || resolveUserRole(entry.user),
    status: entry.status || 'success',
    ipAddress: entry.ipAddress || '',
    userAgent: entry.userAgent || '',
    browser: entry.browser || '',
    device: entry.device || '',
    loginMethod: entry.loginMethod || 'google_oauth',
    failureReason: entry.failureReason || '',
    createdAt: entry.createdAt || null
  }));

  return {
    items: serializedItems,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    },
    stats
  };
}

async function getSuspiciousActivity({ page = 1, limit = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [failedLogins, flaggedAttempts, restrictedAccounts, roleChanges, openReports] = await Promise.all([
    LoginHistory.aggregate([
      {
        $match: {
          status: 'failure',
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            email: '$email',
            ipAddress: '$ipAddress'
          },
          count: { $sum: 1 },
          latestAt: { $max: '$createdAt' },
          reasons: { $addToSet: '$failureReason' }
        }
      },
      { $match: { count: { $gte: 3 } } },
      { $sort: { latestAt: -1 } },
      { $limit: 20 }
    ]),
    ContestResult.find({
      antiCheatStatus: 'flagged',
      antiCheatFlaggedAt: { $ne: null }
    })
      .populate('contest', 'name')
      .populate('student', 'name email')
      .sort({ antiCheatFlaggedAt: -1 })
      .limit(20)
      .lean(),
    User.find({
      accountStatus: { $in: ['suspended', 'banned'] },
      statusChangedAt: { $gte: thirtyDaysAgo }
    })
      .select('name email role forumRole accountStatus statusReason statusChangedAt')
      .sort({ statusChangedAt: -1 })
      .limit(20)
      .lean(),
    AdminAuditLog.find({
      actionType: 'ROLE_CHANGED',
      createdAt: { $gte: thirtyDaysAgo }
    })
      .populate('adminId', 'name email')
      .populate('targetUserId', 'name email role forumRole')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Report.aggregate([
      {
        $match: {
          status: { $in: ['open', 'under_review'] },
          reason: { $in: ['spam', 'harassment', 'cheating', 'hate'] },
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            targetType: '$targetType',
            target: '$target'
          },
          latestAt: { $max: '$createdAt' },
          reportCount: { $sum: 1 },
          reasons: { $addToSet: '$reason' },
          status: { $last: '$status' }
        }
      },
      { $sort: { latestAt: -1 } },
      { $limit: 20 }
    ])
  ]);

  const items = [
    ...failedLogins.map((entry) => ({
      id: `failed-login-${entry._id.email || 'unknown'}-${entry._id.ipAddress || 'unknown'}`,
      source: 'failed_login_cluster',
      severity: 'danger',
      title: `${entry.count} failed login attempts detected`,
      description: [
        entry._id.email ? `Email: ${entry._id.email}` : '',
        entry._id.ipAddress ? `IP: ${entry._id.ipAddress}` : '',
        entry.reasons.filter(Boolean)[0] ? `Latest reason: ${entry.reasons.filter(Boolean)[0]}` : ''
      ].filter(Boolean).join(' | '),
      createdAt: entry.latestAt,
      user: null,
      linkPath: '/admin/security'
    })),
    ...flaggedAttempts.map((entry) => ({
      id: `contest-${entry._id}`,
      source: 'contest_anti_cheat',
      severity: 'warning',
      title: `Flagged contest attempt in ${entry.contest?.name || 'contest'}`,
      description: entry.antiCheatReason || 'Contest anti-cheat flagged this result.',
      createdAt: entry.antiCheatFlaggedAt || entry.updatedAt || entry.submittedAt || null,
      user: entry.student
        ? {
            id: String(entry.student._id),
            name: entry.student.name || '',
            email: entry.student.email || ''
          }
        : null,
      linkPath: '/admin/contests/anti-cheat'
    })),
    ...restrictedAccounts.map((entry) => ({
      id: `account-${entry._id}`,
      source: 'account_restriction',
      severity: entry.accountStatus === 'banned' ? 'danger' : 'warning',
      title: `${entry.accountStatus === 'banned' ? 'Banned' : 'Suspended'} account`,
      description: entry.statusReason || 'Account restriction applied by admin moderation.',
      createdAt: entry.statusChangedAt || null,
      user: {
        id: String(entry._id),
        name: entry.name || '',
        email: entry.email || ''
      },
      linkPath: '/admin/users'
    })),
    ...roleChanges.map((entry) => ({
      id: `role-${entry._id}`,
      source: 'role_change',
      severity: 'info',
      title: 'Privileged role change recorded',
      description: `${entry.targetUserId?.name || 'User'} changed to ${entry.newValue?.effectiveRole || entry.newValue?.role || 'updated role'}`,
      createdAt: entry.createdAt || null,
      user: entry.targetUserId
        ? {
            id: String(entry.targetUserId._id),
            name: entry.targetUserId.name || '',
            email: entry.targetUserId.email || ''
          }
        : null,
      linkPath: '/admin/audit-logs'
    })),
    ...openReports.map((entry) => ({
      id: `report-${entry._id.targetType}-${entry._id.target}`,
      source: 'moderation_report',
      severity: 'warning',
      title: `${entry.reportCount} active moderation reports`,
      description: `${entry._id.targetType} reported for ${entry.reasons.join(', ')}`,
      createdAt: entry.latestAt || null,
      user: null,
      linkPath: '/admin/moderation'
    }))
  ]
    .sort((a, b) => (formatDate(b.createdAt)?.getTime() || 0) - (formatDate(a.createdAt)?.getTime() || 0));

  const summary = items.reduce((accumulator, item) => {
    accumulator.total += 1;
    accumulator.bySource[item.source] = (accumulator.bySource[item.source] || 0) + 1;
    return accumulator;
  }, { total: 0, bySource: {} });

  const paginatedItems = items.slice((safePage - 1) * safeLimit, safePage * safeLimit);

  return {
    items: paginatedItems,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / safeLimit))
    },
    summary
  };
}

module.exports = {
  getLoginHistory,
  getSuspiciousActivity
};
