/**
 * practiceApi.js
 *
 * Client for the /api/practice endpoints. Records every Mock Test,
 * QBank inline practice, and free practice session a student takes.
 *
 * Backed by `httpClient` so auth + error envelope are handled uniformly.
 */

import { httpClient } from './httpClient';

const { request, buildHeaders } = httpClient;

/**
 * Submit a new practice attempt. Server returns the persisted document
 * including recomputed `marks` aggregate.
 *
 * @param {object} payload - see PracticeAttempt schema
 * @returns {Promise<object>} the saved attempt
 */
export function submitAttempt(payload) {
  return request('/practice', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
}

/**
 * List the caller's attempts with optional filters.
 *
 * @param {{
 *   mode?: string,
 *   subject?: string,
 *   paper?: string,
 *   chapter?: string,
 *   topic?: string,
 *   minPercentage?: number,
 *   maxPercentage?: number,
 *   from?: string,
 *   to?: string,
 *   limit?: number,
 *   skip?: number,
 *   sort?: string
 * }} [params]
 */
export function listMyAttempts(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/practice${suffix}`, { headers: buildHeaders() });
}

/**
 * Fetch a single attempt (includes the full per-question detail and
 * the AI-graded written feedback). Includes the base64 written images
 * because they're useful for the review screen.
 *
 * @param {string} id
 */
export function getAttempt(id) {
  return request(`/practice/${id}`, { headers: buildHeaders() });
}

/**
 * Soft-delete an attempt owned by the caller.
 *
 * @param {string} id
 */
export function deleteAttempt(id) {
  return request(`/practice/${id}`, {
    method: 'DELETE',
    headers: buildHeaders()
  });
}

/**
 * Update post-submission notes attached to an attempt.
 *
 * @param {string} id
 * @param {string} notes
 */
export function updateNotes(id, notes) {
  return request(`/practice/${id}/notes`, {
    method: 'PATCH',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ notes })
  });
}

/**
 * Aggregate stats: overall accuracy, by-mode, by-subject, by-chapter,
 * 10 most recent attempts, and a 14-day trend.
 */
export function getStats() {
  return request('/practice/stats/summary', { headers: buildHeaders() });
}

/**
 * Fetch the compact daily solved totals used by the dashboard heatmap.
 * Unlike listMyAttempts, this does not transfer question snapshots.
 */
export function getDashboardActivity(timezone) {
  const params = new URLSearchParams();
  if (timezone) params.set('timezone', timezone);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request(`/practice/dashboard-activity${suffix}`, { headers: buildHeaders() });
}

/* ------------------------------------------------------------------ */
/*  Convenience builder used by the Mock Test submit flow             */
/* ------------------------------------------------------------------ */

/**
 * Build a PracticeAttempt payload from the data already in memory
 * inside MockTestExam. This keeps the submit handler readable and
 * gives a single place to evolve the payload shape.
 *
 * @param {{
 *   mode: 'mock_test' | 'qbank_practice' | 'free_practice' | 'inline_qbank',
 *   title: string,
 *   contestId?: string,
 *   config: object,
 *   questions: any[],
 *   answers: Record<string, number>,
 *   writtenAnswers: Record<string, string>,
 *   writtenEvaluations: Record<string, { score: number, feedback: string }>,
 *   startedAt: number,
 *   durationMinutes: number,
 *   negativeMarking?: boolean
 * }} input
 */
export function buildAttemptPayload(input) {
  const {
    mode,
    title,
    contestId = null,
    questions = [],
    answers = {},
    writtenAnswers = {},
    writtenEvaluations = {},
    startedAt,
    durationMinutes,
    negativeMarking = false
  } = input;

  const now = new Date();
  const start = startedAt ? new Date(startedAt) : now;
  const elapsedSec = Math.max(0, Math.round((now - start) / 1000));
  const allowedSec = (durationMinutes || 0) * 60;
  const timeTaken = allowedSec > 0 ? Math.min(elapsedSec, allowedSec) : elapsedSec;

  const perQuestion = questions.map((q, idx) => {
    const qid = q._id || q.id || String(idx);
    const isMCQ = q.type === 'mcq';
    const selectedIndex = answers[qid];
    const writtenImg = writtenAnswers[qid] || '';
    const evalEntry = writtenEvaluations[qid];

    const isAttempted = isMCQ
      ? selectedIndex !== undefined && selectedIndex !== null
      : Boolean(writtenImg);
    let isCorrect = null;
    let score = 0;
    const maxScore = typeof q.marks === 'number' ? q.marks : 1;

    if (isMCQ) {
      if (isAttempted) {
        const correctIdx = findCorrectIndex(q);
        isCorrect = selectedIndex === correctIdx;
        if (isCorrect) score = maxScore;
        else if (negativeMarking) score = -0.25 * maxScore;
      }
    } else {
      if (isAttempted && evalEntry) {
        const s = parseFloat(evalEntry.score);
        if (!isNaN(s)) score = Math.max(0, Math.min(maxScore, s * maxScore));
      }
    }

    return {
      questionId: qid,
      snapshot: {
        type: q.type || 'mcq',
        questionText: q.questionText || q.text || '',
        imageUrl: q.imageUrl || '',
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: findCorrectIndex(q),
        cq: q.cq || { description: '', parts: [] },
        marks: maxScore,
        solution: q.solution || ''
      },
      subject: q.subject || '',
      paper: q.paper || '',
      chapter: q.chapter || '',
      topic: q.topic || '',
      source: q.source || (contestId ? 'contest' : 'mock_test'),
      selectedIndex: isMCQ ? selectedIndex ?? null : null,
      writtenImageBase64: writtenImg,
      writtenText: '',
      isCorrect,
      isAttempted,
      score,
      maxScore,
      timeSpentSeconds: 0,
      aiFeedback: evalEntry ? evalEntry.feedback || '' : '',
      flagged: false,
      answeredAt: now.toISOString()
    };
  });

  const totalMarks = perQuestion.reduce((s, q) => s + q.maxScore, 0);

  return {
    mode,
    title,
    contestId,
    config: {
      durationMinutes: durationMinutes || 0,
      totalMarks,
      negativeMarking,
      negativePenalty: 0.25,
      passingMarks: 0,
      questionCount: perQuestion.length
    },
    questions: perQuestion,
    timing: {
      startedAt: start.toISOString(),
      submittedAt: now.toISOString(),
      timeTakenSeconds: timeTaken
    },
    notes: ''
  };
}

function findCorrectIndex(q) {
  if (typeof q.correctIndex === 'number') return q.correctIndex;
  if (!Array.isArray(q.options)) return -1;
  return q.options.findIndex((o) => o && o.isCorrect);
}

/* ------------------------------------------------------------------ */
/*  Convenience builder for the QBank inline-practice flow (option B) */
/* ------------------------------------------------------------------ */

/**
 * Build a lightweight `inline_qbank` attempt for a single question the
 * student just answered in the QBank browser.
 *
 * @param {{
 *   question: any,
 *   selectedIndex: number | null,
 *   timeSpentSeconds?: number
 * }} input
 */
export function buildInlinePayload({ question, selectedIndex, timeSpentSeconds = 0 }) {
  const correctIdx = findCorrectIndex(question);
  const maxScore = typeof question.marks === 'number' ? question.marks : 1;
  const isAttempted = selectedIndex !== undefined && selectedIndex !== null;
  const isCorrect = isAttempted ? selectedIndex === correctIdx : null;
  const score = isCorrect ? maxScore : 0;

  return {
    mode: 'inline_qbank',
    title: `QBank: ${question.subject || 'Practice'}${question.chapter ? ' · ' + question.chapter : ''}`,
    contestId: null,
    config: {
      durationMinutes: 0,
      totalMarks: maxScore,
      negativeMarking: false,
      negativePenalty: 0,
      passingMarks: 0,
      questionCount: 1
    },
    questions: [
      {
        questionId: question._id || question.id || null,
        snapshot: {
          type: question.type || 'mcq',
          questionText: question.questionText || question.text || '',
          imageUrl: question.imageUrl || '',
          options: Array.isArray(question.options) ? question.options : [],
          correctIndex: correctIdx,
          cq: question.cq || { description: '', parts: [] },
          marks: maxScore,
          solution: question.solution || ''
        },
        subject: question.subject || '',
        paper: question.paper || '',
        chapter: question.chapter || '',
        topic: question.topic || '',
        source: 'qbank',
        selectedIndex: isAttempted ? selectedIndex : null,
        writtenImageBase64: '',
        writtenText: '',
        isCorrect,
        isAttempted,
        score,
        maxScore,
        timeSpentSeconds,
        aiFeedback: '',
        flagged: false,
        answeredAt: new Date().toISOString()
      }
    ],
    timing: {
      startedAt: new Date(Date.now() - timeSpentSeconds * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      timeTakenSeconds: timeSpentSeconds
    },
    notes: ''
  };
}

export default {
  submitAttempt,
  listMyAttempts,
  getAttempt,
  deleteAttempt,
  updateNotes,
  getStats,
  getDashboardActivity,
  buildAttemptPayload,
  buildInlinePayload
};
