import httpClient from './httpClient';

export async function fetchMentors() {
  return httpClient.request('/mentor-connections/mentors');
}

export async function fetchStudentMentorDashboard() {
  return httpClient.request('/mentor-connections/student-dashboard');
}

export async function fetchMentorDashboard() {
  return httpClient.request('/mentor-connections/mentor-dashboard');
}

export async function sendMentorRequest(mentorId) {
  return httpClient.request('/mentor-connections/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mentorId })
  });
}

export async function respondToMentorRequest(connectionId, action) {
  return httpClient.request(`/mentor-connections/requests/${connectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
}
