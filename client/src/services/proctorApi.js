/**
 * proctorApi.js
 *
 * Client for AI proctoring endpoints. Used by the admin panel to
 * fetch violation records and review them.
 */

import { httpClient } from './httpClient';

/**
 * Fetch all proctor violations for a contest (admin/teacher).
 * @param {string} contestId
 * @param {{ page?: number, limit?: number, studentId?: string }} params
 */
export function getContestViolations(contestId, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(
    `/contests/${contestId}/proctor/violations${query ? `?${query}` : ''}`,
    { timeoutMs: 30000 }
  );
}

/**
 * Review (confirm or dismiss) a proctor violation (admin/teacher).
 * @param {string} violationId
 * @param {{ status: string, reviewNote?: string }} payload
 */
export function reviewViolation(violationId, payload) {
  return httpClient.request(`/contests/proctor/violations/${violationId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}
