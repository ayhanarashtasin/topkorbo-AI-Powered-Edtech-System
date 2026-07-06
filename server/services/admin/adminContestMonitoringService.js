const mongoose = require('mongoose');
const Contest = require('../../models/Contest');
const ContestResult = require('../../models/ContestResult');
const PracticeAttempt = require('../../models/PracticeAttempt');
const { createAdminAuditLog } = require('./adminAuditService');
const {
  resolveContestDates,
  normalizeAdminContestStatus
} = require('../../utils/contestSchedule');

function toSafePage(page) {
  return Math.max(1, Number(page) || 1);
}

function toSafeLimit(limit, fallback = 10) {
  return Math.min(100, Math.max(1, Number(limit) || fallback));
}

function isLiveContest(contest, now = new Date()) {
  if (normalizeAdminContestStatus(contest) !== 'active') return false;
  const { startDate, endDate } = resolveContestDates(contest);
  return startDate <= now && now <= endDate;
}

function buildTimeRemaining(endDate, now = new Date()) {
  const diffMs = Math.max(0, endDate.getTime() - now.getTime());
  return Math.floor(diffMs / 1000);
}

function estimateStartedAt(result) {
  const basis = result.updatedAt || result.submittedAt || null;
  if (!basis) return null;
  const durationMs = Math.max(0, Number(result.timeTakenSeconds) || 0) * 1000;
  return new Date(new Date(basis).getTime() - durationMs);
}

function buildAttemptStatus(result) {
  if (result.isDisqualified) return 'disqualified';
  const submitted = Number(result.answersSubmitted) || 0;
  const total = Number(result.totalQuestions) || 0;
  if (total > 0 && submitted >= total) return 'completed';
  if (submitted > 0) return 'in_progress';
  return 'registered';
}

function formatParticipantRow({ contest, result, attempt }) {
  const { startDate, endDate } = resolveContestDates(contest);
  const derivedStartedAt = attempt?.timing?.startedAt || estimateStartedAt(result);
  const derivedSubmittedAt = attempt?.timing?.submittedAt || result.updatedAt || result.submittedAt || null;
  const duration = attempt?.timing?.timeTakenSeconds ?? result.timeTakenSeconds ?? 0;
  const progress = Number(result.totalQuestions) > 0
    ? Math.min(100, Math.round(((Number(result.answersSubmitted) || 0) / Number(result.totalQuestions)) * 100))
    : 0;

  return {
    id: String(result._id),
    contestId: String(contest._id),
    contestTitle: contest.name || '',
    participant: result.student
      ? {
          id: String(result.student._id || ''),
          name: result.student.name || '',
          email: result.student.email || ''
        }
      : null,
    attemptStatus: buildAttemptStatus(result),
    startedAt: derivedStartedAt || null,
    submittedAt: derivedSubmittedAt || null,
    durationSeconds: Number(duration) || 0,
    score: Number(result.score) || 0,
    totalQuestions: Number(result.totalQuestions) || 0,
    answersSubmitted: Number(result.answersSubmitted) || 0,
    progress,
    antiCheatStatus: result.antiCheatStatus || 'none',
    isDisqualified: Boolean(result.isDisqualified),
    disqualificationReason: result.disqualificationReason || '',
    startDate,
    endDate
  };
}

