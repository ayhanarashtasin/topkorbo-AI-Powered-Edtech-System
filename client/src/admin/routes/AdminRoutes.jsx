import { Fragment } from 'react';
import { Navigate, Route } from 'react-router-dom';
import AdminAcademicTaxonomyPage from '../pages/AdminAcademicTaxonomyPage';
import AdminRoute from '../components/AdminRoute';
import AdminAuditLogsPage from '../pages/AdminAuditLogsPage';
import AdminAnalyticsPage from '../pages/AdminAnalyticsPage';
import AdminBooksPage from '../pages/AdminBooksPage';
import AdminContestsPage from '../pages/AdminContestsPage';
import AdminDashboard from '../pages/AdminDashboard';
import AdminIeltsSetsPage from '../pages/AdminIeltsSetsPage';
import AdminModerationPage from '../pages/AdminModerationPage';
import AdminNotificationsPage from '../pages/AdminNotificationsPage';
import AdminNoticesPage from '../pages/AdminNoticesPage';
import AdminPaymentsPage from '../pages/AdminPaymentsPage';
import AdminPlaceholderPage from '../pages/AdminPlaceholderPage';
import AdminQuestionsPage from '../pages/AdminQuestionsPage';
import AdminSecurityPage from '../pages/AdminSecurityPage';
import AdminSettingsPage from '../pages/AdminSettingsPage';
import AdminSupportPage from '../pages/AdminSupportPage';
import AdminTeachersPage from '../pages/AdminTeachersPage';
import AdminUsersPage from '../pages/AdminUsersPage';
import AdminWaitlistPage from '../pages/AdminWaitlistPage';

const placeholderRoutes = [
  {
    path: 'content-approval',
    title: 'Content Approval',
    description: 'Unified approval queues across books, question sets, and future content modules will be built here.',
    bullets: ['Approval inbox', 'Reviewer workflow', 'Escalation states']
  }
];

export function renderAdminRoutes() {
  return (
    <Fragment>
      <Route path="/admin" element={<AdminRoute />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="teachers" element={<AdminTeachersPage />} />
        <Route path="teachers/applications" element={<AdminTeachersPage />} />
        <Route path="teachers/verification" element={<AdminTeachersPage />} />
        <Route path="questions" element={<AdminQuestionsPage />} />
        <Route path="questions/pending" element={<AdminQuestionsPage />} />
        <Route path="questions/reports" element={<AdminQuestionsPage />} />
        <Route path="questions/quality" element={<AdminQuestionsPage />} />
        <Route path="questions/import-export" element={<AdminQuestionsPage />} />
        <Route path="books" element={<AdminBooksPage />} />
        <Route path="contests" element={<AdminContestsPage />} />
        <Route path="contests/live" element={<AdminContestsPage />} />
        <Route path="contests/anti-cheat" element={<AdminContestsPage />} />
        <Route path="content/ielts-sets" element={<AdminIeltsSetsPage />} />
        <Route path="content/notices" element={<AdminNoticesPage />} />
        <Route path="content/waitlist" element={<AdminWaitlistPage />} />
        <Route path="academic-taxonomy" element={<AdminAcademicTaxonomyPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="support" element={<AdminSupportPage />} />
        <Route path="support/feedback" element={<AdminSupportPage />} />
        <Route path="moderation" element={<AdminModerationPage />} />
        <Route path="moderation/appeals" element={<AdminModerationPage />} />
        <Route path="reports" element={<Navigate to="/admin/moderation" replace />} />
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
        <Route path="security" element={<AdminSecurityPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        {placeholderRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <AdminPlaceholderPage
                title={route.title}
                description={route.description}
                bullets={route.bullets}
              />
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Fragment>
  );
}
