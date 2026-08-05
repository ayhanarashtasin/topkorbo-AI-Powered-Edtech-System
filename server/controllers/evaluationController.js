/**
 * Evaluation Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * AI-powered evaluation and tutoring for written/CQ answers.
 *
 * Endpoints (mounted at /api/evaluate):
 *   POST /written  → grade handwritten answers via Groq vision model
 *   POST /explain  → generate step-by-step solution explanation
 *   POST /chat     → multi-turn tutoring chat about a question
 *
 * AI models used:
 *   - qwen/qwen3.6-27b  → vision model (analyzes handwritten images)
 *   - openai/gpt-oss-120b → text model (generates explanations)
 *
 * All endpoints enforce AI quota via enforceAiQuota middleware.
 */

const { Groq } = require('groq-sdk');
const Question = require('../models/Question');
const fs = require('fs');
const path = require('path');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const VISION_MODEL = "qwen/qwen3.6-27b";
const TEXT_MODEL = "openai/gpt-oss-120b";

function logToFile(msg) {
  try {
    const logPath = path.join(__dirname, '..', 'evaluation.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

/**
 * POST /api/evaluate/written
 * ──────────────────────────
 * Evaluates one or more handwritten answers by comparing student images
 * against the manual solution stored on each Question document.
 *
 * Flow:
 *   1. For each answer, fetch the Question to get the manual solution
 *   2. Send the student's image + solution to the vision model
 *   3. Parse the JSON response for score (0-1) and feedback
 *   4. Fall back to regex extraction if JSON parsing fails
 *
 * Returns: { [questionId]: { score, feedback } }
 */
exports.evaluateWrittenAnswers = async (req, res) => {
  try {
    logToFile(`--- NEW EVALUATION REQUEST ---`);
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ msg: 'Invalid answers format' });
    }

    const evaluations = {};

    for (const answer of answers) {
      const { questionId, studentImageBase64 } = answer;
      const question = await Question.findById(questionId);

      logToFile(`Evaluating question: ${questionId}`);

      if (!question) {
        logToFile(`Question not found: ${questionId}`);
        continue;
      }

      // Build the grading prompt: student image is compared against
      // the manually authored solution to determine partial credit.
      const manualSolution = question.solution || 'No manual solution provided.';

      const promptText = `You are an expert examiner grading a student's written exam.
Compare the student's solution (provided as an image) with the manual solution below:

Manual Solution:
${manualSolution}

Analyze how well the student's answer matches the manual solution.
Give partial marks as a score between 0 and 1 (e.g., if it's 60% correct, give 0.6).
Provide a brief feedback explaining your grading.

Return ONLY a valid JSON object in the following format:
{
  "score": 0.6,
  "feedback": "Your explanation goes here."
}
No markdown, no extra text.

CRITICAL FORMATTING INSTRUCTIONS FOR FEEDBACK:
1. You MUST wrap all mathematical variables, formulas, equations, or numbers with units in single dollar signs (e.g. $t \\\\approx 6$ s, $\\\\theta \\\\approx 107.46^\\\\circ$, $BC \\\\approx 65.92$ m, $\\\\cos\\\\theta = -\\\\frac{3}{10}$) so they can be rendered correctly.
2. You MUST double-escape all backslashes in your JSON string (use \\\\theta instead of \\theta, and \\\\approx instead of \\approx, \\\\frac instead of \\frac).
3. Do not use raw math symbols or variables without the dollar sign wrappers. Every mathematical term must be enclosed in single dollar signs (e.g., $x$, $y$).
4. NEVER use \\(...\\) or \\[...\\] delimiters. ONLY use $...$ for inline math and $$...$$ for display math.`;

      const completion = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: studentImageBase64 } }
            ]
          }
        ],
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
        stop: null,
        response_format: { type: "json_object" }
      });

      const responseText = completion.choices[0].message.content;
      logToFile(`Raw Groq Response for ${questionId}: ${responseText.replace(/\n/g, ' ')}`);

      // Parse AI response — fall back to regex if the model returns malformed JSON
      let evalData = { score: 0, feedback: "Failed to evaluate." };
      try {
        evalData = JSON.parse(responseText);
      } catch (e) {
        logToFile(`JSON Parse error for ${questionId}. Falling back to regex.`);

        const scoreMatch = responseText.match(/"score"\s*:\s*([\d.]+)/);
        const feedbackMatch = responseText.match(/"feedback"\s*:\s*"([\s\S]*?)"\s*\}/);

        if (scoreMatch) evalData.score = parseFloat(scoreMatch[1]);
        if (feedbackMatch) evalData.feedback = feedbackMatch[1].replace(/\\"/g, '"');
        else evalData.feedback = responseText;
      }

      evaluations[questionId] = {
        score: evalData.score || 0,
        feedback: evalData.feedback || ""
      };
      logToFile(`Evaluation successful for ${questionId}: ${JSON.stringify(evaluations[questionId])}`);
    }

    logToFile(`Returning success response.`);
    res.json(evaluations);

  } catch (err) {
    console.error("Evaluation Error details:", err);
    let errMsg = err.message;
    if (err.response) {
      console.error("Groq Response Error:", err.response.data);
      errMsg = JSON.stringify(err.response.data);
    }
    logToFile(`FATAL ERROR: ${errMsg}`);
    res.status(500).json({ msg: err.message || 'Server Error during evaluation', error: err.message });
  }
};

