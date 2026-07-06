import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminBadge from '../components/AdminBadge';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminStatCard from '../components/AdminStatCard';
import AdminTable from '../components/AdminTable';
import { createAdminBroadcast, fetchAdminBroadcasts, fetchAdminNotificationAudienceStats } from '../services/adminApi';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'students', label: 'Students' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'tutors', label: 'Tutors / mentors' },
  { value: 'moderators', label: 'Moderators' }
];
const PRIORITY_OPTIONS = ['normal', 'important', 'urgent'];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toneForStatus(status) {
  if (status === 'sent') return 'success';
  if (status === 'scheduled') return 'info';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

function toneForPriority(priority) {
  if (priority === 'urgent') return 'danger';
  if (priority === 'important') return 'warning';
  return 'info';
}

export default function AdminNotificationsPage() {
  const [form, setForm] = useState({
    title: '',
    message: '',
    audience: 'all',
    priority: 'normal',
    channels: {
      inApp: true,
      email: false,
      sms: false,
      push: false
    },
    scheduledFor: ''
  });
  const [broadcasts, setBroadcasts] = useState([]);
  const [stats, setStats] = useState({
    all: 0,
    students: 0,
    teachers: 0,
    tutors: 0,
    moderators: 0,
    configuredChannels: {
      inApp: true,
      email: false,
      sms: false,
      push: false
    }
  });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function refreshPage(page = 1) {
    const [broadcastData, audienceStats] = await Promise.all([
      fetchAdminBroadcasts({ page, limit: 10 }),
      fetchAdminNotificationAudienceStats()
    ]);
    setBroadcasts(broadcastData?.items || []);
    setPagination(broadcastData?.pagination || { page: 1, totalPages: 1, total: 0 });
    setStats(audienceStats || {
      all: 0,
      students: 0,
      teachers: 0,
      tutors: 0,
      moderators: 0,
      configuredChannels: {
        inApp: true,
        email: false,
        sms: false,
        push: false
      }
    });
  }

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        setLoading(true);
        const [broadcastData, audienceStats] = await Promise.all([
          fetchAdminBroadcasts({ page: pagination.page || 1, limit: 10 }),
          fetchAdminNotificationAudienceStats()
        ]);
        if (!active) return;
        setBroadcasts(broadcastData?.items || []);
        setPagination(broadcastData?.pagination || { page: 1, totalPages: 1, total: 0 });
        setStats(audienceStats || {
          all: 0,
          students: 0,
          teachers: 0,
          tutors: 0,
          moderators: 0,
          configuredChannels: {
            inApp: true,
            email: false,
            sms: false,
            push: false
          }
        });
      } catch (err) {
        if (active) {
          toast.error(err.message || 'Failed to load notification admin data');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [pagination.page]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      await createAdminBroadcast({
        title: form.title,
        message: form.message,
        audience: form.audience,
        priority: form.priority,
        channels: form.channels,
        scheduledFor: form.scheduledFor || null
      });
      toast.success(form.scheduledFor ? 'Broadcast stored as scheduled placeholder' : 'Broadcast sent successfully');
      setForm({
        title: '',
        message: '',
        audience: 'all',
        priority: 'normal',
        channels: {
          inApp: true,
          email: false,
          sms: false,
          push: false
        },
        scheduledFor: ''
      });
      if ((pagination.page || 1) === 1) {
        await refreshPage(1);
      } else {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create broadcast');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Broadcast Notifications"
        description="Send real in-app broadcast updates to targeted user groups while leaving unconfigured email, SMS, and push channels safely disabled."
        badge={{ label: `${pagination.total} broadcasts`, tone: 'info' }}
      />

      <div className="admin-stats-grid">
        <AdminStatCard label="Active users" value={stats.all} hint="Eligible recipients for all-user broadcasts" tone="info" />
        <AdminStatCard label="Students" value={stats.students} hint="Active student accounts" tone="success" />
        <AdminStatCard label="Teachers" value={stats.teachers} hint="Active teacher accounts" tone="warning" />
        <AdminStatCard label="Moderators" value={stats.moderators} hint="Forum moderators available for ops updates" tone="neutral" />
      </div>

      <div className="admin-panels-grid admin-panels-grid--equal">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Create broadcast</h3>
              <p className="admin-panel__subtext">In-app delivery is live. Other channels remain disabled until real integrations are configured.</p>
            </div>
          </div>

          <form className="admin-detail-stack" onSubmit={handleSubmit}>
            <label className="admin-field">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Exam schedule update"
              />
            </label>

            <label className="admin-field">
              <span>Message</span>
              <textarea
                rows={5}
                value={form.message}
                onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Share the announcement details that users should see in-app."
              />
            </label>

            <div className="admin-toolbar">
              <label className="admin-field">
                <span>Audience</span>
                <select value={form.audience} onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}>
                  {AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Priority</span>
                <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Schedule placeholder</span>
                <input
                  type="datetime-local"
                  value={form.scheduledFor}
                  onChange={(event) => setForm((prev) => ({ ...prev, scheduledFor: event.target.value }))}
                />
              </label>
            </div>

            <div className="admin-list">
              <li>
                <div>
                  <strong>In-app</strong>
                  <span>Available and enabled for this phase.</span>
                </div>
                <AdminBadge tone="success" size="sm">Enabled</AdminBadge>
              </li>
              <li>
                <div>
                  <strong>Email</strong>
                  <span>No configured email broadcast integration was found.</span>
                </div>
                <AdminBadge tone="neutral" size="sm">Not configured</AdminBadge>
              </li>
              <li>
                <div>
                  <strong>SMS</strong>
                  <span>No configured SMS broadcast integration was found.</span>
                </div>
                <AdminBadge tone="neutral" size="sm">Not configured</AdminBadge>
              </li>
              <li>
                <div>
                  <strong>Push</strong>
                  <span>No configured push broadcast integration was found.</span>
                </div>
                <AdminBadge tone="neutral" size="sm">Not configured</AdminBadge>
              </li>
            </div>

            <div className="admin-action-row">
              <button type="submit" className="admin-button" disabled={submitting}>
                {submitting ? 'Sending...' : 'Create broadcast'}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Preview</h3>
              <p className="admin-panel__subtext">How the in-app announcement will appear to recipients.</p>
            </div>
            <div className="admin-chip-row">
              <AdminBadge tone={toneForPriority(form.priority)}>{form.priority}</AdminBadge>
              <AdminBadge tone="info">{AUDIENCE_OPTIONS.find((item) => item.value === form.audience)?.label || 'All users'}</AdminBadge>
            </div>
          </div>

          <article className="admin-stat-card admin-stat-card--neutral">
            <div className="admin-stat-card__top">
              <p className="admin-stat-card__label">{form.title || 'Broadcast title preview'}</p>
            </div>
            <h3 className="admin-stat-card__value" style={{ fontSize: '1.2rem' }}>In-app announcement</h3>
            <p className="admin-stat-card__hint">{form.message || 'Your broadcast message preview will appear here once you start drafting it.'}</p>
          </article>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel__header">
          <div>
            <h3>Previous broadcasts</h3>
            <p className="admin-panel__subtext">Stored admin announcements and their delivery state.</p>
          </div>
        </div>

        {loading ? (
          <AdminLoadingState label="Loading broadcast history..." />
        ) : !broadcasts.length ? (
          <AdminEmptyState title="No broadcasts sent yet" description="Your in-app announcements will appear here after the first broadcast is created." />
        ) : (
          <>
            <AdminTable columns={['Title', 'Audience', 'Priority', 'Status', 'Sent', 'Channels', 'Created']} minWidth={1180}>
              {broadcasts.map((broadcast) => (
                <tr key={broadcast.id}>
                  <td>
                    <strong>{broadcast.title}</strong>
                    <div className="admin-table__muted">{broadcast.message}</div>
                  </td>
                  <td>{AUDIENCE_OPTIONS.find((item) => item.value === broadcast.audience)?.label || broadcast.audience}</td>
                  <td><AdminBadge tone={toneForPriority(broadcast.priority)}>{broadcast.priority}</AdminBadge></td>
                  <td><AdminBadge tone={toneForStatus(broadcast.status)}>{broadcast.status}</AdminBadge></td>
                  <td>{broadcast.sentCount}</td>
                  <td>{broadcast.channels.inApp ? 'In-app' : 'None'}</td>
                  <td>{formatDate(broadcast.createdAt)}</td>
                </tr>
              ))}
            </AdminTable>

            <AdminPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onChange={(page) => setPagination((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </section>
    </section>
  );
}
