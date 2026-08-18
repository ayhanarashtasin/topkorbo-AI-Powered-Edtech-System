const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const VISION_MODEL = "qwen/qwen3.6-27b";
const TEXT_MODEL = "openai/gpt-oss-120b";

/**
 * Extracts JSON from AI output that may contain <think> blocks, markdown, etc.
 * Handles cases where <think> is opened but never closed (token limit hit).
 */
function extractJson(text) {
  if (!text) return null;

  // 1. Remove completed <think>...</think> or <thought>...</thought> blocks
  let cleaned = text.replace(/<(think|thought)>[\s\S]*?<\/(think|thought)>/gi, '').trim();

  // 2. If there's an unclosed thinking tag, strip everything to the end
  cleaned = cleaned.replace(/<(think|thought)>[\s\S]*/gi, '').trim();

  // 3. Remove markdown code fences
  cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  // 3. Try to find and parse a JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Try to fix common JSON issues (trailing commas, etc.)
      try {
        const fixed = jsonMatch[0]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(fixed);
      } catch (e2) {}
    }
  }
  return null;
}

/**
 * Extracts marks/score from raw text using regex when JSON parsing fails.
 * Searches both the thinking chain and any partial output for grading signals.
 */
function extractMarksFromText(text, maxScore) {
  if (!text) return null;

  const result = {};

  // Look for marks patterns like "marks": 5, "score": 1.0, etc.
  const marksMatch = text.match(/"marks"\s*:\s*([\d.]+)/);
  const scoreMatch = text.match(/"score"\s*:\s*([\d.]+)/);
  const totalScoreMatch = text.match(/"totalScore"\s*:\s*([\d.]+)/);
  const feedbackMatch = text.match(/"feedback"\s*:\s*"([^"]*?)"/);
  const generalFeedbackMatch = text.match(/"generalFeedback"\s*:\s*"([^"]*?)"/);

  if (marksMatch) result.marks = parseFloat(marksMatch[1]);
  if (scoreMatch) result.score = parseFloat(scoreMatch[1]);
  if (totalScoreMatch) result.totalScore = parseFloat(totalScoreMatch[1]);
  if (feedbackMatch) result.feedback = feedbackMatch[1];
  if (generalFeedbackMatch) result.generalFeedback = generalFeedbackMatch[1];

  // Also try to infer marks from the thinking chain itself
  // Look for patterns like "award full marks", "5/5", "all 5 marks"
  if (!result.marks && !result.totalScore) {
    const fullMarksPattern = new RegExp(`award\\s+full\\s+marks|${maxScore}\\s*/\\s*${maxScore}|all\\s+${maxScore}\\s+marks`, 'i');
    if (fullMarksPattern.test(text)) {
      result.marks = maxScore;
    }

    // Look for "X marks" or "X/maxScore" patterns
    const marksPattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:\\/\\s*${maxScore}|\\s+out\\s+of\\s+${maxScore}|\\s*marks?\\s+(?:out\\s+of|from)\\s+${maxScore})`, 'i');
    const marksFromText = text.match(marksPattern);
    if (marksFromText) {
      result.marks = parseFloat(marksFromText[1]);
    }
  }

  return (result.marks !== undefined || result.totalScore !== undefined || result.score !== undefined) ? result : null;
}

/**
 * Service to evaluate a student's answer (as an image) using a two-step approach:
 * Step 1: OCR — Use vision model to transcribe the handwritten answer
 * Step 2: Grade — Use text model to compare transcription against reference answer
 *
 * This avoids the problem where "thinking" models (like Qwen 3) consume all tokens
 * on internal reasoning before producing the JSON output.
 */
exports.evaluateImageAnswer = async (base64Image, questionText, manualAnswer, rubric, maxScore) => {
  const gradingPrompt = `SYSTEM: You are an automated exam grading API. Output ONLY a raw JSON object. No markdown, no code fences, no explanation.

TASK: Grade the student's answer.

