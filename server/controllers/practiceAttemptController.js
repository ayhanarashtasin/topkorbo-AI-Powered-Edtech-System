/**
 * Practice Attempt Controller
 * ----------------------------------------------------------------------------
 * Persists every practice session a student completes on TopKorbo:
 *   - Mock tests (full timed exams)
 *   - QBank inline practice (per-question auto-save, option B)
 *   - Free practice sessions
 *
 * Endpoints (mounted at /api/practice):
 *   POST   /              → submit a new attempt
 *   GET    /              → list the caller's attempts (with filters)
 *   GET    /:id           → fetch one attempt (caller or admin only)
 *   DELETE /:id           → soft-delete the caller's attempt
 *   PATCH  /:id/notes     → update post-submission notes
 *   GET    /stats/summary → aggregate stats (subjects, accuracy, trends)
 *
 * Retention: forever. Soft delete via `isDeleted` flag only.
 */

const PracticeAttempt = require('../models/PracticeAttempt');
const ApiResponse = require('../utils/apiResponse');
const mongoose = require('mongoose');
const { getDashboardActivity } = require('../services/dashboardActivityService');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toObjectIdOrNull(v) {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (typeof v === 'string' && mongoose.Types.ObjectId.isValid(v) && /^[0-9a-fA-F]{24}$/.test(v)) {
    return v;
  }
  return null;
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => {
    if (opt == null) return { text: '', isCorrect: false };
    if (typeof opt === 'string') return { text: opt, isCorrect: false };
    return {
      text: typeof opt.text === 'string' ? opt.text : (opt.label || ''),
      isCorrect: !!opt.isCorrect
    };
  });
}

function normalizeCqParts(parts) {
  if (!Array.isArray(parts)) return [];
  return parts.map((p) => {
    if (p == null) return { label: '', text: '' };
    if (typeof p === 'string') return { label: '', text: p };
    return {
      label: typeof p.label === 'string' ? p.label : '',
      text: typeof p.text === 'string' ? p.text : (p.description || '')
    };
  });
}

