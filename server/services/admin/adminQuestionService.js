const mongoose = require('mongoose');
const Question = require('../../models/Question');
const Report = require('../../models/Report');
const PracticeAttempt = require('../../models/PracticeAttempt');
const { createAdminAuditLog } = require('./adminAuditService');

const QUESTION_STATUSES = ['pending', 'approved', 'rejected'];
const REPORT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'];
const QUESTION_TYPES = ['mcq', 'written', 'cq'];
const SUBJECTS = [
  'Physics',
  'Chemistry',
  'Higher Math',
  'Biology',
  'Bangla',
  'English',
  'ICT',
  'Statistics',
  'Accounting',
  'Finance',
  'Economics',
  'Management'
];

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toQuestionPreview(questionText = '') {
  const raw = String(questionText || '').replace(/\s+/g, ' ').trim();
  if (!raw) return 'Untitled question';
  return raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
}

function mapQuestionListItem(question) {
  return {
    id: String(question._id),
    preview: toQuestionPreview(question.questionText),
    subject: question.subject || '',
    paper: question.paper || '',
    chapter: question.chapter || '',
    topic: question.topic || '',
    difficulty: question.difficulty || 'medium',
    type: question.type || 'mcq',
    submittedBy: question.teacher
      ? {
          id: String(question.teacher._id || question.teacher),
          name: question.teacher.name || '',
          email: question.teacher.email || ''
        }
      : null,
    status: question.approvalStatus || 'approved',
    createdAt: question.createdAt || null,
    reviewReason: question.reviewReason || ''
  };
}

function buildQuestionQuery({
  search = '',
  status = '',
  subject = '',
  type = '',
  difficulty = '',
  teacherId = '',
  createdFrom = '',
  createdTo = ''
}) {
  const query = {};

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), 'i');
    query.$or = [
      { questionText: searchRegex },
      { subject: searchRegex },
      { chapter: searchRegex },
      { topic: searchRegex }
    ];
  }

  if (status && QUESTION_STATUSES.includes(status)) query.approvalStatus = status;
  if (subject) query.subject = subject;
  if (type && QUESTION_TYPES.includes(type)) query.type = type;
  if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) query.difficulty = difficulty;
  if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) query.teacher = teacherId;

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

