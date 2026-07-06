const mongoose = require('mongoose');
const Contest = require('../../models/Contest');
const ContestResult = require('../../models/ContestResult');
const User = require('../../models/User');
const { createAdminAuditLog } = require('./adminAuditService');
const {
  resolveContestDates,
  normalizeAdminContestStatus,
  getContestLifecycle
} = require('../../utils/contestSchedule');

const ADMIN_STATUS_OPTIONS = ['active', 'archived', 'cancelled'];
const QUESTION_TYPE_OPTIONS = ['mcq', 'cq', 'both'];
const LEVEL_OPTIONS = ['hsc', 'admission'];
const ADMISSION_TYPES = ['medical', 'varsity', 'engineering', ''];
const ADMISSION_SUBTYPES = ['science', 'commerce', 'arts', 'iba', ''];
const TIMEZONE_OPTIONS = [
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney'
];

function ensureContestId(contestId) {
  if (!mongoose.Types.ObjectId.isValid(contestId)) {
    const err = new Error('Contest not found');
    err.statusCode = 404;
    throw err;
  }
}

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function findContestOrThrow(contestId) {
  ensureContestId(contestId);
  const contest = await Contest.findById(contestId).populate('creator', 'name email avatar role');
  if (!contest) {
    const err = new Error('Contest not found');
    err.statusCode = 404;
    throw err;
  }
  return contest;
}

async function findUserOrThrow(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('Creator not found');
    err.statusCode = 404;
    throw err;
  }
  const user = await User.findById(userId).select('name email avatar role');
  if (!user) {
    const err = new Error('Creator not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

function validateSchedulePayload(payload = {}, { partial = false } = {}) {
  const next = {};
  const { date, duration, startTime } = payload;

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'date')) {
    if (!date || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
      const err = new Error('Valid contest date is required');
      err.statusCode = 400;
      throw err;
    }
    next.date = date;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'duration')) {
    if (
      !duration
      || !Number.isFinite(Number(duration.hours))
      || !Number.isFinite(Number(duration.minutes))
      || Number(duration.hours) < 0
      || Number(duration.minutes) < 0
      || Number(duration.minutes) > 59
      || (Number(duration.hours) === 0 && Number(duration.minutes) === 0)
    ) {
      const err = new Error('Valid contest duration is required');
      err.statusCode = 400;
      throw err;
    }
    next.duration = {
      hours: Number(duration.hours),
      minutes: Number(duration.minutes)
    };
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'startTime')) {
    if (
      !startTime
      || !Number.isFinite(Number(startTime.hour))
      || !Number.isFinite(Number(startTime.minute))
      || !['AM', 'PM'].includes(startTime.period)
      || !TIMEZONE_OPTIONS.includes(startTime.timezone)
      || Number(startTime.hour) < 1
      || Number(startTime.hour) > 12
      || Number(startTime.minute) < 0
      || Number(startTime.minute) > 59
    ) {
      const err = new Error('Valid contest start time is required');
      err.statusCode = 400;
      throw err;
    }
    next.startTime = {
      hour: Number(startTime.hour),
      minute: Number(startTime.minute),
      period: startTime.period,
      timezone: startTime.timezone
    };
  }

  return next;
}

function validateMetadataPayload(payload = {}, { partial = false } = {}) {
  const next = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'name')) {
    const name = String(payload.name || '').trim();
    if (!name) {
      const err = new Error('Contest title is required');
      err.statusCode = 400;
      throw err;
    }
    next.name = name;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'level')) {
    const level = String(payload.level || '').trim();
    if (!LEVEL_OPTIONS.includes(level)) {
      const err = new Error('Valid contest level is required');
      err.statusCode = 400;
      throw err;
    }
    next.level = level;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'questionType')) {
    const questionType = String(payload.questionType || '').trim();
    if (!QUESTION_TYPE_OPTIONS.includes(questionType)) {
      const err = new Error('Valid question type is required');
      err.statusCode = 400;
      throw err;
    }
    next.questionType = questionType;
  }

  return next;
}

