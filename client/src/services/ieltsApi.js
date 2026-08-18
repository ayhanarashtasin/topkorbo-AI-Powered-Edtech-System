/**
 * IELTS Client API Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides centralized, authenticated HTTP client methods for all IELTS operations:
 * Listening, Reading, Writing, Speaking Appointments, and AI Evaluations.
 */

import { httpClient } from './httpClient';

const { request, requestWithAuth, buildHeaders } = httpClient;

/**
 * Fetch all available IELTS listening sets
 */
export function getListeningSets() {
  return request('/ielts/listening/sets', { headers: buildHeaders() });
}

/**
 * Upload an IELTS listening set (multipart/form-data)
 */
export function uploadListeningSet(formData) {
  return requestWithAuth('/ielts/listening/upload', {
    method: 'POST',
    body: formData
  });
}

/**
 * Fetch all approved IELTS teachers
 */
export function getApprovedTeachers() {
  return request('/ielts/teachers', { headers: buildHeaders() });
}

/**
 * Request a speaking test appointment
 */
export function requestAppointment({ teacherId, date, timeSlot, message }) {
  return request('/ielts/appointments', {
    method: 'POST',
    body: JSON.stringify({ teacherId, date, timeSlot, message })
  });
}

/**
 * Fetch speaking appointments for current user (student or teacher)
 */
export function getAppointments() {
  return request('/ielts/appointments', { headers: buildHeaders() });
}

/**
 * Update speaking test appointment status (accepted/rejected)
 */
export function updateAppointmentStatus(appointmentId, { status, meetingLink }) {
  return request(`/ielts/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, meetingLink })
  });
}

/**
 * Fetch all IELTS writing sets
 */
export function getWritingSets() {
  return request('/ielts/writing/sets', { headers: buildHeaders() });
}

/**
 * Upload an IELTS writing set (multipart/form-data)
 */
export function uploadWritingSet(formData) {
  return requestWithAuth('/ielts/writing/upload', {
    method: 'POST',
    body: formData
  });
}

/**
 * Delete an IELTS writing set
 */
export function deleteWritingSet(id) {
  return request(`/ielts/writing/sets/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Evaluate IELTS writing responses with AI examiner
 */
export function evaluateWriting({ setId, task1Answer, task2Answer }) {
  return request('/ielts/writing/evaluate', {
    method: 'POST',
    body: JSON.stringify({ setId, task1Answer, task2Answer })
  });
}

/**
 * Fetch all IELTS reading sets
 */
export function getReadingSets() {
  return request('/ielts/reading/sets', { headers: buildHeaders() });
}

/**
 * Upload an IELTS reading set (multipart/form-data)
 */
export function uploadReadingSet(formData) {
  return requestWithAuth('/ielts/reading/upload', {
    method: 'POST',
    body: formData
  });
}

export default {
  getListeningSets,
  uploadListeningSet,
  getApprovedTeachers,
  requestAppointment,
  getAppointments,
  updateAppointmentStatus,
  getWritingSets,
  uploadWritingSet,
  deleteWritingSet,
  evaluateWriting,
  getReadingSets,
  uploadReadingSet
};
