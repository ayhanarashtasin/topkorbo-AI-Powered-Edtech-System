const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TeacherApplication = require('../models/TeacherApplication');
const planService = require('../services/planService');
const { recordLoginAttempt } = require('../services/loginHistoryService');
const {
  resolveAccountStatus,
  reactivateExpiredBan
} = require('../services/accountStatusService');

const GUEST_ROLE_CONFIG = {
  student: {
    role: 'student',
    name: 'Guest Student',
    email: 'guest.student@topkorbo.local',
    googleId: 'topkorbo-guest-student',
    profile: {
      collegeName: 'TopKorbo Demo College',
      hscBatch: '2026',
      stream: 'Science',
      academicStatus: 'HSC 2nd Year',
      medium: 'Bangla Medium',
      district: 'Dhaka',
      division: 'Dhaka',
      areaName: 'Demo Area',
      aspirations: ['Engineering', 'University']
    }
  },
  mentor: {
    role: 'tutor',
    name: 'Guest Mentor',
    email: 'guest.mentor@topkorbo.local',
    googleId: 'topkorbo-guest-mentor',
    profile: {
      collegeName: 'TopKorbo Demo College',
      hscBatch: '2024',
      studentIdNumber: 'GUEST-MENTOR-001',
      interestedToGuide: ['Engineering', 'Academic'],
      universityName: 'Demo University',
      department: 'Computer Science',
      currentYearSemester: '3rd Year',
      admissionAchievement: 'Demo mentor account for hackathon judges.'
    }
  },
  tutor: {
    role: 'teacher',
    forumRole: 'user',
    name: 'Guest Tutor',
    email: 'guest.tutor@topkorbo.local',
    googleId: 'topkorbo-guest-tutor',
    profile: {
      collegeName: 'TopKorbo Demo College',
      hscBatch: '2022',
      studentIdNumber: 'GUEST-TUTOR-001',
      interestedToGuide: ['IELTS', 'University', 'Academic'],
      ieltsScore: '8.0',
      universityName: 'Demo University',
      department: 'English',
      currentYearSemester: 'Graduate',
      admissionAchievement: 'Demo approved tutor account for hackathon judges.'
    }
  },
  admin: {
    role: 'student',
    forumRole: 'admin',
    name: 'Guest Admin',
    email: 'guest.admin@topkorbo.local',
    googleId: 'topkorbo-guest-admin',
    profile: {
      collegeName: 'TopKorbo Demo Admin College',
      hscBatch: '2026',
      stream: 'Science',
      academicStatus: 'HSC 2nd Year',
      medium: 'Bangla Medium',
      district: 'Dhaka',
      division: 'Dhaka',
      areaName: 'Admin Demo Area',
      aspirations: ['Engineering']
    }
  }
};

function getGuestConfig(guestType) {
  const normalizedType = String(guestType || '').toLowerCase();
  return {
    guestType: GUEST_ROLE_CONFIG[normalizedType] ? normalizedType : 'student',
    config: GUEST_ROLE_CONFIG[normalizedType] || GUEST_ROLE_CONFIG.student
  };
}

function buildAuthPayload(user, { isGuest = false } = {}) {
  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      forumRole: user.forumRole || 'user'
    },
    process.env.JWT_SECRET,
    { expiresIn: '60d' }
  );

  return {
    token,
    role: user.role,
    forumRole: user.forumRole || 'user',
    name: user.name,
    email: user.email,
    avatar: user.avatar || '',
    isComplete: true,
    isGuest
  };
}

