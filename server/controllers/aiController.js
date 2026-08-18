const Groq = require('groq-sdk');
const ChatMessage = require('../models/ChatMessage');
const { answerBookTutorRequest } = require('../services/bookRagService');
const { detectImage } = require('../utils/imageSignature');

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
  process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

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

function buildTutorContextKey({ scope = 'page', bookId, chapterId, topicId, nodeId, pageNumber }) {
  const safeBookId = String(bookId || '');
  const safeChapterId = String(chapterId || '');
  const safeTopicId = String(topicId || '');
  const safeNodeId = String(nodeId || '');
  const safePage = Number.isFinite(Number(pageNumber)) ? Number(pageNumber) : null;

  if (scope === 'node') {
    if (safeNodeId) return `node:${safeBookId}:${safeChapterId}:${safeNodeId}`;
    if (safeChapterId) return `chapter:${safeBookId}:${safeChapterId}`;
    return `book:${safeBookId}`;
  }
  if (scope === 'topic') return `topic:${safeBookId}:${safeChapterId}:${safeTopicId}`;
  if (scope === 'chapter') return `chapter:${safeBookId}:${safeChapterId}`;
  if (scope === 'book') return `book:${safeBookId}`;
  if (scope === 'page' && safePage) return `page:${safeBookId}:${safeChapterId}:${safePage}`;
  if (safePage) return `page:${safeBookId}:${safeChapterId}:${safePage}`;
  if (safeTopicId) return `topic:${safeBookId}:${safeChapterId}:${safeTopicId}`;
  if (safeChapterId) return `chapter:${safeBookId}:${safeChapterId}`;
  return `book:${safeBookId}`;
}

function buildLegacyChatFilter({ userId, chapterId, pageNumber, contextKey }) {
  const filter = { userId };
  if (contextKey) {
    filter.contextKey = contextKey;
    return filter;
  }
  if (chapterId) filter.chapterId = chapterId;
  if (pageNumber) filter.pageNumber = Number(pageNumber);
  return filter;
}

