const Groq = require('groq-sdk');
const ChatMessage = require('../models/ChatMessage');

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
