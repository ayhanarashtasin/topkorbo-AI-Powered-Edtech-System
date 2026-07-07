import { useEffect, useState } from 'react';
import {
  HiMiniAcademicCap,
  HiMiniBell,
  HiMiniBookOpen,
  HiMiniChartBarSquare,
  HiMiniChatBubbleLeftRight,
  HiMiniClipboardDocumentCheck,
  HiMiniDocumentText,
  HiMiniExclamationTriangle,
  HiMiniQueueList,
  HiMiniShieldCheck,
  HiMiniTrophy,
  HiMiniUsers
} from 'react-icons/hi2';
import AdminBadge from '../components/AdminBadge';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatCard from '../components/AdminStatCard';
import { fetchAdminDashboardStats } from '../services/adminApi';

const DEFAULT_DATA = {
  stats: {
    totalUsers: 0,
    students: 0,
    teachers: 0,
    premiumUsers: 0,
    pendingTeacherApplications: 0,
    pendingQuestions: 0,
    pendingBooks: 0,
    pendingIeltsSets: 0,
    reports: 0,
    supportTickets: 0,
    feedbackInbox: 0,
    waitlistEntries: 0,
    activeNotices: 0,
    sentBroadcasts: 0,
    auditEvents: 0,
    contests: 0,
    ieltsSets: 0,
    unreadNotifications: 0,
    totalRevenue: 0
  },
  systemHealth: {
    api: 'operational',
    database: 'unknown',
    uptimeSeconds: 0
  }
};

const CARD_CONFIG = [
  { key: 'totalUsers', label: 'Total users', hint: 'Registered accounts across the platform', icon: <HiMiniUsers />, tone: 'info' },
  { key: 'students', label: 'Students', hint: 'Learners currently onboarded', icon: <HiMiniAcademicCap />, tone: 'neutral' },
  { key: 'teachers', label: 'Teachers', hint: 'Approved teacher accounts', icon: <HiMiniClipboardDocumentCheck />, tone: 'success' },
  { key: 'premiumUsers', label: 'Premium users', hint: 'Paid or manually granted active premium access', icon: <HiMiniShieldCheck />, tone: 'success' },
  { key: 'pendingTeacherApplications', label: 'Teacher applications', hint: 'Waiting for admin review', icon: <HiMiniQueueList />, tone: 'warning' },
  { key: 'pendingQuestions', label: 'Pending questions', hint: 'Question bank items awaiting approval', icon: <HiMiniDocumentText />, tone: 'neutral' },
  { key: 'pendingBooks', label: 'Pending books', hint: 'Unpublished reading uploads', icon: <HiMiniBookOpen />, tone: 'neutral' },
  { key: 'pendingIeltsSets', label: 'Pending IELTS', hint: 'Listening and writing sets awaiting review', icon: <HiMiniAcademicCap />, tone: 'warning' },
  { key: 'reports', label: 'Reports', hint: 'Open moderation issues', icon: <HiMiniExclamationTriangle />, tone: 'danger' },
  { key: 'supportTickets', label: 'Support tickets', hint: 'Open support issues needing admin attention', icon: <HiMiniChatBubbleLeftRight />, tone: 'neutral' },
  { key: 'feedbackInbox', label: 'Feedback inbox', hint: 'New or reviewed feedback still in admin workflow', icon: <HiMiniBell />, tone: 'info' },
  { key: 'auditEvents', label: 'Audit events', hint: 'Recorded admin actions across completed phases', icon: <HiMiniShieldCheck />, tone: 'neutral' },
  { key: 'contests', label: 'Contests', hint: 'All contest records', icon: <HiMiniTrophy />, tone: 'info' },
  { key: 'totalRevenue', label: 'Revenue', hint: 'Validated payment totals', icon: <HiMiniChartBarSquare />, tone: 'success', format: 'currency' }
];

