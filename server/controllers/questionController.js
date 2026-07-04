const Question = require('../models/Question');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const planService = require('../services/planService');

/**
 * @desc    Create a new question (teacher only)
 * @route   POST /api/questions
 * @access  Private (teacher)
 */
exports.createQuestion = async (req, res, next) => {
  try {
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
 *          subject + paper + type combination.
 * @route   GET /api/questions/sources
 * @access  Private
 * @query   subject, paper, type (optional)
 */
exports.getQuestionSources = async (req, res, next) => {
  try {
    const { subject, paper, type } = req.query;
    const isPaperlessSubject = subject === 'ICT';

    if (!subject || (!paper && !isPaperlessSubject)) {
      return ApiResponse.error(res, 'subject and paper are required query params', 400);
    }

    const baseMatch = { subject };
    if (paper) baseMatch.paper = paper;
    if (type && ['mcq', 'cq', 'written'].includes(type)) {
      baseMatch.type = type;
    }

    const boardSources = await Question.aggregate([
      { $match: { ...baseMatch, 'tags.category': 'board' } },
      { $unwind: '$tags' },
      { $match: { 'tags.category': 'board', 'tags.board': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: { board: '$tags.board', year: '$tags.year', type: '$type' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          sourceType: { $literal: 'board' },
          board: '$_id.board',
          year: { $ifNull: ['$_id.year', ''] },
          type: '$_id.type',
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

    const collegeSources = await Question.aggregate([
      { $match: { ...baseMatch, 'tags.category': 'college' } },
      { $unwind: '$tags' },
      { $match: { 'tags.category': 'college', 'tags.college': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: { college: '$tags.college', year: '$tags.year', type: '$type' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          sourceType: { $literal: 'college' },
          college: '$_id.college',
          year: { $ifNull: ['$_id.year', ''] },
          type: '$_id.type',
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
 * @route   GET /api/questions/by-source
 * @access  Private
 * @query   subject, paper, sourceType, name, year (optional), type (optional), shift (optional)
 */
exports.getQuestionsBySource = async (req, res, next) => {
  try {
    const { subject, paper, sourceType, name, year, type, shift, context } = req.query;
    const isPaperlessSubject = subject === 'ICT';

    if (!sourceType || !name) {
      return ApiResponse.error(
        res,
        'sourceType and name are required query params',
        400
      );
    }

    // This endpoint is shared between browsing and starting a q-bank exam.
    // Only count usage when the client is actually starting an exam
    // (context=qbank), so mere browsing/previews stay free.
    if (context === 'qbank') {
      await planService.consume(req.user.id, 'qbankExams');
    }

    if (!['board', 'college', 'admission'].includes(sourceType)) {
      return ApiResponse.error(res, "sourceType must be 'board', 'college', or 'admission'", 400);
    }

    if (sourceType !== 'admission' && (!subject || (!paper && !isPaperlessSubject))) {
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
      if (paper) match.paper = paper;
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
 * @desc    Get distinct university (varsity admission) sources
 * @route   GET /api/questions/varsity-sources
 * @access  Private
 * @query   subject, paper, type (optional)
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
 * @desc    Get written questions for Varsity Admission stream
 * @route   GET /api/questions/varsity-written
 * @access  Private
 * @query   subject, paper, university (optional)
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
 * @desc    Get admission question cards for a specific university
 * @route   GET /api/questions/admission-cards
 * @access  Private
 * @query   university, type (optional)
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

/**
 * @desc    Update an existing question (only by the teacher who created it)
 * @route   PUT /api/questions/:id
 * @access  Private (teacher – owner only)
 */
exports.updateQuestion = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return ApiResponse.error(res, 'Only teachers can update questions', 403);
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      return ApiResponse.error(res, 'Question not found', 404);
    }

    // Ownership check
    if (question.teacher.toString() !== user._id.toString()) {
      return ApiResponse.error(res, 'You can only edit questions you uploaded', 403);
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
      solutionImageUrl,
      cq
    } = req.body;

    if (type && !['mcq', 'written', 'cq'].includes(type)) {
      return ApiResponse.error(res, 'Valid question type (mcq/written/cq) is required', 400);
    }
    if (questionText !== undefined && (!questionText || !questionText.trim())) {
      return ApiResponse.error(res, 'Question text cannot be empty', 400);
    }

    // Apply updates only when the field was sent
    if (questionText !== undefined) question.questionText = questionText.trim();
    if (imageUrl !== undefined) question.imageUrl = imageUrl || '';
    if (solutionImageUrl !== undefined) question.solutionImageUrl = solutionImageUrl || '';
    if (solution !== undefined) question.solution = solution || '';
    if (subject !== undefined) question.subject = subject;
    if (paper !== undefined) question.paper = paper;
    if (chapter !== undefined) question.chapter = chapter;
    if (topic !== undefined) question.topic = topic;
    if (type !== undefined) question.type = type;
    if (tags !== undefined) question.tags = tags || [];

    if (type === 'mcq' || type === 'written') {
      if (options !== undefined) question.options = options || [];
    } else if (type === 'cq') {
      if (cq !== undefined) question.cq = cq;
    }

    await question.save();

    return ApiResponse.success(res, question, 'Question updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a question (only by the teacher who created it)
 * @route   DELETE /api/questions/:id
 * @access  Private (teacher – owner only)
 */
exports.deleteQuestion = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can delete questions', 403);
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      return ApiResponse.error(res, 'Question not found', 404);
    }

    if (question.teacher.toString() !== user._id.toString()) {
      return ApiResponse.error(res, 'You can only delete questions you uploaded', 403);
    }

    await question.deleteOne();

    return ApiResponse.success(res, { id: req.params.id }, 'Question deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ── Standard → Tag Mapping ──────────────────────────────────────────────────
const ENGINEERING_UNIVERSITIES = [
  'BUET', 'CUET', 'KUET', 'RUET', 'MIST', 'IUT', 'BUTEX'
];
const GENERAL_UNIVERSITIES = [
  'DU', 'CU', 'RU', 'JU', 'GST', 'BUP', 'IBA'
];
const MEDICAL_UNIVERSITIES = ['Medical', 'Dental'];
const BOARDS = [
  'Dhaka', 'Comilla', 'Rajshahi', 'Jessore', 'Chittagong',
  'Sylhet', 'Barishal', 'Dinajpur', 'Mymensingh', 'Madrasa', 'Technical'
];
const COLLEGES = [
  'Notre Dame College', 'Dhaka College', 'Rajuk Uttara Model College',
  'Viqarunnisa Noon College', 'Holy Cross College', 'Adamjee Cantonment College',
  'Ideal College', 'Dhaka City College', 'Government Science College',
  'Shaheed Bir Uttam Lt. Anwar Girls College', 'Milestone College',
  'BIRDEM Nursing College', 'Begum Rokeya University, Rangpur',
  'Chittagong College', 'Rajshahi College', 'Jahangirnagar University School & College',
  'Comilla Victoria College', 'Barishal Cadet College', 'Mymensingh Girls Cadet College',
  'Sylhet Cadet College', 'Faujdarhat Cadet College'
];

/**
 * @desc    Fetch questions for mock test with filters
 * @route   POST /api/questions/mock-test
 * @access  Private
 */
exports.fetchMockTestQuestions = async (req, res, next) => {
  try {
    const {
      selections,     // [{ subject, paper, chapters: [{ name, topics: [string] }] }]
      standard,       // 'engineering' | 'university' | 'academic' | 'medical' | '' (legacy)
      standards,      // ['engineering', 'university', 'academic', 'medical']
      selectedEngineeringUnis, // ['BUET', 'CKRUET']
      selectedGeneralUnis,     // ['DU', 'GST']
      selectedAcademicTypes,   // ['board', 'college']
      selectedBoards,          // ['Dhaka', 'Rajshahi']
      selectedColleges,        // ['Notre Dame College']
      questionType,   // 'mcq' | 'cq' | 'written' | ''
      totalQuestions, // number
      source,         // { type: 'board' | 'college', name: 'Dhaka', year: '2025' } | null
      context         // 'qbank' | 'mock' | 'battle' — which feature is starting an exam
    } = req.body;

    // Free-tier lifetime limits are attributed by which feature is starting the
    // exam. Battle question fetches are counted at battleController.createRoom
    // (per room, not per fetch), so they are not gated here.
    if (context === 'qbank') {
      await planService.consume(req.user.id, 'qbankExams');
    } else if (context === 'mock') {
      await planService.consume(req.user.id, 'mockTests');
    } else if (context === 'ai-battle') {
      // AI battle runs entirely client-side vs an AI opponent (no server room),
      // so its question fetch is the choke point for the battle-room limit.
      await planService.consume(req.user.id, 'battleRooms');
    } else if (!context) {
      console.warn('[planService] /questions/mock-test called without a context — usage not attributed');
    }

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

    // Build tag filters based on standards/sub-selections using $elemMatch
    const tagConditions = [];
    const hasSource = source && source.type && source.name;
    const activeStandards = Array.isArray(standards) ? standards : (standard ? [standard] : []);

    // 1. Engineering
    if (activeStandards.includes('engineering')) {
      const engUnis = Array.isArray(selectedEngineeringUnis) && selectedEngineeringUnis.length > 0
        ? selectedEngineeringUnis
        : ENGINEERING_UNIVERSITIES;
      tagConditions.push({
        tags: {
          $elemMatch: {
            category: 'admission',
            university: { $in: engUnis }
          }
        }
      });
    }

    // 2. University
    if (activeStandards.includes('university')) {
      const genUnis = Array.isArray(selectedGeneralUnis) && selectedGeneralUnis.length > 0
        ? selectedGeneralUnis
        : GENERAL_UNIVERSITIES;
      tagConditions.push({
        tags: {
          $elemMatch: {
            category: 'admission',
            university: { $in: genUnis }
          }
        }
      });
    }

    // 3. Medical
    if (activeStandards.includes('medical')) {
      tagConditions.push({
        tags: {
          $elemMatch: {
            category: 'admission',
            university: { $in: MEDICAL_UNIVERSITIES }
          }
        }
      });
    }

    // 4. Academic
    if (activeStandards.includes('academic') && !hasSource) {
      const acadTypes = Array.isArray(selectedAcademicTypes) && selectedAcademicTypes.length > 0
        ? selectedAcademicTypes
        : ['board']; // legacy fallback to board questions
      
      if (acadTypes.includes('board')) {
        const boards = Array.isArray(selectedBoards) && selectedBoards.length > 0
          ? selectedBoards
          : BOARDS;
        tagConditions.push({
          tags: {
            $elemMatch: {
              category: 'board',
              board: { $in: boards }
            }
          }
        });
      }

      if (acadTypes.includes('college')) {
        tagConditions.push({
          tags: {
            $elemMatch: {
              category: 'college'
            }
          }
        });
      }
    }

    // Compose final match conditions using $and array to avoid overlapping $or operators
    const andConditions = [];
    
    // Add subject conditions
    andConditions.push({ $or: subjectConditions });

    // Add question type filter
    if (questionType && ['mcq', 'cq', 'written'].includes(questionType)) {
      andConditions.push({ type: questionType });
    }

    // Add standards filter if configured
    if (tagConditions.length > 0) {
      andConditions.push({ $or: tagConditions });
    }

    // Source filter (board+year or college+year)
    if (source && source.type && source.name) {
      const sourceMatch = {};
      if (source.type === 'board') {
        sourceMatch['tags.category'] = 'board';
        sourceMatch['tags.board'] = source.name;
        if (source.year) {
          sourceMatch['tags.year'] = source.year;
        }
      } else if (source.type === 'college') {
        sourceMatch['tags.category'] = 'college';
        sourceMatch['tags.college'] = source.name;
        if (source.year) {
          sourceMatch['tags.year'] = source.year;
        }
      }
      andConditions.push(sourceMatch);
    }

    const matchStage = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    // 1. Fetch ALL matching questions using find() — reliable and deterministic
    const allMatching = await Question.find(matchStage)
      .select('-teacher -__v')
      .lean();

    const availableCount = allMatching.length;

    // 2. If no matching questions at all, return early
    if (availableCount === 0) {
      return ApiResponse.success(res, {
        questions: [],
        total: 0,
        requested: limit,
        available: 0
      }, 'No matching questions found');
    }

    // 3. If fewer matching questions than requested, return early with the available count
    //    so the client can show a proper error modal
    if (availableCount < limit) {
      return ApiResponse.success(res, {
        questions: [],
        total: 0,
        requested: limit,
        available: availableCount
      }, `Only ${availableCount} questions available, but ${limit} were requested`);
    }

    // 4. Fisher-Yates shuffle for true randomization, then take exactly `limit` questions
    for (let i = allMatching.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allMatching[i], allMatching[j]] = [allMatching[j], allMatching[i]];
    }
    const questions = allMatching.slice(0, limit);

    // Removed backfill logic as per user request to only serve strictly matched questions

    return ApiResponse.success(res, {
      questions,
      total: questions.length,
      requested: limit,
      available: availableCount
    }, 'Mock test questions fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Fetch ALL questions matching subject/chapter/topic selections
 *          for the Contest "Choose from Question Bank" flow.
 *          Unlike mock-test, this returns every match without random
 *          sampling or a quantity cap, so the teacher can hand-pick.
 * @route   POST /api/questions/qbank-browse
 * @access  Private (teacher)
 */
exports.fetchQBankQuestions = async (req, res, next) => {
  try {
    const { selections } = req.body;
    // selections: [{ subject, paper, chapters: [{ name, topics: [string] }] }]

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return ApiResponse.error(res, 'At least one subject/chapter selection is required', 400);
    }

    const subjectConditions = [];
    selections.forEach(sel => {
      if (!sel.subject) return;
      (sel.chapters || []).forEach(ch => {
        if (!ch.name) return;
        const cond = { subject: sel.subject, paper: sel.paper, chapter: ch.name };
        if (ch.topics && ch.topics.length > 0) {
          cond.topic = { $in: ch.topics };
        }
        subjectConditions.push(cond);
      });
    });

    if (subjectConditions.length === 0) {
      return ApiResponse.error(res, 'No valid chapter selections found', 400);
    }

    const questions = await Question.find({ $or: subjectConditions })
      .select('-teacher -__v')
      .sort({ subject: 1, paper: 1, chapter: 1, createdAt: -1 })
      .lean();

    return ApiResponse.success(res, {
      questions,
      total: questions.length
    }, 'Question bank questions fetched successfully');
  } catch (err) {
    next(err);
  }
};
