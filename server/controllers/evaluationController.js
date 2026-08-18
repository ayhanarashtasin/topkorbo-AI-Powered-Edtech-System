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
 *   - qwen/qwen3.6-27b  → vision model (analyzes handwritten images & OCR)
 *   - openai/gpt-oss-120b → text model (reasoning, evaluation & explanations)
 *
 * All endpoints enforce AI quota via enforceAiQuota middleware.
 */

const { Groq } = require('groq-sdk');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Evaluation = require('../models/Evaluation');
const aiEvaluationService = require('../services/aiEvaluationService');
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

// Extracts JSON from AI output that may contain thinking chains, markdown wrappers, etc.
// Handles unclosed <think> tags when the model runs out of tokens mid-thinking.
function extractJson(text) {
  if (!text) return null;
  // 1. Remove completed <think>...</think> or <thought>...</thought> blocks
  let cleaned = text.replace(/<(think|thought)>[\s\S]*?<\/(think|thought)>/gi, '').trim();
  // 2. Remove unclosed thinking tag (model ran out of tokens mid-thinking)
  cleaned = cleaned.replace(/<(think|thought)>[\s\S]*/gi, '').trim();
  // 3. Remove markdown code fences
  cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Try fixing common JSON issues
      try {
        const fixed = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(fixed);
      } catch (e2) {}
    }
  }
  return null;
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

      // Build the grading prompt: student answer is evaluated against
      // the manually authored solution to determine partial credit.
      const manualSolution = question.solution || 'No manual solution provided.';
      const totalMarks = question.totalMarks || 10;
      const rubricText = question.rubricText ? `\nGrading Rubric (use this to determine marks):\n${question.rubricText}` : '';

      const gradingPrompt = `SYSTEM: You are an automated exam grading API. Output ONLY a raw JSON object. No markdown, no code fences, no explanation.

TASK: Grade the student's answer.

REFERENCE ANSWER:
${manualSolution}
${rubricText}

INSTRUCTIONS:
- Evaluate the mathematical and logical correctness of the student's work.
- The REFERENCE ANSWER is a guideline. If the student uses a different but valid method to reach the correct answer, award FULL MARKS.
- Do NOT deduct marks for using alternative correct approaches.
- Total marks available: ${totalMarks}
- Award partial marks based on how many steps/concepts the student got correct.
- Keep feedback SHORT (1-2 sentences max).

OUTPUT (raw JSON only):
{"marks":<number 0 to ${totalMarks}>,"totalMarks":${totalMarks},"score":<marks divided by totalMarks>,"feedback":"<short 1-2 sentence feedback>"}`;

      // ── Step 1: OCR — Transcribe student's handwriting with vision model ──
      let responseText = null;

      try {
        logToFile(`[Step 1] OCR transcription for ${questionId}`);
        const ocrCompletion = await groq.chat.completions.create({
          model: VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe ALL text, math equations, and symbols from this handwritten answer image. Use LaTeX notation for math. Be precise and complete. Output ONLY the transcription, nothing else." },
                { type: "image_url", image_url: { url: studentImageBase64 } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 2048,
          top_p: 1,
          stream: false
        });

        let extractedText = ocrCompletion.choices[0].message.content || '';
        // Strip <think> blocks from OCR output
        extractedText = extractedText.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*/gi, '').trim();
        logToFile(`[Step 1] OCR result (${extractedText.length} chars): ${extractedText.substring(0, 150)}...`);

        if (!extractedText || extractedText.length < 5) {
          throw new Error('OCR produced empty transcription');
        }

        // ── Step 2: Grade — Use text model for reliable JSON output ──────────
        logToFile(`[Step 2] Grading with text model for ${questionId}`);
        const textCompletion = await groq.chat.completions.create({
          model: TEXT_MODEL,
          messages: [
            {
              role: "user",
              content: `${gradingPrompt}\n\nSTUDENT'S ANSWER (transcribed from handwriting):\n${extractedText}`
            }
          ],
          temperature: 1,
          max_completion_tokens: 2048,
          top_p: 1,
          reasoning_effort: "medium",
          stream: false
        });

        responseText = textCompletion.choices[0].message.content;
      } catch (evalError) {
        logToFile(`Two-step evaluation error for ${questionId}: ${evalError.message}`);
        throw evalError;
      }

      if (!responseText) throw new Error("No response generated from models.");
      
      logToFile(`Raw Grading Response for ${questionId}: ${responseText.replace(/\n/g, ' ').substring(0, 300)}`);

      // Parse AI response — extract JSON from thinking chains, markdown, etc.
      let evalData = extractJson(responseText);
      
      // Last resort: manual regex
      if (!evalData || (typeof evalData.marks === 'undefined' && typeof evalData.score === 'undefined')) {
        logToFile(`extractJson failed for ${questionId}. Falling back to regex.`);
        const scoreMatch = responseText.match(/"score"\s*:\s*([\d.]+)/);
        const marksMatch = responseText.match(/"marks"\s*:\s*([\d.]+)/);
        const feedbackMatch = responseText.match(/"feedback"\s*:\s*"([^"]*?)"/);
        
        evalData = evalData || {};
        if (scoreMatch) evalData.score = parseFloat(scoreMatch[1]);
        if (marksMatch) evalData.marks = parseFloat(marksMatch[1]);
        if (feedbackMatch) evalData.feedback = feedbackMatch[1].replace(/\\"/g, '"');
      }

      evaluations[questionId] = {
        score: evalData.score || (evalData.marks ? evalData.marks / totalMarks : 0),
        marks: evalData.marks || 0,
        totalMarks: evalData.totalMarks || totalMarks,
        feedback: evalData.feedback || "No feedback provided."
      };
      logToFile(`Evaluation result for ${questionId}: ${JSON.stringify(evaluations[questionId])}`);
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
      max_tokens: 2048,
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
      max_tokens: 1536,
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

