const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');
const authController = require('../controllers/authController');

// @desc    Auth with Google
// @route   GET /api/auth/google
router.get('/google', authLimiter, authController.googleAuth);

// @desc    Google auth callback
// @route   GET /api/auth/google/callback
router.get('/google/callback', authLimiter, authController.googleCallback);

// @desc    Save/Complete Profile details (Student or Mentor)
// @route   POST /api/auth/profile
router.post('/profile', auth, authController.completeProfile);

// @desc    Verify and save Phone Number
// @route   POST /api/auth/verify-phone
router.post('/verify-phone', auth, authController.verifyPhone);

// @desc    Get current user profile details
// @route   GET /api/auth/me
router.get('/me', auth, authController.getMe);

// @desc    Get tutor's teacher application details
// @route   GET /api/auth/teacher-application
router.get('/teacher-application', auth, authController.getTeacherApplication);

// @desc    Submit or update teacher application
// @route   POST /api/auth/teacher-apply
router.post('/teacher-apply', auth, authController.applyTeacher);

module.exports = router;
