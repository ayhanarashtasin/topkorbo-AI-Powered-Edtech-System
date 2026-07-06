import { useEffect, useState } from 'react';
import {
  HiMiniAcademicCap,
  HiMiniBookOpen,
  HiMiniChartBarSquare,
  HiMiniChatBubbleLeftRight,
  HiMiniClipboardDocumentCheck,
  HiMiniDocumentText,
  HiMiniExclamationTriangle,
  HiMiniQueueList,
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
    pendingTeacherApplications: 0,
    pendingQuestions: 0,
    pendingBooks: 0,
    reports: 0,
    supportTickets: 0,
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
  { key: 'pendingTeacherApplications', label: 'Teacher applications', hint: 'Waiting for admin review', icon: <HiMiniQueueList />, tone: 'warning' },
  { key: 'pendingQuestions', label: 'Pending questions', hint: 'Approval queue placeholder', icon: <HiMiniDocumentText />, tone: 'neutral' },
  { key: 'pendingBooks', label: 'Pending books', hint: 'Unpublished reading uploads', icon: <HiMiniBookOpen />, tone: 'neutral' },
  { key: 'reports', label: 'Reports', hint: 'Open moderation issues', icon: <HiMiniExclamationTriangle />, tone: 'danger' },
  { key: 'supportTickets', label: 'Support tickets', hint: 'Open support issues needing admin attention', icon: <HiMiniChatBubbleLeftRight />, tone: 'neutral' },
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
          <h3>Teacher review, user control, moderation, and audit visibility now live inside one isolated admin module.</h3>
          <p>
            Real backend counts are shown where the platform already has data. Modules that are still pending remain clearly marked without breaking the rest of the application.
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
          <p>IELTS sets tracked: {stats.ieltsSets}</p>
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
                <p>Open community reports needing action</p>
              </div>
              <AdminBadge tone="danger">{stats.reports}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>Question approvals</strong>
                <p>Placeholder until question approval status is fully modeled</p>
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
                <strong>User management</strong>
                <span>Search, filters, role changes, account status control, and audit logging</span>
              </div>
              <AdminBadge tone="success" size="sm">Live</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Teacher management</strong>
                <span>Application review, verification review, and admin decision history</span>
              </div>
              <AdminBadge tone="success" size="sm">Live</AdminBadge>
            </li>
          </ul>
        </section>
      </div>
    </section>
  );
}