function validateLevelSpecificFields(payload = {}, currentContest = null) {
  const effectiveLevel = String(payload.level || currentContest?.level || '').trim();
  if (effectiveLevel === 'hsc') {
    const subjects = Array.isArray(payload.subjects)
      ? payload.subjects.map((item) => String(item || '').trim()).filter(Boolean)
      : Array.isArray(currentContest?.subjects)
        ? currentContest.subjects
        : [];
    if (!subjects.length) {
      const err = new Error('At least one subject is required for HSC contests');
      err.statusCode = 400;
      throw err;
    }
    return {
      subjects,
      admissionType: '',
      admissionSubtype: ''
    };
  }

  const admissionType = Object.prototype.hasOwnProperty.call(payload, 'admissionType')
    ? String(payload.admissionType || '').trim()
    : (currentContest?.admissionType || '');
  if (!ADMISSION_TYPES.includes(admissionType) || !admissionType) {
    const err = new Error('Valid admission type is required for admission contests');
    err.statusCode = 400;
    throw err;
  }

  let admissionSubtype = '';
  if (admissionType === 'varsity') {
    admissionSubtype = Object.prototype.hasOwnProperty.call(payload, 'admissionSubtype')
      ? String(payload.admissionSubtype || '').trim()
      : (currentContest?.admissionSubtype || '');
    if (!ADMISSION_SUBTYPES.includes(admissionSubtype) || !admissionSubtype) {
      const err = new Error('Valid admission subtype is required for varsity contests');
      err.statusCode = 400;
      throw err;
    }
  }

  return {
    subjects: [],
    admissionType,
    admissionSubtype
  };
}

function validateAdminStatus(value, { required = false } = {}) {
  const status = String(value || '').trim();
  if (!status) {
    if (required) {
      const err = new Error('Contest status is required');
      err.statusCode = 400;
      throw err;
    }
    return '';
  }
  if (!ADMIN_STATUS_OPTIONS.includes(status)) {
    const err = new Error('Invalid contest status');
    err.statusCode = 400;
    throw err;
  }
  return status;
}

function assertContestDatesValid(contestLike) {
  const { startDate, endDate } = resolveContestDates(contestLike);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    const err = new Error('Contest schedule is invalid');
    err.statusCode = 400;
    throw err;
  }
  if (endDate <= startDate) {
    const err = new Error('Contest end time must be after start time');
    err.statusCode = 400;
    throw err;
  }
  return { startDate, endDate };
}

function ensureTransitionAllowed(contest, nextStatus) {
  const currentStatus = normalizeAdminContestStatus(contest);
  if (currentStatus === nextStatus) return;

  const lifecycle = getContestLifecycle(contest);
  if (nextStatus === 'active') return;

  if (currentStatus === 'cancelled' && nextStatus === 'archived') return;

  if (lifecycle === 'live' && nextStatus === 'archived') {
    const err = new Error('A live contest cannot be archived directly. Cancel it first if it must be taken out of circulation.');
    err.statusCode = 400;
    throw err;
  }
}

function buildContestCountsAggregation(contestIds) {
  return ContestResult.aggregate([
    { $match: { contest: { $in: contestIds } } },
    {
      $group: {
        _id: '$contest',
        resultCount: { $sum: 1 },
        disqualifiedCount: {
          $sum: {
            $cond: [{ $eq: ['$isDisqualified', true] }, 1, 0]
          }
        }
      }
    }
  ]);
}

