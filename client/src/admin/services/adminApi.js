import httpClient from '../../services/httpClient';

export async function fetchAdminDashboardStats() {
  return httpClient.request('/admin/dashboard/stats');
}

export async function fetchAdminSession() {
  return httpClient.request('/admin/session');
}

export async function fetchAdminUsers(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/users${query ? `?${query}` : ''}`);
}

export async function fetchAdminUserDetails(userId) {
  return httpClient.request(`/admin/users/${userId}`);
}

export async function updateAdminUserRole(userId, payload) {
  return httpClient.request(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateAdminUserStatus(userId, payload) {
  return httpClient.request(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminTeachers(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/teachers${query ? `?${query}` : ''}`);
}

export async function fetchAdminTeacherDetails(userId) {
  return httpClient.request(`/admin/teachers/${userId}`);
}

export async function updateAdminTeacherApplication(userId, payload) {
  return httpClient.request(`/admin/teachers/${userId}/application`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateAdminTeacherVerification(userId, payload) {
  return httpClient.request(`/admin/teachers/${userId}/verification`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminAuditLogs(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/audit-logs${query ? `?${query}` : ''}`);
}

export async function fetchAdminQuestions(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/questions${query ? `?${query}` : ''}`);
}

export async function fetchAdminQuestionDetails(questionId) {
  return httpClient.request(`/admin/questions/${questionId}`);
}

export async function approveAdminQuestion(questionId, payload = {}) {
  return httpClient.request(`/admin/questions/${questionId}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function rejectAdminQuestion(questionId, payload) {
  return httpClient.request(`/admin/questions/${questionId}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function editAdminQuestion(questionId, payload) {
  return httpClient.request(`/admin/questions/${questionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminQuestionReports(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/questions/reports${query ? `?${query}` : ''}`);
}

export async function updateAdminQuestionReportStatus(questionId, payload) {
  return httpClient.request(`/admin/questions/reports/${questionId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminQuestionQuality() {
  return httpClient.request('/admin/questions/quality');
}

export async function fetchAdminAcademicTaxonomy() {
  return httpClient.request('/admin/academic-taxonomy/tree');
}

export async function createAdminTaxonomyNode(type, payload) {
  return httpClient.request(`/admin/academic-taxonomy/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateAdminTaxonomyNode(type, nodeId, payload) {
  return httpClient.request(`/admin/academic-taxonomy/${type}/${nodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function archiveAdminTaxonomyNode(type, nodeId, payload = {}) {
  return httpClient.request(`/admin/academic-taxonomy/${type}/${nodeId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function reorderAdminTaxonomyNode(type, nodeId, payload) {
  return httpClient.request(`/admin/academic-taxonomy/${type}/${nodeId}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminBooks(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/books${query ? `?${query}` : ''}`);
}

export async function fetchAdminBookDetails(bookId) {
  return httpClient.request(`/admin/books/${bookId}`);
}

export async function approveAdminBook(bookId, payload = {}) {
  return httpClient.request(`/admin/books/${bookId}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function rejectAdminBook(bookId, payload) {
  return httpClient.request(`/admin/books/${bookId}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminIeltsSets(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/content/ielts-sets${query ? `?${query}` : ''}`);
}

export async function fetchAdminIeltsSetDetails(setType, setId) {
  return httpClient.request(`/admin/content/ielts-sets/${setType}/${setId}`);
}

export async function approveAdminIeltsSet(setType, setId, payload = {}) {
  return httpClient.request(`/admin/content/ielts-sets/${setType}/${setId}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function rejectAdminIeltsSet(setType, setId, payload) {
  return httpClient.request(`/admin/content/ielts-sets/${setType}/${setId}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminNotices(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/content/notices${query ? `?${query}` : ''}`);
}

export async function createAdminNotice(payload) {
  return httpClient.request('/admin/content/notices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateAdminNotice(noticeId, payload) {
  return httpClient.request(`/admin/content/notices/${noticeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function archiveAdminNotice(noticeId) {
  return httpClient.request(`/admin/content/notices/${noticeId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function fetchAdminWaitlist(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/content/waitlist${query ? `?${query}` : ''}`);
}

export async function updateAdminWaitlistContacted(entryId, payload) {
  return httpClient.request(`/admin/content/waitlist/${entryId}/contacted`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
