const Contest = require('../models/Contest');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const Question = require('../models/Question');
const ContestResult = require('../models/ContestResult');
const RatingHistory = require('../models/RatingHistory');
const {
  resolveContestDates,
  normalizeAdminContestStatus,
  getContestLifecycle
} = require('../utils/contestSchedule');
const {
  INITIAL_RATING,
  CORRECT_POINTS,
  WRONG_PENALTY,
  getRatingRankTitle,
  buildLiveLeaderboard,
  settleContest
} = require('../services/contestSettlementService');

function canAccessContest(contest, user) {
  const status = normalizeAdminContestStatus(contest);
  if (status === 'active') return true;
  if (user?.role === 'admin') return true;
  const creatorId = contest?.creator?._id || contest?.creator;
  if (creatorId && String(creatorId) === String(user?.id)) return true;
  if (Array.isArray(contest?.registeredStudents)) {
    return contest.registeredStudents.some((studentId) => String(studentId) === String(user?.id));
  }
  return false;
}

/**
 * Resolve the authoritative answer key (correct option index) for a single
 * contest question. QBank-sourced questions store their options on the original
 * Question doc, so those are resolved from a preloaded map.
 */
function correctIndexFor(q, originalById) {
  let options = Array.isArray(q.options) ? q.options : [];
  if ((!options.length) && q.source === 'qbank' && q.originalQuestionId) {
    const orig = originalById.get(String(q.originalQuestionId));
    options = (orig && Array.isArray(orig.options)) ? orig.options : [];
  }
  return options.findIndex((opt) => opt && opt.isCorrect);
}

/**
 * @desc    Create a new contest (teacher only)
 * @route   POST /api/contests/create
 * @access  Private (teacher)
 */
exports.createContest = async (req, res, next) => {
  try {
    // Verify the user is a teacher
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can create contests', 403);
    }

    const {
      name,
      date,
      duration,
      startTime,
      level,
      subjects,
      admissionType,
      admissionSubtype,
      questionType,
      qbankSelections,
      confirmedQuestions
    } = req.body;

    // Validate name
    if (!name || !name.trim()) {
      return ApiResponse.error(res, 'Contest name is required', 400);
    }

    // Validate date
    if (!date) {
      return ApiResponse.error(res, 'Contest date is required', 400);
    }

    // Validate duration
    if (!duration || typeof duration.hours !== 'number' || typeof duration.minutes !== 'number') {
      return ApiResponse.error(res, 'Valid duration (hours and minutes) is required', 400);
    }

    // Validate starting time
    if (!startTime || typeof startTime.hour !== 'number' || typeof startTime.minute !== 'number' || !startTime.period || !startTime.timezone) {
      return ApiResponse.error(res, 'Valid starting time is required', 400);
    }

    // Validate level
    if (!level || !['hsc', 'admission'].includes(level)) {
      return ApiResponse.error(res, 'Valid level (hsc or admission) is required', 400);
    }

    // Level-specific validation
    if (level === 'hsc' && (!subjects || !Array.isArray(subjects) || subjects.length === 0)) {
      return ApiResponse.error(res, 'At least one subject is required for HSC level', 400);
    }

    if (level === 'admission' && !admissionType) {
      return ApiResponse.error(res, 'Admission type is required for admission level', 400);
    }

    if (level === 'admission' && admissionType === 'varsity') {
      if (!admissionSubtype || !['science', 'commerce', 'arts', 'iba'].includes(admissionSubtype)) {
        return ApiResponse.error(res, 'Valid admission subtype (science, commerce, arts, iba) is required for Varsity level', 400);
      }
    }

    // Validate question type
    if (!questionType || !['mcq', 'cq', 'both'].includes(questionType)) {
      return ApiResponse.error(res, 'Valid question type (mcq/cq/both) is required', 400);
    }

    const embeddedQuestions = [];
    const addedQBankIds = new Set();

    // 1) Add teacher-uploaded questions
    if (confirmedQuestions && Array.isArray(confirmedQuestions)) {
      for (const q of confirmedQuestions) {
        const source = q.source || 'uploaded';
        const originalQuestionId = q.originalQuestionId || (source === 'qbank' ? (q._id || q.id) : null);
        
        if (source === 'qbank' && originalQuestionId) {
          addedQBankIds.add(originalQuestionId.toString());
        }

        embeddedQuestions.push({
          source,
          originalQuestionId,
          teacher: user._id,
          questionText: q.questionText || q.text || '',
          imageUrl: q.imageUrl || (q.images?.[0] || ''),
          type: q.type || 'mcq',
          options: q.options || [],
          cq: q.cq,
          subject: q.subject || 'Physics',
          paper: q.paper || '1st',
          chapter: q.chapter || 'General',
          topic: q.topic || 'General',
          solution: q.solution || '',
          solutionImageUrl: q.solutionImageUrl || '',
          tags: q.tags || []
        });
      }
    }

    // 2) Add each question picked from the question bank (only if not already embedded as a confirmed question)
    if (qbankSelections && Array.isArray(qbankSelections)) {
      for (const selection of qbankSelections) {
        const picked = Array.isArray(selection.questionIds) ? selection.questionIds : [];
        for (const qid of picked) {
          if (addedQBankIds.has(qid.toString())) {
            continue; // Skip, already added with full content in loop 1
          }
          embeddedQuestions.push({
            source: 'qbank',
            originalQuestionId: qid,
            selectionMeta: {
              subject: selection.subject,
              paper: selection.paper,
              chapter: selection.chapter,
              topic: selection.topic,
              numberOfQuestions: selection.numberOfQuestions
            },
            teacher: user._id,
            // Placeholder fields required by the schema; real content stays in Question collection
            questionText: `(qbank ref: ${qid})`,
            type: 'mcq',
            subject: selection.subject || 'Physics',
            paper: selection.paper || '1st',
            chapter: selection.chapter || 'General',
            topic: selection.topic || 'General',
            options: [],
            tags: []
          });
        }
      }
    }

    // Create and save the Contest document with all questions embedded
    const contest = new Contest({
      creator: user._id,
      name: name.trim(),
      date,
      duration,
      startTime,
      level,
      subjects: level === 'hsc' ? subjects : [],
      admissionType: level === 'admission' ? admissionType : '',
      admissionSubtype: (level === 'admission' && admissionType === 'varsity') ? admissionSubtype : '',
      questionType,
      qbankSelections: qbankSelections || null,
      confirmedQuestions: [], // Legacy field, kept empty for schema compatibility
      questions: embeddedQuestions,
      contestQuestionsCollection: 'contest_questions'
    });

    await contest.save();

    return ApiResponse.success(res, contest, 'Contest created successfully', 201);
  } catch (err) {
    console.error('Create contest controller error:', err);
    return next(err);
  }
};

