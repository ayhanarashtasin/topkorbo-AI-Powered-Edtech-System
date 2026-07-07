const User = require('../../models/User');
const Contest = require('../../models/Contest');
const ContestResult = require('../../models/ContestResult');
const Book = require('../../models/Book');
const Payment = require('../../models/Payment');
const SupportTicket = require('../../models/SupportTicket');
const Report = require('../../models/Report');
const TeacherApplication = require('../../models/TeacherApplication');
const Question = require('../../models/Question');
const Notification = require('../../models/Notification');
const IeltsListeningSet = require('../../models/IeltsListeningSet');
const IeltsWritingSet = require('../../models/IeltsWritingSet');
const IeltsReadingSet = require('../../models/IeltsReadingSet');
const { getContestLifecycle } = require('../../utils/contestSchedule');

const TIMEZONE = 'Asia/Dhaka';
const RANGE_PRESETS = {
  '7d': { days: 7, label: 'Last 7 days', granularity: 'day' },
  '30d': { days: 30, label: 'Last 30 days', granularity: 'day' },
  '90d': { days: 90, label: 'Last 90 days', granularity: 'month' },
  all: { days: null, label: 'All time', granularity: 'month' }
};

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseRange(range = '30d', now = new Date()) {
  const key = RANGE_PRESETS[range] ? range : '30d';
  const preset = RANGE_PRESETS[key];
  if (!preset.days) {
    return {
      key,
      label: preset.label,
      granularity: preset.granularity,
      timezone: TIMEZONE,
      startDate: null,
      endDate: now
    };
  }

  const startDate = startOfDay(new Date(now.getTime() - (preset.days - 1) * 24 * 60 * 60 * 1000));
  return {
    key,
    label: preset.label,
    granularity: preset.granularity,
    timezone: TIMEZONE,
    startDate,
    endDate: now
  };
}

function buildDateMatch(field, rangeInfo) {
  if (!rangeInfo.startDate) return {};
  return {
    [field]: {
      $gte: rangeInfo.startDate,
      $lte: rangeInfo.endDate
    }
  };
}

async function countByField(Model, field, values = [], match = {}) {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } }
  ]);

  const grouped = values.reduce((acc, value) => {
    acc[value] = 0;
    return acc;
  }, {});

  rows.forEach((row) => {
    const key = String(row._id || '');
    grouped[key] = Number(row.count) || 0;
  });

  return grouped;
}

async function sumValidPayments(match = {}) {
  const rows = await Payment.aggregate([
    { $match: { status: 'valid', ...match } },
    { $group: { _id: null, amount: { $sum: '$amount' } } }
  ]);
  return Number(rows[0]?.amount) || 0;
}

function getStoredRegistrationCount(contest) {
  const detailed = Array.isArray(contest.registeredStudentsDetails)
    ? contest.registeredStudentsDetails.length
    : 0;
  if (detailed > 0) return detailed;
  return Array.isArray(contest.registeredStudents) ? contest.registeredStudents.length : 0;
}