async function listQuestions(filters = {}) {
  const safePage = Math.max(1, Number(filters.page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(filters.limit) || 10));
  const query = buildQuestionQuery(filters);

  const [items, total] = await Promise.all([
    Question.find(query)
      .populate('teacher', 'name email')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Question.countDocuments(query)
  ]);

  return {
    items: items.map(mapQuestionListItem),
    filters: {
      subjects: SUBJECTS,
      statuses: QUESTION_STATUSES,
      types: QUESTION_TYPES,
      difficulties: ['easy', 'medium', 'hard']
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function getQuestionDetails(questionId) {
  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    const err = new Error('Question not found');
    err.statusCode = 404;
    throw err;
  }

  const question = await Question.findById(questionId)
    .populate('teacher', 'name email')
    .populate('reviewedBy', 'name email')
    .lean();

  if (!question) {
    const err = new Error('Question not found');
    err.statusCode = 404;
    throw err;
  }

  const reports = await Report.find({ targetType: 'question', target: question._id })
    .populate('reporter', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return {
    id: String(question._id),
    preview: toQuestionPreview(question.questionText),
    questionText: question.questionText || '',
    imageUrl: question.imageUrl || '',
    type: question.type || 'mcq',
    options: Array.isArray(question.options) ? question.options : [],
    cq: question.cq || { description: '', parts: [] },
    subject: question.subject || '',
    paper: question.paper || '',
    chapter: question.chapter || '',
    topic: question.topic || '',
    difficulty: question.difficulty || 'medium',
    solution: question.solution || '',
    solutionImageUrl: question.solutionImageUrl || '',
    tags: Array.isArray(question.tags) ? question.tags : [],
    status: question.approvalStatus || 'approved',
    reviewReason: question.reviewReason || '',
    reviewedAt: question.reviewedAt || null,
    submittedBy: question.teacher
      ? {
          id: String(question.teacher._id),
          name: question.teacher.name || '',
          email: question.teacher.email || ''
        }
      : null,
    createdAt: question.createdAt || null,
    reports: reports.map((report) => ({
      id: String(report._id),
      reason: report.reason || '',
      description: report.description || '',
      status: report.status || 'open',
      createdAt: report.createdAt || null,
      reportedBy: report.reporter
        ? {
            id: String(report.reporter._id),
            name: report.reporter.name || '',
            email: report.reporter.email || ''
          }
        : null
    }))
  };
}

async function approveQuestion({ adminUser, questionId, reason = '' }) {
  const question = await Question.findById(questionId);
  if (!question) {
    const err = new Error('Question not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    approvalStatus: question.approvalStatus || 'approved',
    reviewReason: question.reviewReason || ''
  };

  question.approvalStatus = 'approved';
  question.reviewReason = String(reason || '').trim();
  question.reviewedBy = adminUser.id;
  question.reviewedAt = new Date();
  await question.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetQuestionId: question._id,
    targetUserId: question.teacher,
    actionType: 'QUESTION_APPROVED',
    previousValue,
    newValue: {
      approvalStatus: question.approvalStatus,
      reviewReason: question.reviewReason || ''
    },
    reason
  });

  return { id: String(question._id), status: question.approvalStatus };
}

async function rejectQuestion({ adminUser, questionId, reason = '' }) {
  if (!String(reason).trim()) {
    const err = new Error('Rejection reason is required');
    err.statusCode = 400;
    throw err;
  }

  const question = await Question.findById(questionId);
  if (!question) {
    const err = new Error('Question not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    approvalStatus: question.approvalStatus || 'approved',
    reviewReason: question.reviewReason || ''
  };

  question.approvalStatus = 'rejected';
  question.reviewReason = String(reason).trim();
  question.reviewedBy = adminUser.id;
  question.reviewedAt = new Date();
  await question.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetQuestionId: question._id,
    targetUserId: question.teacher,
    actionType: 'QUESTION_REJECTED',
    previousValue,
    newValue: {
      approvalStatus: question.approvalStatus,
      reviewReason: question.reviewReason
    },
    reason
  });

  return { id: String(question._id), status: question.approvalStatus, reviewReason: question.reviewReason };
}

async function editQuestion({ adminUser, questionId, updates = {}, reason = '' }) {
  const question = await Question.findById(questionId);
  if (!question) {
    const err = new Error('Question not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    questionText: question.questionText,
    subject: question.subject,
    paper: question.paper,
    chapter: question.chapter,
    topic: question.topic,
    difficulty: question.difficulty || 'medium',
    solution: question.solution || '',
    approvalStatus: question.approvalStatus || 'approved',
    options: question.options
  };

  const allowedFields = ['questionText', 'imageUrl', 'type', 'subject', 'paper', 'chapter', 'topic', 'difficulty', 'solution', 'solutionImageUrl', 'tags', 'options', 'cq'];
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      question[field] = updates[field];
    }
  });

  question.adminEditedAt = new Date();
  question.reviewedBy = adminUser.id;
  question.reviewedAt = new Date();
  await question.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetQuestionId: question._id,
    targetUserId: question.teacher,
    actionType: 'QUESTION_EDITED',
    previousValue,
    newValue: {
      questionText: question.questionText,
      subject: question.subject,
      paper: question.paper,
      chapter: question.chapter,
      topic: question.topic,
      difficulty: question.difficulty || 'medium',
      solution: question.solution || '',
      approvalStatus: question.approvalStatus || 'approved',
      options: question.options
    },
    reason
  });

  return getQuestionDetails(question._id);
}

async function listQuestionReports({ search = '', status = '', page = 1, limit = 10 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const match = { targetType: 'question' };
  if (status && REPORT_STATUSES.includes(status)) {
    match.status = status;
  }

  const aggregated = await Report.aggregate([
    { $match: match },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: '$target',
        reportCount: { $sum: 1 },
        latestCreatedAt: { $max: '$createdAt' },
        latestReason: { $last: '$reason' },
        latestDescription: { $last: '$description' },
        statuses: { $addToSet: '$status' }
      }
    },
    { $sort: { latestCreatedAt: -1 } }
  ]);

  const questionIds = aggregated.map((item) => item._id);
  const questions = await Question.find({ _id: { $in: questionIds } })
    .populate('teacher', 'name email')
    .lean();
  const questionMap = new Map(questions.map((item) => [String(item._id), item]));

  let items = aggregated
    .map((item) => {
      const question = questionMap.get(String(item._id));
      if (!question) return null;
      const derivedStatus = item.statuses.includes('open')
        ? 'open'
        : item.statuses.includes('under_review')
          ? 'under_review'
          : item.statuses.includes('resolved')
            ? 'resolved'
            : 'dismissed';
      return {
        questionId: String(item._id),
        reportCount: item.reportCount,
        reason: item.latestReason || 'other',
        description: item.latestDescription || '',
        status: derivedStatus,
        createdAt: item.latestCreatedAt || null,
        question: mapQuestionListItem({
          ...question,
          teacher: question.teacher
        })
      };
    })
    .filter(Boolean);

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    items = items.filter((item) =>
      regex.test(item.question.preview) ||
      regex.test(item.question.subject || '') ||
      regex.test(item.question.chapter || '') ||
      regex.test(item.question.submittedBy?.name || '')
    );
  }

  const total = items.length;
  items = items.slice((safePage - 1) * safeLimit, (safePage - 1) * safeLimit + safeLimit);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function updateQuestionReportStatus({
  adminUser,
  questionId,
  nextStatus,
  note = ''
}) {
  if (!REPORT_STATUSES.includes(nextStatus)) {
    const err = new Error('Invalid report status');
    err.statusCode = 400;
    throw err;
  }

  const reports = await Report.find({
    targetType: 'question',
    target: questionId,
    status: { $in: ['open', 'under_review', 'resolved', 'dismissed'] }
  });

  if (!reports.length) {
    const err = new Error('Question reports not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatuses = Array.from(new Set(reports.map((report) => report.status)));
  const now = new Date();
  await Promise.all(
    reports.map((report) => {
      report.status = nextStatus;
      report.reviewer = adminUser.id;
      report.reviewedAt = now;
      report.actionTaken = String(note || '').trim();
      return report.save();
    })
  );

  const actionTypeMap = {
    resolved: 'QUESTION_REPORT_RESOLVED',
    dismissed: 'QUESTION_REPORT_DISMISSED',
    under_review: 'QUESTION_REPORT_VALID',
    open: 'QUESTION_REPORT_VALID'
  };

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetQuestionId: questionId,
    actionType: actionTypeMap[nextStatus],
    previousValue: {
      statuses: previousStatuses
    },
    newValue: {
      status: nextStatus
    },
    reason: note
  });

  return {
    questionId: String(questionId),
    status: nextStatus
  };
}