/**
 * @desc    Get upcoming/active contests created by current teacher
 * @route   GET /api/contests/mine
 * @access  Private (teacher)
 */
exports.getMyContests = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can retrieve their contests', 403);
    }

    const contests = await Contest.find({ creator: user._id }).lean();

    const now = new Date();

    const mappedContests = contests.map(contest => {
      const { startDate, endDate } = resolveContestDates(contest);
      return {
        ...contest,
        startDate,
        endDate,
        adminStatus: normalizeAdminContestStatus(contest)
      };
    });

    // Sort: running first, then upcoming (ascending), then ended (descending)
    mappedContests.sort((a, b) => {
      const isRunningA = a.startDate <= now && now <= a.endDate;
      const isRunningB = b.startDate <= now && now <= b.endDate;
      if (isRunningA && !isRunningB) return -1;
      if (!isRunningA && isRunningB) return 1;

      const isUpcomingA = a.startDate > now;
      const isUpcomingB = b.startDate > now;
      if (isUpcomingA && !isUpcomingB) return -1;
      if (!isUpcomingA && isUpcomingB) return 1;

      if (isUpcomingA && isUpcomingB) {
        return a.startDate - b.startDate;
      }
      return b.endDate - a.endDate;
    });

    return ApiResponse.success(res, mappedContests, 'My contests fetched successfully');
  } catch (err) {
    console.error('Get my contests controller error:', err);
    return next(err);
  }
};

/**
 * @desc    Get all upcoming/active/ended contests with participation status
 * @route   GET /api/contests/upcoming
 * @access  Private
 */
