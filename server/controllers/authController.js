const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TeacherApplication = require('../models/TeacherApplication');

const authController = {
  /**
   * GET /api/auth/google
   * Redirect to Google sign in / sign up
   */
  googleAuth: (req, res, next) => {
    const role = req.query.role || 'student';
    const action = req.query.action || 'signup'; // 'signup' or 'login'

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: JSON.stringify({ role, action })
    })(req, res, next);
  },

  /**
   * GET /api/auth/google/callback
   * Google auth callback handler
   */
  googleCallback: (req, res, next) => {
    const frontendUrl = process.env.FRONTEND_URL || (
      process.env.NODE_ENV === 'production'
        ? '/'
        : 'http://localhost:5173'
    );

    passport.authenticate('google', { session: false }, async (err, user, info) => {
      if (err) {
        return res.redirect(`${frontendUrl}?error=${encodeURIComponent(err.message || 'auth_failed')}`);
      }

      if (!user) {
        if (info && info.message === 'signup_required' && info.profile) {
          const profile = info.profile;
          const name = encodeURIComponent(profile.displayName || '');
          const email = encodeURIComponent(profile.emails[0]?.value || '');
          const avatar = encodeURIComponent(profile.photos[0]?.value || '');
          return res.redirect(`${frontendUrl}?signupRequired=true&name=${name}&email=${email}&avatar=${avatar}`);
        }
        return res.redirect(`${frontendUrl}?error=auth_failed`);
      }

      // Check if the user has completed their profile
      const isComplete = (user.role === 'tutor' || user.role === 'teacher') ? !!user.universityName : !!user.collegeName;

      // Generate a JWT token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || '24241122',
        { expiresIn: '60d' }
      );

      // Clean up massive Base64 strings from URL parameter
      const avatarUrl = user.avatar && user.avatar.startsWith('data:image')
        ? ''
        : user.avatar || '';

      res.redirect(`${frontendUrl}?token=${token}&role=${user.role}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&avatar=${encodeURIComponent(avatarUrl)}&isComplete=${isComplete}`);
    })(req, res, next);
  },

  /**
   * POST /api/auth/profile
   * Save/Complete Profile details (Student or Mentor)
   */
  completeProfile: async (req, res, next) => {
    try {
      if (req.user.role === 'tutor' || req.user.role === 'teacher') {
        const {
          name,
          dob,
          gender,
          studentIdNumber,
          studentIdCardPhoto,
          interestedToGuide,
          collegeName,
          hscBatch,
          universityName,
          department,
          currentYearSemester,
          admissionAchievement,
          avatar
        } = req.body;

        // STRICT VALIDATION
        if (!name || !name.trim()) {
          return res.status(400).json({ success: false, message: 'Full Name is required.' });
        }
        if (!studentIdNumber || !studentIdNumber.trim()) {
          return res.status(400).json({ success: false, message: 'Student ID Number is required.' });
        }
        if (!studentIdCardPhoto || !studentIdCardPhoto.trim()) {
          return res.status(400).json({ success: false, message: 'Student ID Photo upload is required.' });
        }
        if (!interestedToGuide || !Array.isArray(interestedToGuide) || interestedToGuide.length === 0) {
          return res.status(400).json({ success: false, message: 'Interested to Guide selection is required.' });
        }
        if (!collegeName || !collegeName.trim()) {
          return res.status(400).json({ success: false, message: 'College Name is required.' });
        }
        if (!hscBatch) {
          return res.status(400).json({ success: false, message: 'HSC Batch is required.' });
        }
        if (!universityName || !universityName.trim()) {
          return res.status(400).json({ success: false, message: 'University Name is required.' });
        }
        if (!department || !department.trim()) {
          return res.status(400).json({ success: false, message: 'Department Name is required.' });
        }
        if (!currentYearSemester || !currentYearSemester.trim()) {
          return res.status(400).json({ success: false, message: 'Current Year/Semester is required.' });
        }
        if (!admissionAchievement || !admissionAchievement.trim()) {
          return res.status(400).json({ success: false, message: 'Admission Achievement description is required.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
          req.user.id,
          {
            name,
            dob,
            gender,
            studentIdNumber,
            studentIdCardPhoto,
            interestedToGuide,
            collegeName,
            hscBatch,
            universityName,
            department,
            currentYearSemester,
            admissionAchievement,
            avatar
          },
          { new: true, runValidators: true }
        );

        if (!updatedUser) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({
          success: true,
          message: 'Mentor profile updated successfully ✨',
          data: updatedUser
        });
      }

      // Otherwise student role
      const {
        name,
        collegeName,
        hscBatch,
        stream,
        academicStatus,
        medium,
        district,
        division,
        areaName,
        aspirations,
        avatar,
        dob,
        gender,
        optionalSubject
      } = req.body;

      // STRICT VALIDATION
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Full Name is required.' });
      }
      if (!collegeName || !collegeName.trim()) {
        return res.status(400).json({ success: false, message: 'College Name is required.' });
      }
      if (!hscBatch) {
        return res.status(400).json({ success: false, message: 'HSC Batch selection is required.' });
      }
      if (!stream) {
        return res.status(400).json({ success: false, message: 'Group / Stream selection is required.' });
      }
      if (!academicStatus) {
        return res.status(400).json({ success: false, message: 'Academic Status selection is required.' });
      }
      if (!medium) {
        return res.status(400).json({ success: false, message: 'Version / Medium selection is required.' });
      }
      if (!district || !district.trim()) {
        return res.status(400).json({ success: false, message: 'District is required.' });
      }
      if (!division || !division.trim()) {
        return res.status(400).json({ success: false, message: 'Division is required.' });
      }
      if (!areaName || !areaName.trim()) {
        return res.status(400).json({ success: false, message: 'Area Name is required.' });
      }
      if (!aspirations || !Array.isArray(aspirations) || aspirations.length === 0) {
        return res.status(400).json({ success: false, message: 'Please select at least one Aspiration / Goal.' });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        {
          name,
          collegeName,
          hscBatch,
          stream,
          academicStatus,
          medium,
          district,
          division,
          areaName,
          aspirations,
          avatar,
          dob,
          gender,
          optionalSubject
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({
        success: true,
        message: 'Student profile updated successfully ✨',
        data: updatedUser
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/verify-phone
   * Verify and save phone number
   */
  verifyPhone: async (req, res, next) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber || !phoneNumber.trim()) {
        return res.status(400).json({ success: false, message: 'Phone number is required.' });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { phoneNumber },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({
        success: true,
        message: 'Phone number verified successfully! 📱',
        data: updatedUser
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/auth/me
   * Get current authenticated user details
   */
  getMe: async (req, res, next) => {
    try {
      // Exclude the large base64 studentIdCardPhoto field — it's ~200KB+ and the
      // frontend never needs it here.  This alone cuts query time from ~1s to ~40ms.
      const userQuery = User.findById(req.user.id).select('-studentIdCardPhoto');
      const isEligibleForTeacherApp = req.user.role === 'tutor' || req.user.role === 'teacher';

      // Run user + teacher-application queries in parallel instead of sequentially
      const [user, teacherApplication] = await Promise.all([
        userQuery,
        isEligibleForTeacherApp
          ? TeacherApplication.findOne({ userId: req.user.id }).lean()
          : Promise.resolve(null)
      ]);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Automatically promote user role to 'teacher' if their TeacherApplication is approved
      if (user.role === 'tutor' && teacherApplication && teacherApplication.status === 'approved') {
        user.role = 'teacher';
        await user.save();
      }

      const response = { success: true, data: user };
      if (teacherApplication) {
        response.teacherApplication = teacherApplication;
      }
      res.json(response);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/auth/teacher-application
   * Get tutor's teacher application details
   */
  getTeacherApplication: async (req, res, next) => {
    try {
      if (req.user.role !== 'tutor' && req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: 'Access denied. Only mentors can apply to be teachers.' });
      }
      const application = await TeacherApplication.findOne({ userId: req.user.id });
      if (!application) {
        return res.json({ success: true, exists: false });
      }
      res.json({ success: true, exists: true, data: application });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/teacher-apply
   * Submit or update teacher application
   */
  applyTeacher: async (req, res, next) => {
    try {
      if (req.user.role !== 'tutor' && req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: 'Access denied. Only mentors can apply to be teachers.' });
      }
      const {
        checkScript,
        checkScriptDetails,
        createQuestionBank,
        createQuestionBankSubjects,
        manageContest,
        manageContestDetails,
        aboutYou
      } = req.body;

      if (!aboutYou || !aboutYou.trim()) {
        return res.status(400).json({ success: false, message: 'The about you box is required so our admin can evaluate.' });
      }
      if (aboutYou.trim().length < 20) {
        return res.status(400).json({ success: false, message: 'Please write at least 20 characters about yourself.' });
      }

      const application = await TeacherApplication.findOneAndUpdate(
        { userId: req.user.id },
        {
          checkScript: !!checkScript,
          checkScriptDetails: checkScriptDetails || '',
          createQuestionBank: !!createQuestionBank,
          createQuestionBankSubjects: createQuestionBankSubjects || [],
          manageContest: !!manageContest,
          manageContestDetails: manageContestDetails || '',
          aboutYou: aboutYou.trim(),
          status: 'pending' // Reset to pending if resubmitted
        },
        { new: true, upsert: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Application submitted successfully! 🎓',
        data: application
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = authController;
