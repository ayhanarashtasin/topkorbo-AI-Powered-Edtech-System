import { httpClient } from './httpClient';

const { request, buildHeaders } = httpClient;

/**
 * Fetch the caller's study routine and active session.
 */
export function getRoutine() {
  return request('/study-routine', {
    headers: buildHeaders()
  });
}

/**
 * Save student profile and generate the first 7 days routine.
 */
export function saveRoutine(data) {
  return request('/study-routine', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
    timeoutMs: 60000
  });
}

/**
 * Replace entire routine array or document fields.
 */
export function replaceRoutine(data) {
  return request('/study-routine', {
    method: 'PUT',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
}

/**
 * Delete the caller's study routine and clear active sessions.
 */
export function deleteRoutine() {
  return request('/study-routine', {
    method: 'DELETE',
    headers: buildHeaders()
  });
}

/**
 * Toggle segment completion status.
 */
export function toggleSegment(dayIndex, segmentId) {
  return request(`/study-routine/${dayIndex}/${segmentId}/toggle`, {
    method: 'PATCH',
    headers: buildHeaders()
  });
}

/**
 * Update segment details (subject, chapter, task, duration, etc.).
 */
export function editSegment(dayIndex, segmentId, data) {
  return request(`/study-routine/${dayIndex}/${segmentId}`, {
    method: 'PUT',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
}

/**
 * Get aggregated study stats (hours, streaks, subject distribution).
 */
export function getStats() {
  return request('/study-routine/stats', {
    headers: buildHeaders()
  });
}

/**
 * Start a live focus timer session.
 */
export function startSession(data) {
  return request('/study-routine/session/start', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
}

/**
 * Stop the active focus timer session and record completed duration.
 */
export function stopSession(data = {}) {
  return request('/study-routine/session/stop', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
}

/**
 * Generate 7 days routine directly from student profile.
 */
export function aiGenerate(studentProfile) {
  return request('/study-routine/ai/chat', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ studentProfile }),
    timeoutMs: 90000
  });
}

/**
 * Modify routine with natural language query through AI coach.
 */
export function aiModify(message, currentRoutine) {
  return request('/study-routine/ai/modify', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, currentRoutine }),
    timeoutMs: 60000
  });
}

/**
 * Generate next 7 days adaptively based on past completion rates.
 */
export function aiGenerateWeek() {
  return request('/study-routine/ai/generate-week', {
    method: 'POST',
    headers: buildHeaders(),
    timeoutMs: 60000
  });
}

export default {
  getRoutine,
  saveRoutine,
  replaceRoutine,
  deleteRoutine,
  toggleSegment,
  editSegment,
  getStats,
  startSession,
  stopSession,
  aiGenerate,
  aiModify,
  aiGenerateWeek
};