function sanitizeQuestion(q = {}) {
  const snap = q.snapshot || {};
  return {
    questionId: toObjectIdOrNull(q.questionId),
    snapshot: {
      type: snap.type || 'mcq',
      questionText: snap.questionText || '',
      imageUrl: snap.imageUrl || '',
      options: normalizeOptions(snap.options),
      correctIndex: typeof snap.correctIndex === 'number' ? snap.correctIndex : -1,
      cq: {
        description: (snap.cq && snap.cq.description) || '',
        parts: normalizeCqParts(snap.cq && snap.cq.parts)
      },
      marks: typeof snap.marks === 'number' ? snap.marks : 1,
      solution: snap.solution || ''
    },
    subject: q.subject || '',
    paper: q.paper || '',
    chapter: q.chapter || '',
    topic: q.topic || '',
    source: q.source || 'qbank',
    selectedIndex: typeof q.selectedIndex === 'number' ? q.selectedIndex : null,
    writtenImageBase64: q.writtenImageBase64 || '',
    writtenText: q.writtenText || '',
    isCorrect: typeof q.isCorrect === 'boolean' ? q.isCorrect : null,
    isAttempted: !!q.isAttempted,
    score: typeof q.score === 'number' ? q.score : 0,
    maxScore: typeof q.maxScore === 'number' ? q.maxScore : 1,
    timeSpentSeconds: typeof q.timeSpentSeconds === 'number' ? q.timeSpentSeconds : 0,
    aiFeedback: q.aiFeedback || '',
    flagged: !!q.flagged,
    answeredAt: q.answeredAt ? new Date(q.answeredAt) : new Date()
  };
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function buildHierarchy(questions) {
  return {
    subjects: uniq(questions.map((q) => q.subject)),
    papers: uniq(questions.map((q) => q.paper)),
    chapters: uniq(questions.map((q) => q.chapter)),
    topics: uniq(questions.map((q) => q.topic))
  };
}

function buildTiming(payload) {
  const now = new Date();
  const startedAt = payload.timing && payload.timing.startedAt
    ? new Date(payload.timing.startedAt)
    : now;
  const submittedAt = payload.timing && payload.timing.submittedAt
    ? new Date(payload.timing.submittedAt)
    : now;
  const timeTakenSeconds = payload.timing && typeof payload.timing.timeTakenSeconds === 'number'
    ? payload.timing.timeTakenSeconds
    : Math.max(0, Math.round((submittedAt - startedAt) / 1000));

  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  const avg = questions.length
    ? Math.round(
        questions.reduce((s, q) => s + (q.timeSpentSeconds || 0), 0) / questions.length
      )
    : 0;

  return {
    startedAt,
    submittedAt,
    timeTakenSeconds,
    averageTimePerQuestion: avg
  };
}

/* ------------------------------------------------------------------ */
/*  POST /api/practice                                                */
/* ------------------------------------------------------------------ */

exports.submitAttempt = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return ApiResponse.error(res, 'Unauthorized', 401);
    }

    const body = req.body || {};
    const mode = body.mode;
    if (!['mock_test', 'qbank_practice', 'free_practice', 'inline_qbank'].includes(mode)) {
      return ApiResponse.error(res, 'Invalid mode', 400);
    }

    const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
    const questions = rawQuestions.map(sanitizeQuestion);
    const hierarchy = buildHierarchy(questions);

    const attempt = new PracticeAttempt({
      userId: toObjectIdOrNull(userId) || userId,
      mode,
      contestId: toObjectIdOrNull(body.contestId),
      title: body.title || '',
      subjects: hierarchy.subjects,
      papers: hierarchy.papers,
      chapters: hierarchy.chapters,
      topics: hierarchy.topics,
      config: {
        durationMinutes: (body.config && body.config.durationMinutes) || 0,
        totalMarks: (body.config && body.config.totalMarks) ||
          questions.reduce((s, q) => s + (q.maxScore || 0), 0),
        negativeMarking: !!(body.config && body.config.negativeMarking),
        negativePenalty:
          typeof (body.config && body.config.negativePenalty) === 'number'
            ? body.config.negativePenalty
            : 0.25,
        passingMarks: (body.config && body.config.passingMarks) || 0,
        questionCount: questions.length
      },
      questions,
      timing: buildTiming({ ...body, questions }),
      device: {
        userAgent: (req.headers['user-agent'] || '').slice(0, 500),
        language: (req.headers['accept-language'] || '').slice(0, 50)
      },
      notes: body.notes || ''
    });

    attempt.recomputeMarks();
    await attempt.save();

    return ApiResponse.success(res, attempt, 'Attempt saved', 201);
  } catch (err) {
    console.error('[practiceAttempt] submitAttempt error:', err);
    return ApiResponse.error(res, err.message || 'Failed to save attempt', 500);
  }
};

/* ------------------------------------------------------------------ */
/*  GET /api/practice                                                  */
/* ------------------------------------------------------------------ */

exports.listMyAttempts = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);

    const {
      mode,
      subject,
      paper,
      chapter,
      topic,
      minPercentage,
      maxPercentage,
      from,
      to,
      limit = 50,
      skip = 0,
      sort = '-createdAt'
    } = req.query;

    const filter = { userId, isDeleted: false };
    if (mode) filter.mode = mode;
    if (subject) filter.subjects = { $in: [subject] };
    if (paper) filter.papers = { $in: [paper] };
    if (chapter) filter.chapters = { $in: [chapter] };
    if (topic) filter.topics = { $in: [topic] };
    if (minPercentage || maxPercentage) {
      filter['marks.percentage'] = {};
      if (minPercentage) filter['marks.percentage'].$gte = Number(minPercentage);
      if (maxPercentage) filter['marks.percentage'].$lte = Number(maxPercentage);
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const lim = Math.min(Number(limit) || 50, 200);
    const sk = Math.max(Number(skip) || 0, 0);

    const [items, total] = await Promise.all([
      PracticeAttempt.find(filter)
        .sort(sort)
        .skip(sk)
        .limit(lim)
        .select('-questions.writtenImageBase64'),
      PracticeAttempt.countDocuments(filter)
    ]);

    return ApiResponse.success(res, { items, total, limit: lim, skip: sk });
  } catch (err) {
    console.error('[practiceAttempt] listMyAttempts error:', err);
    return ApiResponse.error(res, err.message || 'Failed to list attempts', 500);
  }
};

