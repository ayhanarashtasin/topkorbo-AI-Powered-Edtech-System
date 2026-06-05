const Contest = require('../models/Contest');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const { getContestQuestionModel } = require('../models/ContestQuestion');

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
      if (!admissionSubtype || !['science', 'commerce', 'arts'].includes(admissionSubtype)) {
        return ApiResponse.error(res, 'Valid admission subtype (science, commerce, arts) is required for Varsity level', 400);
      }
    }

    // Validate question type
    if (!questionType || !['mcq', 'cq', 'both'].includes(questionType)) {
      return ApiResponse.error(res, 'Valid question type (mcq/cq/both) is required', 400);
    }

    // Create dynamically named collection for contest-specific questions
    const safeName = name.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const collectionName = `${safeName}_questions`;
    const ContestQuestionModel = getContestQuestionModel(name.trim());

    // Temporarily holding documents to save
    const savedQuestions = [];
    if (confirmedQuestions && Array.isArray(confirmedQuestions)) {
      for (const q of confirmedQuestions) {
        const newQData = {
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
        };
        const savedQ = await ContestQuestionModel.create(newQData);
        savedQuestions.push(savedQ);
      }
    }

    // Create the contest
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
      confirmedQuestions: savedQuestions,
      contestQuestionsCollection: collectionName
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

    const upcomingContests = contests.filter(contest => {
      const tz = contest.startTime?.timezone || 'Asia/Dhaka';
      const offset = offsets[tz] || '+06:00';

      let hour = contest.startTime?.hour || 12;
      const minute = contest.startTime?.minute || 0;
      const period = contest.startTime?.period || 'AM';

      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;

      const pad = (num) => String(num).padStart(2, '0');
      const startStr = `${contest.date}T${pad(hour)}:${pad(minute)}:00${offset}`;
      const startDate = new Date(startStr);

      const durationHours = contest.duration?.hours || 0;
      const durationMinutes = contest.duration?.minutes || 0;

      // End Date = Start Date + duration
      const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000) + (durationMinutes * 60 * 1000));

      return endDate > now;
    });

    // Sort by start date ascending
    upcomingContests.sort((a, b) => {
      const getStart = (c) => {
        const tz = c.startTime?.timezone || 'Asia/Dhaka';
        const offset = offsets[tz] || '+06:00';
        let hour = c.startTime?.hour || 12;
        const minute = c.startTime?.minute || 0;
        const period = c.startTime?.period || 'AM';
        if (period === 'PM' && hour < 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        const pad = (num) => String(num).padStart(2, '0');
        return new Date(`${c.date}T${pad(hour)}:${pad(minute)}:00${offset}`);
      };
      return getStart(a) - getStart(b);
    });

    return ApiResponse.success(res, upcomingContests, 'Upcoming contests fetched successfully');
  } catch (err) {
    console.error('Get my contests controller error:', err);
    return next(err);
  }
};
