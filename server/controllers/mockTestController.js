/**
 * Mock Test Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles persisting completed mock test results and computing ranking/percentile
 * against all historical attempts with the same filter criteria.
 *
 * Currently exposes a single endpoint:
 *   POST /api/mock-tests/attempts → save a completed attempt + compute rank
 *
 * The question-fetching logic lives in questionController.fetchMockTestQuestions
 * because it's shared across mock tests, QBank exams, and battle mode.
 */

const MockTestAttempt = require('../models/MockTestAttempt');

/**
 * Safely coerce a value to a finite number, defaulting to 0 for NaN/Infinity.
 * Prevents bad client data from corrupting MongoDB documents.
 */
function clampNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * POST /api/mock-tests/attempts
 * ──────────────────────────────
 * Called by the client after exam submission to record the result.
 *
 * Ranking algorithm:
 *   1. Count how many existing attempts have a higher score → overallPosition
 *   2. Percentile = ((totalAttempts - rank + 1) / totalAttempts) × 100
 *
 * This is a simple O(n) count per insert. For a future optimization,
 * consider a materialized leaderboard collection with TTL-based caching.
 */
exports.createAttempt = async (req, res, next) => {
  try {
    const { config, summary, subjectBreakdown } = req.body || {};

    if (!config || !summary) {
      return res.status(400).json({ success: false, message: 'Attempt config and summary are required.' });
    }

    const score = Math.max(0, clampNumber(summary.score));

    // Count attempts with a strictly better score to determine this attempt's rank.
    const betterCount = await MockTestAttempt.countDocuments({
      'summary.score': { $gt: score }
    });
    const totalAttemptsBeforeInsert = await MockTestAttempt.countDocuments();
    const totalAttempts = totalAttemptsBeforeInsert + 1;
    const overallPosition = betterCount + 1;

    // Percentile: what % of all attempts this score is equal-to-or-better-than.
    // Floor at 1 so no one ever shows 0th percentile.
    const percentile = totalAttempts
      ? Math.max(1, Math.round(((totalAttempts - overallPosition + 1) / totalAttempts) * 100))
      : 100;

    const attempt = await MockTestAttempt.create({
      student: req.user.id,
      config: {
        standards: Array.isArray(config.standards) ? config.standards : [],
        questionType: config.questionType || '',
        duration: clampNumber(config.duration),
        negativeMarking: !!config.negativeMarking,
        totalQuestions: clampNumber(config.totalQuestions)
      },
      summary: {
        score,
        correct: clampNumber(summary.correct),
        wrong: clampNumber(summary.wrong),
        skipped: clampNumber(summary.skipped),
        total: clampNumber(summary.total),
        timeTakenSeconds: clampNumber(summary.timeTakenSeconds),
        writtenUploadedCount: clampNumber(summary.writtenUploadedCount)
      },
      subjectBreakdown: Array.isArray(subjectBreakdown)
        ? subjectBreakdown.map((entry) => ({
          subject: entry.subject || 'Unknown',
          correct: clampNumber(entry.correct),
          wrong: clampNumber(entry.wrong),
          skipped: clampNumber(entry.skipped),
          total: clampNumber(entry.total),
          score: clampNumber(entry.score)
        }))
        : [],
      ranking: {
        overallPosition,
        totalAttempts,
        percentile
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        _id: attempt._id,
        ranking: attempt.ranking
      }
    });
  } catch (err) {
    next(err);
  }
};
