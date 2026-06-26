import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import LiveClassRoom from '../components/liveclass/LiveClassRoom';
import { fetchStudentLiveSessions, joinStudentLiveClass } from '../services/liveClassApi';
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
          <div className="live-page__intro">
            <div>
              <h1>Available Live Classes</h1>
              <p>Join active classes from mentors who have already accepted your connection request.</p>
            </div>
            <div className="live-page__usage">Realtime refresh: every 15 seconds</div>
          </div>

          {error ? <div className="live-page__error">{error}</div> : null}

          {!connection ? (
            <section className="live-page__directory">
              {loading ? (
                <div className="live-page__empty">Loading live classes...</div>
              ) : sessions.length === 0 ? (
                <div className="live-page__empty">No live classes are running from your mentors right now.</div>
              ) : (
                sessions.map((session) => (
                  <article key={session._id} className="live-page__card">
                    <div>
                      <h3>{session.title}</h3>
                      <p>{session.mentor?.name || 'Mentor'}</p>
                      <small>{session.mentor?.department || session.mentor?.universityName || 'Live mentor session'}</small>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={joiningRoom === session.roomName}
                      onClick={() => handleJoin(session.roomName)}
                    >
                      {joiningRoom === session.roomName ? 'Joining...' : 'Join Live Class'}
                    </button>
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
              onDisconnected={() => {
                setConnected(false);
                setConnection(null);
                setError((prev) => prev || 'Live class disconnected. If this happens immediately, the LiveKit configuration or token is invalid.');
              }}
              onEndClass={null}
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