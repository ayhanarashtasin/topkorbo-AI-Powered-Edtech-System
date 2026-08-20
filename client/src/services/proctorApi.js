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
 * Fetch proctor violations across every contest the signed-in teacher owns
 * (admins are unscoped). Powers the teacher "Cheating Verify" page.
 * @param {{ page?: number, limit?: number, status?: string, contestId?: string }} params
 */
export function getMyContestViolations(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(
    `/contests/proctor/violations/mine${query ? `?${query}` : ''}`,
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

/**
 * Batch review all proctor violations for a student in a contest (admin/teacher).
 * @param {string} contestId
 * @param {string} studentId
 * @param {{ status: string, reviewNote?: string }} payload
 */
export function reviewStudentViolations(contestId, studentId, payload) {
  return httpClient.request(`/contests/${contestId}/proctor/students/${studentId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

/**
 * Delete all proctor violations for a student in a contest (admin/teacher).
 * @param {string} contestId
 * @param {string} studentId
 */
export function deleteStudentViolations(contestId, studentId) {
  return httpClient.request(`/contests/${contestId}/proctor/students/${studentId}`, {
    method: 'DELETE'
  });
}

/**
 * Delete a single proctor violation / snapshot (admin/teacher).
 * @param {string} violationId
 */
export function deleteViolation(violationId) {
  return httpClient.request(`/contests/proctor/violations/${violationId}`, {
    method: 'DELETE'
  });
}