/**
 * POST /api/evaluate/explain
 * ──────────────────────────
 * Generates a step-by-step solution explanation for a question.
 *
 * Two modes:
 *   - With student image: analyzes the student's mistakes and provides
 *     a corrected solution pointing out where they went wrong
 *   - Without image: generates a clean step-by-step solution from scratch
 *
 * Uses vision model when an image is provided, text model otherwise.
 * Returns plain text with $...$ math delimiters for KaTeX rendering.
 */
exports.explainQuestion = async (req, res) => {
  try {
    const { questionId, studentImageBase64 } = req.body;

    if (!questionId) {
      return res.status(400).json({ msg: 'questionId is required' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ msg: 'Question not found' });
    }

    const manualSolution = question.solution || '';
    const questionText = question.questionText || '';

    // Build full question context for the AI prompt
    let optionsText = '';
    if (question.options && question.options.length > 0) {
      optionsText = '\nOptions:\n' + question.options.map((opt, i) => {
        const prefix = ['A', 'B', 'C', 'D'][i] || String(i + 1);
        const correct = opt.isCorrect ? ' (Correct)' : '';
        return `${prefix}. ${opt.text}${correct}`;
      }).join('\n');
    }

    let cqText = '';
    if (question.type === 'cq' && question.cq) {
      cqText = '\nStem: ' + (question.cq.description || '');
      if (question.cq.parts && question.cq.parts.length > 0) {
        cqText += '\nParts:\n' + question.cq.parts.map(p => `(${p.label}) ${p.text}`).join('\n');
      }
    }

    let promptText;
    const messageContent = [];

    if (studentImageBase64) {
      // Student uploaded their attempt — analyze their mistakes
      promptText = `You are a world-class math and science tutor. A student attempted this question and uploaded their handwritten solution as an image.

Question:
${questionText}
${optionsText}
${cqText}

${manualSolution ? `Reference Solution:\n${manualSolution}` : ''}

Instructions:
1. First, read and understand the student's handwritten solution from the image.
2. Provide the COMPLETE correct step-by-step solution with detailed mathematical working.
3. Then, compare the student's work to the correct solution and clearly point out WHERE and WHY the student made mistakes.
4. CRITICAL: Use ONLY $...$ for inline math and $$...$$ for display/block math. NEVER use \\(...\\) or \\[...\\] delimiters.
5. Use clear headings with ** for bold text.
6. Number each step.
7. At the end, add a section titled "**Your Mistakes:**" that specifically addresses the student's errors.

Return ONLY the formatted explanation text. No JSON wrapping.`;

      messageContent.push({ type: "text", text: promptText });
      messageContent.push({
        type: "image_url",
        image_url: { url: studentImageBase64 }
      });
    } else {
      // No image — just generate the full step-by-step solution
      promptText = `You are a world-class math and science tutor. Generate a detailed, step-by-step solution for this question.

Question:
${questionText}
${optionsText}
${cqText}

${manualSolution ? `Reference Solution:\n${manualSolution}` : ''}

Instructions:
1. Provide a COMPLETE step-by-step solution with detailed mathematical working.
2. Explain each step clearly so a student can understand the reasoning.
3. CRITICAL: Use ONLY $...$ for inline math and $$...$$ for display/block math. NEVER use \\(...\\) or \\[...\\] delimiters.
4. Use clear headings with ** for bold text.
5. Number each step.
6. If there are multiple parts, solve each part separately with its own heading.
7. At the end, provide a brief summary of the key concepts used.

Return ONLY the formatted explanation text. No JSON wrapping.`;

      messageContent.push({ type: "text", text: promptText });
    }

    logToFile(`--- AI EXPLANATION REQUEST for ${questionId} (image: ${!!studentImageBase64}) ---`);

    const completion = await groq.chat.completions.create({
      model: studentImageBase64 ? VISION_MODEL : TEXT_MODEL,
      messages: [{ role: "user", content: messageContent }],
      temperature: 0.7,
      max_completion_tokens: 2048,
      top_p: 1,
      stream: false
    });

    const explanation = completion.choices[0].message.content;
    logToFile(`AI Explanation response length: ${explanation.length} chars`);

    res.json({ explanation });

  } catch (err) {
    console.error("Explanation Error:", err);
    logToFile(`EXPLANATION ERROR: ${err.message}`);
    res.status(500).json({ msg: err.message || 'Server Error during explanation' });
  }
};

