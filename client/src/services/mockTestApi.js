/**
 * mockTestApi.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Client service for mock test attempt persistence.
 *
 * This is intentionally minimal — the main question-fetching logic uses
 * a direct fetch() call in MockTest.jsx because it needs to handle the
 * paywall response (notifyPaywall) inline before navigation.
 *
 * This service only handles the post-submission attempt recording.
 */

import httpClient from './httpClient';

/**
 * Saves a completed mock test attempt to the server.
 * Called by MockTestExam.jsx after exam submission.
 *
 * @param {object} payload - { config, summary, subjectBreakdown }
 * @returns {Promise<{ ranking: { overallPosition, totalAttempts, percentile } }>}
 */
export async function createMockTestAttempt(payload) {
  return httpClient.request('/mock-tests/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
