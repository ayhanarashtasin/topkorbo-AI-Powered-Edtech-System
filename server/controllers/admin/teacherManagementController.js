const adminTeacherService = require('../../services/admin/adminTeacherService');

async function listTeachers(req, res, next) {
  try {
    const data = await adminTeacherService.listTeachers(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getTeacherDetails(req, res, next) {
  try {
    const data = await adminTeacherService.getTeacherDetails(req.params.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updateTeacherApplicationStatus(req, res, next) {
  try {
    const data = await adminTeacherService.updateTeacherApplicationStatus({
      adminUser: req.user,
      targetUserId: req.params.userId,
      decision: req.body.decision,
      reason: req.body.reason,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Teacher application updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function updateTeacherVerificationStatus(req, res, next) {
  try {
    const data = await adminTeacherService.updateTeacherVerificationStatus({
      adminUser: req.user,
      targetUserId: req.params.userId,
      nextStatus: req.body.status,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Teacher verification updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function resetMentorLiveSessions(req, res, next) {
  try {
    const data = await adminTeacherService.resetMentorLiveSessions({
      adminUser: req.user,
      targetUserId: req.params.userId,
      reason: req.body.reason
    });
    return res.json({ success: true, data, message: 'Mentor live sessions reset successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listTeachers,
  getTeacherDetails,
  updateTeacherApplicationStatus,
  updateTeacherVerificationStatus,
  resetMentorLiveSessions
};