/* ------------------------------------------------------------------ */
/*  GET /api/practice/dashboard-activity                               */
/* ------------------------------------------------------------------ */

exports.getDashboardActivity = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);

    const activity = await getDashboardActivity(userId, req.query.timezone);
    return ApiResponse.success(res, activity);
  } catch (err) {
    if (err.code === 'INVALID_TIME_ZONE') {
      return ApiResponse.error(res, 'Invalid timezone.', 400);
    }
    console.error('[practiceAttempt] getDashboardActivity error:', err);
    return ApiResponse.error(res, 'Failed to compute dashboard activity', 500);
  }
};

/* ------------------------------------------------------------------ */
/*  GET /api/practice/:id                                              */
/* ------------------------------------------------------------------ */

exports.getAttempt = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);

    const { id } = req.params;
    const attempt = await PracticeAttempt.findById(id);
    if (!attempt || attempt.isDeleted) {
      return ApiResponse.error(res, 'Attempt not found', 404);
    }
    if (
      String(attempt.userId) !== String(userId) &&
      req.user.role !== 'admin' &&
      req.user.forumRole !== 'admin'
    ) {
      return ApiResponse.error(res, 'Forbidden', 403);
    }

    return ApiResponse.success(res, attempt);
  } catch (err) {
    console.error('[practiceAttempt] getAttempt error:', err);
    return ApiResponse.error(res, err.message || 'Failed to fetch attempt', 500);
  }
};

/* ------------------------------------------------------------------ */
/*  DELETE /api/practice/:id (soft delete)                             */
/* ------------------------------------------------------------------ */

exports.deleteAttempt = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);

    const { id } = req.params;
    const attempt = await PracticeAttempt.findById(id);
    if (!attempt || attempt.isDeleted) {
      return ApiResponse.error(res, 'Attempt not found', 404);
    }
    if (
      String(attempt.userId) !== String(userId) &&
      req.user.role !== 'admin' &&
      req.user.forumRole !== 'admin'
    ) {
      return ApiResponse.error(res, 'Forbidden', 403);
    }

    attempt.isDeleted = true;
    await attempt.save();

    return ApiResponse.success(res, { _id: id }, 'Attempt deleted');
  } catch (err) {
    console.error('[practiceAttempt] deleteAttempt error:', err);
    return ApiResponse.error(res, err.message || 'Failed to delete attempt', 500);
  }
};

/* ------------------------------------------------------------------ */
/*  PATCH /api/practice/:id/notes                                      */
/* ------------------------------------------------------------------ */

exports.updateNotes = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);

    const { id } = req.params;
    const { notes } = req.body || {};
    if (typeof notes !== 'string') {
      return ApiResponse.error(res, 'notes must be a string', 400);
    }

    const attempt = await PracticeAttempt.findById(id);
    if (!attempt || attempt.isDeleted) {
      return ApiResponse.error(res, 'Attempt not found', 404);
    }
    if (String(attempt.userId) !== String(userId)) {
      return ApiResponse.error(res, 'Forbidden', 403);
    }

    attempt.notes = notes.slice(0, 1000);
    await attempt.save();

    return ApiResponse.success(res, { _id: id, notes: attempt.notes }, 'Notes updated');
  } catch (err) {
    console.error('[practiceAttempt] updateNotes error:', err);
    return ApiResponse.error(res, err.message || 'Failed to update notes', 500);
  }
};

/* ------------------------------------------------------------------ */
/*  GET /api/practice/stats/summary                                    */
/* ------------------------------------------------------------------ */

