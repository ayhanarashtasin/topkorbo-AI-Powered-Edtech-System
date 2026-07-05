const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { TRIAL_PLAN, trialExpiresAt } = require('./plans');

const requiredGoogleEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
const missingGoogleEnv = requiredGoogleEnv.filter((key) => !process.env[key]);

if (missingGoogleEnv.length > 0) {
  throw new Error(`Missing Google OAuth env vars: ${missingGoogleEnv.join(', ')}`);
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      // SECURITY: role is client-supplied via the OAuth `state` parameter and can
      // be forged. Only *self-service* roles may ever be assigned at signup.
      // Privileged roles ('teacher', 'admin') are server-owned and can only be
      // granted through the admin-approved promotion workflow (see
      // authController.getMe -> TeacherApplication, and admin routes). A 'tutor'
      // is an unprivileged applicant who becomes a 'teacher' only after approval.
      const SELF_SIGNUP_ROLES = new Set(['student', 'tutor']);

      let requestedRole = 'student';
      let action = 'signup';

      if (req.query.state) {
        try {
          const parsedState = JSON.parse(req.query.state);
          requestedRole = parsedState.role || 'student';
          action = parsedState.action || 'signup';
        } catch (e) {
          // If not valid JSON, treat it as the raw role string for backwards compatibility
          requestedRole = req.query.state;
        }
      }

      // Never trust a privileged role from the client. Fall back to 'student'.
      const role = SELF_SIGNUP_ROLES.has(requestedRole) ? requestedRole : 'student';
      
      const email = profile.emails[0].value;

      // Find user by email (most robust check)
      let user = await User.findOne({ email });

      if (action === 'login') {
        if (!user) {
          // If trying to login but account does not exist in DB, trigger signup required
          return done(null, false, { message: 'signup_required', profile });
        }

        // User exists! If googleId is not matched/set, let's link it
        if (!user.googleId) {
          user.googleId = profile.id;
          await user.save();
        }

        return done(null, user);
      } else {
        // action === 'signup'
        if (user) {
          // User already exists, treat as a login (idempotent)
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user);
        }

        // Create new user record. Every new signup starts on a free Pro+
        // trial that lazily downgrades to free once planExpiresAt passes.
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: email,
          avatar: profile.photos[0]?.value,
          role: role,
          plan: TRIAL_PLAN,
          planExpiresAt: trialExpiresAt(),
          planIsTrial: true
        });

        user.isNewUser = true;

        return done(null, user);
      }
    } catch (err) {
      return done(err, null);
    }
  }
));

module.exports = passport;