/**
 * POST /api/evaluate/chat
 * ──────────────────────────
 * Multi-turn tutoring chat about a specific question.
 *
 * Maintains conversation context by accepting the full chat history
 * from the client and prepending a system prompt with the question context.
 *
 * Supports image analysis — if the student uploads a handwritten work
 * image in any message, the vision model is used automatically.
 */
exports.chatQuestion = async (req, res) => {
  try {
    const { questionId, history, message, studentImageBase64 } = req.body;

    if (!questionId) {
      return res.status(400).json({ msg: 'questionId is required' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ msg: 'Question not found' });
    }

    const manualSolution = question.solution || '';
    const questionText = question.questionText || '';

    let optionsText = '';
    if (question.options && question.options.length > 0) {
      optionsText = '\nOptions:\n' + question.options.map((opt, i) => {
        const prefix = ['A', 'B', 'C', 'D'][i] || String(i + 1);
        const correct = opt.isCorrect ? ' (Correct)' : '';
        return `${prefix}. ${opt.text}${correct}`;
      }).join('\n');
    }

    let cqText = '';
    if (question.type === 'cq' && question.cq) {
      cqText = '\nStem: ' + (question.cq.description || '');
      if (question.cq.parts && question.cq.parts.length > 0) {
        cqText += '\nParts:\n' + question.cq.parts.map(p => `(${p.label}) ${p.text}`).join('\n');
      }
    }

    // System prompt establishes the tutor persona and question context
    const systemPrompt = `You are a world-class math and science tutor. The student is asking follow-up questions about the exam question described below.

Question:
${questionText}
${optionsText}
${cqText}

${manualSolution ? `Reference Solution:\n${manualSolution}` : ''}

Instructions:
1. Guide the student step-by-step to understand the concept and solve the question.
2. Be helpful, encouraging, and mathematically precise.
3. If they upload an image, read and analyze their work, pointing out where they did well and where they made errors.
4. CRITICAL: Use ONLY $...$ for inline math and $$...$$ for display/block math. NEVER use \\(...\\) or \\[...\\] delimiters.
5. Keep your tone encouraging and clean. Use standard markdown formatting (like ** for bold, numbered steps, bullet points) as needed.
6. Do NOT output raw emojis.`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Replay conversation history so the model has full context.
    // Messages with images use the content array format; plain text uses a string.
    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        const msgContent = [];

        if (msg.image) {
          msgContent.push({ type: "text", text: msg.content || "" });
          msgContent.push({
            type: "image_url",
            image_url: { url: msg.image }
          });
          messages.push({ role, content: msgContent });
        } else {
          messages.push({ role, content: msg.content || "" });
        }
      });
    }

    // Append the new user message
    const userMessageContent = [];
    userMessageContent.push({ type: "text", text: message || "" });
    if (studentImageBase64) {
      userMessageContent.push({
        type: "image_url",
        image_url: { url: studentImageBase64 }
      });
    }

    messages.push({
      role: "user",
      content: userMessageContent
    });

    logToFile(`--- AI CHAT REQUEST for ${questionId} (history length: ${history ? history.length : 0}, image: ${!!studentImageBase64}) ---`);

    // Use vision model if any message in the conversation contains an image
    const hasImage = studentImageBase64 || (history && history.some(msg => msg.image));
    const completion = await groq.chat.completions.create({
      model: hasImage ? VISION_MODEL : TEXT_MODEL,
      messages: messages,
      temperature: 0.7,
      max_completion_tokens: 1536,
      top_p: 1,
      stream: false
    });

    const response = completion.choices[0].message.content;
    logToFile(`AI Chat response length: ${response.length} chars`);

    res.json({ response });

  } catch (err) {
    console.error("AI Chat Error:", err);
    logToFile(`CHAT ERROR: ${err.message}`);
    res.status(500).json({ msg: err.message || 'Server Error during AI chat' });
  }
};
