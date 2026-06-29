const Groq = require('groq-sdk');
const ChatMessage = require('../models/ChatMessage');
const StudyRoutine = require('../models/StudyRoutine');
const { toISODate } = require('../utils/recurrence');

/**
 * Lazily construct the Groq client. We instantiate per-request because the
 * constructor is cheap and avoids a stale-key issue if `LLM_API_KEY` is
 * rotated at runtime via a hot reload.
 */
function getGroqClient() {
  // Accept either `LLM_API_KEY` (per our `.env.example`) or `GROQ_API_KEY`
  // (common shorthand for projects that only use Groq).
  const apiKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('LLM_API_KEY is not configured on the server');
    err.statusCode = 500;
    throw err;
  }
  return new Groq({ apiKey });
}

const DEFAULT_MODEL =
  process.env.LLM_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

// Cap how much context we forward so a single very dense page doesn't blow
// the LLM's context window or our request latency budget.
const MAX_PAGE_CHARS = 12_000;
// Roughly N turns of prior conversation; a turn is one user message + one
// assistant reply, so we fetch 2N messages.
const MAX_HISTORY_MESSAGES = 12;

function clampText(text, max = MAX_PAGE_CHARS) {
  if (!text) return '';
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const SYSTEM_PROMPT =
  "You are a helpful, knowledgeable tutor assisting a student who is " +
  'reading the page below. ' +
  '\n\n' +
  'How to answer:\n' +
  "1. Use the page as your PRIMARY source — quote, paraphrase, or build " +
  "directly on what the page says. Anchor your answer in the page's " +
  "vocabulary, examples, and structure so the student feels continuity " +
  "with what they are reading.\n" +
  "2. You ARE allowed — and encouraged — to go BEYOND the page when the " +
  "student asks for an explanation, definition, example, comparison, or " +
  "background. A student asking 'what is X in detail?' or 'explain X' " +
  "expects a full, useful answer, not just a pointer back to the page.\n" +
  "3. When you use information from outside the page, briefly connect it " +
  "back to the page (e.g. 'The page uses this term in the context of …').\n" +
  "4. Structure your reply with GitHub-Flavored Markdown:\n" +
  "   - Start with a one-line summary in bold.\n" +
  "   - Use ## headings to break sections (only when the answer has 3+ sections).\n" +
  "   - Use bullet/numbered lists for enumerations, steps, or feature lists.\n" +
  "   - Use **bold** for key terms on first use, *italic* for emphasis.\n" +
  "   - Use `inline code` for technical terms, file names, metric names (e.g. `DER`).\n" +
  "   - Avoid walls of text — break long answers into short paragraphs.\n" +
  "5. Keep answers focused (aim for 150-300 words unless the question " +
  "clearly needs more). Be student-friendly — define jargon the first " +
  "time you use it.\n" +
  "6. Do NOT wrap the whole reply in a single bullet list or code block. " +
  "Mix prose and lists naturally.";

function buildUserPrompt({ pageText, question }) {
  const ctx = clampText(pageText);
  return (
    (ctx ? 'Page the student is currently reading:\n"""' + '\n' + ctx + '\n' + '"""\n\n' : '') +
    `Question: ${question}`
  );
}

/**
 * POST /api/ai/chat
 * Body: { bookId, chapterId, pageNumber, question, pageText }
 * Auth: required.
 *
 * Persists the user's question, calls Groq with the prior history plus the
 * current page context, persists the assistant reply, and returns both.
 */
exports.chat = async (req, res, next) => {
  try {
    const { bookId, chapterId, pageNumber, question, pageText } = req.body || {};

    if (!bookId || !chapterId || !pageNumber || !question) {
      return res.status(400).json({
        success: false,
        message: 'bookId, chapterId, pageNumber, and question are required'
      });
    }

    const userId = req.user._id || req.user.id;
    const pageNum = Number(pageNumber);
    const cleanQuestion = String(question).trim();
    if (!cleanQuestion) {
      return res.status(400).json({ success: false, message: 'question cannot be empty' });
    }

    // 1. Persist the user turn first so it's part of history if the LLM call fails.
    const userMessage = await ChatMessage.create({
      userId,
      bookId,
      chapterId,
      pageNumber: pageNum,
      role: 'user',
      content: cleanQuestion
    });

    // Prior history is fetched *after* inserting the user turn so we can
    // exclude it from the LLM context. Only role+content is needed — the
    // LLM doesn't care about timestamps or refs.
    const priorHistory = await ChatMessage.find({
      userId,
      chapterId,
      pageNumber: pageNum,
      _id: { $ne: userMessage._id }
    })
      .select('role content')
      .sort({ createdAt: 1 })
      .limit(MAX_HISTORY_MESSAGES)
      .lean();

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const m of priorHistory) {
      messages.push({ role: m.role, content: m.content });
    }
    messages.push({
      role: 'user',
      content: buildUserPrompt({ pageText, question: cleanQuestion })
    });

    let reply;
    try {
      const groq = getGroqClient();
      const completion = await groq.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 900
      });
      reply = completion?.choices?.[0]?.message?.content?.trim();
    } catch (llmErr) {
      // Remove the user turn we optimistically inserted so the UI doesn't
      // look like it lost the question — but only if it was a transient LLM
      // failure. We log instead of deleting on auth/permission errors.
      console.error('[aiController] Groq call failed:', llmErr?.message);
      await ChatMessage.deleteOne({ _id: userMessage._id, userId }).catch(() => {});
      const status = llmErr?.statusCode || 502;
      return res.status(status).json({
        success: false,
        message: llmErr?.message || 'AI tutor is unavailable right now. Please try again.'
      });
    }

    if (!reply) {
      await ChatMessage.deleteOne({ _id: userMessage._id, userId }).catch(() => {});
      return res.status(502).json({
        success: false,
        message: 'AI tutor returned an empty response.'
      });
    }

    const assistantMessage = await ChatMessage.create({
      userId,
      bookId,
      chapterId,
      pageNumber: pageNum,
      role: 'assistant',
      content: reply
    });

    res.status(200).json({
      success: true,
      data: {
        reply,
        userMessage,
        assistantMessage
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ai/history?chapterId=...&pageNumber=...
 * Returns ordered chat history for the current user. `pageNumber` is
 * optional — omit to get the entire chapter's history.
 */
exports.getHistory = async (req, res, next) => {
  try {
    const { chapterId, pageNumber } = req.query;
    if (!chapterId) {
      return res.status(400).json({ success: false, message: 'chapterId is required' });
    }
    const filter = {
      userId: req.user._id || req.user.id,
      chapterId
    };
    if (pageNumber) filter.pageNumber = Number(pageNumber);

    const messages = await ChatMessage.find(filter).sort({ createdAt: 1 }).lean();
    res.status(200).json({
      success: true,
      data: { messages }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/ai/history?chapterId=...&pageNumber=...
 * Deletes the current user's chat history. With `pageNumber` it clears a
 * single page; without it, the entire chapter's history.
 */
exports.clearHistory = async (req, res, next) => {
  try {
    const { chapterId, pageNumber } = req.query;
    if (!chapterId) {
      return res.status(400).json({ success: false, message: 'chapterId is required' });
    }
    const filter = {
      userId: req.user._id || req.user.id,
      chapterId
    };
    if (pageNumber) filter.pageNumber = Number(pageNumber);

    const result = await ChatMessage.deleteMany(filter);
    res.status(200).json({
      success: true,
      data: { deletedCount: result.deletedCount || 0 }
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Extract Question → LaTeX
// ---------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

const EXTRACT_SYSTEM_PROMPT =
  'You are a careful, meticulous question formatter. ' +
  'A teacher will hand you either plain text describing a question, or an image of a ' +
  'question (handwritten or printed, possibly with diagrams). ' +
  'Your job is to extract a structured representation of the question and return it as JSON.\n\n' +
  'Rules:\n' +
  '1. Return ONLY a JSON object (no prose, no markdown fences). Shape:\n' +
  '   {\n' +
  '     "questionText": "<LaTeX of the full question stem, including any inline math like $x^2$ or $$\\int_0^1 f(x)\\,dx$$>",\n' +
  '     "options": [\n' +
  '       { "label": "A", "text": "<LaTeX>" },\n' +
  '       { "label": "B", "text": "<LaTeX>" },\n' +
  '       { "label": "C", "text": "<LaTeX>" },\n' +
  '       { "label": "D", "text": "<LaTeX>" }\n' +
  '     ],\n' +
  '     "correctOption": "A" | "B" | "C" | "D" | null,\n' +
  '     "solution": "<LaTeX of a worked solution, or empty string if no solution is shown>"\n' +
  '   }\n' +
  '2. Preserve EVERY detail from the original (numbers, units, subscripts, matrices, equations). ' +
  'Use proper LaTeX: \\frac{a}{b}, x^{2}, x_{i}, \\sqrt{x}, \\sum, \\int, \\vec{v}, etc. ' +
  'IMPORTANT: ALWAYS wrap ALL standalone variables (like n or x), mathematical expressions, matrices, and equations within $ (for inline math) or $$ (for display math). Do NOT leave variables or math as raw text.\n' +
  '3. IMPORTANT: You MUST aggressively search the image or text for Multiple Choice Options (typically A, B, C, D or 1, 2, 3, 4). Put these into the "options" array. DO NOT include the options in the "questionText" string. If the options are numbered 1, 2, 3, 4, map them to labels A, B, C, D respectively.\n' +
  '4. If the question has no options (short-answer / numerical / fill-in-the-blank), set ' +
  '"options": []. If you can identify the correct option from the source (e.g. it is ticked or ' +
  'circled in the image, or stated in the text), set "correctOption" to its label, otherwise null.\n' +
  '5. Never invent information that is not present in the source. If something is unreadable, ' +
  'write the closest plausible reading but keep it faithful.\n' +
  '6. Output ONLY the JSON object — no backticks, no "Here is the JSON:" preface, no trailing commentary.';

function buildExtractUserContent({ text, imageBase64, mimeType }) {
  const parts = [];
  if (imageBase64) {
    const safeMime = typeof mimeType === 'string' && mimeType.startsWith('image/')
      ? mimeType
      : 'image/png';
    parts.push({
      type: 'image_url',
      image_url: {
        // OpenAI-compatible multimodal format — Groq accepts the same shape.
        url: `data:${safeMime};base64,${imageBase64}`
      }
    });
  }
  const textPart = typeof text === 'string' && text.trim().length > 0
    ? text.trim()
    : 'Please extract the question from the attached image and return it as JSON.';
  parts.push({ type: 'text', text: textPart });
  return parts;
}

function safeParseJson(raw) {
  if (!raw) return null;
  let str = String(raw).trim();
  // Strip ```json ... ``` or ``` ... ``` fences if the model adds them despite
  // the instruction.
  str = str.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Take the substring from the first `{` to the last `}` so a stray leading
  // or trailing sentence doesn't kill the parse.
  const first = str.indexOf('{');
  const last = str.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    str = str.slice(first, last + 1);
  }
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

function normaliseExtracted(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const questionText = typeof obj.questionText === 'string' ? obj.questionText : '';
  const rawOptions = Array.isArray(obj.options) ? obj.options : [];
  const options = rawOptions
    .map((opt) => ({
      label: typeof opt?.label === 'string' ? opt.label.trim() : '',
      text: typeof opt?.text === 'string' ? opt.text : ''
    }))
    .filter((opt) => opt.label && opt.text);
  const correctOptionRaw = typeof obj.correctOption === 'string'
    ? obj.correctOption.trim().toUpperCase()
    : null;
  const validLabels = new Set(options.map((o) => o.label.toUpperCase()));
  const correctOption = correctOptionRaw && validLabels.has(correctOptionRaw)
    ? correctOptionRaw
    : null;
  const solution = typeof obj.solution === 'string' ? obj.solution : '';
  if (!questionText) return null;
  return { questionText, options, correctOption, solution };
}

// ---------------------------------------------------------------------------
// AI Study Routine Mentor
// ---------------------------------------------------------------------------

const MAX_ROUTINE_MESSAGES = 20;
const MAX_ROUTINE_MESSAGE_CHARS = 3000;

// Phase 1: Chat prompt — collects exam-specific information
const STUDY_ROUTINE_CHAT_PROMPT =
  'You are a friendly AI Study Mentor for HSC students in Bangladesh.\n\n' +
  'Your ONLY job is to gather information about the student through a short conversation.\n' +
  'You must NEVER generate a study routine or timetable yourself.\n\n' +
  'RULES:\n' +
  '- Ask 2-3 simple questions per message.\n' +
  '- NEVER repeat a question the student already answered. Read the conversation history carefully.\n' +
  '- Keep your tone friendly, short, and encouraging.\n' +
  '- Once you have gathered ENOUGH information, set "readyToGenerate" to true.\n\n' +
  'Information to gather:\n' +
  '1. HSC year (1st or 2nd) and stream (Science/Business/Humanities)\n' +
  '2. Exam name and approximate exam date\n' +
  '3. Subjects they need to study, with paper names (e.g. Physics 1st Paper, Physics 2nd Paper)\n' +
  '4. For each subject+paper: which chapters/topics they need to cover\n' +
  '5. Which subjects are weak / need extra attention\n' +
  '6. College hours and any coaching/private tutor hours\n' +
  '7. Wake-up time and sleep time\n' +
  '8. Target GPA\n' +
  '9. Plan duration in days — must be ONE of: 30, 35, or 40 days\n' +
  '10. How many days per week they will study (e.g. 6 days/week with one rest day, 7 days/week, etc.)\n' +
  '11. (Optional) Preferred start date. If they do not specify, use today.\n\n' +
  'You MUST have at minimum: year, stream, exam info, planDurationDays (30/35/40), studyDaysPerWeek (1-7), at least 2 subjects with chapters, wake/sleep time, and weak subjects.\n\n' +
  'Return ONLY a JSON object:\n' +
  '- While gathering: {"reply":"<message>","readyToGenerate":false}\n' +
  '- When ready: {"reply":"<short closing message like: I have everything I need! Generating your 35-day routine now...>","readyToGenerate":true,"studentProfile":{"year":"1st","stream":"Science","collegeHours":"8AM-2PM","wakeUpTime":"7AM","sleepTime":"11PM","weakSubjects":["Biology"],"targetGpa":"5","dailyStudyHours":"5","planDurationDays":35,"studyDaysPerWeek":6,"startDate":"2026-06-26"},"examInfo":{"examName":"HSC 2026","examDate":"2026-08-25","subjects":[{"name":"Physics","paper":"1st Paper","chapters":["Motion","Force","Work & Energy"]},{"name":"Biology","paper":"1st Paper","chapters":["Cell Biology","Genetics"]}]}}\n\n' +
  'For examDate, calculate the approximate date based on what the student says (e.g. "2 months" = today + 60 days). Use ISO format YYYY-MM-DD.\n' +
  'planDurationDays MUST be exactly 30, 35, or 40. studyDaysPerWeek MUST be an integer between 1 and 7.\n' +
  'The studentProfile and examInfo must contain ALL the info you gathered.';

// Phase 2: Dedicated routine generation — receives profile + exam info, outputs structured routine
const STUDY_ROUTINE_GENERATE_PROMPT =
  'You are a study routine generator for HSC students in Bangladesh.\n\n' +
  'You will receive a student profile and exam information as JSON. Generate a COMPLETE, REALISTIC, DATE-AWARE study routine that covers all their chapters before the exam date.\n\n' +
  'RULES:\n' +
  '- Output ONLY a JSON object.\n' +
  '- Respect wake/sleep times and college hours.\n' +
  '- Include breaks (lunch, rest) as segments with subject "Break".\n' +
  '- Include college time as segments with subject "College".\n' +
  '- Give EXTRA study time to weak subjects (mark those segments with "priority":"high").\n' +
  '- Use studentProfile.startDate (ISO YYYY-MM-DD) as the FIRST day of the routine.\n' +
  '- Generate ONLY the FIRST 7 day entries (the first week) by walking forward one calendar day at a time from startDate. If planDurationDays < 7, generate exactly planDurationDays entries instead. Do NOT generate the whole plan — the remaining weeks are generated later, one week at a time.\n' +
  '- If studyDaysPerWeek < 7, skip the appropriate number of rest days within these 7 days (e.g. 6 days/week = rest every Sunday). Rest days are included as "Rest" entries with no segments.\n' +
  '- For EACH day, set "dayDate" to the ISO date (YYYY-MM-DD) of that calendar day and "day" to its weekday name.\n' +
  '- For EACH segment, set "startAt" and "endAt" as full ISO datetimes (with Z timezone) for that segment within dayDate. They MUST be ordered: earliest first. Use the student\'s wakeUpTime as the earliest non-morning-routine time.\n' +
  '- For EACH segment, set "estimatedMinutes" to the integer duration in minutes.\n' +
  '- For EACH study segment, set "priority" to "high" if the subject is in weakSubjects, otherwise "medium". Set "low" for breaks and college.\n' +
  '- Each study day should have 6-12 segments.\n' +
  '- Each study segment MUST include "subject", "paper", "chapter", and "task".\n' +
  '- Across these first 7 days, prioritise the most important chapters and the weak subjects first; the remaining chapters are scheduled in later weeks.\n' +
  '- For non-study segments (Break, College, Morning Routine, Rest), paper and chapter can be empty strings.\n' +
  '- The "task" field should be specific: "Solve exercises 3.1-3.5", "Read and take notes on section 2", "Practice MCQs from chapter 4", etc.\n\n' +
  'JSON shape:\n' +
  '{\n' +
  '  "routine":[\n' +
  '    {\n' +
  '      "day":"Monday",\n' +
  '      "dayDate":"2026-06-29",\n' +
  '      "segments":[\n' +
  '        {"time":"7:00 AM - 7:30 AM","startAt":"2026-06-29T01:00:00.000Z","endAt":"2026-06-29T01:30:00.000Z","subject":"Morning Routine","paper":"","chapter":"","task":"Wake up, freshen up","priority":"low","estimatedMinutes":30,"completed":false},\n' +
  '        {"time":"7:30 AM - 9:00 AM","startAt":"2026-06-29T01:30:00.000Z","endAt":"2026-06-29T03:00:00.000Z","subject":"Physics","paper":"1st Paper","chapter":"Motion","task":"Read theory, solve exercise 1.1-1.5","priority":"high","estimatedMinutes":90,"completed":false},\n' +
  '        {"time":"9:00 AM - 9:15 AM","startAt":"2026-06-29T03:00:00.000Z","endAt":"2026-06-29T03:15:00.000Z","subject":"Break","paper":"","chapter":"","task":"Short rest, snack","priority":"low","estimatedMinutes":15,"completed":false}\n' +
  '      ]\n' +
  '    }\n' +
  '  ]\n' +
  '}\n\n' +
  'CRITICAL: startAt and endAt MUST be valid ISO datetimes within dayDate. estimatedMinutes must equal (endAt - startAt) in minutes. Output ONLY the JSON object. No prose, no markdown.';

// Phase 3: AI modification prompt — receives current routine + user request, outputs modified routine
const STUDY_ROUTINE_MODIFY_PROMPT =
  'You are a study routine modifier for HSC students.\n\n' +
  'You will receive:\n' +
  '1. The student\'s current routine as JSON (with dayDate, startAt, endAt, priority, estimatedMinutes)\n' +
  '2. The student\'s modification request\n\n' +
  'Your job is to modify the routine according to the student\'s request and return the COMPLETE modified routine.\n\n' +
  'RULES:\n' +
  '- Return ONLY a JSON object with the full modified routine.\n' +
  '- Keep ALL segments that were not affected by the modification.\n' +
  '- Maintain the same JSON structure: {"routine":[{"day":"...","dayDate":"...","segments":[...]}]}\n' +
  '- Each segment must have: time, startAt, endAt, priority, estimatedMinutes, subject, paper, chapter, task, completed (preserve existing completed status).\n' +
  '- Be smart about modifications: if the user says "swap Biology and Physics on Monday", swap ALL Biology and Physics segments on Monday while keeping their original startAt/endAt times.\n' +
  '- If the user says "add more Biology", find free slots or reduce less important segments. Adjust startAt/endAt accordingly.\n' +
  '- Always maintain breaks and reasonable study hours.\n' +
  '- NEVER change dayDate of an existing day. You may add new days but cannot shift existing dates.\n\n' +
  'Output ONLY the JSON object. No explanation.';

// Week-by-week generation prompt — generates 7 days based on previous week's progress
const STUDY_ROUTINE_WEEKLY_PROMPT =
  'You are a study routine generator for HSC students in Bangladesh.\n\n' +
  'You will receive:\n' +
  '1. Student profile (wake/sleep times, college hours, weak subjects)\n' +
  '2. Exam info (exam date, subjects with chapters)\n' +
  '3. Previous week\'s progress summary (completion rates, which subjects were strong/weak)\n' +
  '4. The 7-day date range to generate\n\n' +
  'Generate a 7-day study routine that ADAPTS based on the student\'s previous week.\n\n' +
  'RULES:\n' +
  '- Output ONLY a JSON object with exactly 7 day entries.\n' +
  '- Each day must have "day" (weekday name), "dayDate" (YYYY-MM-DD), and "segments" array.\n' +
  '- Each segment must have: time, startAt, endAt, subject, paper, chapter, task, priority, estimatedMinutes, completed (always false for new segments).\n' +
  '- For EACH segment, set "startAt" and "endAt" as full ISO datetimes (with Z timezone) for that segment within dayDate. They MUST be ordered: earliest first.\n' +
  '- Each study day should have 6-12 segments.\n' +
  '- Include breaks (lunch, rest) as segments with subject "Break".\n' +
  '- Include college time as segments with subject "College" if college hours are provided.\n' +
  '- Give EXTRA study time to weak subjects (mark those segments with "priority":"high").\n' +
  '- If a subject had LOW completion last week, increase its time this week or move it to a better time slot.\n' +
  '- If the student had a good streak, maintain the same study pattern.\n' +
  '- If the student struggled with a subject, add a review session before new material.\n' +
  '- Respect the student\'s wake/sleep times and college hours.\n' +
  '- If studyDaysPerWeek < 7, skip the appropriate rest days.\n' +
  '- Each study segment MUST include "subject", "paper", "chapter", and "task".\n' +
  '- The "task" field should be specific: "Solve exercises 3.1-3.5", "Read and take notes on section 2", etc.\n' +
  '- Distribute chapters so that all remaining chapters are covered before the exam date.\n' +
  '- For non-study segments (Break, College, Morning Routine, Rest), paper and chapter can be empty strings.\n' +
  '- For rest days, return an empty segments array.\n\n' +
  'JSON shape:\n' +
  '{"routine":[{"day":"Monday","dayDate":"2026-07-04","segments":[{"time":"7:00 AM - 7:30 AM","startAt":"2026-07-04T01:00:00.000Z","endAt":"2026-07-04T01:30:00.000Z","subject":"Morning Routine","paper":"","chapter":"","task":"Wake up, freshen up","priority":"low","estimatedMinutes":30,"completed":false}]}]}\n\n' +
  'CRITICAL: startAt and endAt MUST be valid ISO datetimes within dayDate. estimatedMinutes must equal (endAt - startAt) in minutes. Output ONLY the JSON object. No prose, no markdown.';

function normaliseRoutineMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => {
      const role = message?.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof message?.content === 'string'
        ? message.content.replace(/\s+/g, ' ').trim().slice(0, MAX_ROUTINE_MESSAGE_CHARS)
        : '';
      return { role, content };
    })
    .filter((message) => message.content)
    .slice(-MAX_ROUTINE_MESSAGES);
}

/**
 * Wraps a Groq chat call with exponential backoff for transient 503/429/500
 * "over capacity" / "rate limit" errors. Returns the final response (success
 * or last error). Does NOT retry on 4xx client errors — those won't recover.
 */
async function groqWithRetry(groq, params, opts = {}) {
  const maxAttempts = Math.max(1, Number(opts.maxAttempts) || 4);
  const baseDelayMs = Math.max(100, Number(opts.baseDelayMs) || 800);
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await groq.chat.completions.create(params);
    } catch (err) {
      lastErr = err;
      const status = err?.statusCode || err?.status || 0;
      const transient = status === 503 || status === 429 || status === 500 || status === 502;
      const isLast = attempt === maxAttempts;
      if (!transient || isLast) throw err;
      // Exponential backoff with full jitter, capped at 8s
      const delay = Math.min(8000, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * delay);
      console.warn(
        `[aiController] Groq transient ${status} (attempt ${attempt}/${maxAttempts}); retrying in ${jitter}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }
  throw lastErr;
}

/**
 * POST /api/ai/study-routine
 * Phase 1: Chat to collect exam-specific info.
 * When readyToGenerate, automatically calls Phase 2 to generate the routine.
 */
exports.studyRoutine = async (req, res, next) => {
  try {
    const conversation = normaliseRoutineMessages(req.body?.messages);
    if (conversation.length === 0 || conversation[conversation.length - 1].role !== 'user') {
      return res.status(400).json({
        success: false,
        message: 'At least one latest user message is required.'
      });
    }

    const groq = getGroqClient();

    // --- Phase 1: Chat ---
    const chatCompletion = await groqWithRetry(groq, {
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: STUDY_ROUTINE_CHAT_PROMPT },
        ...conversation
      ]
    });

    const chatParsed = safeParseJson(chatCompletion?.choices?.[0]?.message?.content);
    if (!chatParsed || typeof chatParsed.reply !== 'string' || !chatParsed.reply.trim()) {
      return res.status(502).json({
        success: false,
        message: 'AI mentor returned an unusable response. Please try again.'
      });
    }

    const readyToGenerate = chatParsed.readyToGenerate === true || String(chatParsed.readyToGenerate).toLowerCase() === 'true';

    if (!readyToGenerate) {
      return res.status(200).json({
        success: true,
        data: {
          reply: chatParsed.reply.trim(),
          routineReady: false,
          routine: [],
          examInfo: null,
          studentProfile: null
        }
      });
    }

    // --- Phase 2: Generate ---
    const studentProfile = chatParsed.studentProfile || {};
    const examInfo = chatParsed.examInfo || {};
    const profileAndExam = JSON.stringify({ studentProfile, examInfo }, null, 2);

    let routine = [];
    try {
      const genCompletion = await groqWithRetry(groq, {
        model: DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: STUDY_ROUTINE_GENERATE_PROMPT },
          { role: 'user', content: `Student & Exam Info:\n${profileAndExam}\n\nGenerate ONLY the first 7 days (the first week) of the study routine as JSON.` }
        ]
      });

      const genParsed = safeParseJson(genCompletion?.choices?.[0]?.message?.content);
      if (genParsed && Array.isArray(genParsed.routine)) {
        routine = genParsed.routine;
      }
    } catch (genErr) {
      console.error('[aiController] routine generation failed:', genErr?.message);
    }

    if (routine.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          reply: chatParsed.reply.trim() + '\n\n⚠️ I had trouble generating the schedule. Please send another message (e.g. "generate now") and I\'ll try again.',
          routineReady: false,
          routine: [],
          examInfo: null,
          studentProfile: null
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        reply: chatParsed.reply.trim(),
        routineReady: true,
        routine,
        examInfo,
        studentProfile
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ai/study-routine/modify
 * Phase 3: AI-driven routine modification.
 * Body: { message: string, currentRoutine: array }
 */
exports.modifyStudyRoutine = async (req, res, next) => {
  try {
    const { message, currentRoutine } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'A modification message is required.' });
    }
    if (!currentRoutine || !Array.isArray(currentRoutine)) {
      return res.status(400).json({ success: false, message: 'Current routine is required.' });
    }

    const groq = getGroqClient();
    const routineJson = JSON.stringify(currentRoutine, null, 2);

    const completion = await groqWithRetry(groq, {
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: STUDY_ROUTINE_MODIFY_PROMPT },
        { role: 'user', content: `Current Routine:\n${routineJson}\n\nModification Request: ${message.trim()}` }
      ]
    });

    const parsed = safeParseJson(completion?.choices?.[0]?.message?.content);
    if (!parsed || !Array.isArray(parsed.routine)) {
      return res.status(502).json({
        success: false,
        message: 'AI could not modify the routine. Please try a different request.'
      });
    }

    res.status(200).json({
      success: true,
      data: { routine: parsed.routine }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ai/extract-question
 * Body: { text?: string, imageBase64?: string, mimeType?: string }
 * Auth: required.
 *
 * Teacher-only helper: takes a question (typed or as an image) and returns a
 * structured LaTeX representation so it can be copied into the upload form.
 * Result is intentionally NOT persisted — it is throwaway formatting work.
 */
exports.extractQuestion = async (req, res, next) => {
  try {
    const { text, imageBase64, mimeType } = req.body || {};
    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0;
    if (!hasText && !hasImage) {
      return res.status(400).json({
        success: false,
        message: 'Provide either `text` or `imageBase64`.'
      });
    }

    if (hasImage) {
      // Cap to keep the request well under Express's 16 MB JSON body limit and
      // Groq's image size limits.
      const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        return res.status(413).json({
          success: false,
          message: 'Image is too large. Please use a smaller image (under ~5 MB).'
        });
      }
    }

    const userContent = buildExtractUserContent({ text, imageBase64, mimeType });

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      // 4–5 LaTeX options plus a worked solution can easily exceed 1500 tokens.
      max_tokens: 2500,
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ]
    });

    const raw = completion?.choices?.[0]?.message?.content;
    const parsed = safeParseJson(raw);
    const extracted = normaliseExtracted(parsed);

    if (!extracted) {
      console.error('[aiController] extractQuestion: failed to parse LLM output', raw);
      return res.status(502).json({
        success: false,
        message: 'AI could not interpret the question. Please try a clearer image or text.'
      });
    }

    res.status(200).json({
      success: true,
      data: { extracted }
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Answer an MCQ (AI battle opponent)
// ---------------------------------------------------------------------------

const ANSWER_MCQ_SYSTEM_PROMPT =
  'You are an expert tutor solving a Bangladeshi admission-test multiple-choice ' +
  'question. You are given one question and a list of options, each with a ' +
  '0-based index. Read the question and EVERY option carefully and work out the ' +
  'single correct answer. Questions and options may contain LaTeX (wrapped in ' +
  '$...$ or $$...$$) and may be written in Bangla or English. ' +
  'Think through the problem step by step, then commit to the option that is ' +
  'actually correct — do NOT guess randomly. ' +
  'Respond with ONLY a JSON object of the exact shape ' +
  '{ "reasoning": "<brief step-by-step reasoning>", "answerIndex": <integer> } ' +
  'where answerIndex is the 0-based index of the correct option. ' +
  'No markdown fences, no extra text outside the JSON object.';

function buildAnswerMcqPrompt(questionText, options) {
  const lines = options.map((opt, idx) => `${idx}: ${opt}`);
  return (
    `Question:\n${questionText}\n\n` +
    `Options (index: text):\n${lines.join('\n')}\n\n` +
    `Determine the correct option and reply with JSON like ` +
    `{"reasoning": "...", "answerIndex": 0}. answerIndex must be an integer ` +
    `between 0 and ${options.length - 1}.`
  );
}

/**
 * POST /api/ai/answer-mcq
 * Body: { questionText: string, options: [{ text }] | string[] }
 * Auth: required.
 *
 * The AI opponent in the 1v1-vs-AI battle. The model genuinely reads and solves
 * the question (we deliberately never send the answer key). Returns the 0-based
 * index the model chose, or `null` if the model could not be reached / returned
 * an unusable answer — we never substitute a random guess, so the AI's answer
 * is always its real attempt.
 */
exports.answerMcq = async (req, res, next) => {
  try {
    const { questionText, options } = req.body || {};

    // Normalise options to plain strings; accept both [{text}] and [string].
    const optionTexts = Array.isArray(options)
      ? options
          .map((opt) => (typeof opt === 'string' ? opt : (opt && typeof opt.text === 'string' ? opt.text : '')))
          .map((text) => text.trim())
      : [];

    if (typeof questionText !== 'string' || !questionText.trim() || optionTexts.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'questionText and at least two options are required.'
      });
    }

    const validIndex = (n) => {
      const i = Number(n);
      return Number.isInteger(i) && i >= 0 && i < optionTexts.length ? i : null;
    };

    let answerIndex = null;
    try {
      const groq = getGroqClient();
      const completion = await groq.chat.completions.create({
        model: DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        // Enough room for brief reasoning before the answer — chain-of-thought
        // meaningfully improves MCQ accuracy over a bare index.
        max_tokens: 500,
        messages: [
          { role: 'system', content: ANSWER_MCQ_SYSTEM_PROMPT },
          { role: 'user', content: buildAnswerMcqPrompt(questionText.trim(), optionTexts) }
        ]
      });
      const parsed = safeParseJson(completion?.choices?.[0]?.message?.content);
      answerIndex = validIndex(parsed?.answerIndex);
    } catch (llmErr) {
      // The AI simply fails to answer this question (answerIndex stays null) —
      // it never guesses randomly, so it can only win by being genuinely right.
      console.error('[aiController] answerMcq Groq call failed:', llmErr?.message);
      answerIndex = null;
    }

    res.status(200).json({
      success: true,
      data: { answerIndex }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/study-routine/generate-week
 * Week-by-week AI generation. Generates 7 days based on previous week's progress.
 */
exports.generateNextWeek = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const studyRoutine = await StudyRoutine.findOne({ userId });
    if (!studyRoutine) {
      return res.status(404).json({
        success: false,
        code: 'NO_ROUTINE',
        message: 'No routine found. Please create one first.'
      });
    }

    const startDate = studyRoutine.startDate;
    const durationDays = studyRoutine.durationDays || 30;
    if (!startDate) {
      // Routine exists but is missing plan metadata. Treat the same as a
      // 404 — the client should drop its stale view and start fresh.
      return res.status(404).json({
        success: false,
        code: 'NO_ROUTINE',
        message: 'Routine is missing plan dates. Please create a new routine.'
      });
    }

    // Determine the date range for the next week
    const planEnd = new Date(startDate);
    planEnd.setUTCDate(planEnd.getUTCDate() + durationDays - 1);

    let weekStart;
    if (studyRoutine.generatedUpTo) {
      weekStart = new Date(studyRoutine.generatedUpTo);
      weekStart.setUTCDate(weekStart.getUTCDate() + 1);
    } else {
      weekStart = new Date(startDate);
    }

    // Nothing left to generate
    if (weekStart > planEnd) {
      return res.status(200).json({
        success: true,
        data: { routine: studyRoutine.routine, generatedUpTo: studyRoutine.generatedUpTo, done: true }
      });
    }

    // Calculate week end (6 days later, or plan end — whichever is sooner)
    let weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    if (weekEnd > planEnd) weekEnd = new Date(planEnd);

    // Extract previous week's completion data
    const routine = studyRoutine.routine || [];
    const previousWeekDays = [];
    if (studyRoutine.generatedUpTo) {
      const prevWeekStart = new Date(studyRoutine.generatedUpTo);
      prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 6);
      for (const day of routine) {
        if (!day.dayDate) continue;
        const d = new Date(day.dayDate);
        if (d >= prevWeekStart && d <= studyRoutine.generatedUpTo) {
          const segs = Array.isArray(day.segments) ? day.segments : [];
          const done = segs.filter((s) => s.completed).length;
          const bySubject = {};
          for (const seg of segs) {
            const subj = seg.subject || 'Other';
            if (!bySubject[subj]) bySubject[subj] = { planned: 0, done: 0 };
            bySubject[subj].planned++;
            if (seg.completed) bySubject[subj].done++;
          }
          previousWeekDays.push({
            dayDate: toISODate(d),
            day: day.day,
            planned: segs.length,
            done,
            bySubject
          });
        }
      }
    }

    const prevWeekSummary = previousWeekDays.length > 0 ? {
      totalPlanned: previousWeekDays.reduce((s, d) => s + d.planned, 0),
      totalDone: previousWeekDays.reduce((s, d) => s + d.done, 0),
      days: previousWeekDays
    } : null;

    // Build the prompt context
    const groq = getGroqClient();
    const profileAndExam = JSON.stringify({
      studentProfile: studyRoutine.studentProfile || {},
      examInfo: studyRoutine.examInfo || {}
    }, null, 2);

    const weekContext = JSON.stringify({
      weekStart: toISODate(weekStart),
      weekEnd: toISODate(weekEnd),
      previousWeekProgress: prevWeekSummary
    }, null, 2);

    // Call AI
    let weekRoutine = [];
    try {
      const completion = await groqWithRetry(groq, {
        model: DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: STUDY_ROUTINE_WEEKLY_PROMPT },
          { role: 'user', content: `Student & Exam Info:\n${profileAndExam}\n\nWeek to Generate:\n${weekContext}\n\nGenerate the 7-day study routine as JSON.` }
        ]
      });

      const parsed = safeParseJson(completion?.choices?.[0]?.message?.content);
      if (parsed && Array.isArray(parsed.routine)) {
        weekRoutine = parsed.routine;
      }
    } catch (genErr) {
      console.error('[aiController] weekly generation failed:', genErr?.message);
    }

    if (weekRoutine.length === 0) {
      return res.status(502).json({
        success: false,
        message: 'AI could not generate the week. Please try again.'
      });
    }

    // Merge AI-generated days into the existing routine
    // Build a map of existing days by date key
    const existingByDate = {};
    for (const day of routine) {
      if (day.dayDate) {
        const key = toISODate(new Date(day.dayDate));
        existingByDate[key] = day;
      }
    }

    // Replace only the days that the AI generated
    let lastGeneratedDate = null;
    for (const aiDay of weekRoutine) {
      if (!aiDay.dayDate) continue;
      const dateKey = typeof aiDay.dayDate === 'string' ? aiDay.dayDate.slice(0, 10) : toISODate(new Date(aiDay.dayDate));

      // Find existing day or create new one
      const existing = existingByDate[dateKey];
      if (existing) {
        existing.segments = (aiDay.segments || []).map((seg) => ({
          ...seg,
          completed: false,
          startAt: seg.startAt ? new Date(seg.startAt) : null,
          endAt: seg.endAt ? new Date(seg.endAt) : null
        }));
      } else {
        routine.push({
          day: aiDay.day,
          dayDate: new Date(dateKey + 'T00:00:00.000Z'),
          segments: (aiDay.segments || []).map((seg) => ({
            ...seg,
            completed: false,
            startAt: seg.startAt ? new Date(seg.startAt) : null,
            endAt: seg.endAt ? new Date(seg.endAt) : null
          }))
        });
      }

      const d = new Date(dateKey + 'T00:00:00.000Z');
      if (!lastGeneratedDate || d > lastGeneratedDate) lastGeneratedDate = d;
    }

    // Sort routine by dayDate
    routine.sort((a, b) => {
      if (!a.dayDate) return 1;
      if (!b.dayDate) return -1;
      return new Date(a.dayDate) - new Date(b.dayDate);
    });

    // Advance generatedUpTo to the intended week boundary (weekEnd), not just
    // the last day the AI happened to emit. This guarantees forward progress so
    // the "Generate Next Week" button keeps moving even if the model omits a
    // trailing rest day in its output.
    studyRoutine.routine = routine;
    const advancedTo = lastGeneratedDate && lastGeneratedDate > weekEnd ? lastGeneratedDate : weekEnd;
    studyRoutine.generatedUpTo = advancedTo;
    await studyRoutine.save();

    res.status(200).json({
      success: true,
      data: {
        routine: studyRoutine.routine,
        generatedUpTo: studyRoutine.generatedUpTo,
        done: advancedTo >= planEnd
      }
    });
  } catch (err) {
    next(err);
  }
};
