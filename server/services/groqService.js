const Groq = require('groq-sdk');

const DEFAULT_MODEL = process.env.GROQ_RAG_MODEL || 'llama-3.3-70b-versatile';

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
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function generateJson({ prompt, systemInstruction, model = DEFAULT_MODEL, temperature = 0.2 }) {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ]
  });
  const content = completion?.choices?.[0]?.message?.content || '';
  const json = safeParseJson(content);
  if (!json) {
    const err = new Error('Groq returned invalid JSON');
    err.statusCode = 502;
    err.rawText = content;
    throw err;
  }
  return { json, text: content, completion };
}

async function generateText({ prompt, systemInstruction, model = DEFAULT_MODEL, temperature = 0.3 }) {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ]
  });
  const text = completion?.choices?.[0]?.message?.content?.trim() || '';
  return { text, completion };
}

module.exports = {
  getGroqClient,
  generateJson,
  generateText,
  safeParseJson,
  DEFAULT_MODEL
};
