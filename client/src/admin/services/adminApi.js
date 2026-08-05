import httpClient from '../../services/httpClient';

export async function fetchAdminDashboardStats() {
  return httpClient.request('/admin/dashboard/stats');
}

export async function fetchAdminAnalyticsOverview(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/analytics/overview${query ? `?${query}` : ''}`);
}

export async function fetchAdminPaymentHistory(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(`/admin/payments${query ? `?${query}` : ''}`);
}

export async function fetchAdminPaymentPlans(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(`/admin/payments/plans${query ? `?${query}` : ''}`);
}

export async function createAdminPaymentPlan(payload) {
  return httpClient.request('/admin/payments/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateAdminPaymentPlan(planId, payload) {
  return httpClient.request(`/admin/payments/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function archiveAdminPaymentPlan(planId, payload) {
  return httpClient.request(`/admin/payments/plans/${planId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
}

export async function grantAdminPremiumAccess(userId, payload) {
  return httpClient.request(`/admin/payments/users/${userId}/grant-premium`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function revokeAdminPremiumAccess(userId, payload) {
  return httpClient.request(`/admin/payments/users/${userId}/revoke-premium`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminLoginHistory(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(`/admin/security/logins${query ? `?${query}` : ''}`);
}

export async function fetchAdminSecuritySignals(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(`/admin/security/suspicious-activity${query ? `?${query}` : ''}`);
}

export async function fetchAdminPlatformSettings() {
  return httpClient.request('/admin/settings/platform');
}

export async function updateAdminPlatformSettings(payload) {
  return httpClient.request('/admin/settings/platform', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
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

export async function resetAdminTeacherLiveSessions(userId, payload = {}) {
  return httpClient.request(`/admin/teachers/${userId}/live-sessions/reset`, {
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

export async function fetchAdminNotificationAudienceStats() {
  return httpClient.request('/admin/notifications/stats');
}

export async function fetchAdminBroadcasts(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/notifications/broadcasts${query ? `?${query}` : ''}`);
}

export async function createAdminBroadcast(payload) {
  return httpClient.request('/admin/notifications/broadcasts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminSupportTickets(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/support/tickets${query ? `?${query}` : ''}`);
}

export async function fetchAdminSupportTicketDetails(ticketId) {
  return httpClient.request(`/admin/support/tickets/${ticketId}`);
}

export async function updateAdminSupportTicketStatus(ticketId, payload) {
  return httpClient.request(`/admin/support/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateAdminSupportTicketPriority(ticketId, payload) {
  return httpClient.request(`/admin/support/tickets/${ticketId}/priority`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function replyAdminSupportTicket(ticketId, payload) {
  return httpClient.request(`/admin/support/tickets/${ticketId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function addAdminSupportTicketNote(ticketId, payload) {
  return httpClient.request(`/admin/support/tickets/${ticketId}/note`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminFeedbackEntries(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/support/feedback${query ? `?${query}` : ''}`);
}

export async function fetchAdminFeedbackDetails(feedbackId) {
  return httpClient.request(`/admin/support/feedback/${feedbackId}`);
}

export async function updateAdminFeedbackStatus(feedbackId, payload) {
  return httpClient.request(`/admin/support/feedback/${feedbackId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function addAdminFeedbackNote(feedbackId, payload) {
  return httpClient.request(`/admin/support/feedback/${feedbackId}/note`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminModerationReports(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/moderation/reports${query ? `?${query}` : ''}`);
}

export async function fetchAdminModerationReportDetails(reportId) {
  return httpClient.request(`/admin/moderation/reports/${reportId}`);
}

export async function markAdminModerationReportUnderReview(reportId, payload = {}) {
  return httpClient.request(`/admin/moderation/reports/${reportId}/under-review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function dismissAdminModerationReport(reportId, payload = {}) {
  return httpClient.request(`/admin/moderation/reports/${reportId}/dismiss`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function resolveAdminModerationReport(reportId, payload = {}) {
  return httpClient.request(`/admin/moderation/reports/${reportId}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function addAdminModerationReportNote(reportId, payload) {
  return httpClient.request(`/admin/moderation/reports/${reportId}/note`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function warnAdminModerationReportUser(reportId, payload = {}) {
  return httpClient.request(`/admin/moderation/reports/${reportId}/warn`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function hideAdminModerationReportContent(reportId, payload = {}) {
  return httpClient.request(`/admin/moderation/reports/${reportId}/hide`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateAdminModerationReportUserStatus(reportId, payload) {
  return httpClient.request(`/admin/moderation/reports/${reportId}/user-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminModerationAppeals(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/moderation/appeals${query ? `?${query}` : ''}`);
}

export async function fetchAdminModerationAppealDetails(appealId) {
  return httpClient.request(`/admin/moderation/appeals/${appealId}`);
}

export async function approveAdminModerationAppeal(appealId, payload = {}) {
  return httpClient.request(`/admin/moderation/appeals/${appealId}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function rejectAdminModerationAppeal(appealId, payload = {}) {
  return httpClient.request(`/admin/moderation/appeals/${appealId}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function addAdminModerationAppealNote(appealId, payload) {
  return httpClient.request(`/admin/moderation/appeals/${appealId}/note`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
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

export async function fetchAdminContests(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return httpClient.request(`/admin/contests${query ? `?${query}` : ''}`);
}

export async function fetchAdminContestDetails(contestId) {
  return httpClient.request(`/admin/contests/${contestId}`);
}

export async function createAdminContest(payload) {
  return httpClient.request('/admin/contests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateAdminContest(contestId, payload) {
  return httpClient.request(`/admin/contests/${contestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function cancelAdminContest(contestId, payload) {
  return httpClient.request(`/admin/contests/${contestId}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function archiveAdminContest(contestId, payload = {}) {
  return httpClient.request(`/admin/contests/${contestId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminLiveContestSummary(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(`/admin/contests/live/summary${query ? `?${query}` : ''}`);
}

export async function fetchAdminLiveContestParticipants(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(`/admin/contests/live/participants${query ? `?${query}` : ''}`);
}

export async function fetchAdminSuspiciousAttempts(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(`/admin/contests/anti-cheat${query ? `?${query}` : ''}`);
}

export async function fetchAdminAttemptDetails(resultId) {
  return httpClient.request(`/admin/contests/anti-cheat/${resultId}`);
}

export async function flagAdminAttempt(resultId, payload) {
  return httpClient.request(`/admin/contests/anti-cheat/${resultId}/flag`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function clearAdminAttemptFlag(resultId, payload = {}) {
  return httpClient.request(`/admin/contests/anti-cheat/${resultId}/clear`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function addAdminAttemptReviewNote(resultId, payload) {
  return httpClient.request(`/admin/contests/anti-cheat/${resultId}/review-note`, {
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
