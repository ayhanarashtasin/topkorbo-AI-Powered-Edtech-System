const Contest = require('../models/Contest');
const User = require('../models/User');
const ContestResult = require('../models/ContestResult');
const RatingHistory = require('../models/RatingHistory');
const {
  resolveContestDates,
  getContestLifecycle
} = require('../utils/contestSchedule');

// ============================================================================
// Scoring constants — tune here.
// ============================================================================
const CORRECT_POINTS = 100; // awarded once, when a question is first solved
const WRONG_PENALTY = 20; // subtracted per wrong attempt (livePoints floored at 0)

// Rating a student starts from before their first rated contest.
const INITIAL_RATING = 0;

const RATING_RANKS = [
  { title: 'Newbie', min: 0 },
  { title: 'Pupil', min: 1200 },
  { title: 'Specialist', min: 1400 },
  { title: 'Expert', min: 1600 },
  { title: 'Candidate Master', min: 1900 },
  { title: 'Master', min: 2100 },
  { title: 'International Master', min: 2300 },
  { title: 'Grandmaster', min: 2400 }
];

function getRatingRankTitle(rating) {
  const value = Number.isFinite(Number(rating)) ? Number(rating) : INITIAL_RATING;
  let rank = RATING_RANKS[0];
  for (const candidate of RATING_RANKS) {
    if (value >= candidate.min) rank = candidate;
  }
  return rank.title;
}

/**
 * Bonus points awarded at settlement for finishing high on the board.
 */
function rankBonus(rank, participants) {
  if (!rank || rank < 1) return 0;
  if (rank === 1) return 200;
  if (rank === 2) return 150;
  if (rank === 3) return 100;
  if (participants > 0 && rank <= Math.ceil(participants * 0.1)) return 50;
  return 0;
}

/**
 * Performance rating a student "earned" in one contest, derived purely from
 * their real standing among actual participants.
 *  - Multiple participants: top rank ≈ 2400, last rank ≈ 800.
 *  - Solo participant: scaled from their real score percentage.
 */
function contestPerformance(rank, participants, percentage) {
  if (participants <= 1) {
    const pct = Math.max(0, Math.min(100, percentage || 0));
    return Math.round(800 + (pct / 100) * 1200);
  }
  const standing = (participants - rank) / (participants - 1); // 1 = best, 0 = worst
  return Math.round(800 + standing * 1600);
}

/**
 * Sort ContestResults by live standing and assign ranks (ties share a rank,
 * disqualified results are pushed to the bottom). Returns a new array with a
 * `rank` (Number) or 'DQ' attached to each item.
 */
function rankResults(results) {
  const sorted = [...results].sort((a, b) => {
    if (a.isDisqualified && !b.isDisqualified) return 1;
    if (!a.isDisqualified && b.isDisqualified) return -1;
    if ((b.livePoints || 0) !== (a.livePoints || 0)) {
      return (b.livePoints || 0) - (a.livePoints || 0);
    }
    // Earlier last-change wins the tiebreak.
    const at = a.lastPointsChangeAt ? new Date(a.lastPointsChangeAt).getTime() : Infinity;
    const bt = b.lastPointsChangeAt ? new Date(b.lastPointsChangeAt).getTime() : Infinity;
    return at - bt;
  });

  let lastPoints = null;
  let lastTime = null;
  let currentRank = 0;

  return sorted.map((item, index) => {
    if (item.isDisqualified) {
      return { ...item, rank: 'DQ' };
    }
    const points = item.livePoints || 0;
    const time = item.lastPointsChangeAt ? new Date(item.lastPointsChangeAt).getTime() : Infinity;
    if (points !== lastPoints || time !== lastTime) {
      currentRank = index + 1;
    }
    lastPoints = points;
    lastTime = time;
    return { ...item, rank: currentRank };
  });
}

/**
 * Build the live leaderboard for a running (or ended) contest, ranked by points.
 * Used both by the per-answer broadcast and the socket join initial emit.
 */
async function buildLiveLeaderboard(contestId, limit = 10) {
  const results = await ContestResult.find({ contest: contestId, isDisqualified: { $ne: true } })
    .populate('student', 'name username')
    .lean();

  const ranked = rankResults(results).slice(0, limit);
  return ranked.map((r) => ({
    rank: r.rank,
    student: r.student ? { _id: r.student._id, name: r.student.name, username: r.student.username } : null,
    livePoints: r.livePoints || 0,
    score: r.score || 0
  }));
}

