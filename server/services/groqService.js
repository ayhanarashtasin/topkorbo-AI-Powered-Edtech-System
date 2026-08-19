const Groq = require('groq-sdk');

const DEFAULT_MODEL =
  process.env.GROQ_RAG_MODEL
  || process.env.GROQ_MODEL
  || process.env.LLM_MODEL
  || 'openai/gpt-oss-20b';

const FALLBACK_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'groq/compound-mini'
];

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY is not configured');
    err.statusCode = 500;
    throw err;
  }
  return new Groq({ apiKey });
}

function safeParseJson(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = text.indexOf('{');
  if (first === -1) return null;
  const last = text.lastIndexOf('}');
  
  if (last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch (_) {}
  }

  // Attempt partial / truncated JSON repair
  let candidate = text.slice(first);
  let inString = false;
  let escaped = false;
  const stack = [];
  let clean = '';

  for (let i = 0; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (escaped) {
      clean += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      clean += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      clean += char;
      continue;
    }
    if (inString) {
      clean += char;
      continue;
    }
    if (char === '{' || char === '[') {
      stack.push(char);
      clean += char;
    } else if (char === '}') {
      if (stack.length && stack[stack.length - 1] === '{') stack.pop();
      clean += char;
    } else if (char === ']') {
      if (stack.length && stack[stack.length - 1] === '[') stack.pop();
      clean += char;
    } else {
      clean += char;
    }
  }

  if (inString) clean += '"';
  clean = clean.replace(/,\s*$/, '');

  while (stack.length) {
    const open = stack.pop();
    if (open === '{') clean += '}';
    else if (open === '[') clean += ']';
  }

  try {
    return JSON.parse(clean);
  } catch (_) {
    // If still fails, clean trailing incomplete keys
    const fixed = clean.replace(/,\s*"[^"]*":?\s*([^[\]{}"\d\w\s]*)?\s*$/, '');
    try {
      return JSON.parse(fixed);
    } catch (_) {
      return null;
    }
  }
}

async function generateJson({ prompt, systemInstruction, model = DEFAULT_MODEL, temperature = 0.1, maxTokens = 3500 }) {
  const groq = getGroqClient();
  const modelsToTry = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let lastErr = null;
  let lastContent = '';

  for (const currentModel of modelsToTry) {
    try {
      const completion = await groq.chat.completions.create({
        model: currentModel,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction || 'Output ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ]
      });
      const content = completion?.choices?.[0]?.message?.content || '';
      lastContent = content;
      const json = safeParseJson(content);
      if (json) {
        return { json, text: content, completion, model: currentModel };
      }
    } catch (err) {
      lastErr = err;
      // If error is 413 / 429 rate limit or 404 model not found, try next model
      const isRecoverable = err?.status === 413 || err?.status === 429 || err?.status === 404 || err?.statusCode === 413 || err?.statusCode === 429;
      if (!isRecoverable) {
        break;
      }
    }
  }

  const err = lastErr || new Error('Groq returned invalid JSON');
  err.statusCode = err.statusCode || 502;
  err.rawText = lastContent;
  throw err;
}

async function generateText({ prompt, systemInstruction, model = DEFAULT_MODEL, temperature = 0.3, maxTokens = 3000 }) {
  const groq = getGroqClient();
  const modelsToTry = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let lastErr = null;

  for (const currentModel of modelsToTry) {
    try {
      const completion = await groq.chat.completions.create({
        model: currentModel,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ]
      });
      const text = completion?.choices?.[0]?.message?.content?.trim() || '';
      return { text, completion, model: currentModel };
    } catch (err) {
      lastErr = err;
      const isRecoverable = err?.status === 413 || err?.status === 429 || err?.status === 404 || err?.statusCode === 413 || err?.statusCode === 429;
      if (!isRecoverable) {
        break;
      }
    }
  }

  throw lastErr || new Error('Failed to generate text');
}

module.exports = {
  getGroqClient,
  generateJson,
  generateText,
  safeParseJson,
  DEFAULT_MODEL
};