function serializeContestSummary(contest, resultSummary = {}) {
  const adminStatus = normalizeAdminContestStatus(contest);
  const { startDate, endDate } = resolveContestDates(contest);
  const rawLifecycle = adminStatus === 'archived' ? 'archived' : getContestLifecycle(contest);
  const lifecycle = rawLifecycle === 'ended' ? 'completed' : rawLifecycle;

  return {
    id: String(contest._id),
    name: contest.name || '',
    title: contest.name || '',
    creator: contest.creator
      ? {
          id: String(contest.creator._id || contest.creator.id || ''),
          name: contest.creator.name || '',
          email: contest.creator.email || '',
          avatar: contest.creator.avatar || ''
        }
      : null,
    createdAt: contest.createdAt || null,
    updatedAt: contest.updatedAt || contest.createdAt || null,
    date: contest.date || '',
    duration: {
      hours: Number(contest.duration?.hours) || 0,
      minutes: Number(contest.duration?.minutes) || 0
    },
    startTime: {
      hour: Number(contest.startTime?.hour) || 12,
      minute: Number(contest.startTime?.minute) || 0,
      period: contest.startTime?.period || 'AM',
      timezone: contest.startTime?.timezone || 'Asia/Dhaka'
    },
    startDate,
    endDate,
    lifecycle,
    status: lifecycle,
    adminStatus,
    adminStatusReason: contest.adminStatusReason || '',
    adminReviewedAt: contest.adminReviewedAt || null,
    adminCancelledAt: contest.adminCancelledAt || null,
    adminArchivedAt: contest.adminArchivedAt || null,
    level: contest.level || '',
    questionType: contest.questionType || '',
    type: contest.questionType || '',
    category: contest.level || '',
    subjects: Array.isArray(contest.subjects) ? contest.subjects : [],
    admissionType: contest.admissionType || '',
    admissionSubtype: contest.admissionSubtype || '',
    questionCount: Array.isArray(contest.questions) ? contest.questions.length : 0,
    participantCount: Array.isArray(contest.registeredStudents) ? contest.registeredStudents.length : 0,
    registrationCount: Array.isArray(contest.registeredStudents) ? contest.registeredStudents.length : 0,
    submissionsCount: Number(resultSummary.resultCount) || 0,
    resultCount: Number(resultSummary.resultCount) || 0,
    disqualifiedCount: Number(resultSummary.disqualifiedCount) || 0
  };
}

async function listContests({
  search = '',
  adminStatus = '',
  lifecycle = '',
  level = '',
  questionType = '',
  createdBy = '',
  startDateFrom = '',
  startDateTo = '',
  page = 1,
  limit = 10
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const query = {};

  if (level && LEVEL_OPTIONS.includes(level)) query.level = level;
  if (questionType && QUESTION_TYPE_OPTIONS.includes(questionType)) query.questionType = questionType;

  const normalizedStatus = validateAdminStatus(adminStatus);
  if (normalizedStatus) {
    if (normalizedStatus === 'active') {
      query.$or = [
        { adminStatus: 'active' },
        { adminStatus: { $exists: false } },
        { adminStatus: null },
        { adminStatus: 'hidden' }
      ];
    } else {
      query.adminStatus = normalizedStatus;
    }
  }

  if (createdBy.trim() || search.trim()) {
    const creatorRegex = new RegExp(createdBy.trim() || search.trim(), 'i');
    const users = await User.find({
      $or: [{ name: creatorRegex }, { email: creatorRegex }]
    }).select('_id').lean();
    const creatorIds = users.map((user) => user._id);
    if (createdBy.trim()) {
      query.creator = { $in: creatorIds.length ? creatorIds : [new mongoose.Types.ObjectId()] };
    }
  }

  const contests = await Contest.find(query)
    .populate('creator', 'name email avatar')
    .sort({ createdAt: -1 })
    .lean();

  const resultCounts = contests.length
    ? await buildContestCountsAggregation(contests.map((contest) => contest._id))
    : [];
  const resultMap = new Map(resultCounts.map((item) => [String(item._id), item]));

  let items = contests.map((contest) => serializeContestSummary(contest, resultMap.get(String(contest._id))));

  if (search.trim()) {
    const queryText = search.trim().toLowerCase();
    items = items.filter((item) => (
      item.name.toLowerCase().includes(queryText)
      || item.creator?.name?.toLowerCase().includes(queryText)
      || item.creator?.email?.toLowerCase().includes(queryText)
      || item.subjects.some((subject) => String(subject).toLowerCase().includes(queryText))
      || item.admissionType.toLowerCase().includes(queryText)
      || item.admissionSubtype.toLowerCase().includes(queryText)
    ));
  }

  if (createdBy.trim()) {
    const queryText = createdBy.trim().toLowerCase();
    items = items.filter((item) => (
      item.creator?.name?.toLowerCase().includes(queryText)
      || item.creator?.email?.toLowerCase().includes(queryText)
    ));
  }

  if (lifecycle) {
    items = items.filter((item) => item.lifecycle === lifecycle);
  }

  const fromDate = toDateOrNull(startDateFrom);
  const toDate = toDateOrNull(startDateTo);
  if (fromDate) {
    items = items.filter((item) => new Date(item.startDate) >= fromDate);
  }
  if (toDate) {
    const inclusiveEnd = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
    items = items.filter((item) => new Date(item.startDate) <= inclusiveEnd);
  }

  const total = items.length;
  const paginatedItems = items.slice((safePage - 1) * safeLimit, safePage * safeLimit);

  return {
    items: paginatedItems,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    },
    stats: {
      active: items.filter((item) => item.adminStatus === 'active').length,
      archived: items.filter((item) => item.adminStatus === 'archived').length,
      cancelled: items.filter((item) => item.adminStatus === 'cancelled').length
    }
  };
}

