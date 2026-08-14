export const DURATION_OPTIONS = [
  {
    id: '1month',
    label: 'Monthly',
    badge: null,
    saveText: null,
    pro: { planId: 'pro', effectiveMonthly: 150, totalPrice: 150 },
    proPlus: { planId: 'pro_plus', effectiveMonthly: 250, totalPrice: 250 }
  },
  {
    id: 'yearly',
    label: 'Yearly',
    badge: 'Best Value 🌟',
    highlight: true,
    saveText: 'Save up to 53%',
    pro: { planId: 'pro_yearly', effectiveMonthly: 70, totalPrice: 840, saveAmount: 960 },
    proPlus: { planId: 'pro_plus_yearly', effectiveMonthly: 110, totalPrice: 1320, saveAmount: 1680 }
  }
];

export const BASE_FEATURES_FREE = [
  { text: '5 question-bank exams', included: true },
  { text: '5 mock tests', included: true },
  { text: '3 battle rooms', included: true },
  { text: 'AI features (limited)', included: true },
  { text: 'Read up to 2 books', included: true },
  { text: 'Reading tools (pen / highlighter / notes)', included: false },
  { text: 'Reading AI (summarize / chat / mind-map)', included: false }
];

export const BASE_FEATURES_PRO = [
  { text: 'Unlimited question-bank exams', included: true },
  { text: 'Unlimited mock tests', included: true },
  { text: 'Unlimited battle rooms', included: true },
  { text: 'Unlimited AI features', included: true },
  { text: 'Read unlimited books', included: true },
  { text: 'Reading tools (pen / highlighter / notes)', included: false },
  { text: 'Reading AI (summarize / chat / mind-map)', included: false }
];

export const BASE_FEATURES_PRO_PLUS = [
  { text: 'Unlimited question-bank exams', included: true },
  { text: 'Unlimited mock tests', included: true },
  { text: 'Unlimited battle rooms', included: true },
  { text: 'Unlimited AI features', included: true },
  { text: 'Read unlimited books', included: true },
  { text: 'Reading tools (pen / highlighter / notes)', included: true },
  { text: 'Reading AI (summarize / chat / mind-map)', included: true }
];

export const COMPARISON_FEATURES = [
  { name: 'Question Bank', free: '5', pro: 'Unlimited', proPlus: 'Unlimited' },
  { name: 'Mock Tests', free: '5', pro: 'Unlimited', proPlus: 'Unlimited' },
  { name: 'Battle Rooms', free: '3', pro: 'Unlimited', proPlus: 'Unlimited' },
  { name: 'AI Mentor', free: 'Limited', pro: 'Unlimited', proPlus: 'Unlimited' },
  { name: 'AI Study Planner', free: 'Limited', pro: 'Unlimited', proPlus: 'Unlimited' },
  { name: 'Books', free: 'Up to 2', pro: 'Unlimited', proPlus: 'Unlimited' },
  { name: 'Reading Tools', free: '-', pro: '-', proPlus: 'Included' },
  { name: 'Reading AI', free: '-', pro: '-', proPlus: 'Included' },
  { name: 'Personalized Routine', free: '-', pro: 'Included', proPlus: 'Included' },
  { name: 'Progress Tracking', free: 'Included', pro: 'Advanced', proPlus: 'Advanced' },
  { name: 'Advanced Analytics', free: '-', pro: 'Included', proPlus: 'Included' },
];
