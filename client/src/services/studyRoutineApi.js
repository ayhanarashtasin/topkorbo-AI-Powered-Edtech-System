import { httpClient } from './httpClient';

const { request, buildHeaders } = httpClient;

export function getStudyRoutine() {
  return request('/study-routine', {
    headers: buildHeaders()
  });
}

export function saveStudyRoutine(routine, examInfo, studentProfile, opts = {}) {
  return request('/study-routine', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      routine,
      examInfo,
      studentProfile,
      startDate: opts.startDate || null,
      durationDays: opts.durationDays || null
    })
  });
}

export function toggleSegment(dayId, segmentId, completed) {
  return request('/study-routine/segment', {
    method: 'PATCH',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ dayId, segmentId, completed })
  });
}

export function updateSegment(dayId, segmentId, fields) {
  return request('/study-routine/segment/edit', {
    method: 'PATCH',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ dayId, segmentId, fields })
  });
}

export function replaceRoutine(routine, opts = {}) {
  return request('/study-routine/replace', {
    method: 'PUT',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      routine,
      startDate: opts.startDate || null,
      durationDays: opts.durationDays || null
    })
  });
}

export function modifyRoutineAI(message, currentRoutine) {
  return request('/study-routine/modify', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, currentRoutine })
  });
}

export function deleteStudyRoutine() {
  return request('/study-routine', {
    method: 'DELETE',
    headers: buildHeaders()
  });
}

export function generateNextWeek() {
  return request('/study-routine/generate-week', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' })
  });
}

export function getStudyStats() {
  return request('/study-routine/stats', {
    headers: buildHeaders()
  });
}

export function startFocusSession(dayId, segmentId) {
  return request('/study-routine/session/start', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ dayId, segmentId })
  });
}

export function stopFocusSession(sessionId, completed) {
  return request('/study-routine/session/stop', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sessionId, completed })
  });
}

export const studyRoutineApi = {
  get: getStudyRoutine,
  save: saveStudyRoutine,
  toggleSegment,
  updateSegment,
  replaceRoutine,
  modifyRoutineAI,
  delete: deleteStudyRoutine,
  getStats: getStudyStats,
  startSession: startFocusSession,
  stopSession: stopFocusSession,
  generateNextWeek
};