exports.getUpcomingContests = async (req, res, next) => {
  try {
    const contests = await Contest.find({
      $or: [
        { adminStatus: 'active' },
        { adminStatus: { $exists: false } },
        { adminStatus: null }
      ]
    }).populate('creator', 'name').lean();
    
    // Find contest results for this student
    const studentId = req.user.id;
    const results = await ContestResult.find({ student: studentId }).lean();
    const participatedContestIds = new Set(results.map(r => r.contest.toString()));

    const now = new Date();

    const ONE_HOUR_MS = 1 * 60 * 60 * 1000;

    const mappedContests = contests.map(contest => {
      const { startDate, endDate } = resolveContestDates(contest);
      const registeredIds = (contest.registeredStudents || []).map(id => id.toString());
      const hasRegistered = registeredIds.includes(studentId.toString());
      const registrationDeadline = new Date(startDate.getTime() - ONE_HOUR_MS);
      const registrationOpen = now < registrationDeadline;
      return {
        ...contest,
        startDate,
        endDate,
        hasParticipated: participatedContestIds.has(contest._id.toString()),
        hasRegistered,
        registrationOpen
      };
    });

    // Sort: running first, then upcoming (ascending), then ended (descending)
    mappedContests.sort((a, b) => {
      const isRunningA = a.startDate <= now && now <= a.endDate;
      const isRunningB = b.startDate <= now && now <= b.endDate;
      if (isRunningA && !isRunningB) return -1;
      if (!isRunningA && isRunningB) return 1;

      const isUpcomingA = a.startDate > now;
      const isUpcomingB = b.startDate > now;
      if (isUpcomingA && !isUpcomingB) return -1;
      if (!isUpcomingA && isUpcomingB) return 1;

      if (isUpcomingA && isUpcomingB) {
        return a.startDate - b.startDate;
      }
      return b.endDate - a.endDate;
    });

    return ApiResponse.success(res, mappedContests, 'Upcoming contests fetched successfully');
  } catch (err) {
    console.error('Get upcoming contests controller error:', err);
    return next(err);
  }
};

/**
 * @desc    Delete a contest created by the current teacher
 * @route   DELETE /api/contests/:id
 * @access  Private (teacher)
 */
exports.deleteContest = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can delete contests', 403);
    }

    const contest = await Contest.findOne({ _id: req.params.id, creator: user._id });
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found or not owned by you', 404);
    }

    // Embedding questions inside Contest means deleting the contest automatically deletes its questions.
    await Contest.deleteOne({ _id: contest._id });

    return ApiResponse.success(
      res,
      { contestId: contest._id },
      'Contest deleted successfully'
    );
  } catch (err) {
    console.error('Delete contest controller error:', err);
    return next(err);
  }
};

/**
 * @desc    Update a contest created by the current teacher
 * @route   PUT /api/contests/:id
 * @access  Private (teacher)
 */
exports.updateContest = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can update contests', 403);
    }

    const contest = await Contest.findOne({ _id: req.params.id, creator: user._id });
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found or not owned by you', 404);
    }

    const {
      name,
      date,
      duration,
      startTime,
      level,
      subjects,
      admissionType,
      admissionSubtype,
      questionType,
      qbankSelections,
      confirmedQuestions
    } = req.body;

    const embeddedQuestions = [];
    const addedQBankIds = new Set();

    // 1) Add teacher-uploaded questions
    if (confirmedQuestions && Array.isArray(confirmedQuestions)) {
      for (const q of confirmedQuestions) {
        const source = q.source || 'uploaded';
        const originalQuestionId = q.originalQuestionId || (source === 'qbank' ? (q._id || q.id) : null);
        
        if (source === 'qbank' && originalQuestionId) {
          addedQBankIds.add(originalQuestionId.toString());
        }

        embeddedQuestions.push({
          source,
          originalQuestionId,
          teacher: user._id,
          questionText: q.questionText || q.text || '',
          imageUrl: q.imageUrl || (q.images?.[0] || ''),
          type: q.type || 'mcq',
          options: q.options || [],
          cq: q.cq,
          subject: q.subject || 'Physics',
          paper: q.paper || '1st',
          chapter: q.chapter || 'General',
          topic: q.topic || 'General',
          solution: q.solution || '',
          solutionImageUrl: q.solutionImageUrl || '',
          tags: q.tags || []
        });
      }
    }

    // 2) Add questions picked from the question bank (if not already embedded)
    if (qbankSelections && Array.isArray(qbankSelections)) {
      for (const selection of qbankSelections) {
        const picked = Array.isArray(selection.questionIds) ? selection.questionIds : [];
        for (const qid of picked) {
          if (addedQBankIds.has(qid.toString())) {
            continue; // Skip, already added
          }
          embeddedQuestions.push({
            source: 'qbank',
            originalQuestionId: qid,
            selectionMeta: {
              subject: selection.subject,
              paper: selection.paper,
              chapter: selection.chapter,
              topic: selection.topic,
              numberOfQuestions: selection.numberOfQuestions
            },
            teacher: user._id,
            questionText: `(qbank ref: ${qid})`,
            type: 'mcq',
            subject: selection.subject || 'Physics',
            paper: selection.paper || '1st',
            chapter: selection.chapter || 'General',
            topic: selection.topic || 'General',
            options: [],
            tags: []
          });
        }
      }
    }

    if (name) contest.name = name.trim();
    if (date) contest.date = date;
    if (duration) contest.duration = duration;
    if (startTime) contest.startTime = startTime;
    if (level) {
      contest.level = level;
      contest.subjects = level === 'hsc' ? (subjects || []) : [];
      contest.admissionType = level === 'admission' ? (admissionType || '') : '';
      contest.admissionSubtype = (level === 'admission' && admissionType === 'varsity') ? (admissionSubtype || '') : '';
    }
    if (questionType) contest.questionType = questionType;
    if (qbankSelections !== undefined) contest.qbankSelections = qbankSelections;
    contest.questions = embeddedQuestions;

    await contest.save();

    return ApiResponse.success(res, contest, 'Contest updated successfully');
  } catch (err) {
    console.error('Update contest controller error:', err);
    return next(err);
  }
};

