import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import LiveClassRoom from '../components/liveclass/LiveClassRoom';
import { endMentorLiveClass, fetchMentorLiveDashboard, startMentorLiveClass } from '../services/liveClassApi';
import { fetchMentorDashboard } from '../services/mentorApi';
import { DisconnectReason } from 'livekit-client';
import { HiVideoCamera, HiUsers, HiClock, HiLightningBolt } from 'react-icons/hi';
import './LiveClassPages.css';

export default function MentorLiveClass() {
  const [user] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Mentor',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'tutor',
  });
  const [title, setTitle] = useState('Weekly Live Class');
  const [dashboard, setDashboard] = useState({ sessionsThisWeek: 0, weeklyLimit: 4, activeSession: null });
  const [acceptedStudents, setAcceptedStudents] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const formatDisconnectReason = (reason) => {
    if (reason === undefined || reason === null) return '';
    const name = DisconnectReason[reason] || String(reason);
    if (name === 'DUPLICATE_IDENTITY') {
      return 'LiveKit disconnected because another tab/device is already connected with the same mentor identity.';
    }
    if (name === 'ROOM_DELETED') {
      return 'LiveKit disconnected because the room was deleted on the server.';
    }
    if (name === 'JOIN_FAILURE') {
      return 'LiveKit disconnected while joining the room. Check the token and room permissions.';
    }
    return `Disconnect reason: ${name}.`;
  };

  const loadDashboard = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);
      const [liveData, mentorData] = await Promise.all([
        fetchMentorLiveDashboard(),
        fetchMentorDashboard(),
      ]);
      setDashboard(liveData || { sessionsThisWeek: 0, weeklyLimit: 4, activeSession: null });
      setAcceptedStudents(Array.isArray(mentorData?.students) ? mentorData.students : []);
    } catch (err) {
      setError(err.message || 'Failed to load live class dashboard.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (!['tutor', 'teacher'].includes(user.role)) {
      window.location.href = '/dashboard';
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    const timer = window.setInterval(() => loadDashboard({ showLoading: false }), 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartClass = async () => {
    try {
      setBusy(true);
      setError('');
      const data = await startMentorLiveClass({
        title,
        roomName: dashboard.activeSession?.roomName || '',
      });
      setConnected(false);
      setConnection(data);
      setDashboard((prev) => ({
        ...prev,
        sessionsThisWeek: data.sessionsThisWeek,
        weeklyLimit: data.weeklyLimit,
        activeSession: data.session,
      }));
    } catch (err) {
      setError(err.message || 'Failed to start live class.');
    } finally {
      setBusy(false);
    }
  };

  const handleEndClass = async () => {
    if (!dashboard.activeSession?._id) return;
    try {
      setBusy(true);
      await endMentorLiveClass(dashboard.activeSession._id);
      setConnected(false);
      setConnection(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Failed to end live class.');
    } finally {
      setBusy(false);
    }
  };

  const weeklyUsagePercent = Math.round((dashboard.sessionsThisWeek / dashboard.weeklyLimit) * 100);

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="live-class" user={user} />
      <main className="dashboard-main">
        <div className="live-page">
          {/* Hero Section */}
          <div className="live-page__intro">
            <div className="live-page__intro-content">
              <div className="live-page__live-badge">
                <span className="live-page__live-dot" />
                Mentor Studio
              </div>
              <h1>Live Classroom</h1>
              <p>Run LiveKit-powered sessions with adaptive streaming, top-speaker rendering, and weekly usage guardrails.</p>
            </div>
            <div className="live-page__usage">
              <HiLightningBolt size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              {dashboard.sessionsThisWeek} / {dashboard.weeklyLimit} Sessions
            </div>
          </div>

          {/* Error State */}
          {error ? <div className="live-page__error">{error}</div> : null}

          {/* Launcher or Room */}
          {!connection ? (
            <section className="live-page__launcher">
              <div className="live-page__launcher-header">
                <h2>{dashboard.activeSession ? 'Resume Your Session' : 'Start a New Session'}</h2>
                <p>Set up your class title and go live for your accepted students.</p>
              </div>

              <label className="live-page__field">
                <span>Class Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  placeholder="e.g., Calculus Week 5 — Integration Techniques"
                />
              </label>

              <div className="live-page__launcher-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || loading || dashboard.sessionsThisWeek >= dashboard.weeklyLimit}
                  onClick={handleStartClass}
                >
                  {busy ? 'Starting...' : dashboard.activeSession ? 'Rejoin Live Class' : 'Start Live Class'}
                </button>

                {/* Weekly usage indicator */}
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <div style={{
                    height: '6px',
                    borderRadius: '999px',
                    background: 'rgba(192, 133, 82, 0.15)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${weeklyUsagePercent}%`,
                      borderRadius: '999px',
                      background: weeklyUsagePercent >= 100 ? '#b91c1c' : 'var(--gradient-cta)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              </div>

              {dashboard.sessionsThisWeek >= dashboard.weeklyLimit ? (
                <p className="live-page__hint">
                  <HiClock size={16} />
                  Weekly limit reached. You can host up to {dashboard.weeklyLimit} sessions per week.
                </p>
              ) : (
                <p className="live-page__hint">
                  <HiClock size={16} />
                  Each session is capped at 2 hours and can support up to 30 students with optimized rendering.
                </p>
              )}
            </section>
          ) : (
            <LiveClassRoom
              token={connection.token}
              wsUrl={connection.wsUrl}
              mode="mentor"
              connect={true}
              sessionTitle={connection.session?.title || title}
              onConnected={() => {
                setConnected(true);
                setError('');
              }}
              onError={(err) => {
                console.error('LiveKit mentor connection error:', err);
                const msg = err?.message || '';
                if (msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('notallowederror')) {
                  setError('Camera or Microphone access was denied by your browser! Please click the camera icon in your URL bar to allow access, then refresh.');
                } else {
                  setError(`LiveKit connection failed: ${msg}. Check that LIVEKIT_URL/HOST is the project WebSocket URL, and that API key/secret are correct.`);
                }
              }}
              onDisconnected={(reason) => {
                setConnected(false);
                setConnection(null);
                setError((prev) => prev || `Live class disconnected. ${formatDisconnectReason(reason)}`);
              }}
              onEndClass={handleEndClass}
            />
          )}

          {/* Connecting Hint */}
          {connection && !connected ? (
            <div className="live-page__hint">
              <HiClock size={16} />
              Connecting to LiveKit at <strong>{connection.wsUrl}</strong>
            </div>
          ) : null}

          {/* Accepted Students Section */}
          <section className="live-page__students">
            <div className="live-page__students-head">
              <div>
                <h2>Accepted Students</h2>
                <p>Only these accepted students can see and join your live sessions.</p>
              </div>
              <span>
                <HiUsers size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                {acceptedStudents.length}
              </span>
            </div>

            {acceptedStudents.length === 0 ? (
              <div className="live-page__empty">
                <div className="live-page__empty-icon">
                  <HiUsers size={24} />
                </div>
                <h3>No accepted students yet</h3>
                <p>Accept student requests from your dashboard first.</p>
              </div>
            ) : (
              <div className="live-page__student-grid">
                {acceptedStudents.map((entry) => (
                  <article key={entry.connectionId} className="live-page__student-card">
                    <div className="live-page__student-avatar">
                      {entry.student?.avatar ? (
                        <img src={entry.student.avatar} alt={entry.student.name} referrerPolicy="no-referrer" />
                      ) : (
                        (entry.student?.name || 'S').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3>{entry.student?.name || 'Student'}</h3>
                      <p>{entry.student?.collegeName || entry.student?.stream || entry.student?.academicStatus || 'Accepted student'}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