exports.getStats = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);

    const baseMatch = { userId: toObjectId(userId), isDeleted: false };

    const [overall, byMode, bySubject, byChapter, recent, last14Days] = await Promise.all([
      // Overall totals + accuracy
      PracticeAttempt.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            totalQuestions: { $sum: { $size: '$questions' } },
            attemptedQuestions: {
              $sum: {
                $size: {
                  $filter: {
                    input: '$questions',
                    as: 'q',
                    cond: { $eq: ['$$q.isAttempted', true] }
                  }
                }
              }
            },
            correctQuestions: {
              $sum: {
                $size: {
                  $filter: {
                    input: '$questions',
                    as: 'q',
                    cond: { $eq: ['$$q.isCorrect', true] }
                  }
                }
              }
            },
            totalObtained: { $sum: '$marks.obtained' },
            totalPossible: { $sum: '$marks.total' },
            totalTimeSeconds: { $sum: '$timing.timeTakenSeconds' }
          }
        }
      ]),
      // By mode
      PracticeAttempt.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$mode', count: { $sum: 1 }, avgPct: { $avg: '$marks.percentage' } } }
      ]),
      // By subject (flatten per-question subjects)
      PracticeAttempt.aggregate([
        { $match: baseMatch },
        { $unwind: '$questions' },
        { $match: { 'questions.subject': { $ne: '' } } },
        {
          $group: {
            _id: '$questions.subject',
            attempts: { $sum: 1 },
            correct: {
              $sum: { $cond: [{ $eq: ['$questions.isCorrect', true] }, 1, 0] }
            },
            attempted: {
              $sum: { $cond: [{ $eq: ['$questions.isAttempted', true] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            _id: 1,
            attempts: 1,
            correct: 1,
            attempted: 1,
            accuracy: {
              $cond: [
                { $gt: ['$attempted', 0] },
                { $divide: ['$correct', '$attempted'] },
                0
              ]
            }
          }
        },
        { $sort: { attempts: -1 } },
        { $limit: 25 }
      ]),
      // By chapter
      PracticeAttempt.aggregate([
        { $match: baseMatch },
        { $unwind: '$questions' },
        { $match: { 'questions.chapter': { $ne: '' } } },
        {
          $group: {
            _id: { subject: '$questions.subject', chapter: '$questions.chapter' },
            attempts: { $sum: 1 },
            correct: {
              $sum: { $cond: [{ $eq: ['$questions.isCorrect', true] }, 1, 0] }
            },
            attempted: {
              $sum: { $cond: [{ $eq: ['$questions.isAttempted', true] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            _id: 1,
            attempts: 1,
            accuracy: {
              $cond: [
                { $gt: ['$attempted', 0] },
                { $divide: ['$correct', '$attempted'] },
                0
              ]
            }
          }
        },
        { $sort: { attempts: -1 } },
        { $limit: 25 }
      ]),
      // 10 most recent attempts
      PracticeAttempt.find(baseMatch)
        .sort('-createdAt')
        .limit(10)
        .select('mode title marks.percentage timing.timeTakenSeconds createdAt subjects chapters'),
      // Last 14 days, attempts per day
      PracticeAttempt.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            avgPct: { $avg: '$marks.percentage' }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const overallRow = overall[0] || {};
    const accuracy = overallRow.attemptedQuestions
      ? overallRow.correctQuestions / overallRow.attemptedQuestions
      : 0;

    return ApiResponse.success(res, {
      overall: {
        totalAttempts: overallRow.totalAttempts || 0,
        totalQuestions: overallRow.totalQuestions || 0,
        attemptedQuestions: overallRow.attemptedQuestions || 0,
        correctQuestions: overallRow.correctQuestions || 0,
        accuracy,
        totalObtained: overallRow.totalObtained || 0,
        totalPossible: overallRow.totalPossible || 0,
        totalTimeSeconds: overallRow.totalTimeSeconds || 0
      },
      byMode,
      bySubject,
      byChapter,
      recent,
      last14Days
    });
  } catch (err) {
    console.error('[practiceAttempt] getStats error:', err);
    return ApiResponse.error(res, err.message || 'Failed to compute stats', 500);
  }
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function toObjectId(id) {
  try {
    return require('mongoose').Types.ObjectId.createFromHexString(String(id));
  } catch (_) {
    return id;
  }
}