/**
 * @desc    Get a single contest by ID (fully populated questions)
 * @route   GET /api/contests/:id
 * @access  Private
 */
exports.getContestById = async (req, res, next) => {
  try {
    const contest = await Contest.findById(req.params.id).populate('creator', 'name').lean();
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }
    if (!canAccessContest(contest, req.user)) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }

    // Populate actual QBank questions content
    const populatedQuestions = [];
    for (const q of contest.questions) {
      if (q.source === 'qbank' && q.originalQuestionId) {
        const originalQ = await Question.findById(q.originalQuestionId).lean();
        if (originalQ) {
          populatedQuestions.push({
            ...q,
            questionText: originalQ.questionText || originalQ.text || '',
            imageUrl: originalQ.imageUrl || (originalQ.images?.[0] || ''),
            type: originalQ.type || 'mcq',
            options: originalQ.options || [],
            cq: originalQ.cq,
            subject: originalQ.subject,
            paper: originalQ.paper,
            chapter: originalQ.chapter,
            topic: originalQ.topic,
            solution: originalQ.solution || '',
            solutionImageUrl: originalQ.solutionImageUrl || '',
            tags: originalQ.tags || []
          });
          continue;
        }
      }
      populatedQuestions.push(q);
    }

    contest.questions = populatedQuestions;

    return ApiResponse.success(res, contest, 'Contest fetched successfully');
  } catch (err) {
    console.error('Get contest by ID controller error:', err);
    return next(err);
  }
};

/**
 * Push the current points-ranked live leaderboard to everyone in the contest room.
 */
async function broadcastLeaderboard(contestId) {
  try {
    const board = await buildLiveLeaderboard(contestId, 10);
    const { getIO } = require('../socket');
    getIO().to(`contest:${contestId}`).emit('contest:leaderboard', board);
  } catch (err) {
    console.error('Error broadcasting contest leaderboard update:', err);
  }
}

/**
 * @desc    Submit a single answer live during a running contest (point-based)
 * @route   POST /api/contests/:id/answer
 * @access  Private (student)
 *
 * Grades the answer immediately: a correct answer awards points (and locks the
 * question), a wrong answer applies a penalty. The live leaderboard is then
 * broadcast to the contest room.
 */