function buildFrontendRedirect(frontendUrl, path, params = {}) {
  const base = String(frontendUrl || '').replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const query = new URLSearchParams(params).toString();
  return `${base}${normalizedPath}${query ? `?${query}` : ''}`;
}

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
   * POST /api/auth/guest
   * Temporary hackathon demo login. Creates/reuses role-specific guest users
   * with Pro+ access so judges can explore without Google OAuth.
   */
  guestLogin: async (req, res, next) => {
    try {
      const { guestType, config } = getGuestConfig(req.body?.guestType || req.body?.role);
      if (process.env.ENABLE_GUEST_LOGIN === 'false') {
        return res.status(404).json({ success: false, message: 'Guest login is disabled.' });
      }
      const guestAdminEnabled = process.env.ENABLE_GUEST_ADMIN !== 'false';
      if (guestType === 'admin' && !guestAdminEnabled) {
        return res.status(403).json({
          success: false,
          message: 'The demo administrator account is disabled.'
        });
      }
      const guestAccessExpiresAt = new Date('2099-12-31T23:59:59.000Z');

      const user = await User.findOneAndUpdate(
        { email: config.email },
        {
          $set: {
            googleId: config.googleId,
            name: config.name,
            email: config.email,
            avatar: '',
            role: config.role,
            forumRole: config.forumRole || 'user',
            accountStatus: 'active',
            isBanned: false,
            plan: config.role === 'tutor' ? 'mentor_pro' : 'pro_plus',
            planExpiresAt: guestAccessExpiresAt,
            planIsTrial: false,
            ...config.profile
          },
          $setOnInsert: {
            usage: {
              qbankExams: 0,
              mockTests: 0,
              battleRooms: 0,
              aiActions: 0
            }
          }
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );

      await recordLoginAttempt({
        req,
        user,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Guest login ready.',
        data: {
          ...buildAuthPayload(user, { isGuest: true }),
          guestType
        }
      });
    } catch (err) {
      next(err);
    }
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
        await recordLoginAttempt({
          req,
          status: 'failure',
          failureReason: err.message || 'google_auth_error'
        });
        return res.redirect(`${frontendUrl}?error=${encodeURIComponent(err.message || 'auth_failed')}`);
      }

      if (!user) {
        if (info?.message === 'registration_disabled') {
          await recordLoginAttempt({
            req,
            status: 'failure',
            failureReason: 'registration_disabled',
            email: info?.profile?.emails?.[0]?.value || ''
          });
          return res.redirect(buildFrontendRedirect(frontendUrl, '/signup', {
            error: 'registration_disabled'
          }));
        }

        if (info && info.message === 'signup_required' && info.profile) {
          await recordLoginAttempt({
            req,
            status: 'failure',
            failureReason: 'signup_required',
            email: info.profile.emails?.[0]?.value || ''
          });
          const profile = info.profile;
          return res.redirect(buildFrontendRedirect(frontendUrl, '/signup', {
            signupRequired: 'true',
            name: profile.displayName || '',
            email: profile.emails[0]?.value || '',
            avatar: profile.photos[0]?.value || ''
          }));
        }
        await recordLoginAttempt({
          req,
          status: 'failure',
          failureReason: info?.message || 'auth_failed'
        });
        return res.redirect(`${frontendUrl}?error=auth_failed`);
      }

      user = await reactivateExpiredBan(user);
      const accountStatus = resolveAccountStatus(user);
      if (accountStatus !== 'active') {
        const reason = user.statusReason || user.banReason || '';
        await recordLoginAttempt({
          req,
          user,
          status: 'failure',
          failureReason: accountStatus
        });
        return res.redirect(buildFrontendRedirect(frontendUrl, '/signup', {
          error: accountStatus,
          reason
        }));
      }

      // Check if the user has completed their profile
      let isComplete = (user.role === 'tutor' || user.role === 'teacher') ? !!user.universityName : !!user.collegeName;
      if (!isComplete && (user.role === 'tutor' || user.role === 'teacher')) {
        const IeltsTeacher = require('../models/IeltsTeacher');
        const ieltsRecord = await IeltsTeacher.findOne({ userId: user._id });
        if (ieltsRecord && ieltsRecord.universityName) {
          isComplete = true;
        }
      }

      const authPayload = buildAuthPayload(user);

      // Clean up massive Base64 strings from URL parameter
      const avatarUrl = user.avatar && user.avatar.startsWith('data:image')
        ? ''
        : user.avatar || '';

      await recordLoginAttempt({
        req,
        user,
        status: 'success'
      });

      res.redirect(
        `${frontendUrl}?token=${authPayload.token}` +
        `&role=${user.role}` +
        `&forumRole=${encodeURIComponent(user.forumRole || 'user')}` +
        `&name=${encodeURIComponent(user.name)}` +
        `&email=${encodeURIComponent(user.email)}` +
        `&avatar=${encodeURIComponent(avatarUrl)}` +
        `&isComplete=${isComplete}`
      );
    })(req, res, next);
  },

  /**
   * POST /api/auth/profile
   * Save/Complete Profile details (Student or Mentor)
   */
  completeProfile: async (req, res, next) => {
    try {
      if (req.user.role === 'tutor' || req.user.role === 'teacher') {
        const existingUser = await User.findById(req.user.id);
        if (!existingUser) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        const {
          name,
          dob,
          gender,
          studentIdNumber,
          studentIdCardPhoto,
          nidPhoto,
          ieltsScore,
          ieltsTrf,
          interestedToGuide,
          collegeName,
          hscBatch,
          universityName,
          department,
          currentYearSemester,
          admissionAchievement,
          avatar
        } = req.body;

        const IeltsTeacher = require('../models/IeltsTeacher');
        const existingIelts = await IeltsTeacher.findOne({ userId: req.user.id });

        const finalStudentIdCardPhoto = studentIdCardPhoto || existingUser.studentIdCardPhoto || (existingIelts ? existingIelts.studentIdCardPhoto : '');
        const finalNidPhoto = nidPhoto || existingUser.nidPhoto || (existingIelts ? existingIelts.nidPhoto : '');
        const finalIeltsTrf = ieltsTrf || existingUser.ieltsTrf || (existingIelts ? existingIelts.ieltsTrf : '');

        // STRICT VALIDATION
        if (!name || !name.trim()) {
          return res.status(400).json({ success: false, message: 'Full Name is required.' });
        }
        if (!studentIdNumber || !studentIdNumber.trim()) {
          return res.status(400).json({ success: false, message: 'Student ID Number is required.' });
        }
        if (!finalStudentIdCardPhoto || !finalStudentIdCardPhoto.trim()) {
          return res.status(400).json({ success: false, message: 'Student ID Photo upload is required.' });
        }
        if (!interestedToGuide || !Array.isArray(interestedToGuide) || interestedToGuide.length === 0) {
          return res.status(400).json({ success: false, message: 'Interested to Guide selection is required.' });
        }

        // Conditional validation for IELTS
        if (interestedToGuide.includes('IELTS')) {
          if (!ieltsScore || !ieltsScore.trim()) {
            return res.status(400).json({ success: false, message: 'IELTS Score is required.' });
          }
          if (!finalIeltsTrf || !finalIeltsTrf.trim()) {
            return res.status(400).json({ success: false, message: 'IELTS TRF PDF upload is required.' });
          }
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

        const hasIelts = interestedToGuide.includes('IELTS');
        const hasOthers = interestedToGuide.some(area => area !== 'IELTS');

        if (hasIelts) {
          await IeltsTeacher.findOneAndUpdate(
            { userId: req.user.id },
            {
              userId: req.user.id,
              name,
              email: req.user.email || existingUser.email,
              studentIdNumber,
              studentIdCardPhoto: finalStudentIdCardPhoto,
              nidPhoto: finalNidPhoto,
              ieltsScore,
              ieltsTrf: finalIeltsTrf,
              collegeName,
              hscBatch,
              universityName,
              department,
              currentYearSemester,
              admissionAchievement,
              avatar,
              dob,
              gender
            },
            { upsert: true, new: true }
          );
        } else {
          await IeltsTeacher.deleteOne({ userId: req.user.id });
        }

        let userUpdatePayload = {
          name,
          dob,
          gender,
          avatar
        };

        if (hasOthers) {
          userUpdatePayload = {
            ...userUpdatePayload,
            studentIdNumber,
            studentIdCardPhoto: finalStudentIdCardPhoto,
            nidPhoto: finalNidPhoto,
            ieltsScore: hasIelts ? ieltsScore : '',
            ieltsTrf: hasIelts ? finalIeltsTrf : '',
            interestedToGuide,
            collegeName,
            hscBatch,
            universityName,
            department,
            currentYearSemester,
            admissionAchievement
          };
        } else {
          // Clear tutor fields in User model so they are only stored in IeltsTeacher model
          userUpdatePayload = {
            ...userUpdatePayload,
            studentIdNumber: '',
            studentIdCardPhoto: '',
            nidPhoto: '',
            ieltsScore: '',
            ieltsTrf: '',
            interestedToGuide: ['IELTS'],
            collegeName: '',
            hscBatch: '',
            universityName: '',
            department: '',
            currentYearSemester: '',
            admissionAchievement: ''
          };
        }

        const updatedUser = await User.findByIdAndUpdate(
          req.user.id,
          userUpdatePayload,
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
      const userQuery = User.findById(req.user.id).select('-studentIdCardPhoto -nidPhoto -ieltsTrf');
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

      // Lazily downgrade an expired paid plan back to free (monthly recurring).
      if (user.plan && user.plan !== 'free' && planService.getEffectivePlan(user) === 'free') {
        user.plan = 'free';
        user.planExpiresAt = null;
        user.planIsTrial = false;
        await user.save();
      }

      let userData = user.toObject();
      if (user.role === 'tutor' || user.role === 'teacher') {
        const IeltsTeacher = require('../models/IeltsTeacher');
        const ieltsRecord = await IeltsTeacher.findOne({ userId: user._id }).select('-studentIdCardPhoto -nidPhoto -ieltsTrf').lean();
        if (ieltsRecord) {
          if (!user.universityName || (user.interestedToGuide.length === 1 && user.interestedToGuide[0] === 'IELTS')) {
            userData = {
              ...userData,
              studentIdNumber: ieltsRecord.studentIdNumber,
              collegeName: ieltsRecord.collegeName,
              hscBatch: ieltsRecord.hscBatch,
              universityName: ieltsRecord.universityName,
              department: ieltsRecord.department,
              currentYearSemester: ieltsRecord.currentYearSemester,
              admissionAchievement: ieltsRecord.admissionAchievement,
              interestedToGuide: ['IELTS'],
              ieltsScore: ieltsRecord.ieltsScore
            };
          }
        }
      }

      const response = { success: true, data: userData };
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
        takeIeltsSpeaking,
        takeIeltsSpeakingDetails,
        createIeltsQSet,
        createIeltsQSetDetails,
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
          takeIeltsSpeaking: !!takeIeltsSpeaking,
          takeIeltsSpeakingDetails: takeIeltsSpeakingDetails || '',
          createIeltsQSet: !!createIeltsQSet,
          createIeltsQSetDetails: createIeltsQSetDetails || '',
          aboutYou: aboutYou.trim(),
          status: 'pending',
          reviewStage: 'pending',
          adminNote: '',
          reviewReason: '',
          reviewedBy: null,
          reviewedAt: null
        },
        { new: true, upsert: true, runValidators: true }
      );

      application.reviewHistory = Array.isArray(application.reviewHistory) ? application.reviewHistory : [];
      application.reviewHistory.push({
        action: 'submitted',
        previousStatus: application.status,
        nextStatus: 'pending',
        note: 'Application submitted by teacher.',
        actedAt: new Date()
      });
      await application.save();

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