function collectSignals({ contest, result, attemptCount = 0 }) {
  const signals = [];
  const { endDate } = resolveContestDates(contest);
  const totalQuestions = Number(result.totalQuestions) || 0;
  const submitted = Number(result.answersSubmitted) || 0;
  const score = Number(result.score) || 0;
  const pct = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
  const timeTaken = Number(result.timeTakenSeconds) || 0;
  const lastActivityAt = result.updatedAt || result.submittedAt || null;

  if (result.isDisqualified) {
    signals.push({
      code: 'client_disqualification',
      label: 'Client anti-cheat triggered',
      reason: result.disqualificationReason || 'Client-side contest integrity rule triggered'
    });
  }

  if (submitted >= totalQuestions && totalQuestions >= 5 && timeTaken > 0 && timeTaken <= Math.max(60, totalQuestions * 8)) {
    signals.push({
      code: 'very_fast_completion',
      label: 'Very fast completion',
      reason: `Completed ${totalQuestions} questions in ${timeTaken} seconds`
    });
  }

  if (submitted >= totalQuestions && pct >= 100 && timeTaken > 0 && timeTaken <= Math.max(90, totalQuestions * 10)) {
    signals.push({
      code: 'perfect_score_fast',
      label: 'Perfect score in short duration',
      reason: `Perfect score with only ${timeTaken} seconds used`
    });
  }

  if (submitted >= totalQuestions && pct >= 90 && timeTaken > 0 && timeTaken <= Math.max(120, totalQuestions * 12)) {
    signals.push({
      code: 'high_score_short_duration',
      label: 'High score with short duration',
      reason: `${Math.round(pct)}% score with only ${timeTaken} seconds used`
    });
  }

  if (score > 0 && timeTaken > 0 && timeTaken < 15) {
    signals.push({
      code: 'near_zero_duration',
      label: 'Unusually short duration',
      reason: `Positive score recorded in only ${timeTaken} seconds`
    });
  }

  if (lastActivityAt && new Date(lastActivityAt).getTime() > endDate.getTime() + 2 * 60 * 1000) {
    signals.push({
      code: 'late_activity',
      label: 'Activity after contest end',
      reason: 'Attempt activity continued after the contest end time'
    });
  }

  if (attemptCount > 1) {
    signals.push({
      code: 'multiple_saved_attempts',
      label: 'Multiple saved practice attempts',
      reason: `${attemptCount} contest-linked practice attempts found for the same user and contest`
    });
  }

  return signals;
}