function formatValue(value, format) {
  if (format === 'currency') {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  return new Intl.NumberFormat('en-US').format(value || 0);
}

export default function AdminDashboard() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const payload = await fetchAdminDashboardStats();
        if (active) {
          setData({
            stats: { ...DEFAULT_DATA.stats, ...(payload?.stats || {}) },
            systemHealth: { ...DEFAULT_DATA.systemHealth, ...(payload?.systemHealth || {}) }
          });
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load admin dashboard');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <AdminLoadingState label="Loading admin dashboard..." />;
  }

  if (error) {
    return (
      <div className="admin-page-error">
        <div className="admin-page-error__card">
          <h3>Dashboard unavailable</h3>
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { stats, systemHealth } = data;

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Dashboard"
        description="Central operations view for platform health, approval queues, and admin workload."
        badge={{ label: `${stats.unreadNotifications} unread notifications`, tone: 'info' }}
      />

      <div className="admin-overview-grid">
        <article className="admin-hero__banner">
          <p className="admin-topbar__eyebrow">Platform overview</p>
          <h3>Real platform counts now back the admin dashboard across approvals, moderation, support, notifications, payments, and audit history.</h3>
          <p>
            This view now pulls directly from the live admin-side collections already in use, so queues and totals reflect current operational workload instead of phase-era placeholders.
          </p>
        </article>

        <article className="admin-health-card">
          <div className="admin-health-card__row">
            <div>
              <p className="admin-topbar__eyebrow">System health</p>
              <strong>{systemHealth.api}</strong>
            </div>
            <AdminBadge tone={systemHealth.database === 'connected' ? 'success' : 'warning'}>
              {systemHealth.database}
            </AdminBadge>
          </div>
          <p>Uptime: {Math.floor((systemHealth.uptimeSeconds || 0) / 60)} minutes</p>
          <p>Audit events tracked: {formatValue(stats.auditEvents)}</p>
          <p>Active notices and broadcasts: {formatValue(stats.activeNotices)} / {formatValue(stats.sentBroadcasts)}</p>
        </article>
      </div>

      <div className="admin-stats-grid">
        {CARD_CONFIG.map((card) => (
          <AdminStatCard
            key={card.key}
            label={card.label}
            value={formatValue(stats[card.key], card.format)}
            hint={card.hint}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="admin-panels-grid">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Priority queues</h3>
              <p className="admin-panel__subtext">The first places an admin usually needs to look.</p>
            </div>
          </div>

          <div className="admin-queue-list">
            <article className="admin-queue-item">
              <div>
                <strong>Teacher applications</strong>
                <p>New educator approvals and follow-ups</p>
              </div>
              <AdminBadge tone="warning">{stats.pendingTeacherApplications}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>Moderation reports</strong>
                <p>Open and under-review community reports needing action</p>
              </div>
              <AdminBadge tone="danger">{stats.reports}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>Question approvals</strong>
                <p>Question bank items waiting in the approval queue</p>
              </div>
              <AdminBadge tone="neutral">{stats.pendingQuestions}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>Book approvals</strong>
                <p>Unpublished book uploads awaiting review</p>
              </div>
              <AdminBadge tone="neutral">{stats.pendingBooks}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>IELTS approvals</strong>
                <p>Listening and writing sets currently waiting for admin review</p>
              </div>
              <AdminBadge tone="warning">{stats.pendingIeltsSets}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>Support and feedback</strong>
                <p>Open tickets plus feedback entries still moving through admin review</p>
              </div>
              <AdminBadge tone="info">{stats.supportTickets + stats.feedbackInbox}</AdminBadge>
            </article>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Current coverage</h3>
              <p className="admin-panel__subtext">What the admin console already handles in this phase.</p>
            </div>
          </div>

          <ul className="admin-list">
            <li>
              <div>
                <strong>Protected admin access</strong>
                <span>Role-checked routing with refresh-safe JWT session handling</span>
              </div>
              <AdminBadge tone="success" size="sm">Live</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Admin operations</strong>
                <span>{formatValue(stats.auditEvents)} audit events, {formatValue(stats.unreadNotifications)} unread notifications, and {formatValue(stats.totalRevenue, 'currency')} validated revenue tracked</span>
              </div>
              <AdminBadge tone="success" size="sm">Live</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Content and support</strong>
                <span>{formatValue(stats.ieltsSets)} IELTS sets, {formatValue(stats.activeNotices)} active notices, {formatValue(stats.waitlistEntries)} waitlist entries, and {formatValue(stats.sentBroadcasts)} broadcasts tracked</span>
              </div>
              <AdminBadge tone="success" size="sm">Live</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Teacher and account workflow</strong>
                <span>{formatValue(stats.pendingTeacherApplications)} teacher applications and {formatValue(stats.premiumUsers)} premium users currently reflected from live records</span>
              </div>
              <AdminBadge tone="success" size="sm">Live</AdminBadge>
            </li>
          </ul>
        </section>
      </div>
    </section>
  );
}
