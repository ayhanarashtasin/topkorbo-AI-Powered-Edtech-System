const adminQuestionService = require('../../services/admin/adminQuestionService');

async function listQuestions(req, res, next) {
  try {
    const data = await adminQuestionService.listQuestions(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getQuestionDetails(req, res, next) {
  try {
    const data = await adminQuestionService.getQuestionDetails(req.params.questionId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function approveQuestion(req, res, next) {
  try {
    const data = await adminQuestionService.approveQuestion({
      adminUser: req.user,
      questionId: req.params.questionId,
      reason: req.body.reason
    });
    return res.json({ success: true, data, message: 'Question approved successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function rejectQuestion(req, res, next) {
  try {
    const data = await adminQuestionService.rejectQuestion({
      adminUser: req.user,
      questionId: req.params.questionId,
      reason: req.body.reason
    });
    return res.json({ success: true, data, message: 'Question rejected successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function editQuestion(req, res, next) {
  try {
    const data = await adminQuestionService.editQuestion({
      adminUser: req.user,
      questionId: req.params.questionId,
      updates: req.body.updates || {},
      reason: req.body.reason
    });
    return res.json({ success: true, data, message: 'Question updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function listQuestionReports(req, res, next) {
  try {
    const data = await adminQuestionService.listQuestionReports(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updateQuestionReportStatus(req, res, next) {
  try {
    const data = await adminQuestionService.updateQuestionReportStatus({
      adminUser: req.user,
      questionId: req.params.questionId,
      nextStatus: req.body.status,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Question reports updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function getQuestionQualityStats(req, res, next) {
  try {
    const data = await adminQuestionService.getQuestionQualityStats();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listQuestions,
  getQuestionDetails,
  approveQuestion,
  rejectQuestion,
  editQuestion,
  listQuestionReports,
  updateQuestionReportStatus,
  getQuestionQualityStats
};
