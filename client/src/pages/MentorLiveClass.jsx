import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import LiveClassRoom from '../components/liveclass/LiveClassRoom';
import { endMentorLiveClass, fetchMentorLiveDashboard, startMentorLiveClass } from '../services/liveClassApi';
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
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await fetchMentorLiveDashboard();
      setDashboard(data || { sessionsThisWeek: 0, weeklyLimit: 4, activeSession: null });
    } catch (err) {
      setError(err.message || 'Failed to load live class dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!['tutor', 'teacher'].includes(user.role)) {
      window.location.href = '/dashboard';
      return;
    }
    loadDashboard();
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

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="live-class" user={user} />
      <main className="dashboard-main">
        <div className="live-page">
          <div className="live-page__intro">
            <div>
              <h1>Mentor Live Classroom</h1>
              <p>Run LiveKit-powered sessions with adaptive streaming, top-speaker rendering, and weekly usage guardrails.</p>
            </div>
            <div className="live-page__usage">
              Sessions This Week: <strong>{dashboard.sessionsThisWeek} / {dashboard.weeklyLimit}</strong>
            </div>
          </div>

          {error ? <div className="live-page__error">{error}</div> : null}

          {!connection ? (
            <section className="live-page__launcher">
              <label className="live-page__field">
                <span>Class title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || loading || dashboard.sessionsThisWeek >= dashboard.weeklyLimit}
                onClick={handleStartClass}
              >
                {busy ? 'Starting...' : dashboard.activeSession ? 'Rejoin Live Class' : 'Start Live Class'}
              </button>
              {dashboard.sessionsThisWeek >= dashboard.weeklyLimit ? (
                <p className="live-page__hint">Weekly limit reached. You can host up to 4 sessions per week.</p>
              ) : (
                <p className="live-page__hint">Each session is capped at 2 hours and can support up to 30 students with optimized rendering.</p>
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
                setError(`LiveKit connection failed: ${err?.message || 'Unknown error'}. Check that LIVEKIT_URL/HOST is the project WebSocket URL (wss://...), and that API key/secret belong to the same LiveKit project.`);
              }}
              onDisconnected={() => {
                setConnected(false);
                setConnection(null);
                setError((prev) => prev || 'Live class disconnected. If this happens immediately, the LiveKit URL or token configuration is likely wrong.');
              }}
              onEndClass={handleEndClass}
            />
          )}
          {connection && !connected ? (
            <div className="live-page__hint">
              Connecting to LiveKit at <strong>{connection.wsUrl}</strong>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
