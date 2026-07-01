const Contest = require('../models/Contest');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const Question = require('../models/Question');
const ContestResult = require('../models/ContestResult');

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
    const offsets = {
      'Asia/Dhaka': '+06:00',
      'Asia/Kolkata': '+05:30',
      'Asia/Dubai': '+04:00',
      'Europe/London': '+00:00',
      'America/New_York': '-05:00',
      'Asia/Tokyo': '+09:00',
      'Asia/Singapore': '+08:00',
      'Australia/Sydney': '+10:00'
    };

    const getContestDates = (c) => {
      const tz = c.startTime?.timezone || 'Asia/Dhaka';
      const offset = offsets[tz] || '+06:00';
      let hour = c.startTime?.hour || 12;
      const minute = c.startTime?.minute || 0;
      const period = c.startTime?.period || 'AM';
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      const pad = (num) => String(num).padStart(2, '0');
      const startDate = new Date(`${c.date}T${pad(hour)}:${pad(minute)}:00${offset}`);
      const durationHours = c.duration?.hours || 0;
      const durationMinutes = c.duration?.minutes || 0;
      const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000) + (durationMinutes * 60 * 1000));
      return { startDate, endDate };
    };

    const mappedContests = contests.map(contest => {
      const { startDate, endDate } = getContestDates(contest);
      return {
        ...contest,
        startDate,
        endDate
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
    const contests = await Contest.find().populate('creator', 'name').lean();
    
    // Find contest results for this student
    const studentId = req.user.id;
    const results = await ContestResult.find({ student: studentId }).lean();
    const participatedContestIds = new Set(results.map(r => r.contest.toString()));

    const now = new Date();
    const offsets = {
      'Asia/Dhaka': '+06:00',
      'Asia/Kolkata': '+05:30',
      'Asia/Dubai': '+04:00',
      'Europe/London': '+00:00',
      'America/New_York': '-05:00',
      'Asia/Tokyo': '+09:00',
      'Asia/Singapore': '+08:00',
      'Australia/Sydney': '+10:00'
    };

    const getContestDates = (c) => {
      const tz = c.startTime?.timezone || 'Asia/Dhaka';
      const offset = offsets[tz] || '+06:00';
      let hour = c.startTime?.hour || 12;
      const minute = c.startTime?.minute || 0;
      const period = c.startTime?.period || 'AM';
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      const pad = (num) => String(num).padStart(2, '0');
      const startDate = new Date(`${c.date}T${pad(hour)}:${pad(minute)}:00${offset}`);
      const durationHours = c.duration?.hours || 0;
      const durationMinutes = c.duration?.minutes || 0;
      const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000) + (durationMinutes * 60 * 1000));
      return { startDate, endDate };
    };

    const ONE_HOUR_MS = 1 * 60 * 60 * 1000;

    const mappedContests = contests.map(contest => {
      const { startDate, endDate } = getContestDates(contest);
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
    const { score, totalQuestions, timeTakenSeconds, answersSubmitted, answers } = req.body;
    const contestId = req.params.id;
    const studentId = req.user.id;

    const contest = await Contest.findById(contestId);
    if (!contest) {
      return ApiResponse.error(res, 'Contest not found', 404);
    }

    // Only registered students can submit results
    const registeredIds = (contest.registeredStudents || []).map(id => id.toString());
    if (!registeredIds.includes(studentId.toString())) {
      return ApiResponse.error(res, 'You must register for this contest before participating', 403);
    }

    const result = await ContestResult.findOneAndUpdate(
      { contest: contestId, student: studentId },
      {
        score,
        totalQuestions,
        timeTakenSeconds,
        answersSubmitted: answersSubmitted || 0,
        answers: answers || {},
        submittedAt: new Date()
      },
      { upsert: true, new: true, runValidators: true }
    );

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
    
    // Find all results for this contest, populated with student's name
    const results = await ContestResult.find({ contest: contestId })
      .populate('student', 'name')
      .lean();

    // Sort: score desc, timeTakenSeconds asc
    results.sort((a, b) => {
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
        timeTakenSeconds: userResult.timeTakenSeconds
      } : null,
      leaderboard: {
        first: rankedResults[0]?.student?.name || '—',
        second: rankedResults[1]?.student?.name || '—',
        third: rankedResults[2]?.student?.name || '—'
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

    const student = await User.findById(studentId);
    if (!student) {
      return ApiResponse.error(res, 'Student not found', 404);
    }

    // Check if already registered
    const registeredIds = (contest.registeredStudents || []).map(id => id.toString());
    if (registeredIds.includes(studentId.toString())) {
      return ApiResponse.error(res, 'You are already registered for this contest', 400);
    }

    // Calculate contest start time
    const offsets = {
      'Asia/Dhaka': '+06:00',
      'Asia/Kolkata': '+05:30',
      'Asia/Dubai': '+04:00',
      'Europe/London': '+00:00',
      'America/New_York': '-05:00',
      'Asia/Tokyo': '+09:00',
      'Asia/Singapore': '+08:00',
      'Australia/Sydney': '+10:00'
    };

    const tz = contest.startTime?.timezone || 'Asia/Dhaka';
    const offset = offsets[tz] || '+06:00';
    let hour = contest.startTime?.hour || 12;
    const minute = contest.startTime?.minute || 0;
    const period = contest.startTime?.period || 'AM';
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    const pad = (num) => String(num).padStart(2, '0');
    const startDate = new Date(`${contest.date}T${pad(hour)}:${pad(minute)}:00${offset}`);

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