async function getContestDetails(contestId) {
  const contest = await findContestOrThrow(contestId);
  const results = await ContestResult.find({ contest: contest._id })
    .populate('student', 'name email')
    .lean();

  results.sort((a, b) => {
    if (a.isDisqualified && !b.isDisqualified) return 1;
    if (!a.isDisqualified && b.isDisqualified) return -1;
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
  });

  const summary = serializeContestSummary(contest.toObject(), {
    resultCount: results.length,
    disqualifiedCount: results.filter((entry) => entry.isDisqualified).length
  });

  return {
    ...summary,
    registeredStudentsDetails: (contest.registeredStudentsDetails || []).map((entry) => ({
      studentId: String(entry.studentId || ''),
      name: entry.name || '',
      email: entry.email || '',
      phoneNumber: entry.phoneNumber || '',
      collegeName: entry.collegeName || '',
      hscBatch: entry.hscBatch || '',
      registeredAt: entry.registeredAt || null
    })),
    topResults: results.slice(0, 10).map((entry, index) => ({
      id: String(entry._id),
      student: entry.student
        ? {
            id: String(entry.student._id || ''),
            name: entry.student.name || '',
            email: entry.student.email || ''
          }
        : null,
      rank: entry.isDisqualified ? 'DQ' : index + 1,
      score: Number(entry.score) || 0,
      totalQuestions: Number(entry.totalQuestions) || 0,
      answersSubmitted: Number(entry.answersSubmitted) || 0,
      timeTakenSeconds: Number(entry.timeTakenSeconds) || 0,
      submittedAt: entry.submittedAt || null,
      isDisqualified: Boolean(entry.isDisqualified),
      disqualificationReason: entry.disqualificationReason || ''
    })),
    review: {
      adminStatus: summary.adminStatus,
      adminStatusReason: summary.adminStatusReason,
      adminReviewedAt: summary.adminReviewedAt,
      adminCancelledAt: summary.adminCancelledAt,
      adminArchivedAt: summary.adminArchivedAt
    }
  };
}

function buildContestDraft(payload, currentContest = null) {
  const metadata = validateMetadataPayload(payload, { partial: Boolean(currentContest) });
  const schedule = validateSchedulePayload(payload, { partial: Boolean(currentContest) });
  const levelSpecific = validateLevelSpecificFields(payload, currentContest);

  const draft = {
    ...(currentContest ? currentContest.toObject() : {}),
    ...metadata,
    ...schedule,
    ...levelSpecific
  };

  if (currentContest) {
    if (!Object.keys(metadata).length) draft.name = currentContest.name;
    if (!Object.keys(schedule).length) {
      draft.date = currentContest.date;
      draft.duration = currentContest.duration;
      draft.startTime = currentContest.startTime;
    }
    if (!payload.level) draft.level = currentContest.level;
    if (!payload.questionType) draft.questionType = currentContest.questionType;
  }

  assertContestDatesValid(draft);
  return { metadata, schedule, levelSpecific, draft };
}

