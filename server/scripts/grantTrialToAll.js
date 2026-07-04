/**
 * One-off migration: grant EVERY existing user a 5-day Pro+ trial.
 *
 * Run once from the `server` directory:
 *     node scripts/grantTrialToAll.js
 *
 * Safe / idempotent:
 *  - Nobody loses access. Users who already have a paid plan whose
 *    planExpiresAt is further out than 5 days keep their later expiry;
 *    we only bump their tier up to Pro+.
 *  - Everyone else is set to Pro+ expiring 5 days from when this runs and
 *    flagged planIsTrial so the UI can label it as a free trial.
 *
 * After the trial expires each user is lazily downgraded to free by
 * authController.getMe / planService.getEffectivePlan — no cron needed.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { TRIAL_PLAN, TRIAL_DURATION_DAYS, trialExpiresAt } = require('../config/plans');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/topkorbo';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB connected');

  const threshold = trialExpiresAt(); // now + TRIAL_DURATION_DAYS

  // Cohort A: no active plan or an expiry at/under the trial window.
  // Grant the full 5-day Pro+ trial and mark it as a trial.
  const granted = await User.updateMany(
    { $or: [{ planExpiresAt: null }, { planExpiresAt: { $lte: threshold } }] },
    { $set: { plan: TRIAL_PLAN, planExpiresAt: threshold, planIsTrial: true } }
  );

  // Cohort B: already have a paid plan lasting beyond the trial window.
  // Only lift the tier to Pro+; keep their (later) expiry and paid status.
  const upgraded = await User.updateMany(
    { planExpiresAt: { $gt: threshold } },
    { $set: { plan: TRIAL_PLAN } }
  );

  console.log(`Granted ${TRIAL_DURATION_DAYS}-day Pro+ trial to ${granted.modifiedCount} user(s).`);
  console.log(`Upgraded ${upgraded.modifiedCount} user(s) with longer paid access to Pro+ (expiry kept).`);
  console.log(`Trial expires at: ${threshold.toISOString()}`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
