const Contest = require('../models/Contest');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const Question = require('../models/Question');
const ContestResult = require('../models/ContestResult');
const RatingHistory = require('../models/RatingHistory');
const {
  resolveContestDates,
  normalizeAdminContestStatus
} = require('../utils/contestSchedule');

// Rating a student starts from before their first rated contest.
const INITIAL_RATING = 1400;

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
 * Performance rating a student "earned" in one contest, derived purely from
 * their real standing among actual participants.
 *  - Multiple participants: top rank ≈ 2400, last rank ≈ 800.
 *  - Solo participant: scaled from their real score percentage.
 */
function contestPerformance(rank, participants, percentage) {
  if (participants <= 1) {
    const pct = Math.max(0, Math.min(100, percentage || 0));
    return Math.round(800 + (pct / 100) * 1200);
  }
  const standing = (participants - rank) / (participants - 1); // 1 = best, 0 = worst
  return Math.round(800 + standing * 1600);
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
 * @desc    Submit a student's contest exam result
 * @route   POST /api/contests/:id/submit
 * @access  Private (student)
 */
exports.submitContestResult = async (req, res, next) => {
  try {
    // SECURITY: `score`, `answersSubmitted` and `totalQuestions` are computed
    // server-side from the answer key — never trusted from the client. Only the
    // student's raw `answers`, timing, and self-reported proctoring flags are
    // read from the request body.
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

    // Only registered students can submit results
    const registeredIds = (contest.registeredStudents || []).map(id => id.toString());
    if (!registeredIds.includes(studentId.toString())) {
      return ApiResponse.error(res, 'You must register for this contest before participating', 403);
    }

    // Build the authoritative answer key. For qbank-sourced questions the
    // correct option lives on the original Question document, so resolve those.
    const submitted = (answers && typeof answers === 'object') ? answers : {};
    const contestQuestions = Array.isArray(contest.questions) ? contest.questions : [];

    const qbankIds = contestQuestions
      .filter(q => q.source === 'qbank' && q.originalQuestionId)
      .map(q => q.originalQuestionId);
    const originals = qbankIds.length
      ? await Question.find({ _id: { $in: qbankIds } }).select('options').lean()
      : [];
    const originalById = new Map(originals.map(o => [String(o._id), o]));

    let score = 0;
    let answersSubmitted = 0;
    let totalQuestions = 0;

    for (const q of contestQuestions) {
      const type = q.type || 'mcq';
      // Only MCQs can be graded server-side; written/cq are not auto-scored.
      if (type !== 'mcq') continue;
      totalQuestions += 1;

      let options = Array.isArray(q.options) ? q.options : [];
      if ((!options.length) && q.source === 'qbank' && q.originalQuestionId) {
        const orig = originalById.get(String(q.originalQuestionId));
        options = (orig && Array.isArray(orig.options)) ? orig.options : [];
      }
      const correctIndex = options.findIndex(opt => opt && opt.isCorrect);

      const key = String(q._id);
      const selected = submitted[key];
      if (selected === undefined || selected === null) continue;

      answersSubmitted += 1;
      if (Number(selected) === correctIndex && correctIndex !== -1) {
        score += 1;
      }
    }

    const result = await ContestResult.findOneAndUpdate(
      { contest: contestId, student: studentId },
      {
        score,
        totalQuestions,
        timeTakenSeconds: Number(timeTakenSeconds) || 0,
        answersSubmitted,
        answers: submitted,
        isDisqualified: !!isDisqualified,
        disqualificationReason: disqualificationReason || '',
        submittedAt: new Date()
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Fetch top 3 and emit live updates to the contest room (exclude disqualified students)
    try {
      const top3 = await ContestResult.find({ contest: contestId, isDisqualified: { $ne: true } })
        .sort({ answersSubmitted: -1, updatedAt: 1 })
        .limit(3)
        .populate('student', 'name')
        .lean();
      
      console.log(`[Controller] Broadcasting updated leaderboard for contest ${contestId}:`, JSON.stringify(top3));
      const { getIO } = require('../socket');
      const io = getIO();
      io.to(`contest:${contestId}`).emit('contest:leaderboard', top3);
    } catch (err) {
      console.error('Error broadcasting contest leaderboard update:', err);
    }

    return ApiResponse.success(res, result, 'Contest result submitted successfully');
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
    const contest = await Contest.findById(contestId).select('creator registeredStudents adminStatus');
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }
    if (!canAccessContest(contest, req.user)) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }
    
    // Find all results for this contest, populated with student's name
    const results = await ContestResult.find({ contest: contestId })
      .populate('student', 'name')
      .lean();

    // Sort: score desc, timeTakenSeconds asc (disqualified to the bottom)
    results.sort((a, b) => {
      if (a.isDisqualified && !b.isDisqualified) return 1;
      if (!a.isDisqualified && b.isDisqualified) return -1;
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.timeTakenSeconds - b.timeTakenSeconds;
    });

    // Calculate ranks (handling ties)
    let lastScore = -1;
    let lastTime = -1;
    let currentRank = 0;

    const rankedResults = results.map((resItem, index) => {
      if (resItem.isDisqualified) {
        return {
          ...resItem,
          rank: 'DQ'
        };
      }
      if (resItem.score !== lastScore || resItem.timeTakenSeconds !== lastTime) {
        currentRank = index + 1;
      }
      lastScore = resItem.score;
      lastTime = resItem.timeTakenSeconds;

      return {
        ...resItem,
        rank: currentRank
      };
    });

    const userResult = rankedResults.find(r => r.student && r.student._id.toString() === req.user.id);
    
    return ApiResponse.success(res, {
      userResult: userResult ? {
        score: userResult.score,
        totalQuestions: userResult.totalQuestions,
        percentage: userResult.totalQuestions > 0 ? Math.round((userResult.score / userResult.totalQuestions) * 100) : 0,
        rank: userResult.rank,
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
 * Ratings are computed from real, finished contests the student took part in.
 * The value only moves when they participate in a contest that has ended; it
 * is persisted to RatingHistory (one entry per contest) and to the User doc,
 * so it is stable and never regenerated from fake data.
 */
exports.getMyRating = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const now = new Date();

    // Every contest this student submitted a result for.
    const myResults = await ContestResult.find({ student: studentId })
      .populate('contest')
      .lean();

    // Keep only contests that have actually ended, ordered by when they ended.
    const finishedResults = myResults
      .filter((r) => r.contest && resolveContestDates(r.contest).endDate < now)
      .sort((a, b) => resolveContestDates(a.contest).endDate - resolveContestDates(b.contest).endDate);

    // Which of those already have a persisted rating entry?
    const existing = await RatingHistory.find({ student: studentId }).lean();
    const ratedContestIds = new Set(existing.map((e) => e.contest.toString()));

    // Rating so far = newRating of the latest existing entry (chronologically).
    const orderedExisting = [...existing].sort(
      (a, b) => new Date(a.contestDate) - new Date(b.contestDate)
    );
    let runningRating = orderedExisting.length
      ? orderedExisting[orderedExisting.length - 1].newRating
      : INITIAL_RATING;

    // Finalize any not-yet-rated finished contests, in chronological order.
    for (const result of finishedResults) {
      const contest = result.contest;
      if (ratedContestIds.has(contest._id.toString())) continue;

      // Real standings for this contest.
      const contestResults = await ContestResult.find({ contest: contest._id }).lean();
      contestResults.sort((a, b) => {
        if (a.isDisqualified && !b.isDisqualified) return 1;
        if (!a.isDisqualified && b.isDisqualified) return -1;
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTakenSeconds - b.timeTakenSeconds;
      });
      let rank = contestResults.length;
      for (let i = 0; i < contestResults.length; i += 1) {
        if (contestResults[i].student.toString() === studentId.toString()) {
          rank = i + 1;
          break;
        }
      }
      const participants = contestResults.length;
      const percentage = result.totalQuestions > 0
        ? (result.score / result.totalQuestions) * 100
        : 0;

      const performance = contestPerformance(rank, participants, percentage);
      const oldRating = runningRating;
      const delta = Math.round((performance - oldRating) / 2);
      const newRating = Math.max(800, oldRating + delta);

      try {
        await RatingHistory.create({
          student: studentId,
          contest: contest._id,
          contestName: contest.name || 'Contest',
          contestDate: resolveContestDates(contest).endDate,
          rank,
          participants,
          score: result.score,
          totalQuestions: result.totalQuestions,
          oldRating,
          newRating,
          delta
        });
        runningRating = newRating;
      } catch (writeErr) {
        // Unique index guards against a race; ignore duplicates.
        if (writeErr.code !== 11000) throw writeErr;
      }
    }

    // Final ordered history to return + persist current/max on the user.
    const history = await RatingHistory.find({ student: studentId })
      .sort({ contestDate: 1 })
      .lean();

    const current = history.length ? history[history.length - 1].newRating : null;
    const max = history.length ? Math.max(...history.map((h) => h.newRating)) : null;

    if (current !== null) {
      await User.findByIdAndUpdate(studentId, { rating: current, maxRating: max });
    }

    return ApiResponse.success(res, {
      current,
      max,
      unrated: history.length === 0,
      history: history.map((h) => ({
        contestName: h.contestName,
        date: h.contestDate,
        rank: h.rank,
        participants: h.participants,
        oldRating: h.oldRating,
        newRating: h.newRating,
        delta: h.delta
      }))
    }, 'Rating history fetched successfully');
  } catch (err) {
    console.error('Get my rating error:', err);
    return next(err);
  }
};