function normalizePageNumber(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
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

      });
      reply = completion?.choices?.[0]?.message?.content?.trim();
    } catch (llmErr) {
      // Remove the user turn we optimistically inserted so the UI doesn't
      // look like it lost the question — but only if it was a transient LLM
      // failure. We log instead of deleting on auth/permission errors.
      console.error('[aiController] Groq call failed:', llmErr?.message);
      await ChatMessage.deleteOne({ _id: userMessage._id, userId }).catch(() => { });
      const status = llmErr?.statusCode || 502;
      return res.status(status).json({
        success: false,
        message: llmErr?.message || 'AI tutor is unavailable right now. Please try again.'
      });
    }

    if (!reply) {
      await ChatMessage.deleteOne({ _id: userMessage._id, userId }).catch(() => { });
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

/**
 * POST /api/ai/book-chat
 * Body: { bookId, chapterId?, topicId?, nodeId?, pageNumber?, scope?, question, requestedAction? }
 * Uses the topic/chapter/book RAG pipeline and stores history per context.
 */
exports.bookChat = async (req, res, next) => {
  try {
    const body = req.body || {};
    const {
      bookId,
      chapterId,
      topicId,
      nodeId,
      pageNumber,
      scope,
      question,
      requestedAction,
      focusText,
      focusLabel,
      focusPageNumber,
      selectedTopicTitle,
      selectedChapterTitle,
      selectedNodeTitle
    } = body;

    if (!bookId || !question) {
      return res.status(400).json({ success: false, message: 'bookId and question are required' });
    }

    const cleanQuestion = String(question).trim();
    if (!cleanQuestion) {
      return res.status(400).json({ success: false, message: 'question cannot be empty' });
    }

    const numericPage = normalizePageNumber(pageNumber);
    const resolvedScope = scope || (nodeId ? 'node' : (topicId ? 'topic' : (numericPage ? 'page' : 'book')));
    const contextKey = buildTutorContextKey({ scope: resolvedScope, bookId, chapterId, topicId, nodeId, pageNumber: numericPage });
    const userId = req.user._id || req.user.id;
    const cleanFocusText = String(focusText || '').trim();
    const cleanFocusLabel = String(focusLabel || '').trim();
    const numericFocusPage = normalizePageNumber(focusPageNumber);

    const userMessage = await ChatMessage.create({
      userId,
      bookId,
      chapterId: chapterId || null,
      topicId: topicId || '',
      nodeId: nodeId || '',
      contextType: resolvedScope,
      contextKey,
      pageNumber: numericPage,
      role: 'user',
      content: cleanQuestion
    });

    let reply = '';
    let action = requestedAction || 'answer';
    let sources = [];
    let contextLabel = '';
    try {
      const result = await answerBookTutorRequest({
        bookId,
        chapterId,
        topicId,
        nodeId,
        pageNumber: numericPage,
        question: cleanQuestion,
        scope: resolvedScope,
        selectedTopicTitle,
        selectedChapterTitle,
        selectedNodeTitle,
        focusText: cleanFocusText,
        focusLabel: cleanFocusLabel,
        focusPageNumber: numericFocusPage,
        forceAction: requestedAction || undefined
      });
      reply = result.reply;
      action = result.action;
      sources = result.sources || [];
      contextLabel = result.contextLabel || '';
    } catch (ragErr) {
      console.error('[aiController] bookChat failed:', ragErr?.message);
      await ChatMessage.deleteOne({ _id: userMessage._id, userId }).catch(() => { });
      return res.status(ragErr?.statusCode || 502).json({
        success: false,
        message: ragErr?.message || 'AI tutor is unavailable right now. Please try again.'
      });
    }

    const assistantMessage = await ChatMessage.create({
      userId,
      bookId,
      chapterId: chapterId || null,
      topicId: topicId || '',
      nodeId: nodeId || '',
      contextType: resolvedScope,
      contextKey,
      pageNumber: numericPage,
      role: 'assistant',
      content: reply,
      sources
    });

    return res.status(200).json({
      success: true,
      data: {
        reply,
        action,
        contextLabel,
        sources,
        userMessage,
        assistantMessage
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ai/book-history
 * Returns ordered book-scoped history for the current context.
 */
exports.bookHistory = async (req, res, next) => {
  try {
    const { bookId, chapterId, topicId, nodeId, pageNumber, scope } = req.query;
    if (!bookId) {
      return res.status(400).json({ success: false, message: 'bookId is required' });
    }
    const numericPage = normalizePageNumber(pageNumber);
    const resolvedScope = scope || (nodeId ? 'node' : (topicId ? 'topic' : (numericPage ? 'page' : 'book')));
    const contextKey = buildTutorContextKey({ scope: resolvedScope, bookId, chapterId, topicId, nodeId, pageNumber });

    const filter = {
      userId: req.user._id || req.user.id,
      contextKey
    };

    const messages = await ChatMessage.find(filter).sort({ createdAt: 1 }).lean();
    return res.status(200).json({
      success: true,
      data: { messages }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/ai/book-history
 * Deletes the current user's book-scoped history for the active context.
 */
exports.bookHistoryClear = async (req, res, next) => {
  try {
    const { bookId, chapterId, topicId, nodeId, pageNumber, scope } = req.query;
    if (!bookId) {
      return res.status(400).json({ success: false, message: 'bookId is required' });
    }
    const numericPage = normalizePageNumber(pageNumber);
    const resolvedScope = scope || (nodeId ? 'node' : (topicId ? 'topic' : (numericPage ? 'page' : 'book')));
    const contextKey = buildTutorContextKey({ scope: resolvedScope, bookId, chapterId, topicId, nodeId, pageNumber });

    const result = await ChatMessage.deleteMany({
      userId: req.user._id || req.user.id,
      contextKey
    });
    return res.status(200).json({
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
const MAX_RUBRIC_TEXT_CHARS = 12_000;
const MAX_RUBRIC_MARKS = 100;

function cleanRubricSourceText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, MAX_RUBRIC_TEXT_CHARS);
}

function isValidImageMimeType(value) {
  return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(value);
}

function getBase64ByteLength(value) {
  if (typeof value !== 'string' || !value) return 0;
  const normalized = value.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return Infinity;
  return Math.floor((normalized.length * 3) / 4) - (normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0);
}

function validateRubricImage(base64, mimeType, label) {
  if (!base64) return null;
  if (!isValidImageMimeType(mimeType)) {
    const error = new Error(`${label} image must be PNG, JPG, GIF, or WebP.`);
    error.statusCode = 400;
    throw error;
  }
  if (getBase64ByteLength(base64) > 4 * 1024 * 1024) {
    const error = new Error(`${label} image is too large. Please use an image under 4 MB.`);
    error.statusCode = 413;
    throw error;
  }
  const normalized = base64.replace(/\s/g, '');
  let detected;
  try {
    detected = detectImage(Buffer.from(normalized, 'base64'));
  } catch (_) {
    detected = null;
  }
  if (!detected || detected.mime !== mimeType) {
    const error = new Error(`${label} image content does not match its declared type.`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

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
  '6. Output ONLY the JSON object — no backticks, no "Here is the JSON:" preface, no trailing commentary. Absolutely DO NOT use <think> tags.';

const EXTRACT_SOLUTION_SYSTEM_PROMPT =
  'You are a careful, meticulous solution formatter. ' +
  'A teacher will hand you either plain text of a worked solution, or an image of a worked solution. ' +
  'Your job is to convert the worked solution into clean LaTeX and return it as JSON.\n\n' +
  'Rules:\n' +
  '1. Return ONLY a JSON object (no prose, no markdown fences). Shape:\n' +
  '   {\n' +
  '     "questionText": "<LaTeX of the question stem if the source includes it, otherwise empty string>",\n' +
  '     "options": [],\n' +
  '     "correctOption": null,\n' +
  '     "solution": "<LaTeX of the full worked solution>"\n' +
  '   }\n' +
  '2. It is OK if the source contains ONLY a solution and no question. In that case, leave "questionText" empty and put everything meaningful in "solution".\n' +
  '3. Preserve EVERY mathematical step, symbol, implication, and conclusion from the source. ' +
  'Use proper LaTeX: \\frac{a}{b}, x^{2}, x_{i}, \\sqrt{x}, \\sum, \\int, \\Rightarrow, \\therefore, etc. ' +
  'Wrap math in $...$ for inline expressions or $$...$$ for display equations.\n' +
  '4. Never invent missing steps or change the result. If something is unclear, use the closest faithful reading.\n' +
  '5. Output ONLY the JSON object — no backticks, no commentary. Absolutely DO NOT use <think> tags.';

const EXTRACT_RUBRIC_SYSTEM_PROMPT =
  'You are a strict, ultra-concise examiner who creates a precise marking rubric from a teacher-provided question and reference answer.\n\n' +
  'Rules:\n' +
  '1. Return ONLY this JSON object: { "questionText": "<question>", "answerText": "<reference answer>", "totalMarks": 5, "criteria": [{ "criterion": "<short title>", "evidenceExpected": "<1-line concise evidence>", "marks": 1 }] }.\n' +
  '2. Transcribe the teacher question and reference answer faithfully. Do not invent missing details.\n' +
  '3. Create EXACTLY 5 to 10 independently checkable criteria. The rubric MUST have between 5 and 10 items in the "criteria" array.\n' +
  '4. SUPER IMPORTANT CONSTRAINT: The ENTIRE rubric (all criteria and evidence combined) MUST BE UNDER 100 WORDS TOTAL. You must be extremely brief. Use bullet-point style language (e.g., "Checks momentum equation", "Finds V=0.067", "Calculates initial KE=0.012J").\n' +
  '5. Every criterion must state an exact required behavior, algorithm step, calculation, or condition in as few words as possible.\n' +
  '6. Do not duplicate marks. Marks across criteria MUST sum EXACTLY to TOTAL MARKS.\n' +
  '7. Use integer marks if possible. No single criterion should receive more than 40% of TOTAL MARKS.\n' +
  '8. Preserve math, code, units, and symbols in proper LaTeX wrapped in $...$ or $$...$$.\n' +
  '9. Do not include thinking, chain-of-thought, markdown fences, or commentary. Output ONLY valid JSON. Absolutely DO NOT use <think> tags.';

function buildExtractUserContent({ text, imageBase64, mimeType, mode, totalMarks, questionText, answerText, questionImageBase64, questionMimeType, answerImageBase64, answerMimeType }) {
  const parts = [];
  if (mode === 'rubric') {
    if (questionImageBase64) {
      parts.push({ type: 'text', text: 'TEACHER QUESTION IMAGE:' });
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${questionMimeType};base64,${questionImageBase64}` }
      });
    }
    if (answerImageBase64) {
      parts.push({ type: 'text', text: 'TEACHER REFERENCE ANSWER IMAGE:' });
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${answerMimeType};base64,${answerImageBase64}` }
      });
    }
    parts.push({
      type: 'text',
      text: [
        `TOTAL MARKS: ${totalMarks}.`,
        'The first attached image, if present, is the teacher question. The second attached image, if present, is the teacher reference answer.',
        `TEACHER QUESTION TEXT:\n${questionText || '(provided in image)'}`,
        `TEACHER ANSWER TEXT:\n${answerText || '(provided in image)'}`,
        'Read all provided sources and return the question, answer, total marks, and structured criteria in the required JSON shape.'
      ].join('\n\n')
    });
    return parts;
  }

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
  let textPart;
  if (typeof text === 'string' && text.trim().length > 0) {
    textPart = text.trim();
  } else if (mode === 'solution') {
    textPart = 'Please extract the worked solution from the attached image and return it as JSON.';
  } else {
    textPart = 'Please extract the question from the attached image and return it as JSON.';
  }
  parts.push({ type: 'text', text: textPart });
  return parts;
}

function safeParseJson(raw) {
  if (!raw) return null;
  let str = String(raw).trim();
  // Strip <think>...</think> reasoning blocks (e.g. from Qwen models)
  str = str.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
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
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object') {
      for (const k in parsed) {
        if (typeof parsed[k] === 'string') {
          parsed[k] = parsed[k].replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
        }
      }
    }
    return parsed;
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

function decodeJsonLikeString(value) {
  if (!value) return '';
  try {
    return JSON.parse(`"${value}"`);
  } catch (_) {
    return String(value)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .trim();
  }
}

function extractLooseSolutionText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Strip <think>...</think> reasoning blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const match = cleaned.match(/"solution"\s*:\s*"([\s\S]*)/);
  if (!match) return raw.trim();

  const tail = match[1]
    .trim()
    .replace(/"?\s*}\s*}?\s*$/g, '')
    .trim();
  return decodeJsonLikeString(tail);
}

// Hard cap for AI-generated rubrics: never more than 10 lines, one criterion
// per line. Any overflow criteria are merged into the final line.
function squashRubricLines(solution) {
  if (typeof solution !== 'string' || !solution.trim()) return solution;
  const lines = solution
    .split(/\r?\n/)
    .map((ln) => ln.replace(/^\s*(?:-|\*|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  if (lines.length <= 10) return lines.join('\n');
  const kept = lines.slice(0, 9);
  kept.push(lines.slice(9).join(' + '));
  return kept.join('\n');
}

function normaliseExtractedSolution(obj, fallbackText = '') {
  const fallbackSolution = typeof fallbackText === 'string' ? fallbackText.trim() : '';
  if (!obj || typeof obj !== 'object') {
    return fallbackSolution
      ? { questionText: '', options: [], correctOption: null, solution: fallbackSolution }
      : null;
  }

  let questionText = typeof obj.questionText === 'string' ? obj.questionText : '';
  let solution = typeof obj.solution === 'string' ? obj.solution : '';
  if (!solution && typeof obj.solutionText === 'string') solution = obj.solutionText;
  if (!solution && typeof obj.workedSolution === 'string') solution = obj.workedSolution;
  if (!solution && typeof obj.latex === 'string') solution = obj.latex;
  if (!solution && typeof obj.text === 'string') solution = obj.text;
  if (!solution && questionText) {
    solution = questionText;
    questionText = '';
  }
  if (!solution && fallbackSolution) solution = fallbackSolution;

  if (!questionText && !solution) return null;
  return { questionText, options: [], correctOption: null, solution };
}

function normaliseExtractedRubric(obj, fallback = {}) {
  if (!obj || typeof obj !== 'object') return null;
  const questionText = cleanRubricSourceText(obj.questionText || fallback.questionText);
  const answerText = cleanRubricSourceText(obj.answerText || obj.referenceAnswer || obj.answer || obj.solutionText || fallback.answerText);
  const sourceCriteria = Array.isArray(obj.criteria) ? obj.criteria : (obj.rubric || obj.solution || '');
  const totalMarks = Number(obj.totalMarks || fallback.totalMarks);
  const rubric = formatRubricSolution(sourceCriteria, totalMarks);
  if (!questionText || !answerText || !rubric || !Number.isInteger(totalMarks) || totalMarks < 1 || totalMarks > MAX_RUBRIC_MARKS) {
    return null;
  }
  return {
    questionText,
    answerText,
    totalMarks,
    criteria: normaliseRubricCriteria(sourceCriteria),
    rubric,
    solution: rubric,
    options: [],
    correctOption: null
  };
}

function normaliseRubricCriteria(source) {
  if (Array.isArray(source)) {
    return source
      .map((item) => ({
        criterion: cleanRubricSourceText(item?.criterion || item?.text).slice(0, 500),
        evidenceExpected: cleanRubricSourceText(item?.evidenceExpected || item?.evidence).slice(0, 700),
        marks: Number.isFinite(Number(item?.marks || item?.mark)) ? Number(item.marks || item.mark) : null
      }))
      .filter((item) => item.criterion);
  }

  if (typeof source !== 'string') return [];
  return source
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .split(/\r?\n/)
    .map((line) => {
      const markMatch = line.match(/[\[\(]\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)?\s*[\]\)]/i);
      return {
        criterion: cleanRubricSourceText(line
          .replace(/^(?:[\s*\-#]+)?\d+[.)]?\s*/, '')
          .replace(/[\[\(]\s*\d+(?:\.\d+)?\s*(?:marks?|pts?|points?)?\s*[\]\)]/i, '')),
        evidenceExpected: '',
        marks: markMatch ? Number(markMatch[1]) : null
      };
    })
    .filter((item) => item.criterion && !/^(evaluation rubric|marking scheme|solution|rubric):?$/i.test(item.criterion));
}

function allocateRubricMarks(criteria, totalMarks) {
  const count = criteria.length;
  if (!count || totalMarks < count) return [];
  const maxPerCriterion = count >= 3 ? Math.max(1, Math.floor(totalMarks * 0.4)) : totalMarks;
  const marks = criteria.map((criterion) => Math.max(1, Math.min(maxPerCriterion, Math.round(criterion.marks || 1))));
  let assigned = marks.reduce((sum, mark) => sum + mark, 0);

  while (assigned > totalMarks) {
    const index = marks
      .map((mark, idx) => ({ mark, idx }))
      .filter((item) => item.mark > 1)
      .sort((a, b) => b.mark - a.mark || b.idx - a.idx)[0]?.idx;
    if (index === undefined) break;
    marks[index] -= 1;
    assigned -= 1;
  }

  while (assigned < totalMarks) {
    const index = marks
      .map((mark, idx) => ({ mark, idx }))
      .filter((item) => item.mark < maxPerCriterion)
      .sort((a, b) => a.mark - b.mark || a.idx - b.idx)[0]?.idx;
    if (index === undefined) break;
    marks[index] += 1;
    assigned += 1;
  }

  return marks;
}

function formatRubricSolution(source, totalMarks) {
  const targetMarks = typeof totalMarks === 'number' && totalMarks > 0 ? totalMarks : 10;
  let criteria = normaliseRubricCriteria(source).slice(0, Math.min(10, targetMarks));
  if (!criteria.length) return '';

  const marks = allocateRubricMarks(criteria, targetMarks);
  if (marks.length !== criteria.length) return '';

  return criteria.map((criterion, index) => {
    const evidence = criterion.evidenceExpected ? ` Evidence: ${criterion.evidenceExpected}` : '';
    const mark = marks[index];
    return `${index + 1}. ${criterion.criterion}${evidence} [${mark} ${mark === 1 ? 'mark' : 'marks'}]`;
  }).join('\n');
}


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
    const {
      text,
      imageBase64,
      mimeType,
      mode,
      totalMarks,
      questionText: rawQuestionText,
      answerText: rawAnswerText,
      questionImageBase64: rawQuestionImageBase64,
      questionMimeType,
      answerImageBase64: rawAnswerImageBase64,
      answerMimeType
    } = req.body || {};
    const isSolutionMode = mode === 'solution';
    const isRubricMode = mode === 'rubric';
    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0;
    const questionText = cleanRubricSourceText(rawQuestionText);
    const answerText = cleanRubricSourceText(rawAnswerText);
    const questionImageBase64 = validateRubricImage(rawQuestionImageBase64, questionMimeType, 'Question');
    const answerImageBase64 = validateRubricImage(rawAnswerImageBase64, answerMimeType, 'Answer');
    const rubricMarks = Number(totalMarks);

    if (isRubricMode && ((!questionText && !questionImageBase64) || (!answerText && !answerImageBase64))) {
      return res.status(400).json({
        success: false,
        message: 'Provide the teacher question and answer as text or image.'
      });
    }
    if (isRubricMode && (!Number.isInteger(rubricMarks) || rubricMarks < 1 || rubricMarks > MAX_RUBRIC_MARKS)) {
      return res.status(400).json({
        success: false,
        message: `totalMarks must be an integer between 1 and ${MAX_RUBRIC_MARKS}.`
      });
    }
    if (!isRubricMode && !hasText && !hasImage) {
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

    const userContent = buildExtractUserContent({
      text,
      imageBase64,
      mimeType,
      mode,
      totalMarks: rubricMarks,
      questionText,
      answerText,
      questionImageBase64,
      questionMimeType,
      answerImageBase64,
      answerMimeType
    });

    const groq = getGroqClient();

    let modelToUse = DEFAULT_MODEL;
    if (isRubricMode) {
      modelToUse = questionImageBase64 || answerImageBase64 ? 'qwen/qwen3.6-27b' : 'llama-3.3-70b-versatile';
    }

    const extractRequest = {
      model: modelToUse,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: isRubricMode ? EXTRACT_RUBRIC_SYSTEM_PROMPT : (isSolutionMode ? EXTRACT_SOLUTION_SYSTEM_PROMPT : EXTRACT_SYSTEM_PROMPT) },
        { role: 'user', content: userContent }
      ]
    };
    if (!isSolutionMode && !isRubricMode) {
      extractRequest.response_format = { type: 'json_object' };
    }

    const completion = await groq.chat.completions.create(extractRequest);

    const raw = completion?.choices?.[0]?.message?.content;
    const parsed = safeParseJson(raw);
    const extracted = isRubricMode
      ? normaliseExtractedRubric(parsed, { questionText, answerText, totalMarks: rubricMarks })
      : isSolutionMode
        ? normaliseExtractedSolution(parsed, extractLooseSolutionText(raw) || (hasText ? text : ''))
      : normaliseExtracted(parsed);
    if (isRubricMode && extracted && extracted.solution) {
      extracted.rubric = formatRubricSolution(extracted.rubric, rubricMarks);
      extracted.solution = extracted.rubric;
    }

    if (!extracted) {
      console.error('[aiController] extractQuestion: failed to parse LLM output', raw);
      return res.status(502).json({
        success: false,
        message: isRubricMode
          ? 'AI could not build a rubric from the question and answer. Please try clearer sources.'
          : isSolutionMode
          ? 'AI could not interpret the solution/rubric. Please try a clearer image or text.'
          : 'AI could not interpret the question. Please try a clearer image or text.'
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