async function fetchOverviewAnalytics({ range = '30d' } = {}) {
  const now = new Date();
  const rangeInfo = parseRange(range, now);
  const createdAtMatch = buildDateMatch('createdAt', rangeInfo);
  const submittedAtMatch = buildDateMatch('submittedAt', rangeInfo);
  const lastActiveMatch = buildDateMatch('lastActiveAt', rangeInfo);

  const recentUserSeriesPipeline = [
    ...(rangeInfo.startDate ? [{ $match: createdAtMatch }] : []),
    {
      $group: {
        _id: {
          $dateToString: {
            format: rangeInfo.granularity === 'month' ? '%Y-%m' : '%Y-%m-%d',
            date: '$createdAt',
            timezone: TIMEZONE
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: rangeInfo.granularity === 'month' ? -1 : 1 } }
  ];
  if (rangeInfo.granularity === 'month') {
    recentUserSeriesPipeline.push({ $limit: 12 });
  } else {
    recentUserSeriesPipeline.push({ $limit: 31 });
  }

  const [
    totalUsers,
    userRoleCounts,
    userStatusCounts,
    newUsersInRange,
    usersWithLastActive,
    activeUsersInRange,
    totalContests,
    totalContestResults,
    contestSubmissionsInRange,
    contestScoreAverage,
    contestRangeScoreAverage,
    antiCheatCounts,
    totalBooks,
    bookStatusCounts,
    totalQuestions,
    questionStatusCounts,
    teacherApplicationStatusCounts,
    totalTeacherApplications,
    reportStatusCounts,
    supportTicketStatusCounts,
    unreadNotifications,
    listeningStatusCounts,
    writingStatusCounts,
    totalReadingSets,
    totalRevenue,
    revenueInRange,
    recentUserSeriesRows
  ] = await Promise.all([
    User.countDocuments(),
    countByField(User, 'role', ['student', 'teacher', 'tutor']),
    countByField(User, 'accountStatus', ['active', 'suspended', 'banned']),
    User.countDocuments(createdAtMatch),
    User.countDocuments({ lastActiveAt: { $ne: null } }),
    User.countDocuments(lastActiveMatch),
    Contest.countDocuments(),
    ContestResult.countDocuments(),
    ContestResult.countDocuments(submittedAtMatch),
    ContestResult.aggregate([
      { $group: { _id: null, averageScore: { $avg: '$score' } } }
    ]),
    ContestResult.aggregate([
      { $match: submittedAtMatch },
      { $group: { _id: null, averageScore: { $avg: '$score' } } }
    ]),
    countByField(ContestResult, 'antiCheatStatus', ['none', 'flagged', 'cleared']),
    Book.countDocuments(),
    countByField(Book, 'approvalStatus', ['pending', 'approved', 'rejected']),
    Question.countDocuments(),
    countByField(Question, 'approvalStatus', ['pending', 'approved', 'rejected']),
    countByField(TeacherApplication, 'status', ['pending', 'approved', 'rejected']),
    TeacherApplication.countDocuments(),
    countByField(Report, 'status', ['open', 'under_review', 'resolved', 'dismissed', 'action_taken']),
    countByField(SupportTicket, 'status', ['open', 'in_progress', 'resolved', 'closed']),
    Notification.countDocuments({ read: false }),
    countByField(IeltsListeningSet, 'approvalStatus', ['pending', 'approved', 'rejected']),
    countByField(IeltsWritingSet, 'approvalStatus', ['pending', 'approved', 'rejected']),
    IeltsReadingSet.countDocuments(),
    sumValidPayments(),
    sumValidPayments(createdAtMatch),
    User.aggregate(recentUserSeriesPipeline)
  ]);

  const contests = await Contest.find({})
    .select('date duration startTime adminStatus registeredStudents registeredStudentsDetails')
    .lean();

  const contestLifecycleCounts = {
    live: 0,
    upcoming: 0,
    ended: 0,
    cancelled: 0
  };
  const contestAdminStatusCounts = {
    active: 0,
    archived: 0,
    cancelled: 0
  };
  let totalRegistrations = 0;

  contests.forEach((contest) => {
    const lifecycle = getContestLifecycle(contest, now);
    if (contestLifecycleCounts[lifecycle] !== undefined) {
      contestLifecycleCounts[lifecycle] += 1;
    }

    const adminStatus = ['active', 'archived', 'cancelled'].includes(contest.adminStatus)
      ? contest.adminStatus
      : 'active';
    contestAdminStatusCounts[adminStatus] += 1;
    totalRegistrations += getStoredRegistrationCount(contest);
  });

  const activeUsersAvailable = usersWithLastActive > 0;
  const pendingApprovals =
    (teacherApplicationStatusCounts.pending || 0)
    + (questionStatusCounts.pending || 0)
    + (bookStatusCounts.pending || 0)
    + (listeningStatusCounts.pending || 0)
    + (writingStatusCounts.pending || 0);
  const recentUserSeries = recentUserSeriesRows
    .slice()
    .sort((a, b) => String(a._id).localeCompare(String(b._id)));

  return {
    range: {
      key: rangeInfo.key,
      label: rangeInfo.label,
      granularity: rangeInfo.granularity,
      timezone: rangeInfo.timezone,
      startDate: rangeInfo.startDate,
      endDate: rangeInfo.endDate
    },
    overviewCards: {
      totalUsers,
      newUsersInRange,
      activeUsersInRange: activeUsersAvailable ? activeUsersInRange : null,
      activeUsersAvailable,
      totalContests,
      contestSubmissionsInRange,
      pendingApprovals,
      openReports: reportStatusCounts.open || 0,
      revenueInRange
    },
    users: {
      total: totalUsers,
      byRole: userRoleCounts,
      byAccountStatus: userStatusCounts,
      newUsersInRange,
      activeUsers: {
        available: activeUsersAvailable,
        value: activeUsersAvailable ? activeUsersInRange : null,
        definition: activeUsersAvailable
          ? 'Users whose lastActiveAt falls inside the selected range.'
          : 'Tracking not available yet.'
      },
      recentSignups: recentUserSeries.map((row) => ({
        period: row._id,
        count: Number(row.count) || 0
      }))
    },
    contests: {
      total: totalContests,
      byAdminStatus: contestAdminStatusCounts,
      byLifecycle: contestLifecycleCounts,
      totalRegistrations,
      totalParticipants: totalContestResults,
      submissionsInRange: contestSubmissionsInRange,
      averageScore: Number(contestScoreAverage[0]?.averageScore || 0).toFixed(2),
      averageScoreInRange: Number(contestRangeScoreAverage[0]?.averageScore || 0).toFixed(2),
      antiCheat: {
        flagged: antiCheatCounts.flagged || 0,
        cleared: antiCheatCounts.cleared || 0
      }
    },
    content: {
      books: {
        total: totalBooks,
        byApprovalStatus: bookStatusCounts
      },
      questions: {
        total: totalQuestions,
        byApprovalStatus: questionStatusCounts
      },
      teacherApplications: {
        total: totalTeacherApplications,
        byStatus: teacherApplicationStatusCounts
      },
      ielts: {
        listening: {
          total: Object.values(listeningStatusCounts).reduce((sum, value) => sum + value, 0),
          byApprovalStatus: listeningStatusCounts
        },
        writing: {
          total: Object.values(writingStatusCounts).reduce((sum, value) => sum + value, 0),
          byApprovalStatus: writingStatusCounts
        },
        reading: {
          total: totalReadingSets,
          approvalTrackingAvailable: false
        }
      },
      reports: {
        byStatus: reportStatusCounts
      },
      supportTickets: {
        byStatus: supportTicketStatusCounts,
        openWorkload: (supportTicketStatusCounts.open || 0) + (supportTicketStatusCounts.in_progress || 0)
      }
    },
    payments: {
      totalRevenue,
      revenueInRange,
      definition: 'Sum of payments where status is valid.'
    },
    notifications: {
      unread: unreadNotifications
    },
    unavailableMetrics: [
      { label: 'Page views', reason: 'Tracking not available yet.' },
      { label: 'Session duration', reason: 'Tracking not available yet.' },
      { label: 'Retention and cohorts', reason: 'Tracking not available yet.' },
      { label: 'Book reads and reading time', reason: 'Tracking not available yet.' },
      { label: 'Learning progress analytics', reason: 'Tracking not available yet.' },
      { label: 'Notification open rate', reason: 'Tracking not available yet.' },
      { label: 'Weak subjects and top students', reason: 'Tracking not available yet.' },
      { label: 'IELTS reading approval status', reason: 'Tracking not available yet.' }
    ]
  };
}

module.exports = {
  fetchOverviewAnalytics
};