QUESTION: "${questionText || 'N/A'}"
REFERENCE ANSWER: "${manualAnswer || 'N/A'}"
RUBRIC: "${rubric || 'Grade based on accuracy and completeness'}"
TOTAL MARKS: ${maxScore}

INSTRUCTIONS:
- Evaluate the mathematical and logical correctness of the student's work.
- The REFERENCE ANSWER is a guideline. If the student uses a different but valid method to reach the correct answer, award FULL MARKS.
- Do NOT deduct marks for using alternative correct approaches.
- Award partial marks for partially correct work.
- Keep generalFeedback to 1-2 sentences.

OUTPUT (raw JSON only):
{"totalScore":<number 0 to ${maxScore}>,"rubricBreakdown":[{"criterion":"<name>","pointsAwarded":<number>,"feedback":"<short>"}],"generalFeedback":"<1-2 sentences>"}`;

  try {
    console.log('[AI Eval] Starting two-step OCR → Grade evaluation');

    // ── Step 1: OCR — Transcribe the student's handwritten answer ──────────
    let extractedText = '';
    try {
      const ocrResponse = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe ALL text, math equations, and symbols from this handwritten answer image. Use LaTeX notation for math. Be precise and complete. Output ONLY the transcription, nothing else."
              },
              { type: "image_url", image_url: { url: base64Image } }
            ],
          }
        ],
        model: VISION_MODEL,
        temperature: 0.1,
        max_tokens: 2048,
      });

      const rawOcr = ocrResponse.choices[0]?.message?.content || '';
      // Strip <think> blocks from OCR output too
      extractedText = rawOcr.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*/gi, '').trim();
      console.log(`[AI Eval] OCR extracted ${extractedText.length} chars`);
    } catch (ocrError) {
      console.error('[AI Eval] OCR failed:', ocrError.message);
      throw new Error(`OCR failed: ${ocrError.message}`);
    }

    if (!extractedText || extractedText.length < 5) {
      throw new Error('OCR produced empty or too short transcription');
    }

    // ── Step 2: Grade — Use text model for reliable JSON grading ────────────
    let aiOutput = null;
    try {
      const gradeResponse = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `${gradingPrompt}\n\nSTUDENT'S ANSWER (transcribed from handwriting):\n${extractedText}`
          }
        ],
        model: TEXT_MODEL,
        temperature: 1,
        max_completion_tokens: 2048,
        top_p: 1,
        reasoning_effort: "medium"
      });

      aiOutput = gradeResponse.choices[0]?.message?.content;
      console.log(`[AI Eval] Grading response: ${(aiOutput || '').substring(0, 200)}`);
    } catch (gradeError) {
      console.error('[AI Eval] Text grading failed:', gradeError.message);
      throw new Error(`Grading failed: ${gradeError.message}`);
    }

    if (!aiOutput) {
      throw new Error("Empty response from grading model");
    }

    // ── Parse the grading result ────────────────────────────────────────────
    let parsedResult = extractJson(aiOutput);

    // Fallback: try regex extraction if JSON parsing failed
    if (!parsedResult) {
      console.warn('[AI Eval] JSON extraction failed, trying regex fallback');
      parsedResult = extractMarksFromText(aiOutput, maxScore);
    }

    if (!parsedResult) {
      console.error('[AI Eval] All parsing failed. Raw output:', aiOutput);
      throw new Error("Failed to extract grading result from AI response");
    }

    const totalScore = parsedResult.totalScore ?? parsedResult.marks ?? 0;

    return {
      totalScore: Math.min(totalScore, maxScore),
      rubricBreakdown: Array.isArray(parsedResult.rubricBreakdown) ? parsedResult.rubricBreakdown : [],
      generalFeedback: parsedResult.generalFeedback || parsedResult.feedback || "Evaluation completed.",
      rawOutput: aiOutput
    };

  } catch (error) {
    console.error("[AI Evaluation Service Error]:", error.message);
    throw new Error(`Failed to evaluate answer image: ${error.message}`);
  }
};
