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
