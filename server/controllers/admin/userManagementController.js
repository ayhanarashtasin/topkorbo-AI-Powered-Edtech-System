const adminUserService = require('../../services/admin/adminUserService');

async function listUsers(req, res, next) {
  try {
    const data = await adminUserService.listUsers(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getUserDetails(req, res, next) {
  try {
    const data = await adminUserService.getUserDetails(req.params.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const data = await adminUserService.updateUserRole({
      adminUser: req.user,
      targetUserId: req.params.userId,
      nextRole: req.body.role,
      reason: req.body.reason,
      confirmSelfDowngrade: req.body.confirmSelfDowngrade
    });
    return res.json({ success: true, data, message: 'User role updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const data = await adminUserService.updateUserStatus({
      adminUser: req.user,
      targetUserId: req.params.userId,
      nextStatus: req.body.status,
      reason: req.body.reason
    });
    return res.json({ success: true, data, message: 'User account status updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const data = await adminUserService.deleteUser({
      adminUser: req.user,
      targetUserId: req.params.userId,
      reason: req.body.reason || 'Account deleted by administrator'
    });
    return res.json({ success: true, data, message: 'User account and all associated data deleted successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listUsers,
  getUserDetails,
  updateUserRole,
  updateUserStatus,
  deleteUser
};
