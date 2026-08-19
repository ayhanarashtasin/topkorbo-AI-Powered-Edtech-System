/**
 * IELTS Service Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * Encapsulates all business logic, LLM (Groq) integrations, OCR transcriptions,
 * writing response evaluations, and score calculations for the IELTS module.
 */

const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY || 'placeholder_key';
  return new Groq({ apiKey });
}

const VISION_MODEL = process.env.VISION_MODEL || 'qwen/qwen3.6-27b';
const TEXT_MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-120b';

/**
 * Normalizes question set approval status.
 */
function normalizeApprovalStatus(doc) {
  return ['pending', 'approved', 'rejected'].includes(doc?.approvalStatus)
    ? doc.approvalStatus
    : 'approved';
}

/**
 * Builds standard approval filter for public/student queries.
 */
function buildApprovedOrLegacyMatch() {
  return {
    $or: [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false } },
      { approvalStatus: null }
    ]
  };
}

/**
 * Builds user-role specific query filter for IELTS sets.
 */
function buildSetQueryForUser(user) {
  if (user?.role === 'admin' || user?.role === 'teacher') return {};
  return buildApprovedOrLegacyMatch();
}

/**
 * Safely unlinks a file from disk.
 */
function deleteLocalFile(urlPath) {
  if (!urlPath) return;
  try {
    const filePath = path.isAbsolute(urlPath) ? urlPath : path.join(__dirname, '..', urlPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error('Error deleting file:', e.message);
  }
}

/**
 * Generates clean prompt text from PDF, Image, or plain text using Groq LLM.
 */
async function generateCleanPrompt(type, filePath, textContent) {
  if (type === 'text') {
    return textContent ? textContent.trim() : '';
  }

  if (type === 'pdf') {
    try {
      const { extractPdfPages } = require('./pdfService');
      const buffer = fs.readFileSync(filePath);
      const pages = await extractPdfPages(buffer);
      const rawText = pages.map((p) => p.text).join('\n').trim();

      if (!rawText) {
        return 'Empty PDF document. Could not extract text.';
      }

      const prompt = `Format the following extracted raw text of an IELTS writing question set into a clean, professional, and well-structured written question format. Remove any irrelevant OCR artifacts, page numbers, or headers. Provide only the clean, complete question text itself:\n\n${rawText}`;

      const completion = await getGroqClient().chat.completions.create({
        model: TEXT_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are an IELTS exam compiler. Format raw extracted text into clean, typed written IELTS exam prompts.' },
          { role: 'user', content: prompt }
        ]
      });

      return completion?.choices?.[0]?.message?.content?.trim() || rawText;
    } catch (err) {
      console.error('Error generating clean prompt from PDF:', err);
      return 'PDF Document Prompt';
    }
  }

  if (type === 'image') {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';

      const base64Image = imageBuffer.toString('base64');

      const completion = await getGroqClient().chat.completions.create({
        model: VISION_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe and rewrite this IELTS writing prompt image into a clean, typed written/described version of the question. Describe any charts, graphs, maps, diagrams, or pie charts in clean textual detail as if it were a typed description, so it can be easily understood in text format. Do not use generic placeholders; output a clean, self-contained typed prompt version of the question.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ]
      });

      return completion?.choices?.[0]?.message?.content?.trim() || 'Image Document Prompt';
    } catch (err) {
      console.error('Error generating clean prompt from image:', err);
      return 'Image Document Prompt';
    }
  }

  return '';
}

/**
 * Rounds a decimal score to official IELTS 0.5 band increments.
 */
function roundToIeltsBand(score) {
  const fraction = score - Math.floor(score);
  if (fraction < 0.25) {
    return Math.floor(score);
  } else if (fraction < 0.75) {
    return Math.floor(score) + 0.5;
  } else {
    return Math.ceil(score);
  }
}

/**
 * Evaluates an individual IELTS Writing task response using Groq AI examiner.
 */
async function evaluateTask(task, taskLabel, studentAnswer) {
  if (!task || !studentAnswer || !studentAnswer.trim()) {
    return null;
  }

  const taskPromptText = task.cleanPrompt || task.textPrompt || `${taskLabel} prompt.`;

  const promptText = `You are an expert IELTS Writing examiner. Evaluate the student's response for the following task:

Task Type: ${taskLabel}
Task Prompt / Question:
${taskPromptText}

Student's Answer:
${studentAnswer}

Please grade the response according to the official IELTS assessment criteria:
1. Task Achievement / Response (0-9)
2. Coherence and Cohesion (0-9)
3. Lexical Resource (0-9)
4. Grammatical Range and Accuracy (0-9)

Provide an overall band score for this task (0-9, can be in 0.5 increments, e.g. 6.5, 7.0).
Provide detailed feedback and specific suggestions for improvement.

Return ONLY a valid JSON object in this exact format:
{
  "bandScore": 6.5,
  "criteria": {
    "taskAchievement": { "score": 6.5, "comments": "Explanation for task achievement." },
    "coherenceCohesion": { "score": 6.0, "comments": "Explanation for coherence and cohesion." },
    "lexicalResource": { "score": 7.0, "comments": "Explanation for lexical resource." },
    "grammaticalRangeAccuracy": { "score": 6.5, "comments": "Explanation for grammatical range and accuracy." }
  },
  "feedback": "Overall narrative feedback on the writing response.",
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2"
  ]
}
Do not return any other text, markdown formatting (outside the JSON structure), or explanations.`;

  try {
    const completion = await getGroqClient().chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: 'You are an IELTS exam evaluator. Evaluate written responses and output JSON.' },
        { role: 'user', content: promptText }
      ],
      temperature: 0.3
    });

    const contentText = completion.choices[0].message.content;
    return JSON.parse(contentText);
  } catch (err) {
    console.error(`Error evaluating ${taskLabel}:`, err);
    return {
      bandScore: 0,
      criteria: {
        taskAchievement: { score: 0, comments: err.message },
        coherenceCohesion: { score: 0, comments: err.message },
        lexicalResource: { score: 0, comments: err.message },
        grammaticalRangeAccuracy: { score: 0, comments: err.message }
      },
      feedback: `Failed to evaluate: ${err.message}`,
      suggestions: []
    };
  }
}

/**
 * Full IELTS Writing set evaluation across Task 1 and Task 2.
 */
async function evaluateWritingSet(set, task1Answer, task2Answer) {
  const [eval1, eval2] = await Promise.all([
    evaluateTask(set.task1, 'Task 1', task1Answer),
    evaluateTask(set.task2, 'Task 2', task2Answer)
  ]);

  let overallBandScore = 0;
  if (eval1 && eval2) {
    // Official IELTS weighting: Task 2 is weighted double compared to Task 1
    const weightedAverage = (eval1.bandScore + 2 * eval2.bandScore) / 3;
    overallBandScore = roundToIeltsBand(weightedAverage);
  } else if (eval1) {
    overallBandScore = eval1.bandScore;
  } else if (eval2) {
    overallBandScore = eval2.bandScore;
  }

  return {
    overallBandScore,
    task1Evaluation: eval1,
    task2Evaluation: eval2
  };
}

module.exports = {
  normalizeApprovalStatus,
  buildApprovedOrLegacyMatch,
  buildSetQueryForUser,
  generateCleanPrompt,
  roundToIeltsBand,
  evaluateTask,
  evaluateWritingSet,
  deleteLocalFile
};
