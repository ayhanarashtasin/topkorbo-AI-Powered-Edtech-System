import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import LiveClassRoom from '../components/liveclass/LiveClassRoom';
import { fetchStudentLiveSessions, joinStudentLiveClass } from '../services/liveClassApi';
import { DisconnectReason } from 'livekit-client';
import {
  HiVideoCamera,
  HiCalendar,
  HiClock,
  HiPlay,
  HiExclamationCircle,
  HiSearch,
  HiAcademicCap,
  HiSparkles,
} from 'react-icons/hi';
import './LiveClassPages.css';

export default function StudentLiveClass() {
  const navigate = useNavigate();
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
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'live' | 'upcoming' | 'history'
  const [searchQuery, setSearchQuery] = useState('');

  const formatDisconnectReason = useCallback((reason) => {
    if (reason === undefined || reason === null) return '';
    const name = DisconnectReason[reason] || String(reason);
    if (name === 'DUPLICATE_IDENTITY') {
      return 'LiveKit disconnected because another browser tab/device connected with your student identity.';
    }
    if (name === 'ROOM_DELETED') {
      return 'The live session was ended by the mentor.';
    }
    if (name === 'JOIN_FAILURE') {
      return 'LiveKit connection failed while joining. Please check permissions and room token.';
    }
    return `Disconnected: ${name}.`;
  }, []);

  const formatClassTime = useCallback((value) => {
    if (!value) return 'Time not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Time not set';
    return date.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const data = await fetchStudentLiveSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load live classes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.role !== 'student') {
      window.location.href = '/dashboard';
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
    const timer = window.setInterval(loadSessions, 15000);
    return () => window.clearInterval(timer);
  }, [user.role, loadSessions]);

  const handleJoin = async (roomName) => {
    try {
      setJoiningRoom(roomName);
      setError('');
      const data = await joinStudentLiveClass(roomName);
      setConnection(data);
    } catch (err) {
      setError(err.message || 'Failed to join live class.');
    } finally {
      setJoiningRoom('');
    }
  };

  const liveSessions = useMemo(() => sessions.filter((s) => s.status === 'live'), [sessions]);
  const upcomingSessions = useMemo(() => sessions.filter((s) => s.status === 'scheduled'), [sessions]);
  const historySessions = useMemo(
    () => sessions.filter((s) => ['completed', 'cancelled'].includes(s.status)),
    [sessions]
  );

  const filteredSessions = useMemo(() => {
    let list = sessions;
    if (activeFilter === 'live') list = liveSessions;
    else if (activeFilter === 'upcoming') list = upcomingSessions;
    else if (activeFilter === 'history') list = historySessions;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((s) => {
      const title = (s.title || '').toLowerCase();
      const mentorName = (s.mentor?.name || '').toLowerCase();
      const dept = (s.mentor?.department || '').toLowerCase();
      const uni = (s.mentor?.universityName || '').toLowerCase();
      return title.includes(q) || mentorName.includes(q) || dept.includes(q) || uni.includes(q);
    });
  }, [sessions, activeFilter, liveSessions, upcomingSessions, historySessions, searchQuery]);

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="live-class" user={user} />
      <main className="dashboard-main">
        <div className="live-page">
          {/* Hero Banner */}
          <section className="live-page__intro">
            <div className="live-page__intro-content">
              <div className="live-page__intro-icon">
                <HiVideoCamera size={26} />
              </div>
              <div className="live-page__intro-text">
                <h1>Live Learning Hub</h1>
                <p>
                  Join real-time classrooms conducted by your mentors, participate in discussions,
                  and learn interactively.
                </p>
              </div>
            </div>

            <div className="live-page__usage-card">
              <div className="live-page__usage-header">
                <span>Active Classes</span>
                <span className="live-page__usage-count" style={{ color: '#059669' }}>
                  {liveSessions.length} Live
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {upcomingSessions.length} upcoming scheduled
              </div>
            </div>
          </section>

          {/* Error Alert */}
          {error ? (
            <div className="live-page__error" role="alert">
              <HiExclamationCircle size={20} />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Connected Classroom Viewport */}
          {connection ? (
            <section className="live-page__section" style={{ padding: '16px' }}>
              <LiveClassRoom
                token={connection.token}
                wsUrl={connection.wsUrl}
                mode="student"
                connect={true}
                sessionTitle={connection.session?.title || 'Live Class'}
                onConnected={() => {
                  setError('');
                }}
                onError={(err) => {
                  console.error('LiveKit student connection error:', err);
                  setError(
                    `LiveKit connection failed: ${err?.message || 'Unknown error'}. Check if the mentor is broadcasting.`
                  );
                }}
                onDisconnected={(reason) => {
                  setConnection(null);
                  loadSessions();
                  setError((prev) => prev || `Live class disconnected. ${formatDisconnectReason(reason)}`);
                }}
                onEndClass={null}
              />
            </section>
          ) : (
            <>
              {/* Filter Tabs & Search Bar */}
              <div className="live-page__filter-bar">
                <div className="live-page__tab-pills">
                  <button
                    type="button"
                    className={`live-page__tab-pill ${activeFilter === 'all' ? 'live-page__tab-pill--active' : ''}`}
                    onClick={() => setActiveFilter('all')}
                  >
                    All Classes
                    <span className="live-page__tab-counter">{sessions.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`live-page__tab-pill ${activeFilter === 'live' ? 'live-page__tab-pill--active' : ''}`}
                    onClick={() => setActiveFilter('live')}
                  >
                    <span className="live-room__live-pulse" style={{ width: '6px', height: '6px' }} />
                    Live Now
                    <span className="live-page__tab-counter">{liveSessions.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`live-page__tab-pill ${activeFilter === 'upcoming' ? 'live-page__tab-pill--active' : ''}`}
                    onClick={() => setActiveFilter('upcoming')}
                  >
                    Upcoming
                    <span className="live-page__tab-counter">{upcomingSessions.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`live-page__tab-pill ${activeFilter === 'history' ? 'live-page__tab-pill--active' : ''}`}
                    onClick={() => setActiveFilter('history')}
                  >
                    History
                    <span className="live-page__tab-counter">{historySessions.length}</span>
                  </button>
                </div>

                <div className="live-page__search-box">
                  <HiSearch size={16} color="#8c7b79" />
                  <input
                    type="text"
                    placeholder="Search by mentor or topic..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Spotlight: Live Now Classes */}
              {(activeFilter === 'all' || activeFilter === 'live') && liveSessions.length > 0 && (
                <section className="live-page__section">
                  <div className="live-page__section-head">
                    <div>
                      <h2>
                        <span className="live-room__live-pulse" />
                        Live Classrooms Happening Now
                      </h2>
                      <p>Click below to join and participate immediately.</p>
                    </div>
                    <span className="live-page__section-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}>
                      {liveSessions.length} active
                    </span>
                  </div>

                  <div className="live-page__cards-grid">
                    {liveSessions.map((session) => (
                      <article key={session._id} className="live-page__card" style={{ border: '2px solid rgba(16, 185, 129, 0.35)' }}>
                        <div>
                          <div className="live-page__card-header">
                            <span className="live-page__card-tag live-page__card-tag--live">
                              <span className="live-room__live-pulse" style={{ width: '6px', height: '6px' }} />
                              Live Now
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#047857' }}>
                              {session.durationMinutes || 60} mins
                            </span>
                          </div>

                          <h3 className="live-page__card-title">{session.title}</h3>

                          <div className="live-page__card-mentor-row">
                            <div className="live-page__card-avatar">
                              {session.mentor?.avatar ? (
                                <img src={session.mentor.avatar} alt={session.mentor.name} referrerPolicy="no-referrer" />
                              ) : (
                                (session.mentor?.name || 'M').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {session.mentor?.name || 'Mentor'}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {session.mentor?.department || session.mentor?.universityName || 'Verified Mentor'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="live-page__card-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            disabled={joiningRoom === session.roomName}
                            onClick={() => handleJoin(session.roomName)}
                          >
                            <HiPlay size={18} />
                            {joiningRoom === session.roomName ? 'Connecting...' : 'Join Classroom Now'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Main Directory / Filtered List */}
              <section className="live-page__section">
                <div className="live-page__section-head">
                  <div>
                    <h2>
                      <HiAcademicCap size={22} color="#c08552" />
                      {activeFilter === 'all'
                        ? 'All Mentor Sessions'
                        : activeFilter === 'live'
                        ? 'Live Sessions'
                        : activeFilter === 'upcoming'
                        ? 'Upcoming Schedule'
                        : 'Class History'}
                    </h2>
                    <p>Sessions curated for your connected mentorship tracks.</p>
                  </div>
                  <span className="live-page__section-badge">
                    {filteredSessions.length} {filteredSessions.length === 1 ? 'class' : 'classes'}
                  </span>
                </div>

                {loading ? (
                  <div className="live-page__empty">
                    <p>Loading live classrooms...</p>
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="live-page__empty">
                    <div className="live-page__empty-icon">
                      <HiCalendar />
                    </div>
                    <h4>No live classes found</h4>
                    <p>
                      {searchQuery
                        ? 'No sessions match your search query.'
                        : 'Your mentors have not scheduled new classes at the moment.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '12px' }}
                      onClick={() => navigate('/student/find-mentor')}
                    >
                      <HiSparkles size={16} />
                      Find & Connect with Mentors
                    </button>
                  </div>
                ) : (
                  <div className="live-page__cards-grid">
                    {filteredSessions.map((session) => {
                      const isLive = session.status === 'live';
                      const isUpcoming = session.status === 'scheduled';
                      return (
                        <article key={session._id} className="live-page__card">
                          <div>
                            <div className="live-page__card-header">
                              <span
                                className={`live-page__card-tag ${
                                  isLive
                                    ? 'live-page__card-tag--live'
                                    : isUpcoming
                                    ? 'live-page__card-tag--upcoming'
                                    : session.status === 'cancelled'
                                    ? 'live-page__card-tag--cancelled'
                                    : 'live-page__card-tag--completed'
                                }`}
                              >
                                {isLive && <span className="live-room__live-pulse" style={{ width: '5px', height: '5px' }} />}
                                {isLive
                                  ? 'Live Now'
                                  : isUpcoming
                                  ? 'Scheduled'
                                  : session.status === 'cancelled'
                                  ? 'Cancelled'
                                  : 'Completed'}
                              </span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                {session.durationMinutes || 60} mins
                              </span>
                            </div>

                            <h3 className="live-page__card-title">{session.title}</h3>

                            <div className="live-page__card-meta">
                              <div className="live-page__card-meta-item">
                                <HiCalendar size={15} color="#c08552" />
                                <span>{formatClassTime(session.scheduledStart || session.actualStart)}</span>
                              </div>
                            </div>

                            {session.description ? (
                              <p className="live-page__card-desc">{session.description}</p>
                            ) : null}

                            <div className="live-page__card-mentor-row">
                              <div className="live-page__card-avatar">
                                {session.mentor?.avatar ? (
                                  <img src={session.mentor.avatar} alt={session.mentor.name} referrerPolicy="no-referrer" />
                                ) : (
                                  (session.mentor?.name || 'M').charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                  {session.mentor?.name || 'Mentor'}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                  {session.mentor?.department || session.mentor?.universityName || 'Verified Mentor'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="live-page__card-actions">
                            {isLive ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled={joiningRoom === session.roomName}
                                onClick={() => handleJoin(session.roomName)}
                              >
                                <HiPlay size={16} />
                                {joiningRoom === session.roomName ? 'Connecting...' : 'Join Classroom'}
                              </button>
                            ) : isUpcoming ? (
                              <button type="button" className="btn btn-secondary" style={{ width: '100%' }} disabled>
                                <HiClock size={16} />
                                Starts {formatClassTime(session.scheduledStart)}
                              </button>
                            ) : (
                              <button type="button" className="btn btn-secondary" style={{ width: '100%' }} disabled>
                                {session.status === 'cancelled' ? 'Cancelled' : 'Ended'}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
