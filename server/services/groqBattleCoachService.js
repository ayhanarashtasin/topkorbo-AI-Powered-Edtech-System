const Groq = require('groq-sdk');

const DEFAULT_COACH_REPORT = {
  summary: 'Battle coach is temporarily unavailable, but your result is safe. Review the questions you missed and retry the weak chapters.',
  strengths: ['Completed the battle and built useful practice data.'],
  weaknesses: ['Could not generate a detailed weak-area breakdown right now.'],
  speedAccuracy: 'Compare your response time with correctness: fast wrong answers need slower checking, while slow correct answers need timed practice.',
  mistakePatterns: ['Review wrong answers and any negative-marking losses.'],
  practiceActions: [
    'Revise the chapters connected to wrong answers.',
    'Redo similar MCQs with a timer.',
    'Practice accuracy first, then reduce response time.'
  ],
  motivation: 'Good battle. Use this result as a map for the next round.'
};

const COACH_SCHEMA_KEYS = [
  'summary',
  'strengths',
  'weaknesses',
  'speedAccuracy',
  'mistakePatterns',
  'practiceActions',
  'motivation'
];

const truncate = (value, maxLength = 1200) => String(value || '').slice(0, maxLength);

const sanitizeStringArray = (value, fallback) => {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => truncate(item, 220)).filter(Boolean).slice(0, 6);
};

const normalizeCoachReport = (report) => ({
  summary: truncate(report?.summary, 500) || DEFAULT_COACH_REPORT.summary,
  strengths: sanitizeStringArray(report?.strengths, DEFAULT_COACH_REPORT.strengths),
  weaknesses: sanitizeStringArray(report?.weaknesses, DEFAULT_COACH_REPORT.weaknesses),
  speedAccuracy: truncate(report?.speedAccuracy, 500) || DEFAULT_COACH_REPORT.speedAccuracy,
  mistakePatterns: sanitizeStringArray(report?.mistakePatterns, DEFAULT_COACH_REPORT.mistakePatterns),
  practiceActions: sanitizeStringArray(report?.practiceActions, DEFAULT_COACH_REPORT.practiceActions).slice(0, 5),
  motivation: truncate(report?.motivation, 280) || DEFAULT_COACH_REPORT.motivation
});

const extractJson = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  return JSON.parse(candidate.slice(start, end + 1));
};

const buildSystemPrompt = () => (
  'You are an expert Bangladeshi admission-test study coach. Analyze battle performance with practical, concise, student-friendly advice. ' +
  'Focus on accuracy, response time, weak chapters, and next practice steps. Be encouraging but specific. Do not invent data that is not provided.'
);

const buildUserPrompt = (battleSummary) => (
  `Return ONLY valid JSON with exactly these keys: ${COACH_SCHEMA_KEYS.join(', ')}. ` +
  'strengths, weaknesses, mistakePatterns, and practiceActions must be arrays of short strings. practiceActions must have 3 to 5 items.\n\n' +
  `Battle summary JSON:\n${JSON.stringify(battleSummary)}`
);

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
};

const generateBattleCoachReport = async (battleSummary) => {
  const groq = getGroqClient();
  if (!groq) {
    return {
      report: DEFAULT_COACH_REPORT,
      fallback: true,
      reason: 'GROQ_API_KEY is not configured'
    };
  }

  const model = process.env.GROQ_MODEL || process.env.LLM_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(battleSummary) }
      ],
      temperature: 0.35,
      max_tokens: 1200
    });

    const text = completion?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(text);

    return {
      report: normalizeCoachReport(parsed),
      fallback: !parsed
    };
  } catch (err) {
    console.error('Groq battle coach failed:', err.message);
    return {
      report: DEFAULT_COACH_REPORT,
      fallback: true,
      reason: 'AI generation failed'
    };
  }
};

module.exports = {
  DEFAULT_COACH_REPORT,
  generateBattleCoachReport,
  normalizeCoachReport
};
