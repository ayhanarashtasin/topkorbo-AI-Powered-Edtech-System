import httpClient from './httpClient';

export async function fetchMentors(options = {}) {
  const params = new URLSearchParams();
  if (options.sort) params.set('sort', options.sort);
  if (options.university) params.set('university', options.university);
  const query = params.toString();
  return httpClient.request(`/mentor-connections/mentors${query ? `?${query}` : ''}`);
}

export async function fetchMentorProfile(mentorId) {
  return httpClient.request(`/mentor-connections/mentors/${mentorId}`);
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

export async function submitMentorReview(mentorId, payload) {
  return httpClient.request(`/mentor-connections/mentors/${mentorId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function respondToMentorRequest(connectionId, action) {
  return httpClient.request(`/mentor-connections/requests/${connectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
}
