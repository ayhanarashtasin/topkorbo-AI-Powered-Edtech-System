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
      tags
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
