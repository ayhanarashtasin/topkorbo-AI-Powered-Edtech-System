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
      solution
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
      totalQuestions   // number
    } = req.body;

    const limit = Math.min(parseInt(totalQuestions) || 20, 200);

    // Build subject/chapter/topic $or conditions
    const subjectConditions = [];
    if (selections && Array.isArray(selections)) {
      selections.forEach(sel => {
        if (!sel.subject) return;
        sel.chapters?.forEach(ch => {
          if (!ch.name) return;
          const cond = { subject: sel.subject, paper: sel.paper, chapter: ch.name };
          if (ch.topics && ch.topics.length > 0) {
            cond.topic = { $in: ch.topics };
          }
          subjectConditions.push(cond);
        });
      });
    }

    if (subjectConditions.length === 0) {
      return ApiResponse.error(res, 'At least one subject/chapter selection is required', 400);
    }

    // Build tag filter based on standard
    let tagFilter = null;
    if (standard === 'engineering') {
      tagFilter = { 'tags.category': 'admission', 'tags.university': { $in: ENGINEERING_UNIVERSITIES } };
    } else if (standard === 'university') {
      tagFilter = { 'tags.category': 'admission', 'tags.university': { $in: GENERAL_UNIVERSITIES } };
    } else if (standard === 'academic') {
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