function cloneQuestionsFromSource(sourceContest) {
  return (sourceContest?.questions || []).map((question) => ({
    ...question.toObject ? question.toObject() : question,
    _id: new mongoose.Types.ObjectId()
  }));
}

async function createContest({ adminUser, payload = {} }) {
  const creatorId = payload.creatorId || adminUser.id;
  const creator = await findUserOrThrow(creatorId);
  const requestedStatus = validateAdminStatus(payload.adminStatus || 'archived', { required: true });
  const { draft } = buildContestDraft(payload);

  let sourceContest = null;
  if (payload.cloneFromContestId) {
    sourceContest = await findContestOrThrow(payload.cloneFromContestId);
  }

  const questions = sourceContest ? cloneQuestionsFromSource(sourceContest) : [];
  const qbankSelections = sourceContest?.qbankSelections || null;

  if (requestedStatus === 'active' && questions.length === 0) {
    const err = new Error('Active admin-created contests must clone an existing contest question set for safety');
    err.statusCode = 400;
    throw err;
  }

  const contest = await Contest.create({
    creator: creator._id,
    name: draft.name,
    date: draft.date,
    duration: draft.duration,
    startTime: draft.startTime,
    level: draft.level,
    subjects: draft.subjects,
    admissionType: draft.admissionType,
    admissionSubtype: draft.admissionSubtype,
    questionType: draft.questionType,
    qbankSelections,
    confirmedQuestions: [],
    questions,
    contestQuestionsCollection: 'contest_questions',
    adminStatus: requestedStatus,
    adminStatusReason: requestedStatus === 'archived' ? 'Created from admin contest control' : '',
    adminReviewedBy: adminUser.id,
    adminReviewedAt: new Date(),
    adminArchivedAt: requestedStatus === 'archived' ? new Date() : null,
    adminCancelledAt: requestedStatus === 'cancelled' ? new Date() : null
  });

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'CONTEST_CREATED',
    targetEntityId: String(contest._id),
    targetEntityType: 'contest',
    targetEntityName: contest.name,
    previousValue: null,
    newValue: {
      adminStatus: requestedStatus,
      creatorId: String(creator._id),
      questionCount: questions.length
    },
    reason: payload.reason || ''
  });

  return getContestDetails(contest._id);
}

