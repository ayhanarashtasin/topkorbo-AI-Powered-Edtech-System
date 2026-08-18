const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const questionController = require('../controllers/questionController');

// DEBUG ROUTE TO CHECK LATEST QUESTIONS
router.get('/debug-latest-all', questionController.getLatestQuestionsDebug);

// @desc    Create a new question
// @route   POST /api/questions
router.post('/', auth, questionController.createQuestion);

// @desc    Get current teacher's uploaded questions
// @route   GET /api/questions/mine
router.get('/mine', auth, questionController.getMyQuestions);

// @desc    Get topics by subject, paper, and chapter
// @route   GET /api/questions/topics
router.get('/topics', auth, questionController.getTopicsForMockTest);

// @desc    Get the synced academic taxonomy tree for question-based flows
// @route   GET /api/questions/taxonomy
router.get('/taxonomy', auth, questionController.getAcademicTaxonomy);

// @desc    Get distinct board/college question sources for a subject/paper/type
// @route   GET /api/questions/sources
router.get('/sources', auth, questionController.getQuestionSources);

// @desc    Get all questions belonging to a specific board/college source
// @route   GET /api/questions/by-source
router.get('/by-source', auth, questionController.getQuestionsBySource);

// @desc    Get admission question cards for a specific university (grouped by year/shift)
// @route   GET /api/questions/admission-cards
router.get('/admission-cards', auth, questionController.getAdmissionQuestionCards);

// @desc    Get distinct university admission sources
// @route   GET /api/questions/varsity-sources
router.get('/varsity-sources', auth, questionController.getVarsityAdmissionSources);

// @desc    Get written questions for Varsity Admission stream
// @route   GET /api/questions/varsity-written
router.get('/varsity-written', auth, questionController.getVarsityWrittenQuestions);

// @desc    Fetch ALL questions matching subject/chapter/topic for contest QBank pick
// @route   POST /api/questions/qbank-browse
router.post('/qbank-browse', auth, questionController.fetchQBankQuestions);

// @desc    Fetch questions for mock test with filters
// @route   POST /api/questions/mock-test
router.post('/mock-test', auth, questionController.fetchMockTestQuestions);

// @desc    Update a question (teacher owner only)
// @route   PUT /api/questions/:id
router.put('/:id', auth, questionController.updateQuestion);

// @desc    Report a wrong question
// @route   POST /api/questions/:id/report
router.post('/:id/report', auth, questionController.reportQuestion);

// @desc    Delete a question (teacher owner only)
// @route   DELETE /api/questions/:id
router.delete('/:id', auth, questionController.deleteQuestion);

module.exports = router;
