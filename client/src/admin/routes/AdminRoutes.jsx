import { Fragment } from 'react';
import { Navigate, Route } from 'react-router-dom';
import AdminAcademicTaxonomyPage from '../pages/AdminAcademicTaxonomyPage';
import AdminRoute from '../components/AdminRoute';
import AdminAuditLogsPage from '../pages/AdminAuditLogsPage';
import AdminBooksPage from '../pages/AdminBooksPage';
import AdminDashboard from '../pages/AdminDashboard';
import AdminIeltsSetsPage from '../pages/AdminIeltsSetsPage';
import AdminNoticesPage from '../pages/AdminNoticesPage';
import AdminPlaceholderPage from '../pages/AdminPlaceholderPage';
import AdminQuestionsPage from '../pages/AdminQuestionsPage';
import AdminTeachersPage from '../pages/AdminTeachersPage';
import AdminUsersPage from '../pages/AdminUsersPage';
import AdminWaitlistPage from '../pages/AdminWaitlistPage';

const placeholderRoutes = [
  {
    path: 'contests',
    title: 'Contests',
    description: 'Contest oversight and lifecycle controls will appear here once the admin workflows are built.',
    bullets: ['Contest review', 'Schedule controls', 'Contest issue handling']
  },
  {
    path: 'reports',
    title: 'Moderation Reports',
    description: 'Moderation workflows already have backend support; this route is reserved for the richer admin review UI.',
    bullets: ['Open report queue', 'Action history', 'Reviewer notes']
  },
  {
    path: 'support',
    title: 'Support',
    description: 'Support tickets and admin response workflows are scaffolded here for a future backend module.',
    bullets: ['Ticket inbox', 'Priority labels', 'Resolution tracking']
  },
  {
    path: 'notifications',
    title: 'Notifications',
    description: 'Administrative announcements, broadcast tools, and notification management will be implemented here.',
    bullets: ['Broadcast composer', 'Notification history', 'Audience targeting']
  },
  {
    path: 'settings',
    title: 'Settings',
    description: 'System configuration, policy toggles, and platform-wide admin preferences will live here.',
    bullets: ['General settings', 'Policy controls', 'Operational defaults']
  },
  {
    path: 'content-approval',
    title: 'Content Approval',
    description: 'Unified approval queues across books, question sets, and future content modules will be built here.',
    bullets: ['Approval inbox', 'Reviewer workflow', 'Escalation states']
  },
  {
    path: 'analytics',
    title: 'Analytics',
    description: 'Platform metrics, growth analysis, and performance tracking dashboards will be added here.',
    bullets: ['Usage trends', 'Growth reports', 'Engagement analysis']
  },
  {
    path: 'payments',
    title: 'Payments',
    description: 'Payment operations, reconciliations, and revenue analytics will be expanded here.',
    bullets: ['Payment ledger', 'Refund review', 'Revenue insights']
  },
  {
    path: 'security',
    title: 'Security',
    description: 'Access control reviews, incident management, and security administration will be added here.',
    bullets: ['Role audits', 'Session oversight', 'Incident controls']
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
        <Route path="content/ielts-sets" element={<AdminIeltsSetsPage />} />
        <Route path="content/notices" element={<AdminNoticesPage />} />
        <Route path="content/waitlist" element={<AdminWaitlistPage />} />
        <Route path="academic-taxonomy" element={<AdminAcademicTaxonomyPage />} />
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
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
