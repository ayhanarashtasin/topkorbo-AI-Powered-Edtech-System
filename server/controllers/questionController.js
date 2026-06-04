const Question = require('../models/Question');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Create a new question (teacher only)
 * @route   POST /api/questions
 * @access  Private (teacher)
 */
exports.createQuestion = async (req, res, next) => {
  try {
    // Verify the user is a teacher
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can upload questions', 403);
    }

    const {
      questionText,
      imageUrl,
      type,
      options,
      subject,
      paper,
      chapter,
      topic,
      tags,
      solution,
      solutionImageUrl
    } = req.body;

    // Basic validation
    if (!questionText || !questionText.trim()) {
      return ApiResponse.error(res, 'Question text is required', 400);
    }
    if (!type || !['mcq', 'written', 'cq'].includes(type)) {
      return ApiResponse.error(res, 'Valid question type (mcq/written/cq) is required', 400);
    }
    if (!subject) {
      return ApiResponse.error(res, 'Subject is required', 400);
    }
    if (!paper) {
      return ApiResponse.error(res, 'Paper selection is required', 400);
    }
    if (!chapter) {
      return ApiResponse.error(res, 'Chapter is required', 400);
    }
    if (!topic) {
      return ApiResponse.error(res, 'Topic is required', 400);
    }

    // Build the question document
    const questionData = {
      teacher: user._id,
      questionText: questionText.trim(),
      imageUrl: imageUrl || '',
      type,
      subject,
      paper,
      chapter,
      topic,
      solution: solution || '',
      solutionImageUrl: solutionImageUrl || '',
      tags: tags || [],
      options: (type === 'mcq' || type === 'written') ? (options || []) : [],
      cq: type === 'cq' ? req.body.cq : undefined
    };

    const question = await Question.create(questionData);

    return ApiResponse.success(res, question, 'Question uploaded successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get all questions uploaded by the current teacher
 * @route   GET /api/questions/mine
 * @access  Private (teacher)
 */
exports.getMyQuestions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can view their uploaded questions', 403);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      Question.find({ teacher: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Question.countDocuments({ teacher: user._id })
    ]);

    return ApiResponse.success(res, {
      questions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Questions fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get distinct topics by subject, paper, and chapter filter
 * @route   GET /api/questions/topics
 * @access  Private (student/teacher/tutor)
 */
exports.getTopicsForMockTest = async (req, res, next) => {
  try {
    const { subject, paper, chapter } = req.query;

    if (!subject || !paper || !chapter) {
      return ApiResponse.error(res, 'subject, paper, and chapter are required query params', 400);
    }

    // Query distinct topics along with question count matching the filter
    const topics = await Question.aggregate([
      {
        $match: {
          subject,
          paper,
          chapter
        }
      },
      {
        $group: {
          _id: '$topic',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          count: 1
        }
      },
      {
        $sort: { name: 1 }
      }
    ]);

    return ApiResponse.success(res, topics, 'Topics fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get distinct available question sources (Board/College) for a given
 *          subject + paper + type combination. Each source contains a count
 *          of how many questions are available.
 * @route   GET /api/questions/sources
 * @access  Private
 * @query   subject  – 'Physics' | 'Chemistry' | 'Higher Math' | 'Biology' | ...
 *          paper    – '1st' | '2nd'
 *          type     – 'mcq' | 'cq' | 'written'  (optional – returns all if missing)
 */
exports.getQuestionSources = async (req, res, next) => {
  try {
    const { subject, paper, type } = req.query;

    if (!subject || !paper) {
      return ApiResponse.error(res, 'subject and paper are required query params', 400);
    }

    const baseMatch = { subject, paper };
    if (type && ['mcq', 'cq', 'written'].includes(type)) {
      baseMatch.type = type;
    }

    // Board sources: group by (board, year)
    const boardSources = await Question.aggregate([
      { $match: { ...baseMatch, 'tags.category': 'board' } },
      { $unwind: '$tags' },
      { $match: { 'tags.category': 'board', 'tags.board': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: { board: '$tags.board', year: '$tags.year' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          sourceType: { $literal: 'board' },
          board: '$_id.board',
          year: { $ifNull: ['$_id.year', ''] },
          count: 1,
          label: {
            $concat: [
              '$_id.board',
              { $cond: [{ $and: ['$_id.year', { $ne: ['$_id.year', ''] }] }, { $concat: [' - ', '$_id.year'] }, ''] }
            ]
          }
        }
      },
      { $sort: { year: -1, board: 1 } }
    ]);

    // College sources: group by (college, year)
    const collegeSources = await Question.aggregate([
      { $match: { ...baseMatch, 'tags.category': 'college' } },
      { $unwind: '$tags' },
      { $match: { 'tags.category': 'college', 'tags.college': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: { college: '$tags.college', year: '$tags.year' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          sourceType: { $literal: 'college' },
          college: '$_id.college',
          year: { $ifNull: ['$_id.year', ''] },
          count: 1,
          label: {
            $concat: [
              '$_id.college',
              { $cond: [{ $and: ['$_id.year', { $ne: ['$_id.year', ''] }] }, { $concat: [' - ', '$_id.year'] }, ''] }
            ]
          }
        }
      },
      { $sort: { year: -1, college: 1 } }
    ]);

    return ApiResponse.success(res, {
      boards: boardSources,
      colleges: collegeSources
    }, 'Question sources fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get all questions that belong to a specific board/college source
 *          (optionally filtered by year). Returns every question that exists
 *          in the database matching the tag — no random sampling, no limit
 *          other than a safety cap to keep responses sane.
 * @route   GET /api/questions/by-source
 * @access  Private
 * @query   subject    – 'Physics' | 'Chemistry' | 'Higher Math' | 'Biology'
 *          paper      – '1st' | '2nd'
 *          sourceType – 'board' | 'college' | 'admission'
 *          name       – board name (e.g. "Dinajpur"), college name, or university code (e.g. "RU")
 *          year       – optional (e.g. "2023")
 *          type       – optional 'mcq' | 'cq' | 'written'
 *          shift      – optional (e.g. "1st Shift") – only for admission
 */
exports.getQuestionsBySource = async (req, res, next) => {
  try {
    const { subject, paper, sourceType, name, year, type, shift } = req.query;

    if (!sourceType || !name) {
      return ApiResponse.error(
        res,
        'sourceType and name are required query params',
        400
      );
    }

    if (!['board', 'college', 'admission'].includes(sourceType)) {
      return ApiResponse.error(res, "sourceType must be 'board', 'college', or 'admission'", 400);
    }

    // For board/college, subject and paper are required
    if (sourceType !== 'admission' && (!subject || !paper)) {
      return ApiResponse.error(res, 'subject and paper are required for board/college sources', 400);
    }

    const match = {};

    if (sourceType === 'admission') {
      match['tags.category'] = 'admission';
      match['tags.university'] = name;
      if (year) match['tags.year'] = year;
      if (shift) match['tags.shift'] = shift;
    } else {
      match.subject = subject;
      match.paper = paper;
      match['tags.category'] = sourceType;
      match[sourceType === 'board' ? 'tags.board' : 'tags.college'] = name;
      if (year) match['tags.year'] = year;
    }

    if (type && ['mcq', 'cq', 'written'].includes(type)) {
      match.type = type;
    }

    const questions = await Question.find(match)
      .select('-teacher -__v')
      .sort({ createdAt: -1 })
      .lean();

    return ApiResponse.success(res, {
      questions,
      total: questions.length
    }, 'Questions fetched for source');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get distinct university (varsity admission) sources for a given
 *          subject + paper + type combination. Mirrors `getQuestionSources`
 *          but groups by the `admission` tag's `university` field. Used by
 *          the Question Bank Varsity Admission flow.
 * @route   GET /api/questions/varsity-sources
 * @access  Private
 * @query   subject – 'Physics' | 'Chemistry' | 'Higher Math' | 'Biology' | ...
 *          paper   – '1st' | '2nd'
 *          type    – 'mcq' | 'cq' | 'written'  (optional – returns all if missing)
 */
exports.getVarsityAdmissionSources = async (req, res, next) => {
  try {
    const { subject, paper, type } = req.query;

    if (!subject || !paper) {
      return ApiResponse.error(res, 'subject and paper are required query params', 400);
    }

    const baseMatch = { subject, paper };
    if (type && ['mcq', 'cq', 'written'].includes(type)) {
      baseMatch.type = type;
    }

    const sources = await Question.aggregate([
      { $match: { ...baseMatch, 'tags.category': 'admission' } },
      { $unwind: '$tags' },
      {
        $match: {
          'tags.category': 'admission',
          'tags.university': { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: { university: '$tags.university', year: '$tags.year' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          sourceType: { $literal: 'admission' },
          university: '$_id.university',
          year: { $ifNull: ['$_id.year', ''] },
          count: 1,
          label: {
            $concat: [
              '$_id.university',
              { $cond: [{ $and: ['$_id.year', { $ne: ['$_id.year', ''] }] }, { $concat: [' - ', '$_id.year'] }, ''] }
            ]
          }
        }
      },
      { $sort: { year: -1, university: 1 } }
    ]);

    return ApiResponse.success(res, { sources }, 'Varsity admission sources fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get every written question tagged for a particular subject + paper
 *          inside the Varsity Admission stream. Powers the dedicated
 *          `VarsityWrittenView` page where students review written practice
 *          questions chapter-wise.
 * @route   GET /api/questions/varsity-written
 * @access  Private
 * @query   subject – 'Physics' | 'Chemistry' | 'Higher Math' | 'Biology'
 *          paper   – '1st' | '2nd'
 */
exports.getVarsityWrittenQuestions = async (req, res, next) => {
  try {
    const { subject, paper, university } = req.query;

    if (!subject || !paper) {
      return ApiResponse.error(res, 'subject and paper are required query params', 400);
    }

    const match = {
      subject,
      paper,
      type: 'written',
      'tags.category': 'admission'
    };

    if (university) {
      match['tags.university'] = university.toUpperCase();
    }

    const questions = await Question.find(match)
      .select('-teacher -__v')
      .sort({ createdAt: -1 })
      .lean();

    return ApiResponse.success(res, {
      questions,
      total: questions.length
    }, 'Varsity written questions fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get admission question "cards" for a specific university. Groups
 *          questions by (year, shift, type) so the front-end can render a
 *          grid of source cards similar to the Academic MCQ board cards.
 * @route   GET /api/questions/admission-cards
 * @access  Private
 * @query   university – e.g. 'RU', 'DU', 'CU', 'GST', 'AGRI', …
 *          type       – optional 'mcq' | 'written' (filter by question type)
 */
exports.getAdmissionQuestionCards = async (req, res, next) => {
  try {
    const { university, type } = req.query;

    if (!university) {
      return ApiResponse.error(res, 'university is a required query param', 400);
    }

    const baseMatch = {
      'tags.category': 'admission',
      'tags.university': university.toUpperCase()
    };
    if (type && ['mcq', 'cq', 'written'].includes(type)) {
      baseMatch.type = type;
    }

    const cards = await Question.aggregate([
      { $match: baseMatch },
      { $unwind: '$tags' },
      {
        $match: {
          'tags.category': 'admission',
          'tags.university': university.toUpperCase()
        }
      },
      {
        $group: {
          _id: {
            year: '$tags.year',
            shift: '$tags.shift',
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          university: { $literal: university.toUpperCase() },
          year: { $ifNull: ['$_id.year', ''] },
          shift: { $ifNull: ['$_id.shift', ''] },
          type: '$_id.type',
          count: 1,
          time: { $literal: '1 hour' }
        }
      },
      { $sort: { year: -1, shift: 1, type: 1 } }
    ]);

    return ApiResponse.success(res, { cards }, 'Admission question cards fetched successfully');
  } catch (err) {
    next(err);
  }
};

// ── Standard → Tag Mapping ──────────────────────────────────────────────────
const ENGINEERING_UNIVERSITIES = [
  'BUET', 'CUET', 'KUET', 'RUET', 'MIST', 'IUT', 'BUTEX', 'CKRUET'
];
const GENERAL_UNIVERSITIES = [
  'DU', 'CU', 'RU', 'JU', 'GST', 'BUP', 'IBA'
];
const MEDICAL_UNIVERSITIES = ['Medical', 'Dental'];

/**
 * @desc    Fetch questions for mock test with filters
 * @route   POST /api/questions/mock-test
 * @access  Private
 */
exports.fetchMockTestQuestions = async (req, res, next) => {
  try {
    const {
      selections,     // [{ subject, paper, chapters: [{ name, topics: [string] }] }]
      standard,       // 'engineering' | 'university' | 'academic' | 'medical' | ''
      questionType,   // 'mcq' | 'cq' | 'written' | ''
      totalQuestions, // number
      source          // { type: 'board' | 'college', name: 'Dhaka', year: '2025' } | null
    } = req.body;

    const limit = Math.min(parseInt(totalQuestions) || 20, 200);

    // Build subject/chapter/topic $or conditions
    const subjectConditions = [];
    if (selections && Array.isArray(selections)) {
      selections.forEach(sel => {
        if (!sel.subject) return;
        sel.chapters?.forEach(ch => {
          if (!ch.name) return;
          // '*' = wildcard — match any chapter (used when user is selecting
          // by source/board/college instead of chapter).
          if (ch.name === '*') {
            subjectConditions.push({ subject: sel.subject, paper: sel.paper });
          } else {
            const cond = { subject: sel.subject, paper: sel.paper, chapter: ch.name };
            if (ch.topics && ch.topics.length > 0) {
              cond.topic = { $in: ch.topics };
            }
            subjectConditions.push(cond);
          }
        });
      });
    }

    if (subjectConditions.length === 0) {
      return ApiResponse.error(res, 'At least one subject/chapter selection is required', 400);
    }

    // Build tag filter based on standard
    let tagFilter = null;
    const hasSource = source && source.type && source.name;
    if (standard === 'engineering') {
      tagFilter = { 'tags.category': 'admission', 'tags.university': { $in: ENGINEERING_UNIVERSITIES } };
    } else if (standard === 'university') {
      tagFilter = { 'tags.category': 'admission', 'tags.university': { $in: GENERAL_UNIVERSITIES } };
    } else if (standard === 'academic' && !hasSource) {
      tagFilter = { 'tags.category': 'board' };
    } else if (standard === 'medical') {
      tagFilter = { 'tags.category': 'admission', 'tags.university': { $in: MEDICAL_UNIVERSITIES } };
    }

    // Compose final match
    const matchStage = { $or: subjectConditions };
    if (questionType && ['mcq', 'cq', 'written'].includes(questionType)) {
      matchStage.type = questionType;
    }
    if (tagFilter) {
      Object.assign(matchStage, tagFilter);
    }

    // Source filter (board+year or college+year)
    if (source && source.type && source.name) {
      if (source.type === 'board') {
        matchStage['tags.category'] = 'board';
        matchStage['tags.board'] = source.name;
        if (source.year) {
          matchStage['tags.year'] = source.year;
        }
      } else if (source.type === 'college') {
        matchStage['tags.category'] = 'college';
        matchStage['tags.college'] = source.name;
        if (source.year) {
          matchStage['tags.year'] = source.year;
        }
      }
    }

    // Aggregation: match → sample → project
    const pipeline = [
      { $match: matchStage },
      { $sample: { size: limit } },
      {
        $project: {
          teacher: 0,
          __v: 0
        }
      }
    ];

    const questions = await Question.aggregate(pipeline);

    // Removed backfill logic as per user request to only serve strictly matched questions

    return ApiResponse.success(res, {
      questions,
      total: questions.length,
      requested: limit
    }, 'Mock test questions fetched successfully');
  } catch (err) {
    next(err);
  }
};