/**
 * POST /api/evaluate/cq
 * ──────────────────────────
 * Evaluate a student's handwritten/typed CQ answer from an uploaded image against Rubric.
 */
exports.evaluateCQ = async (req, res, next) => {
  try {
    const { questionId } = req.body;
    
    // 1. Validate inputs (Security Best Practice)
    if (!questionId) {
      return res.status(400).json({ success: false, message: 'Question ID is required.' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ success: false, message: 'Invalid Question ID format.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Answer image is required.' });
    }

    // 2. Fetch the Question, Reference Answer, and Rubric
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }
    
    if (question.type !== 'cq' && question.type !== 'written') {
      return res.status(400).json({ success: false, message: 'Question is not a CQ or Written type.' });
    }

    const maxScore = question.totalMarks || 10;
    const manualAnswer = question.solution || '';
    const rubric = question.rubricText || '';

    // 3. Prepare Image (Base64)
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    // Validate mimeType to prevent non-image processing (Security Best Practice)
    if (!mimeType.startsWith('image/')) {
       return res.status(400).json({ success: false, message: 'Uploaded file must be an image.' });
    }
    const dataURI = `data:${mimeType};base64,${base64Image}`;

    // 4. Call AI Evaluation Service
    let evaluationResult;
    try {
      evaluationResult = await aiEvaluationService.evaluateImageAnswer(
        dataURI, 
        question.questionText, 
        manualAnswer, 
        rubric,
        maxScore
      );
    } catch (aiError) {
      console.error('AI Evaluation failed:', aiError);
      return res.status(502).json({ 
        success: false, 
        message: 'Failed to evaluate answer due to AI service error. Please try again later.' 
      });
    }

    // 5. Store Evaluation in Database
    const evaluation = new Evaluation({
      student: req.user.id,
      question: questionId,
      imageUrl: 'processed_in_memory_no_permanent_url_yet', // Can be updated if uploaded to Cloudinary
      totalScore: evaluationResult.totalScore,
      maxScore: maxScore,
      rubricBreakdown: evaluationResult.rubricBreakdown,
      generalFeedback: evaluationResult.generalFeedback,
      status: 'graded',
      rawAiResponse: evaluationResult.rawOutput
    });

    await evaluation.save();

    // 6. Return response
    return res.status(200).json({
      success: true,
      evaluation: {
        id: evaluation._id,
        totalScore: evaluation.totalScore,
        maxScore: evaluation.maxScore,
        rubricBreakdown: evaluation.rubricBreakdown,
        generalFeedback: evaluation.generalFeedback,
        status: evaluation.status
      }
    });

  } catch (error) {
    console.error('CQ Evaluation Error:', error);
    // Generic error message to prevent leaking system details
    return res.status(500).json({ 
      success: false, 
      message: 'An unexpected error occurred during evaluation.' 
    });
  }
};

