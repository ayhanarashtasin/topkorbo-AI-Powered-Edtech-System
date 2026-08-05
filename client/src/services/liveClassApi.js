import httpClient from './httpClient';

export async function fetchMentorLiveDashboard() {
  return httpClient.request('/live-class/mentor/dashboard');
}

export async function startMentorLiveClass(payload) {
  return httpClient.request('/live-class/mentor/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function scheduleMentorLiveClass(payload) {
  return httpClient.request('/live-class/mentor/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateMentorScheduledLiveClass(sessionId, payload) {
  return httpClient.request(`/live-class/mentor/schedule/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function endMentorLiveClass(sessionId) {
  return httpClient.request(`/live-class/mentor/${sessionId}/end`, {
    method: 'POST',
  });
}

export async function fetchStudentLiveSessions() {
  return httpClient.request('/live-class/student/sessions');
}

export async function joinStudentLiveClass(roomName) {
  return httpClient.request('/live-class/student/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName }),
  });
}