exports.submitAnswer = async (req, res, next) => {
  try {
    const { questionId, selectedIndex } = req.body;
    const contestId = req.params.id;
    const studentId = req.user.id;

    if (!questionId || selectedIndex === undefined || selectedIndex === null) {
      return ApiResponse.error(res, 'questionId and selectedIndex are required', 400);
    }

    const contest = await Contest.findById(contestId).lean();
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }
    // Live answers are only accepted while the contest is actually running.
    if (getContestLifecycle(contest) !== 'live') {
      return ApiResponse.error(res, 'This contest is not running right now', 403);
    }

    const registeredIds = (contest.registeredStudents || []).map((id) => id.toString());
    if (!registeredIds.includes(studentId.toString())) {
      return ApiResponse.error(res, 'You must register for this contest before participating', 403);
    }

    const contestQuestions = Array.isArray(contest.questions) ? contest.questions : [];
    const question = contestQuestions.find((q) => String(q._id) === String(questionId));
    if (!question) {
      return ApiResponse.error(res, 'Question not found in this contest', 404);
    }
    if ((question.type || 'mcq') !== 'mcq') {
      return ApiResponse.error(res, 'Only MCQ questions can be answered live', 400);
    }

    // Resolve the answer key (qbank questions keep options on the Question doc).
    let originalById = new Map();
    if (question.source === 'qbank' && question.originalQuestionId) {
      const orig = await Question.findById(question.originalQuestionId).select('options').lean();
      if (orig) originalById.set(String(question.originalQuestionId), orig);
    }
    const correctIndex = correctIndexFor(question, originalById);

    // Load or create this student's result row.
    let result = await ContestResult.findOne({ contest: contestId, student: studentId });
    if (!result) {
      result = new ContestResult({
        contest: contestId,
        student: studentId,
        score: 0,
        totalQuestions: contestQuestions.filter((q) => (q.type || 'mcq') === 'mcq').length,
        timeTakenSeconds: 0,
        livePoints: 0,
        perQuestion: {},
        answers: {}
      });
    }

    const perQuestion = result.perQuestion && typeof result.perQuestion === 'object' ? result.perQuestion : {};
    const key = String(questionId);
    const state = perQuestion[key] || { attempts: 0, solved: false, awarded: 0, solvedAt: null };

    if (state.solved) {
      return ApiResponse.error(res, 'You have already solved this question', 400);
    }

    const isCorrect = Number(selectedIndex) === correctIndex && correctIndex !== -1;
    state.attempts += 1;

    const pointsBefore = result.livePoints || 0;
    if (isCorrect) {
      state.solved = true;
      state.awarded = CORRECT_POINTS;
      state.solvedAt = new Date();
      result.livePoints = pointsBefore + CORRECT_POINTS;
      result.score = (result.score || 0) + 1;
    } else {
      result.livePoints = Math.max(0, pointsBefore - WRONG_PENALTY);
    }
    const pointsDelta = result.livePoints - pointsBefore;

    perQuestion[key] = state;
    result.perQuestion = perQuestion;
    result.markModified('perQuestion');
    // Keep the raw answer map in sync for the end-of-contest reconciliation.
    const answers = result.answers && typeof result.answers === 'object' ? result.answers : {};
    answers[key] = Number(selectedIndex);
    result.answers = answers;
    result.markModified('answers');
    result.answersSubmitted = Object.keys(answers).length;
    result.lastPointsChangeAt = new Date();
    await result.save();

    await broadcastLeaderboard(contestId);

    return ApiResponse.success(res, {
      correct: isCorrect,
      solved: state.solved,
      livePoints: result.livePoints,
      pointsDelta
    }, isCorrect ? 'Correct answer' : 'Wrong answer — penalty applied');
  } catch (err) {
    console.error('Submit answer error:', err);
    return next(err);
  }
};

/**
 * @desc    Finalize a student's contest attempt (marks it finished)
 * @route   POST /api/contests/:id/submit
 * @access  Private (student)
 *
 * Scoring happens live via submitAnswer, so this endpoint only finalizes: it
 * reconciles (grades) any answers that were never submitted live as a safety
 * net, records the time taken and proctoring flags, and marks the attempt done.
 */
