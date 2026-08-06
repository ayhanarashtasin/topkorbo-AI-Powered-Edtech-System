import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import LiveClassRoom from '../components/liveclass/LiveClassRoom';
import { fetchStudentLiveSessions, joinStudentLiveClass } from '../services/liveClassApi';
import { DisconnectReason } from 'livekit-client';
import { HiVideoCamera, HiUsers, HiClock } from 'react-icons/hi';
import './LiveClassPages.css';

export default function StudentLiveClass() {
  const [user] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
  });
  const [sessions, setSessions] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joiningRoom, setJoiningRoom] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const formatDisconnectReason = (reason) => {
    if (reason === undefined || reason === null) return '';
    const name = DisconnectReason[reason] || String(reason);
    if (name === 'DUPLICATE_IDENTITY') {
      return 'LiveKit disconnected because another tab/device is already connected with the same student identity.';
    }
    if (name === 'ROOM_DELETED') {
      return 'LiveKit disconnected because the room was deleted on the server.';
    }
    if (name === 'JOIN_FAILURE') {
      return 'LiveKit disconnected while joining the room. Check the token and room permissions.';
    }
    return `Disconnect reason: ${name}.`;
  };

  const loadSessions = async () => {
    try {
      const data = await fetchStudentLiveSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load live sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role !== 'student') {
      window.location.href = '/dashboard';
      return;
    }
    loadSessions();
    const timer = window.setInterval(loadSessions, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const handleJoin = async (roomName) => {
    try {
      setJoiningRoom(roomName);
      setError('');
      const data = await joinStudentLiveClass(roomName);
      setConnected(false);
      setConnection(data);
    } catch (err) {
      setError(err.message || 'Failed to join live class.');
    } finally {
      setJoiningRoom('');
    }
  };

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
                Live Sessions
              </div>
              <h1>Available Live Classes</h1>
              <p>Join active classes from mentors who have already accepted your connection request.</p>
            </div>
            <div className="live-page__usage">
              <HiUsers size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              {sessions.length} Active Now
            </div>
          </div>

          {/* Error State */}
          {error ? <div className="live-page__error">{error}</div> : null}

          {/* Session Directory or Room */}
          {!connection ? (
            <section className="live-page__directory">
              {/* Section Header */}
              <div className="live-page__section-header">
                <h2>Your Mentors' Sessions</h2>
                <span className="live-page__section-count">{sessions.length} running</span>
              </div>

              {/* Loading */}
              {loading ? (
                <>
                  <div className="live-page__skeleton" />
                  <div className="live-page__skeleton" />
                  <div className="live-page__skeleton" />
                </>
              ) : sessions.length === 0 ? (
                /* Empty State */
                <div className="live-page__empty">
                  <div className="live-page__empty-icon">
                    <HiVideoCamera size={24} />
                  </div>
                  <h3>No live classes right now</h3>
                  <p>Mentors you're connected with aren't hosting sessions at the moment. Check back soon!</p>
                </div>
              ) : (
                /* Session Cards */
                sessions.map((session) => (
                  <article key={session._id} className="live-page__card">
                    <div className="live-page__card-left">
                      <div className="live-page__card-avatar">
                        {(session.mentor?.name || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div className="live-page__card-info">
                        <h3>{session.title}</h3>
                        <p>{session.mentor?.name || 'Mentor'}</p>
                        <small>{session.mentor?.department || session.mentor?.universityName || 'Live mentor session'}</small>
                      </div>
                    </div>
                    <div className="live-page__card-right">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={joiningRoom === session.roomName}
                        onClick={() => handleJoin(session.roomName)}
                      >
                        {joiningRoom === session.roomName ? 'Joining...' : 'Join Class'}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          ) : (
            <LiveClassRoom
              token={connection.token}
              wsUrl={connection.wsUrl}
              mode="student"
              connect={true}
              sessionTitle={connection.session?.title || 'Live Class'}
              onConnected={() => {
                setConnected(true);
                setError('');
              }}
              onError={(err) => {
                console.error('LiveKit student connection error:', err);
                setError(`LiveKit connection failed: ${err?.message || 'Unknown error'}. Check that the mentor session is still live and that the server LiveKit env values point to the same project.`);
              }}
              onDisconnected={(reason) => {
                setConnected(false);
                setConnection(null);
                setError((prev) => prev || `Live class disconnected. ${formatDisconnectReason(reason)}`);
              }}
              onEndClass={null}
            />
          )}

          {/* Connecting Hint */}
          {connection && !connected ? (
            <div className="live-page__hint">
              <HiClock size={16} />
              Connecting to LiveKit at <strong>{connection.wsUrl}</strong>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
