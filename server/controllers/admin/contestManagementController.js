const adminContestService = require('../../services/admin/adminContestService');
const adminContestMonitoringService = require('../../services/admin/adminContestMonitoringService');

async function listContests(req, res, next) {
  try {
    const data = await adminContestService.listContests(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getContestDetails(req, res, next) {
  try {
    const data = await adminContestService.getContestDetails(req.params.contestId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function createContest(req, res, next) {
  try {
    const data = await adminContestService.createContest({
      adminUser: req.user,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data, message: 'Contest created successfully' });
  } catch (err) {
    return next(err);
  }
}

async function updateContest(req, res, next) {
  try {
    const data = await adminContestService.updateContest({
      adminUser: req.user,
      contestId: req.params.contestId,
      payload: req.body || {}
    });
    return res.json({ success: true, data, message: 'Contest updated successfully' });
  } catch (err) {
    return next(err);
  }
}

async function cancelContest(req, res, next) {
  try {
    const data = await adminContestService.cancelContest({
      adminUser: req.user,
      contestId: req.params.contestId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'Contest cancelled successfully' });
  } catch (err) {
    return next(err);
  }
}

async function archiveContest(req, res, next) {
  try {
    const data = await adminContestService.archiveContest({
      adminUser: req.user,
      contestId: req.params.contestId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'Contest archived successfully' });
  } catch (err) {
    return next(err);
  }
}

async function getLiveContestSummary(req, res, next) {
  try {
    const data = await adminContestMonitoringService.getLiveContestsSummary(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getLiveContestParticipants(req, res, next) {
  try {
    const data = await adminContestMonitoringService.getLiveParticipants(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getSuspiciousAttempts(req, res, next) {
  try {
    const data = await adminContestMonitoringService.getSuspiciousAttempts(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getAttemptDetails(req, res, next) {
  try {
    const data = await adminContestMonitoringService.getAttemptDetails(req.params.resultId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function flagAttempt(req, res, next) {
  try {
    const data = await adminContestMonitoringService.flagAttempt({
      adminUser: req.user,
      resultId: req.params.resultId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'Attempt flagged successfully' });
  } catch (err) {
    return next(err);
  }
}

async function clearAttemptFlag(req, res, next) {
  try {
    const data = await adminContestMonitoringService.clearAttemptFlag({
      adminUser: req.user,
      resultId: req.params.resultId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'Attempt cleared successfully' });
  } catch (err) {
    return next(err);
  }
}

async function addAttemptReviewNote(req, res, next) {
  try {
    const data = await adminContestMonitoringService.addAttemptReviewNote({
      adminUser: req.user,
      resultId: req.params.resultId,
      note: req.body?.note || ''
    });
    return res.json({ success: true, data, message: 'Review note saved successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listContests,
  getContestDetails,
  createContest,
  updateContest,
  cancelContest,
  archiveContest,
  getLiveContestSummary,
  getLiveContestParticipants,
  getSuspiciousAttempts,
  getAttemptDetails,
  flagAttempt,
  clearAttemptFlag,
  addAttemptReviewNote
};
