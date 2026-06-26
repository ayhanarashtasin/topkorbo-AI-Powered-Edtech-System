const MockTestAttempt = require('../models/MockTestAttempt');

function clampNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

exports.createAttempt = async (req, res, next) => {
  try {
    const { config, summary, subjectBreakdown } = req.body || {};

    if (!config || !summary) {
      return res.status(400).json({ success: false, message: 'Attempt config and summary are required.' });
    }

    const score = Math.max(0, clampNumber(summary.score));
    const betterCount = await MockTestAttempt.countDocuments({
      'summary.score': { $gt: score }
    });
    const totalAttemptsBeforeInsert = await MockTestAttempt.countDocuments();
    const totalAttempts = totalAttemptsBeforeInsert + 1;
    const overallPosition = betterCount + 1;
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