exports.submitContestResult = async (req, res, next) => {
  try {
    // SECURITY: points/score are computed server-side from the answer key —
    // never trusted from the client. Only raw `answers`, timing, and
    // self-reported proctoring flags are read from the request body.
    const { timeTakenSeconds, answers, isDisqualified, disqualificationReason } = req.body;
    const contestId = req.params.id;
    const studentId = req.user.id;

    const contest = await Contest.findById(contestId).lean();
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }
    if (normalizeAdminContestStatus(contest) !== 'active') {
      return ApiResponse.error(res, 'This contest is not accepting submissions right now', 403);
    }

    const registeredIds = (contest.registeredStudents || []).map((id) => id.toString());
    if (!registeredIds.includes(studentId.toString())) {
      return ApiResponse.error(res, 'You must register for this contest before participating', 403);
    }

    const contestQuestions = Array.isArray(contest.questions) ? contest.questions : [];
    const totalQuestions = contestQuestions.filter((q) => (q.type || 'mcq') === 'mcq').length;

    // Preload qbank originals to resolve answer keys for reconciliation.
    const qbankIds = contestQuestions
      .filter((q) => q.source === 'qbank' && q.originalQuestionId)
      .map((q) => q.originalQuestionId);
    const originals = qbankIds.length
      ? await Question.find({ _id: { $in: qbankIds } }).select('options').lean()
      : [];
    const originalById = new Map(originals.map((o) => [String(o._id), o]));

    let result = await ContestResult.findOne({ contest: contestId, student: studentId });
    if (!result) {
      result = new ContestResult({
        contest: contestId,
        student: studentId,
        score: 0,
        totalQuestions,
        timeTakenSeconds: 0,
        livePoints: 0,
        perQuestion: {},
        answers: {}
      });
    }

    // Safety net: grade any client-supplied answers that were never scored live.
    const perQuestion = result.perQuestion && typeof result.perQuestion === 'object' ? result.perQuestion : {};
    const mergedAnswers = { ...(result.answers && typeof result.answers === 'object' ? result.answers : {}) };
    const clientAnswers = answers && typeof answers === 'object' ? answers : {};

    for (const q of contestQuestions) {
      if ((q.type || 'mcq') !== 'mcq') continue;
      const key = String(q._id);
      const state = perQuestion[key];
      if (state && state.solved) continue; // already locked-in live
      const selected = clientAnswers[key];
      if (selected === undefined || selected === null) continue;

      mergedAnswers[key] = Number(selected);
      const correctIndex = correctIndexFor(q, originalById);
      const isCorrect = Number(selected) === correctIndex && correctIndex !== -1;
      const prev = state || { attempts: 0, solved: false, awarded: 0, solvedAt: null };
      prev.attempts += 1;
      if (isCorrect && !prev.solved) {
        prev.solved = true;
        prev.awarded = CORRECT_POINTS;
        prev.solvedAt = new Date();
        result.livePoints = (result.livePoints || 0) + CORRECT_POINTS;
        result.score = (result.score || 0) + 1;
      } else if (!isCorrect) {
        result.livePoints = Math.max(0, (result.livePoints || 0) - WRONG_PENALTY);
      }
      perQuestion[key] = prev;
    }

    result.perQuestion = perQuestion;
    result.markModified('perQuestion');
    result.answers = mergedAnswers;
    result.markModified('answers');
    result.answersSubmitted = Object.keys(mergedAnswers).length;
    result.totalQuestions = totalQuestions;
    result.timeTakenSeconds = Number(timeTakenSeconds) || result.timeTakenSeconds || 0;
    result.isDisqualified = !!isDisqualified;
    result.disqualificationReason = disqualificationReason || '';
    result.isFinished = true;
    if (result.livePoints > 0 && !result.lastPointsChangeAt) {
      result.lastPointsChangeAt = new Date();
    }
    await result.save();

    await broadcastLeaderboard(contestId);

    return ApiResponse.success(res, result, 'Contest submitted successfully');
  } catch (err) {
    console.error('Submit contest result error:', err);
    return next(err);
  }
};

/**
 * @desc    Get ranks, scores and leaderboard for a contest
 * @route   GET /api/contests/:id/result
 * @access  Private
 */
