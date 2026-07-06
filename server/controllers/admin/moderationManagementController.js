const moderationService = require('../../services/admin/adminModerationService');

async function listReports(req, res, next) {
  try {
    const data = await moderationService.listReports(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getReportDetails(req, res, next) {
  try {
    const data = await moderationService.getReportDetails(req.params.reportId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function markReportUnderReview(req, res, next) {
  try {
    const data = await moderationService.updateReportStatus({
      adminUser: req.user,
      reportId: req.params.reportId,
      nextStatus: 'under_review',
      note: req.body.note,
      actionType: 'REPORT_UNDER_REVIEW'
    });
    return res.json({ success: true, data, message: 'Report marked under review.' });
  } catch (err) {
    return next(err);
  }
}

async function dismissReport(req, res, next) {
  try {
    const data = await moderationService.updateReportStatus({
      adminUser: req.user,
      reportId: req.params.reportId,
      nextStatus: 'dismissed',
      note: req.body.note,
      actionType: 'REPORT_DISMISSED'
    });
    return res.json({ success: true, data, message: 'Report dismissed successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function resolveReport(req, res, next) {
  try {
    const data = await moderationService.updateReportStatus({
      adminUser: req.user,
      reportId: req.params.reportId,
      nextStatus: 'resolved',
      note: req.body.note,
      actionType: 'REPORT_RESOLVED'
    });
    return res.json({ success: true, data, message: 'Report resolved successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function addReportNote(req, res, next) {
  try {
    const data = await moderationService.addReportNote({
      adminUser: req.user,
      reportId: req.params.reportId,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Report note added successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function warnReportedUser(req, res, next) {
  try {
    const data = await moderationService.warnReportedUser({
      adminUser: req.user,
      reportId: req.params.reportId,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'User warned successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function hideReportedContent(req, res, next) {
  try {
    const data = await moderationService.hideReportedContent({
      adminUser: req.user,
      reportId: req.params.reportId,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Reported content hidden successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function updateReportedUserStatus(req, res, next) {
  try {
    const data = await moderationService.changeReportedUserStatus({
      adminUser: req.user,
      reportId: req.params.reportId,
      status: req.body.status,
      reason: req.body.reason
    });
    return res.json({ success: true, data, message: 'User status updated from moderation workflow.' });
  } catch (err) {
    return next(err);
  }
}

async function listAppeals(req, res, next) {
  try {
    const data = await moderationService.listAppeals(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getAppealDetails(req, res, next) {
  try {
    const data = await moderationService.getAppealDetails(req.params.appealId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function approveAppeal(req, res, next) {
  try {
    const data = await moderationService.approveAppeal({
      adminUser: req.user,
      appealId: req.params.appealId,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Appeal approved successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function rejectAppeal(req, res, next) {
  try {
    const data = await moderationService.rejectAppeal({
      adminUser: req.user,
      appealId: req.params.appealId,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Appeal rejected successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function addAppealNote(req, res, next) {
  try {
    const data = await moderationService.addAppealNote({
      adminUser: req.user,
      appealId: req.params.appealId,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Appeal note added successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listReports,
  getReportDetails,
  markReportUnderReview,
  dismissReport,
  resolveReport,
  addReportNote,
  warnReportedUser,
  hideReportedContent,
  updateReportedUserStatus,
  listAppeals,
  getAppealDetails,
  approveAppeal,
  rejectAppeal,
  addAppealNote
};