async function getLiveContestsSummary({ search = '' }) {
  const now = new Date();
  const contests = await Contest.find({})
    .populate('creator', 'name email')
    .lean();
  const liveContests = contests.filter((contest) => isLiveContest(contest, now));
  const filtered = search.trim()
    ? liveContests.filter((contest) => {
        const q = search.trim().toLowerCase();
        return (
          String(contest.name || '').toLowerCase().includes(q)
          || String(contest.creator?.name || '').toLowerCase().includes(q)
          || String(contest.creator?.email || '').toLowerCase().includes(q)
        );
      })
    : liveContests;

  const contestIds = filtered.map((contest) => contest._id);
  const summaries = contestIds.length
    ? await ContestResult.aggregate([
        { $match: { contest: { $in: contestIds } } },
        {
          $group: {
            _id: '$contest',
            submissionsCount: { $sum: 1 },
            averageScore: { $avg: '$score' },
            completionCount: {
              $sum: {
                $cond: [{ $gte: ['$answersSubmitted', '$totalQuestions'] }, 1, 0]
              }
            },
            activeParticipantsCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$answersSubmitted', 0] },
                      { $lt: ['$answersSubmitted', '$totalQuestions'] },
                      { $ne: ['$isDisqualified', true] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    : [];
  const summaryMap = new Map(summaries.map((item) => [String(item._id), item]));

  return {
    items: filtered.map((contest) => {
      const summary = summaryMap.get(String(contest._id)) || {};
      const { startDate, endDate } = resolveContestDates(contest);
      return {
        id: String(contest._id),
        title: contest.name || '',
        status: 'live',
        startTime: startDate,
        endTime: endDate,
        timeRemainingSeconds: buildTimeRemaining(endDate, now),
        activeParticipantsCount: Number(summary.activeParticipantsCount) || 0,
        totalParticipantsCount: Array.isArray(contest.registeredStudents) ? contest.registeredStudents.length : 0,
        submissionsCount: Number(summary.submissionsCount) || 0,
        averageScore: Number(summary.averageScore || 0).toFixed(2),
        completionCount: Number(summary.completionCount) || 0,
        createdBy: contest.creator
          ? {
              id: String(contest.creator._id || ''),
              name: contest.creator.name || '',
              email: contest.creator.email || ''
            }
          : null
      };
    })
  };
}

async function getLiveParticipants({ contestId = '', search = '', page = 1, limit = 20 }) {
  const now = new Date();
  const safePage = toSafePage(page);
  const safeLimit = toSafeLimit(limit, 20);

  const contestQuery = contestId && mongoose.Types.ObjectId.isValid(contestId)
    ? { _id: contestId }
    : {};
  const contests = await Contest.find(contestQuery).lean();
  const liveContests = contests.filter((contest) => isLiveContest(contest, now));
  const liveContestIds = liveContests.map((contest) => contest._id);
  const contestMap = new Map(liveContests.map((contest) => [String(contest._id), contest]));

  if (!liveContestIds.length) {
    return {
      items: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 1
      }
    };
  }

  const results = await ContestResult.find({ contest: { $in: liveContestIds } })
    .populate('student', 'name email')
    .sort({ updatedAt: -1 })
    .lean();

  const attempts = await PracticeAttempt.find({
    contestId: { $in: liveContestIds },
    isDeleted: false
  })
    .select('contestId userId timing')
    .sort({ createdAt: -1 })
    .lean();
  const attemptMap = new Map();
  attempts.forEach((attempt) => {
    const key = `${String(attempt.contestId)}:${String(attempt.userId)}`;
    if (!attemptMap.has(key)) attemptMap.set(key, attempt);
  });

  let items = results.map((result) => {
    const contest = contestMap.get(String(result.contest));
    const attempt = attemptMap.get(`${String(result.contest)}:${String(result.student?._id || '')}`);
    return formatParticipantRow({ contest, result, attempt });
  });

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((item) => (
      String(item.contestTitle || '').toLowerCase().includes(q)
      || String(item.participant?.name || '').toLowerCase().includes(q)
      || String(item.participant?.email || '').toLowerCase().includes(q)
    ));
  }

  const total = items.length;
  const paginated = items.slice((safePage - 1) * safeLimit, safePage * safeLimit);
  return {
    items: paginated,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function getSuspiciousAttempts({ search = '', status = '', contestId = '', page = 1, limit = 20 }) {
  const safePage = toSafePage(page);
  const safeLimit = toSafeLimit(limit, 20);
  const resultQuery = {};
  if (contestId && mongoose.Types.ObjectId.isValid(contestId)) {
    resultQuery.contest = contestId;
  }
  if (status && ['flagged', 'cleared'].includes(status)) {
    resultQuery.antiCheatStatus = status;
  }

  const results = await ContestResult.find(resultQuery)
    .populate('student', 'name email')
    .populate('contest', 'name date duration startTime')
    .sort({ updatedAt: -1 })
    .lean();

  const contestIds = Array.from(new Set(results.map((result) => String(result.contest?._id || result.contest)).filter(Boolean)));
  const studentIds = Array.from(new Set(results.map((result) => String(result.student?._id || result.student)).filter(Boolean)));
  const attemptCounts = (contestIds.length && studentIds.length)
    ? await PracticeAttempt.aggregate([
        {
          $match: {
            contestId: { $in: contestIds.map((id) => new mongoose.Types.ObjectId(id)) },
            userId: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: { contestId: '$contestId', userId: '$userId' },
            count: { $sum: 1 }
          }
        }
      ])
    : [];
  const attemptCountMap = new Map(attemptCounts.map((item) => [`${String(item._id.contestId)}:${String(item._id.userId)}`, item.count]));

  let items = results.map((result) => {
    const attemptCount = attemptCountMap.get(`${String(result.contest?._id || result.contest)}:${String(result.student?._id || result.student)}`) || 0;
    const signals = collectSignals({
      contest: result.contest,
      result,
      attemptCount
    });
    return {
      id: String(result._id),
      user: result.student
        ? {
            id: String(result.student._id || ''),
            name: result.student.name || '',
            email: result.student.email || ''
          }
        : null,
      contest: result.contest
        ? {
            id: String(result.contest._id || ''),
            title: result.contest.name || ''
          }
        : null,
      score: Number(result.score) || 0,
      totalQuestions: Number(result.totalQuestions) || 0,
      durationSeconds: Number(result.timeTakenSeconds) || 0,
      attemptCount,
      suspiciousReasons: signals.map((signal) => signal.label),
      suspiciousSignals: signals,
      flagStatus: result.antiCheatStatus || 'none',
      reviewedStatus: result.antiCheatStatus === 'flagged'
        ? 'under_review'
        : result.antiCheatStatus === 'cleared'
          ? 'cleared'
          : signals.length
            ? 'detected'
            : 'clean',
      submittedAt: result.updatedAt || result.submittedAt || null,
      reviewNote: result.antiCheatReviewNote || '',
      antiCheatReason: result.antiCheatReason || '',
      isDisqualified: Boolean(result.isDisqualified)
    };
  }).filter((item) => item.suspiciousSignals.length || item.flagStatus !== 'none');

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((item) => (
      String(item.user?.name || '').toLowerCase().includes(q)
      || String(item.user?.email || '').toLowerCase().includes(q)
      || String(item.contest?.title || '').toLowerCase().includes(q)
      || item.suspiciousReasons.some((reason) => reason.toLowerCase().includes(q))
    ));
  }

  const total = items.length;
  const paginated = items.slice((safePage - 1) * safeLimit, safePage * safeLimit);
  return {
    items: paginated,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function getAttemptDetails(resultId) {
  if (!mongoose.Types.ObjectId.isValid(resultId)) {
    const err = new Error('Attempt not found');
    err.statusCode = 404;
    throw err;
  }

  const result = await ContestResult.findById(resultId)
    .populate('student', 'name email role')
    .populate('contest')
    .populate('antiCheatFlaggedBy', 'name email')
    .populate('antiCheatReviewedBy', 'name email');
  if (!result) {
    const err = new Error('Attempt not found');
    err.statusCode = 404;
    throw err;
  }

  const practiceAttempts = await PracticeAttempt.find({
    contestId: result.contest._id,
    userId: result.student._id,
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .lean();
  const practiceAttempt = practiceAttempts[0] || null;
  const signals = collectSignals({
    contest: result.contest,
    result,
    attemptCount: practiceAttempts.length
  });

  return {
    id: String(result._id),
    user: result.student
      ? {
          id: String(result.student._id || ''),
          name: result.student.name || '',
          email: result.student.email || '',
          role: result.student.role || ''
        }
      : null,
    contest: {
      id: String(result.contest._id),
      title: result.contest.name || '',
      date: result.contest.date || '',
      duration: result.contest.duration || { hours: 0, minutes: 0 },
      startTime: result.contest.startTime || null,
      ...resolveContestDates(result.contest)
    },
    score: Number(result.score) || 0,
    totalQuestions: Number(result.totalQuestions) || 0,
    answersSubmitted: Number(result.answersSubmitted) || 0,
    durationSeconds: Number(result.timeTakenSeconds) || 0,
    startedAt: practiceAttempt?.timing?.startedAt || estimateStartedAt(result),
    submittedAt: practiceAttempt?.timing?.submittedAt || result.updatedAt || result.submittedAt || null,
    answers: result.answers || {},
    suspiciousSignals: signals,
    antiCheatStatus: result.antiCheatStatus || 'none',
    antiCheatReason: result.antiCheatReason || '',
    antiCheatReviewNote: result.antiCheatReviewNote || '',
    antiCheatFlaggedAt: result.antiCheatFlaggedAt || null,
    antiCheatReviewedAt: result.antiCheatReviewedAt || null,
    antiCheatFlaggedBy: result.antiCheatFlaggedBy
      ? {
          id: String(result.antiCheatFlaggedBy._id || ''),
          name: result.antiCheatFlaggedBy.name || '',
          email: result.antiCheatFlaggedBy.email || ''
        }
      : null,
    antiCheatReviewedBy: result.antiCheatReviewedBy
      ? {
          id: String(result.antiCheatReviewedBy._id || ''),
          name: result.antiCheatReviewedBy.name || '',
          email: result.antiCheatReviewedBy.email || ''
        }
      : null,
    isDisqualified: Boolean(result.isDisqualified),
    disqualificationReason: result.disqualificationReason || '',
    practiceAttempt: practiceAttempt
      ? {
          id: String(practiceAttempt._id),
          mode: practiceAttempt.mode || '',
          title: practiceAttempt.title || '',
          timing: practiceAttempt.timing || null,
          device: practiceAttempt.device || {},
          marks: practiceAttempt.marks || {},
          questions: (practiceAttempt.questions || []).map((question) => ({
            id: String(question._id),
            subject: question.subject || '',
            chapter: question.chapter || '',
            topic: question.topic || '',
            type: question.snapshot?.type || 'mcq',
            questionText: question.snapshot?.questionText || '',
            selectedIndex: typeof question.selectedIndex === 'number' ? question.selectedIndex : null,
            isCorrect: question.isCorrect,
            isAttempted: Boolean(question.isAttempted),
            score: Number(question.score) || 0,
            maxScore: Number(question.maxScore) || 0,
            timeSpentSeconds: Number(question.timeSpentSeconds) || 0,
            aiFeedback: question.aiFeedback || '',
            flagged: Boolean(question.flagged)
          }))
        }
      : null
  };
}

async function flagAttempt({ adminUser, resultId, reason = '' }) {
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    const err = new Error('Flag reason is required');
    err.statusCode = 400;
    throw err;
  }
  const result = await ContestResult.findById(resultId).populate('contest', 'name');
  if (!result) {
    const err = new Error('Attempt not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    antiCheatStatus: result.antiCheatStatus || 'none',
    antiCheatReason: result.antiCheatReason || '',
    antiCheatReviewNote: result.antiCheatReviewNote || ''
  };

  result.antiCheatStatus = 'flagged';
  result.antiCheatReason = trimmedReason;
  result.antiCheatFlaggedAt = new Date();
  result.antiCheatReviewedAt = new Date();
  result.antiCheatFlaggedBy = adminUser.id;
  result.antiCheatReviewedBy = adminUser.id;
  await result.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'ATTEMPT_FLAGGED',
    targetEntityId: String(result._id),
    targetEntityType: 'contest_attempt',
    targetEntityName: result.contest?.name || 'Contest attempt',
    previousValue,
    newValue: {
      antiCheatStatus: result.antiCheatStatus,
      antiCheatReason: result.antiCheatReason
    },
    reason: trimmedReason
  });

  return getAttemptDetails(resultId);
}

async function clearAttemptFlag({ adminUser, resultId, reason = '' }) {
  const result = await ContestResult.findById(resultId).populate('contest', 'name');
  if (!result) {
    const err = new Error('Attempt not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    antiCheatStatus: result.antiCheatStatus || 'none',
    antiCheatReason: result.antiCheatReason || ''
  };

  result.antiCheatStatus = 'cleared';
  result.antiCheatReason = String(reason || '').trim();
  result.antiCheatReviewedAt = new Date();
  result.antiCheatReviewedBy = adminUser.id;
  await result.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'ATTEMPT_CLEARED',
    targetEntityId: String(result._id),
    targetEntityType: 'contest_attempt',
    targetEntityName: result.contest?.name || 'Contest attempt',
    previousValue,
    newValue: {
      antiCheatStatus: result.antiCheatStatus,
      antiCheatReason: result.antiCheatReason
    },
    reason: result.antiCheatReason
  });

  return getAttemptDetails(resultId);
}

async function addAttemptReviewNote({ adminUser, resultId, note = '' }) {
  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) {
    const err = new Error('Review note is required');
    err.statusCode = 400;
    throw err;
  }

  const result = await ContestResult.findById(resultId).populate('contest', 'name');
  if (!result) {
    const err = new Error('Attempt not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    antiCheatReviewNote: result.antiCheatReviewNote || ''
  };

  result.antiCheatReviewNote = trimmedNote;
  result.antiCheatReviewedAt = new Date();
  result.antiCheatReviewedBy = adminUser.id;
  await result.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'ATTEMPT_REVIEW_NOTE_ADDED',
    targetEntityId: String(result._id),
    targetEntityType: 'contest_attempt',
    targetEntityName: result.contest?.name || 'Contest attempt',
    previousValue,
    newValue: {
      antiCheatReviewNote: result.antiCheatReviewNote
    },
    reason: trimmedNote
  });

  return getAttemptDetails(resultId);
}

module.exports = {
  getLiveContestsSummary,
  getLiveParticipants,
  getSuspiciousAttempts,
  getAttemptDetails,
  flagAttempt,
  clearAttemptFlag,
  addAttemptReviewNote
};