exports.getContestResult = async (req, res, next) => {
  try {
    const contestId = req.params.id;
    const contest = await Contest.findById(contestId).select('creator registeredStudents adminStatus date startTime duration ratingsSettled');
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }
    if (!canAccessContest(contest, req.user)) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }

    // Lazy fallback: if the contest has ended but the scheduled sweep hasn't
    // settled it yet, finalize points + rating now (idempotent).
    if (!contest.ratingsSettled && getContestLifecycle(contest) === 'ended') {
      try {
        await settleContest(contestId);
      } catch (settleErr) {
        console.error('Lazy settlement in getContestResult failed:', settleErr);
      }
    }

    // Find all results for this contest, populated with student's name
    const results = await ContestResult.find({ contest: contestId })
      .populate('student', 'name')
      .lean();

    // Rank by live points (desc), earlier last-change wins ties, DQ to the bottom.
    results.sort((a, b) => {
      if (a.isDisqualified && !b.isDisqualified) return 1;
      if (!a.isDisqualified && b.isDisqualified) return -1;
      if ((b.livePoints || 0) !== (a.livePoints || 0)) {
        return (b.livePoints || 0) - (a.livePoints || 0);
      }
      const at = a.lastPointsChangeAt ? new Date(a.lastPointsChangeAt).getTime() : Infinity;
      const bt = b.lastPointsChangeAt ? new Date(b.lastPointsChangeAt).getTime() : Infinity;
      return at - bt;
    });

    // Calculate ranks (handling ties)
    let lastPoints = null;
    let lastTime = null;
    let currentRank = 0;

    const rankedResults = results.map((resItem, index) => {
      if (resItem.isDisqualified) {
        return { ...resItem, rank: 'DQ' };
      }
      const points = resItem.livePoints || 0;
      const time = resItem.lastPointsChangeAt ? new Date(resItem.lastPointsChangeAt).getTime() : Infinity;
      if (points !== lastPoints || time !== lastTime) {
        currentRank = index + 1;
      }
      lastPoints = points;
      lastTime = time;
      return { ...resItem, rank: currentRank };
    });

    const userResult = rankedResults.find(r => r.student && r.student._id.toString() === req.user.id);

    // If settled, surface the rating delta from the persisted history.
    let ratingDelta = null;
    let newRating = null;
    if (userResult) {
      const historyEntry = await RatingHistory.findOne({ student: req.user.id, contest: contestId }).lean();
      if (historyEntry) {
        ratingDelta = historyEntry.delta;
        newRating = historyEntry.newRating;
      }
    }

    return ApiResponse.success(res, {
      settled: !!contest.ratingsSettled,
      userResult: userResult ? {
        score: userResult.score,
        totalQuestions: userResult.totalQuestions,
        percentage: userResult.totalQuestions > 0 ? Math.round((userResult.score / userResult.totalQuestions) * 100) : 0,
        rank: userResult.rank,
        livePoints: userResult.livePoints || 0,
        pointsEarned: userResult.pointsEarned || 0,
        ratingDelta,
        newRating,
        timeTakenSeconds: userResult.timeTakenSeconds,
        isDisqualified: userResult.isDisqualified || false,
        disqualificationReason: userResult.disqualificationReason || ''
      } : null,
      leaderboard: {
        first: rankedResults.find(r => !r.isDisqualified)?.student?.name || '—',
        second: rankedResults.filter(r => !r.isDisqualified)[1]?.student?.name || '—',
        third: rankedResults.filter(r => !r.isDisqualified)[2]?.student?.name || '—'
      }
    }, 'Contest results fetched successfully');
  } catch (err) {
    console.error('Get contest result controller error:', err);
    return next(err);
  }
};

/**
 * @desc    Register a student for a contest
 * @route   POST /api/contests/:id/register
 * @access  Private (student)
 */
exports.registerForContest = async (req, res, next) => {
  try {
    const contestId = req.params.id;
    const studentId = req.user.id;

    const { name, phoneNumber, collegeName, hscBatch } = req.body;
    if (!name || !phoneNumber || !collegeName || !hscBatch) {
      return ApiResponse.error(res, 'Name, phone number, college name, and HSC batch are required for registration', 400);
    }

    const contest = await Contest.findById(contestId);
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }
    if (normalizeAdminContestStatus(contest) !== 'active') {
      return ApiResponse.error(res, 'This contest is not open for registration right now', 403);
    }

    const student = await User.findById(studentId);
    if (!student) {
      return ApiResponse.error(res, 'Student not found', 404);
    }

    // Check if already registered
    const registeredIds = (contest.registeredStudents || []).map(id => id.toString());
    if (registeredIds.includes(studentId.toString())) {
      return ApiResponse.error(res, 'You are already registered for this contest', 400);
    }

    const { startDate } = resolveContestDates(contest);

    // Registration closes 1 hour before contest start
    const ONE_HOUR_MS = 1 * 60 * 60 * 1000;
    const registrationDeadline = new Date(startDate.getTime() - ONE_HOUR_MS);
    const now = new Date();

    if (now >= registrationDeadline) {
      return ApiResponse.error(res, 'Registration has closed for this contest (closes 1 hour before start)', 400);
    }

    // Update student's user profile database
    student.name = name;
    student.phoneNumber = phoneNumber;
    student.collegeName = collegeName;
    student.hscBatch = hscBatch;
    await student.save();

    // Add student registration details to contest database
    await Contest.findByIdAndUpdate(contestId, {
      $addToSet: { registeredStudents: studentId },
      $push: {
        registeredStudentsDetails: {
          studentId: student._id,
          name: name,
          email: student.email,
          phoneNumber: phoneNumber,
          collegeName: collegeName,
          hscBatch: hscBatch,
          registeredAt: new Date()
        }
      }
    });

    return ApiResponse.success(res, { contestId, registered: true }, 'Successfully registered for the contest', 200);
  } catch (err) {
    console.error('Register for contest error:', err);
    return next(err);
  }
};

