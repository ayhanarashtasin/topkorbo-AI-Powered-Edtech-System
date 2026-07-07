import { useEffect, useState } from 'react';
import {
  HiMiniBanknotes,
  HiMiniBellAlert,
  HiMiniChartBar,
  HiMiniExclamationTriangle,
  HiMiniQueueList,
  HiMiniTrophy,
  HiMiniUsers
} from 'react-icons/hi2';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatCard from '../components/AdminStatCard';
import AdminTable from '../components/AdminTable';
import { fetchAdminAnalyticsOverview } from '../services/adminApi';

const RANGE_OPTIONS = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'All' }
];

const EMPTY_DATA = {
  range: {
    key: '30d',
    label: 'Last 30 days',
    granularity: 'day'
  },
  overviewCards: {
    totalUsers: 0,
    newUsersInRange: 0,
    activeUsersInRange: null,
    activeUsersAvailable: false,
    totalContests: 0,
    contestSubmissionsInRange: 0,
    pendingApprovals: 0,
    openReports: 0,
    revenueInRange: 0
  },
  users: {
    total: 0,
    byRole: {},
    byAccountStatus: {},
    recentSignups: [],
    activeUsers: {
      available: false,
      definition: 'Tracking not available yet.'
    }
  },
  contests: {
    total: 0,
    byLifecycle: {},
    byAdminStatus: {},
    totalRegistrations: 0,
    totalParticipants: 0,
    submissionsInRange: 0,
    averageScore: '0.00',
    averageScoreInRange: '0.00',
    antiCheat: {
      flagged: 0,
      cleared: 0
    }
  },
  content: {
    books: { total: 0, byApprovalStatus: {} },
    questions: { total: 0, byApprovalStatus: {} },
    teacherApplications: { total: 0, byStatus: {} },
    ielts: {
      listening: { total: 0, byApprovalStatus: {} },
      writing: { total: 0, byApprovalStatus: {} },
      reading: { total: 0, approvalTrackingAvailable: false }
    },
    reports: { byStatus: {} },
    supportTickets: { byStatus: {}, openWorkload: 0 }
  },
  payments: {
    totalRevenue: 0,
    revenueInRange: 0,
    definition: 'Sum of payments where status is valid.'
  },
  notifications: {
    unread: 0
  },
  unavailableMetrics: []
};

const CARD_CONFIG = [
  { key: 'totalUsers', label: 'Total users', icon: <HiMiniUsers />, tone: 'info', hint: 'All registered accounts.' },
  { key: 'newUsersInRange', label: 'New users', icon: <HiMiniChartBar />, tone: 'success', hint: 'Created in the selected range.' },
  { key: 'activeUsersInRange', label: 'Active users', icon: <HiMiniUsers />, tone: 'neutral', hint: 'Uses lastActiveAt when available.' },
  { key: 'totalContests', label: 'Total contests', icon: <HiMiniTrophy />, tone: 'warning', hint: 'All contest records.' },
  { key: 'contestSubmissionsInRange', label: 'Contest submissions', icon: <HiMiniTrophy />, tone: 'info', hint: 'ContestResult rows in the selected range.' },
  { key: 'pendingApprovals', label: 'Pending approvals', icon: <HiMiniQueueList />, tone: 'warning', hint: 'Pending review queues combined.' },
  { key: 'openReports', label: 'Open reports', icon: <HiMiniExclamationTriangle />, tone: 'danger', hint: 'Moderation reports still open.' },
  { key: 'revenueInRange', label: 'Revenue', icon: <HiMiniBanknotes />, tone: 'success', hint: 'Valid payments in the selected range.', format: 'currency' },
  { key: 'unreadNotifications', label: 'Unread notifications', icon: <HiMiniBellAlert />, tone: 'neutral', hint: 'Unread notification rows stored.' }
];

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatCardValue(card, overviewCards, notifications) {
  if (card.key === 'activeUsersInRange') {
    return overviewCards.activeUsersAvailable
      ? formatNumber(overviewCards.activeUsersInRange)
      : 'N/A';
  }
  if (card.key === 'unreadNotifications') {
    return formatNumber(notifications.unread);
  }
  if (card.format === 'currency') {
    return formatCurrency(overviewCards[card.key]);
  }
  return formatNumber(overviewCards[card.key]);
}

