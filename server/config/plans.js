/**
 * Subscription plan definitions — the single source of truth for tier limits
 * and feature flags. Consumed by services/planService.js and middleware/requirePlan.js.
 *
 * Pricing: Free 0tk · Pro 150tk · Pro+ 250tk (monthly recurring for paid plans).
 *
 * `limits`  — lifetime usage caps for a counter key. An OMITTED key means
 *             "unlimited" for that plan (see planService.assertWithinLimit).
 * `readingBooks` — max distinct books a user may open (Infinity = unlimited).
 * `readingTools` — pen / highlighter / highlight-notes access.
 * `readingAI`    — book summarize / book chat / mind-map access.
 */
const PLANS = {
  free: {
    price: 0,
    limits: { qbankExams: 5, mockTests: 5, battleRooms: 3, aiActions: 20 },
    readingBooks: 2,
    readingTools: false,
    readingAI: false
  },
  pro: {
    price: 150,
    limits: {}, // no counter limits — unlimited exams / mock tests / battles / AI
    readingBooks: Infinity,
    readingTools: false,
    readingAI: false
  },
  pro_plus: {
    price: 250,
    limits: {},
    readingBooks: Infinity,
    readingTools: true,
    readingAI: true
  },
  mentor_pro: {
    price: 1499,
    durationDays: 30,
    name: 'Mentor Pro 1 Month',
    limits: {},
    readingBooks: Infinity,
    readingTools: true,
    readingAI: true,
    mentorFeatures: true
  },
  mentor_3months: {
    price: 3897,
    durationDays: 90,
    name: 'Mentor Pro 3 Months',
    limits: {},
    readingBooks: Infinity,
    readingTools: true,
    readingAI: true,
    mentorFeatures: true
  },
  mentor_6months: {
    price: 5994,
    durationDays: 180,
    name: 'Mentor Pro 6 Months',
    limits: {},
    readingBooks: Infinity,
    readingTools: true,
    readingAI: true,
    mentorFeatures: true
  },
  mentor_yearly: {
    price: 8400,
    durationDays: 365,
    name: 'Mentor Pro 1 Year',
    limits: {},
    readingBooks: Infinity,
    readingTools: true,
    readingAI: true,
    mentorFeatures: true
  }
};

const PLAN_IDS = Object.keys(PLANS);

// Paid plans grant 30 days of access, then lazily revert to free.
const PLAN_DURATION_DAYS = 30;

// Every new signup gets this many days of Pro+ for free (a trial). When it
// expires the user is lazily downgraded to free, exactly like a paid plan.
const TRIAL_DURATION_DAYS = 5;
const TRIAL_PLAN = 'pro_plus';

function getPlanConfig(planId) {
  return PLANS[planId] || PLANS.free;
}

/** Absolute expiry Date for a fresh signup trial, `days` from now. */
function trialExpiresAt(days = TRIAL_DURATION_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

module.exports = {
  PLANS,
  PLAN_IDS,
  PLAN_DURATION_DAYS,
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN,
  getPlanConfig,
  trialExpiresAt
};