/**
 * @desc    Get the current student's contest rating history (Codeforces-style)
 * @route   GET /api/contests/rating/me
 * @access  Private (student)
 *
 * Ratings are finalized once per contest by the settlement service (on a
 * schedule and as a lazy fallback). This endpoint is a thin reader: it makes
 * sure any of the student's ended-but-unsettled contests are settled, then
 * returns the persisted RatingHistory and the current/max rating.
 */
exports.getMyRating = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const now = new Date();

    // Settle any of this student's ended contests that haven't been finalized.
    const myResults = await ContestResult.find({ student: studentId })
      .populate('contest')
      .lean();
    const pendingContestIds = myResults
      .filter((r) => r.contest && !r.contest.ratingsSettled && resolveContestDates(r.contest).endDate < now)
      .map((r) => r.contest._id);
    for (const contestId of pendingContestIds) {
      try {
        await settleContest(contestId);
      } catch (settleErr) {
        console.error('Lazy settlement in getMyRating failed:', settleErr);
      }
    }

    const history = await RatingHistory.find({ student: studentId })
      .sort({ contestDate: 1 })
      .lean();

    const user = await User.findById(studentId).select('rating maxRating contestPoints contestsPlayed').lean();
    const current = user && Number.isFinite(user.rating) ? user.rating : INITIAL_RATING;
    const max = user && Number.isFinite(user.maxRating) ? user.maxRating : INITIAL_RATING;

    return ApiResponse.success(res, {
      current,
      max,
      contestPoints: user ? (user.contestPoints || 0) : 0,
      contestsPlayed: user ? (user.contestsPlayed || 0) : 0,
      rankTitle: getRatingRankTitle(current),
      maxRankTitle: getRatingRankTitle(max),
      unrated: history.length === 0,
      history: history.map((h) => ({
        contestName: h.contestName,
        date: h.contestDate,
        rank: h.rank,
        participants: h.participants,
        oldRating: h.oldRating,
        newRating: h.newRating,
        rankTitle: getRatingRankTitle(h.newRating),
        delta: h.delta,
        pointsEarned: h.pointsEarned || 0
      }))
    }, 'Rating history fetched successfully');
  } catch (err) {
    console.error('Get my rating error:', err);
    return next(err);
  }
};

/**
 * @desc    Global leaderboard of contest participants by points or rating
 * @route   GET /api/contests/leaderboard?by=points|rating
 * @access  Private
 */
exports.getGlobalLeaderboard = async (req, res, next) => {
  try {
    const by = req.query.by === 'rating' ? 'rating' : 'points';
    const sortField = by === 'rating' ? 'rating' : 'contestPoints';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const users = await User.find({ contestsPlayed: { $gt: 0 } })
      .select('name username rating maxRating contestPoints contestsPlayed')
      .sort({ [sortField]: -1, maxRating: -1 })
      .limit(limit)
      .lean();

    const leaderboard = users.map((u, index) => ({
      rank: index + 1,
      _id: u._id,
      name: u.name,
      username: u.username,
      rating: u.rating || 0,
      rankTitle: getRatingRankTitle(u.rating || 0),
      contestPoints: u.contestPoints || 0,
      contestsPlayed: u.contestsPlayed || 0
    }));

    // Resolve the caller's own rank (may be outside the returned page).
    let me = null;
    const meDoc = await User.findById(req.user.id)
      .select('name username rating contestPoints contestsPlayed')
      .lean();
    if (meDoc && meDoc.contestsPlayed > 0) {
      const higher = await User.countDocuments({
        contestsPlayed: { $gt: 0 },
        [sortField]: { $gt: meDoc[sortField] || 0 }
      });
      me = {
        rank: higher + 1,
        name: meDoc.name,
        username: meDoc.username,
        rating: meDoc.rating || 0,
        rankTitle: getRatingRankTitle(meDoc.rating || 0),
        contestPoints: meDoc.contestPoints || 0,
        contestsPlayed: meDoc.contestsPlayed || 0
      };
    }

    return ApiResponse.success(res, { by, leaderboard, me }, 'Global leaderboard fetched successfully');
  } catch (err) {
    console.error('Get global leaderboard error:', err);
    return next(err);
  }
};