function buildContentRows(content) {
  return [
    {
      area: 'Questions',
      total: content.questions.total,
      pending: content.questions.byApprovalStatus.pending || 0,
      approved: content.questions.byApprovalStatus.approved || 0,
      rejected: content.questions.byApprovalStatus.rejected || 0
    },
    {
      area: 'Books',
      total: content.books.total,
      pending: content.books.byApprovalStatus.pending || 0,
      approved: content.books.byApprovalStatus.approved || 0,
      rejected: content.books.byApprovalStatus.rejected || 0
    },
    {
      area: 'IELTS listening',
      total: content.ielts.listening.total,
      pending: content.ielts.listening.byApprovalStatus.pending || 0,
      approved: content.ielts.listening.byApprovalStatus.approved || 0,
      rejected: content.ielts.listening.byApprovalStatus.rejected || 0
    },
    {
      area: 'IELTS writing',
      total: content.ielts.writing.total,
      pending: content.ielts.writing.byApprovalStatus.pending || 0,
      approved: content.ielts.writing.byApprovalStatus.approved || 0,
      rejected: content.ielts.writing.byApprovalStatus.rejected || 0
    }
  ];
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const payload = await fetchAdminAnalyticsOverview({ range });
        if (active) {
          setData({ ...EMPTY_DATA, ...(payload || {}) });
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load admin analytics');
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
  }, [range]);

  if (loading) {
    return <AdminLoadingState label="Loading admin analytics..." />;
  }

  if (error) {
    return (
      <div className="admin-page-error">
        <div className="admin-page-error__card">
          <h3>Analytics unavailable</h3>
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overviewCards, users, contests, content, payments, notifications, unavailableMetrics } = data;
  const contentRows = buildContentRows(content);

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Analytics"
        description="Small read-only admin analytics built from existing MongoDB records only. Untracked metrics stay unavailable instead of guessed."
        badge={{ label: data.range.label, tone: 'info' }}
        actions={(
          <div className="admin-page-header__actions">
            {RANGE_OPTIONS.map((option) => (
              <AdminActionButton
                key={option.key}
                variant={range === option.key ? 'solid' : 'ghost'}
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </AdminActionButton>
            ))}
          </div>
        )}
      />

      <div className="admin-overview-grid">
        <article className="admin-hero__banner">
          <p className="admin-topbar__eyebrow">Overview</p>
          <h3>Phase 9A stays intentionally narrow: safe counts, simple range filtering, and no synthetic engagement metrics.</h3>
          <p>
            The selected range affects time-based metrics like new users, active users, contest submissions, and revenue. Platform totals remain based on all stored records.
          </p>
        </article>

        <article className="admin-health-card">
          <div className="admin-health-card__row">
            <div>
              <p className="admin-topbar__eyebrow">Data rules</p>
              <strong>Read only</strong>
            </div>
            <AdminBadge tone="success">Mongo only</AdminBadge>
          </div>
          <p>Revenue definition: valid payments only.</p>
          <p>Active users: {users.activeUsers.definition}</p>
        </article>
      </div>

      <div className="admin-stats-grid">
        {CARD_CONFIG.map((card) => (
          <AdminStatCard
            key={card.key}
            label={card.label}
            value={formatCardValue(card, overviewCards, notifications)}
            hint={card.key === 'activeUsersInRange' && !overviewCards.activeUsersAvailable ? 'Tracking not available yet.' : card.hint}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="admin-panels-grid admin-panels-grid--equal">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>User breakdown</h3>
              <p className="admin-panel__subtext">Roles, account states, and signups recorded in the selected range.</p>
            </div>
          </div>

          <div className="admin-queue-list">
            <article className="admin-queue-item">
              <div>
                <strong>Students</strong>
                <p>Accounts with role `student`</p>
              </div>
              <AdminBadge tone="info">{formatNumber(users.byRole.student || 0)}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>Teachers</strong>
                <p>Accounts with role `teacher`</p>
              </div>
              <AdminBadge tone="success">{formatNumber(users.byRole.teacher || 0)}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>Tutors</strong>
                <p>Accounts with role `tutor`</p>
              </div>
              <AdminBadge tone="warning">{formatNumber(users.byRole.tutor || 0)}</AdminBadge>
            </article>
            <article className="admin-queue-item">
              <div>
                <strong>Suspended or banned</strong>
                <p>Current restricted account statuses</p>
              </div>
              <AdminBadge tone="danger">
                {formatNumber((users.byAccountStatus.suspended || 0) + (users.byAccountStatus.banned || 0))}
              </AdminBadge>
            </article>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Contest snapshot</h3>
              <p className="admin-panel__subtext">Lifecycle counts plus participation and anti-cheat totals.</p>
            </div>
          </div>

          <ul className="admin-list admin-list--compact">
            <li>
              <div>
                <strong>Lifecycle</strong>
                <span>
                  Live {formatNumber(contests.byLifecycle.live || 0)}, upcoming {formatNumber(contests.byLifecycle.upcoming || 0)}, ended {formatNumber(contests.byLifecycle.ended || 0)}, cancelled {formatNumber(contests.byLifecycle.cancelled || 0)}
                </span>
              </div>
              <AdminBadge tone="info">{formatNumber(contests.total)}</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Registrations</strong>
                <span>Stored from contest registration arrays</span>
              </div>
              <AdminBadge tone="neutral">{formatNumber(contests.totalRegistrations)}</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Participants</strong>
                <span>Total ContestResult records</span>
              </div>
              <AdminBadge tone="success">{formatNumber(contests.totalParticipants)}</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Average score</strong>
                <span>{data.range.label}: {contests.averageScoreInRange}</span>
              </div>
              <AdminBadge tone="warning">{contests.averageScore}</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Anti-cheat review</strong>
                <span>Flagged {formatNumber(contests.antiCheat.flagged)} and cleared {formatNumber(contests.antiCheat.cleared)}</span>
              </div>
              <AdminBadge tone="danger">{formatNumber(contests.antiCheat.flagged)}</AdminBadge>
            </li>
          </ul>
        </section>
      </div>

      <div className="admin-panels-grid">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>New user trend</h3>
              <p className="admin-panel__subtext">Grouped from user `createdAt` in the selected range.</p>
            </div>
          </div>

          {users.recentSignups.length ? (
            <AdminTable columns={['Period', 'New users']} minWidth={520}>
              {users.recentSignups.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{formatNumber(row.count)}</td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <AdminEmptyState compact title="No signup rows in this range" description="No user accounts were created inside the currently selected window." />
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Operational totals</h3>
              <p className="admin-panel__subtext">Queues and revenue that are already modeled clearly.</p>
            </div>
          </div>

          <ul className="admin-list admin-list--compact">
            <li>
              <div>
                <strong>Teacher applications</strong>
                <span>Pending {formatNumber(content.teacherApplications.byStatus.pending || 0)}, approved {formatNumber(content.teacherApplications.byStatus.approved || 0)}, rejected {formatNumber(content.teacherApplications.byStatus.rejected || 0)}</span>
              </div>
              <AdminBadge tone="warning">{formatNumber(content.teacherApplications.total)}</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Support workload</strong>
                <span>Open and in-progress tickets combined</span>
              </div>
              <AdminBadge tone="info">{formatNumber(content.supportTickets.openWorkload)}</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Unread notifications</strong>
                <span>Stored unread notification rows</span>
              </div>
              <AdminBadge tone="neutral">{formatNumber(notifications.unread)}</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Total revenue</strong>
                <span>All-time valid payments</span>
              </div>
              <AdminBadge tone="success">{formatCurrency(payments.totalRevenue)}</AdminBadge>
            </li>
            <li>
              <div>
                <strong>IELTS reading sets</strong>
                <span>Approval-state tracking is not modeled for this set type</span>
              </div>
              <AdminBadge tone="neutral">{formatNumber(content.ielts.reading.total)}</AdminBadge>
            </li>
          </ul>
        </section>
      </div>

      <div className="admin-panels-grid">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Content status table</h3>
              <p className="admin-panel__subtext">Only approval-state content types that already store real status fields.</p>
            </div>
          </div>

          <AdminTable columns={['Area', 'Total', 'Pending', 'Approved', 'Rejected']} minWidth={720}>
            {contentRows.map((row) => (
              <tr key={row.area}>
                <td>{row.area}</td>
                <td>{formatNumber(row.total)}</td>
                <td>{formatNumber(row.pending)}</td>
                <td>{formatNumber(row.approved)}</td>
                <td>{formatNumber(row.rejected)}</td>
              </tr>
            ))}
          </AdminTable>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Unavailable analytics</h3>
              <p className="admin-panel__subtext">These stay intentionally unimplemented until real persisted tracking exists.</p>
            </div>
          </div>

          {unavailableMetrics.length ? (
            <ul className="admin-list admin-list--compact">
              {unavailableMetrics.map((item) => (
                <li key={item.label}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.reason}</span>
                  </div>
                  <AdminBadge tone="neutral">Unavailable</AdminBadge>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState compact title="No unavailable metrics recorded" description="Every metric on this page currently maps to real stored data." />
          )}
        </section>
      </div>

      <div className="admin-panels-grid admin-panels-grid--equal">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Definition notes</h3>
              <p className="admin-panel__subtext">Short data definitions used in this phase.</p>
            </div>
          </div>

          <ul className="admin-list admin-list--compact">
            <li>
              <div>
                <strong>New users</strong>
                <span>User rows created inside the selected range.</span>
              </div>
              <AdminBadge tone="info">createdAt</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Contest registrations</strong>
                <span>Counted from `registeredStudentsDetails` first, otherwise `registeredStudents`.</span>
              </div>
              <AdminBadge tone="neutral">Contest</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Contest participation</strong>
                <span>Total `ContestResult` records.</span>
              </div>
              <AdminBadge tone="success">ContestResult</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Revenue</strong>
                <span>{payments.definition}</span>
              </div>
              <AdminBadge tone="success">Payment</AdminBadge>
            </li>
          </ul>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Scope guardrails</h3>
              <p className="admin-panel__subtext">What this page does not attempt to infer.</p>
            </div>
          </div>

          <ul className="admin-list admin-list--compact">
            <li>
              <div>
                <strong>No event tracking</strong>
                <span>No page-view, click, or session instrumentation was added.</span>
              </div>
              <AdminBadge tone="neutral">Safe</AdminBadge>
            </li>
            <li>
              <div>
                <strong>No charts dependency</strong>
                <span>Tables and cards only, using the existing admin UI kit.</span>
              </div>
              <AdminBadge tone="neutral">Lightweight</AdminBadge>
            </li>
            <li>
              <div>
                <strong>No fake engagement metrics</strong>
                <span>Unavailable areas stay unavailable instead of estimated.</span>
              </div>
              <AdminBadge tone="warning">Strict</AdminBadge>
            </li>
          </ul>
        </section>
      </div>
    </section>
  );
}
