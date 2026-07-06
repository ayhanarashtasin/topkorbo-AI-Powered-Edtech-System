const mongoose = require('mongoose');
const User = require('../../models/User');
const TeacherApplication = require('../../models/TeacherApplication');
const Question = require('../../models/Question');
const Book = require('../../models/Book');
const Report = require('../../models/Report');
const Contest = require('../../models/Contest');
const Payment = require('../../models/Payment');
const Notification = require('../../models/Notification');
const IeltsListeningSet = require('../../models/IeltsListeningSet');
const IeltsWritingSet = require('../../models/IeltsWritingSet');
const IeltsReadingSet = require('../../models/IeltsReadingSet');

const EMPTY_STATS = {
  totalUsers: 0,
  students: 0,
  teachers: 0,
  pendingTeacherApplications: 0,
  pendingQuestions: 0,
  pendingBooks: 0,
  reports: 0,
  supportTickets: 0,
  contests: 0,
  ieltsSets: 0,
  unreadNotifications: 0,
  totalRevenue: 0
};

function getDatabaseStatus() {
  const dbReadyState = mongoose.connection.readyState;
  const dbStatusByState = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    readyState: dbReadyState,
    label: dbStatusByState[dbReadyState] || 'unknown'
  };
}

function buildHealth(apiStatus, databaseStatus) {
  return {
    api: apiStatus,
    database: databaseStatus,
    uptimeSeconds: Math.floor(process.uptime())
  };
}

async function fetchDashboardStats() {
  const databaseState = getDatabaseStatus();
  if (databaseState.readyState !== 1) {
    return {
      stats: { ...EMPTY_STATS },
      systemHealth: buildHealth('degraded', databaseState.label)
    };
  }

  const [
    totalUsers,
    totalStudents,
    totalTeachers,
    pendingTeacherApplications,
    pendingQuestions,
    pendingBooks,
    openReports,
    supportTickets,
    totalContests,
    totalIeltsSets,
    totalRevenueResult,
    unreadAdminNotifications
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'teacher' }),
    TeacherApplication.countDocuments({ status: 'pending' }),
    Question.countDocuments({ approvalStatus: 'pending' }),
    Book.countDocuments({ approvalStatus: 'pending' }),
    Report.countDocuments({ status: 'open' }),
    Promise.resolve(0),
    Contest.countDocuments(),
    Promise.all([
      IeltsListeningSet.countDocuments(),
      IeltsWritingSet.countDocuments(),
      IeltsReadingSet.countDocuments()
    ]).then(
      ([listeningSets, writingSets, readingSets]) => listeningSets + writingSets + readingSets
    ),
    Payment.aggregate([
      { $match: { status: 'valid' } },
      { $group: { _id: null, amount: { $sum: '$amount' } } }
    ]),
    Notification.countDocuments({ read: false })
  ]);

  return {
    stats: {
      totalUsers,
      students: totalStudents,
      teachers: totalTeachers,
      pendingTeacherApplications,
      pendingQuestions,
      pendingBooks,
      reports: openReports,
      supportTickets,
      contests: totalContests,
      ieltsSets: totalIeltsSets,
      unreadNotifications: unreadAdminNotifications,
      totalRevenue: totalRevenueResult[0]?.amount || 0
    },
    systemHealth: buildHealth('operational', databaseState.label)
  };
}

module.exports = {
  fetchDashboardStats
};