/**
 * Finalize a single contest exactly once: rank all participants by live points,
 * bank their points to the account, and update their skill rating. Idempotent —
 * safe to call repeatedly (guarded by contest.ratingsSettled + the RatingHistory
 * unique index).
 */
async function settleContest(contestId) {
  const contest = await Contest.findById(contestId);
  if (!contest) return { settled: false, reason: 'not_found' };
  if (contest.ratingsSettled) return { settled: false, reason: 'already_settled' };

  const lifecycle = getContestLifecycle(contest);
  if (lifecycle !== 'ended') return { settled: false, reason: 'not_ended' };

  const { endDate } = resolveContestDates(contest);
  const results = await ContestResult.find({ contest: contestId }).lean();
  const ranked = rankResults(results);

  for (const item of ranked) {
    const studentId = item.student;
    if (!studentId) continue;

    const isDq = item.rank === 'DQ';
    const rank = isDq ? results.length : item.rank;
    const participants = ranked.filter((r) => r.rank !== 'DQ').length;
    const livePoints = isDq ? 0 : Math.max(0, item.livePoints || 0);
    const pointsEarned = isDq ? 0 : Math.max(0, livePoints + rankBonus(rank, participants));

    const user = await User.findById(studentId);
    if (!user) continue;

    const oldRating = Number.isFinite(user.rating) ? user.rating : INITIAL_RATING;
    // Percentage is only used as a solo-participant fallback for the rating curve.
    const maxPossible = (item.totalQuestions || 0) * CORRECT_POINTS;
    const percentage = maxPossible > 0 ? (livePoints / maxPossible) * 100 : 0;
    const performance = contestPerformance(rank, participants, percentage);
    const delta = Math.round((performance - oldRating) / 2);
    const newRating = Math.max(0, oldRating + delta);

    let created = false;
    try {
      await RatingHistory.create({
        student: studentId,
        contest: contest._id,
        contestName: contest.name || 'Contest',
        contestDate: endDate,
        rank,
        participants,
        score: item.score || 0,
        totalQuestions: item.totalQuestions || 0,
        pointsEarned,
        oldRating,
        newRating,
        delta
      });
      created = true;
    } catch (writeErr) {
      // Unique index (student, contest) guards against double settlement.
      if (writeErr.code !== 11000) throw writeErr;
    }

    await ContestResult.updateOne(
      { _id: item._id },
      { $set: { pointsEarned, finalRank: isDq ? null : rank } }
    );

    // Only mutate account totals when this is the first time we rated the pair,
    // so re-running settlement can never double-bank points.
    if (created) {
      await User.updateOne(
        { _id: studentId },
        {
          $set: { rating: newRating, maxRating: Math.max(user.maxRating || 0, newRating) },
          $inc: { contestPoints: pointsEarned, contestsPlayed: 1 }
        }
      );
    }
  }

  contest.ratingsSettled = true;
  contest.settledAt = new Date();
  await contest.save();

  return { settled: true, participants: ranked.length };
}

/**
 * Find every contest that has ended but not yet been settled and settle them.
 * Runs on a schedule and as a lazy fallback.
 */
async function settleEndedContests() {
  const candidates = await Contest.find({
    ratingsSettled: { $ne: true },
    adminStatus: { $ne: 'cancelled' }
  }).lean();

  const now = new Date();
  let settledCount = 0;
  for (const contest of candidates) {
    if (getContestLifecycle(contest, now) !== 'ended') continue;
    try {
      const res = await settleContest(contest._id);
      if (res.settled) settledCount += 1;
    } catch (err) {
      console.error(`Failed to settle contest ${contest._id}:`, err);
    }
  }
  return { settledCount };
}

module.exports = {
  CORRECT_POINTS,
  WRONG_PENALTY,
  INITIAL_RATING,
  RATING_RANKS,
  getRatingRankTitle,
  rankBonus,
  contestPerformance,
  rankResults,
  buildLiveLeaderboard,
  settleContest,
  settleEndedContests
};
