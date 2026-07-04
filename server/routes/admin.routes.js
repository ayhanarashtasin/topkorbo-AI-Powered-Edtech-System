const express = require('express');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const dashboardController = require('../controllers/admin/dashboardController');
const sessionController = require('../controllers/admin/sessionController');
const userManagementController = require('../controllers/admin/userManagementController');
const teacherManagementController = require('../controllers/admin/teacherManagementController');
const auditLogController = require('../controllers/admin/auditLogController');

const router = express.Router();

router.use(auth, requireAdmin);

router.get('/session', sessionController.getAdminSession);
router.get('/dashboard/stats', dashboardController.getDashboardStats);
router.get('/users', userManagementController.listUsers);
router.get('/users/:userId', userManagementController.getUserDetails);
router.patch('/users/:userId/role', userManagementController.updateUserRole);
router.patch('/users/:userId/status', userManagementController.updateUserStatus);
router.get('/teachers', teacherManagementController.listTeachers);
router.get('/teachers/:userId', teacherManagementController.getTeacherDetails);
router.patch('/teachers/:userId/application', teacherManagementController.updateTeacherApplicationStatus);
router.patch('/teachers/:userId/verification', teacherManagementController.updateTeacherVerificationStatus);
router.get('/audit-logs', auditLogController.getAuditLogs);

module.exports = router;