async function getQuestionQualityStats() {
  const [mostReportedRaw, lowPerformingRaw, recentlyRejectedRaw, attemptedIds] = await Promise.all([
    Report.aggregate([
      { $match: { targetType: 'question' } },
      { $group: { _id: '$target', reportCount: { $sum: 1 } } },
      { $sort: { reportCount: -1 } },
      { $limit: 5 }
    ]),
    PracticeAttempt.aggregate([
      { $unwind: '$questions' },
      { $match: { 'questions.questionId': { $ne: null }, 'questions.isAttempted': true, isDeleted: false } },
      {
        $group: {
          _id: '$questions.questionId',
          attempts: { $sum: 1 },
          avgScore: { $avg: '$questions.score' },
          avgMaxScore: { $avg: '$questions.maxScore' },
          correctRate: {
            $avg: {
              $cond: [{ $eq: ['$questions.isCorrect', true] }, 1, 0]
            }
          }
        }
      },
      { $match: { attempts: { $gte: 3 } } },
      { $sort: { correctRate: 1, attempts: -1 } },
      { $limit: 5 }
    ]),
    Question.find({ approvalStatus: 'rejected' })
      .populate('teacher', 'name email')
      .sort({ reviewedAt: -1, createdAt: -1 })
      .limit(5)
      .lean(),
    PracticeAttempt.distinct('questions.questionId', { isDeleted: false })
  ]);

  const questionIds = [
    ...mostReportedRaw.map((item) => item._id),
    ...lowPerformingRaw.map((item) => item._id)
  ].filter(Boolean);

  const referencedQuestions = await Question.find({ _id: { $in: questionIds } })
    .populate('teacher', 'name email')
    .lean();
  const questionMap = new Map(referencedQuestions.map((item) => [String(item._id), item]));

  const totalApproved = await Question.countDocuments({ approvalStatus: 'approved' });
  const attemptedApprovedIds = attemptedIds.filter(Boolean).map(String);
  const unusedCount = Math.max(0, totalApproved - attemptedApprovedIds.length);

  return {
    mostReportedQuestions: mostReportedRaw
      .map((item) => {
        const question = questionMap.get(String(item._id));
        if (!question) return null;
        return {
          questionId: String(item._id),
          reportCount: item.reportCount,
          preview: toQuestionPreview(question.questionText),
          subject: question.subject || '',
          chapter: question.chapter || ''
        };
      })
      .filter(Boolean),
    lowPerformingQuestions: lowPerformingRaw
      .map((item) => {
        const question = questionMap.get(String(item._id));
        if (!question) return null;
        return {
          questionId: String(item._id),
          preview: toQuestionPreview(question.questionText),
          attempts: item.attempts,
          correctRate: Number(((item.correctRate || 0) * 100).toFixed(1)),
          averageScore: Number((item.avgScore || 0).toFixed(2)),
          averageMaxScore: Number((item.avgMaxScore || 0).toFixed(2)),
          subject: question.subject || '',
          chapter: question.chapter || ''
        };
      })
      .filter(Boolean),
    recentlyRejectedQuestions: recentlyRejectedRaw.map((question) => ({
      questionId: String(question._id),
      preview: toQuestionPreview(question.questionText),
      subject: question.subject || '',
      chapter: question.chapter || '',
      reason: question.reviewReason || '',
      reviewedAt: question.reviewedAt || null,
      submittedBy: question.teacher
        ? {
            id: String(question.teacher._id),
            name: question.teacher.name || '',
            email: question.teacher.email || ''
          }
        : null
    })),
    duplicateQuestions: [],
    unusedQuestions: {
      count: unusedCount,
      items: []
    }
  };
}

module.exports = {
  listQuestions,
  getQuestionDetails,
  approveQuestion,
  rejectQuestion,
  editQuestion,
  listQuestionReports,
  updateQuestionReportStatus,
  getQuestionQualityStats
};