async function updateContest({ adminUser, contestId, payload = {} }) {
  const contest = await findContestOrThrow(contestId);
  const requestedStatus = Object.prototype.hasOwnProperty.call(payload, 'adminStatus')
    ? validateAdminStatus(payload.adminStatus, { required: true })
    : '';
  const currentLifecycle = getContestLifecycle(contest);
  const existingResultCount = await ContestResult.countDocuments({ contest: contest._id });
  const previousValue = {
    name: contest.name,
    date: contest.date,
    duration: contest.duration,
    startTime: contest.startTime,
    level: contest.level,
    subjects: contest.subjects,
    admissionType: contest.admissionType,
    admissionSubtype: contest.admissionSubtype,
    questionType: contest.questionType,
    creator: String(contest.creator?._id || contest.creator),
    adminStatus: normalizeAdminContestStatus(contest)
  };

  const { metadata, schedule, levelSpecific } = buildContestDraft(payload, contest);
  const changingSchedule = Boolean(schedule.date || schedule.duration || schedule.startTime);
  const changingStructure = Boolean(
    metadata.level
    || metadata.questionType
    || Object.prototype.hasOwnProperty.call(payload, 'subjects')
    || Object.prototype.hasOwnProperty.call(payload, 'admissionType')
    || Object.prototype.hasOwnProperty.call(payload, 'admissionSubtype')
  );

  if ((currentLifecycle === 'live' || currentLifecycle === 'ended' || existingResultCount > 0) && (changingSchedule || changingStructure)) {
    const err = new Error('Live or historically attempted contests can only be restored, archived, cancelled, or renamed safely');
    err.statusCode = 400;
    throw err;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'creatorId')) {
    const creator = await findUserOrThrow(payload.creatorId);
    contest.creator = creator._id;
  }
  if (metadata.name) contest.name = metadata.name;
  if (metadata.level) contest.level = metadata.level;
  if (metadata.questionType) contest.questionType = metadata.questionType;
  if (schedule.date) contest.date = schedule.date;
  if (schedule.duration) contest.duration = schedule.duration;
  if (schedule.startTime) contest.startTime = schedule.startTime;
  contest.subjects = levelSpecific.subjects;
  contest.admissionType = levelSpecific.admissionType;
  contest.admissionSubtype = levelSpecific.admissionSubtype;
  if (requestedStatus === 'active') {
    contest.adminStatus = 'active';
    contest.adminStatusReason = String(payload.reason || '').trim();
    contest.adminArchivedAt = null;
    contest.adminCancelledAt = null;
  }
  contest.adminReviewedBy = adminUser.id;
  contest.adminReviewedAt = new Date();
  await contest.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'CONTEST_UPDATED',
    targetEntityId: String(contest._id),
    targetEntityType: 'contest',
    targetEntityName: contest.name,
    previousValue,
    newValue: {
      name: contest.name,
      date: contest.date,
      duration: contest.duration,
      startTime: contest.startTime,
      level: contest.level,
      subjects: contest.subjects,
      admissionType: contest.admissionType,
      admissionSubtype: contest.admissionSubtype,
      questionType: contest.questionType,
      creator: String(contest.creator),
      adminStatus: normalizeAdminContestStatus(contest)
    },
    reason: payload.reason || ''
  });

  return getContestDetails(contestId);
}

async function cancelContest({ adminUser, contestId, reason = '' }) {
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    const err = new Error('Cancellation reason is required');
    err.statusCode = 400;
    throw err;
  }

  const contest = await findContestOrThrow(contestId);
  ensureTransitionAllowed(contest, 'cancelled');
  const previousValue = {
    adminStatus: normalizeAdminContestStatus(contest),
    adminStatusReason: contest.adminStatusReason || '',
    adminCancelledAt: contest.adminCancelledAt || null
  };

  contest.adminStatus = 'cancelled';
  contest.adminStatusReason = trimmedReason;
  contest.adminReviewedBy = adminUser.id;
  contest.adminReviewedAt = new Date();
  contest.adminCancelledAt = new Date();
  await contest.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'CONTEST_CANCELLED',
    targetEntityId: String(contest._id),
    targetEntityType: 'contest',
    targetEntityName: contest.name,
    previousValue,
    newValue: {
      adminStatus: 'cancelled',
      adminStatusReason: trimmedReason,
      adminCancelledAt: contest.adminCancelledAt
    },
    reason: trimmedReason
  });

  return getContestDetails(contestId);
}

async function archiveContest({ adminUser, contestId, reason = '' }) {
  const contest = await findContestOrThrow(contestId);
  ensureTransitionAllowed(contest, 'archived');
  const previousValue = {
    adminStatus: normalizeAdminContestStatus(contest),
    adminStatusReason: contest.adminStatusReason || '',
    adminArchivedAt: contest.adminArchivedAt || null
  };

  contest.adminStatus = 'archived';
  contest.adminStatusReason = String(reason || '').trim();
  contest.adminReviewedBy = adminUser.id;
  contest.adminReviewedAt = new Date();
  contest.adminArchivedAt = new Date();
  await contest.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'CONTEST_ARCHIVED',
    targetEntityId: String(contest._id),
    targetEntityType: 'contest',
    targetEntityName: contest.name,
    previousValue,
    newValue: {
      adminStatus: 'archived',
      adminStatusReason: contest.adminStatusReason,
      adminArchivedAt: contest.adminArchivedAt
    },
    reason: contest.adminStatusReason
  });

  return getContestDetails(contestId);
}

module.exports = {
  listContests,
  getContestDetails,
  createContest,
  updateContest,
  cancelContest,
  archiveContest
};
