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
  }
};

const PLAN_IDS = Object.keys(PLANS);

// Paid plans grant 30 days of access, then lazily revert to free.
const PLAN_DURATION_DAYS = 30;

function getPlanConfig(planId) {
  return PLANS[planId] || PLANS.free;
}

module.exports = { PLANS, PLAN_IDS, PLAN_DURATION_DAYS, getPlanConfig };
