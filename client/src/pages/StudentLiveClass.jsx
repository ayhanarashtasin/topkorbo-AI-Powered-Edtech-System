import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import LiveClassRoom from '../components/liveclass/LiveClassRoom';
import { fetchStudentLiveSessions, joinStudentLiveClass } from '../services/liveClassApi';
import { DisconnectReason } from 'livekit-client';
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
      return 'The video room closed. If the mentor has not ended the class, you can join again from Live Now.';
    }
    if (name === 'JOIN_FAILURE') {
      return 'LiveKit disconnected while joining the room. Check the token and room permissions.';
    }
    return `Disconnect reason: ${name}.`;
  };

  const formatClassTime = (value) => {
    if (!value) return 'Time not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Time not set';
    return date.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const liveSessions = sessions.filter((session) => session.status === 'live');
  const upcomingSessions = sessions.filter((session) => session.status === 'scheduled');
  const historySessions = sessions.filter((session) => ['completed', 'cancelled'].includes(session.status));

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
    const timer = window.setInterval(loadSessions, 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <h1>Live Classes</h1>
              <p>Join live classes or keep track of scheduled classes from your accepted mentors.</p>
            </div>
          </div>

          {error ? <div className="live-page__error">{error}</div> : null}

          {!connection ? (
            <>
            <section className="live-page__directory">
              <div className="live-page__section-head">
                <div>
                  <h2>Live Now</h2>
                  <p>Classes you can join right now.</p>
                </div>
                <span>{liveSessions.length} live</span>
              </div>
              {loading ? (
                <div className="live-page__empty">Loading live classes...</div>
              ) : liveSessions.length === 0 ? (
                <div className="live-page__empty">No live classes are running from your mentors right now.</div>
              ) : (
                liveSessions.map((session) => (
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

            <section className="live-page__directory">
              <div className="live-page__section-head">
                <div>
                  <h2>Upcoming Classes</h2>
                  <p>Scheduled classes from mentors who accepted you.</p>
                </div>
                <span>{upcomingSessions.length} upcoming</span>
              </div>
              {loading ? (
                <div className="live-page__empty">Loading scheduled classes...</div>
              ) : upcomingSessions.length === 0 ? (
                <div className="live-page__empty">No upcoming classes scheduled yet.</div>
              ) : (
                upcomingSessions.map((session) => (
                  <article key={session._id} className="live-page__card">
                    <div>
                      <h3>{session.title}</h3>
                      <p>{formatClassTime(session.scheduledStart)} - {session.durationMinutes || 60} minutes</p>
                      <small>{session.description || session.mentor?.name || 'Scheduled live class'}</small>
                    </div>
                    <button type="button" className="btn btn-secondary" disabled>
                      Not Started
                    </button>
                  </article>
                ))
              )}
            </section>

            <section className="live-page__directory">
              <div className="live-page__section-head">
                <div>
                  <h2>Class History</h2>
                  <p>Classes from your accepted mentors that already ended.</p>
                </div>
                <span>{historySessions.length} classes</span>
              </div>
              {loading ? (
                <div className="live-page__empty">Loading class history...</div>
              ) : historySessions.length === 0 ? (
                <div className="live-page__empty">No completed classes yet.</div>
              ) : (
                historySessions.map((session) => (
                  <article key={session._id} className="live-page__card">
                    <div>
                      <h3>{session.title}</h3>
                      <p>{session.mentor?.name || 'Mentor'}</p>
                      <small>
                        {session.status === 'cancelled'
                          ? `Cancelled - ${formatClassTime(session.scheduledStart)}`
                          : `Completed - ${formatClassTime(session.actualEnd || session.actualStart || session.scheduledStart)}`}
                      </small>
                    </div>
                    <button type="button" className="btn btn-secondary" disabled>
                      {session.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                    </button>
                  </article>
                ))
              )}
            </section>
            </>
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
                loadSessions();
                setError((prev) => prev || `Live class disconnected. ${formatDisconnectReason(reason)}`);
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
