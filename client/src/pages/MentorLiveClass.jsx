import { useEffect, useState, useCallback, useMemo } from 'react';
import Sidebar from '../components/layout/Sidebar';
import LiveClassRoom from '../components/liveclass/LiveClassRoom';
import {
  cancelMentorScheduledLiveClass,
  endMentorLiveClass,
  fetchMentorLiveDashboard,
  scheduleMentorLiveClass,
  startMentorLiveClass,
  updateMentorScheduledLiveClass,
} from '../services/liveClassApi';
import { fetchMentorDashboard } from '../services/mentorApi';
import { DisconnectReason } from 'livekit-client';
import {
  HiVideoCamera,
  HiCalendar,
  HiClock,
  HiUserGroup,
  HiPencil,
  HiTrash,
  HiSparkles,
  HiPlay,
  HiCheckCircle,
  HiExclamationCircle,
  HiSearch,
  HiCheck,
  HiX,
} from 'react-icons/hi';
import './LiveClassPages.css';

const emptyDashboard = {
  sessionsThisWeek: 0,
  weeklyLimit: 4,
  activeSession: null,
  scheduledSessions: [],
  classHistory: [],
};

const TEMPLATE_TITLES = [
  'Weekly Doubt Clearing Session',
  'Mock Test Question Analysis',
  'Important Problem Solving Class',
  'Concept Breakdown & Quick Revision',
  'Exam Strategy & Time Management',
];

export default function MentorLiveClass() {
  const [user] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Mentor',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'tutor',
  });

  const [scheduleForm, setScheduleForm] = useState({
    editingSessionId: '',
    title: 'Weekly Live Class',
    scheduledStart: '',
    durationMinutes: '60',
    description: '',
    audienceType: 'all_accepted',
    studentIds: [],
  });

  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [acceptedStudents, setAcceptedStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [connection, setConnection] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelSession, setCancelSession] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'completed' | 'cancelled'

  const formatDisconnectReason = useCallback((reason) => {
    if (reason === undefined || reason === null) return '';
    const name = DisconnectReason[reason] || String(reason);
    if (name === 'DUPLICATE_IDENTITY') {
      return 'LiveKit disconnected because another browser tab/device connected with the same mentor identity.';
    }
    if (name === 'ROOM_DELETED') {
      return 'The live session was closed. You can restart or rejoin whenever you are ready.';
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

  const toDateTimeInputValue = useCallback((value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const [liveData, mentorData] = await Promise.all([
        fetchMentorLiveDashboard(),
        fetchMentorDashboard(),
      ]);
      setDashboard({ ...emptyDashboard, ...(liveData || {}) });
      setAcceptedStudents(Array.isArray(mentorData?.students) ? mentorData.students : []);
    } catch (err) {
      setError(err.message || 'Failed to load live class dashboard.');
    }
  }, []);

  useEffect(() => {
    if (!['tutor', 'teacher'].includes(user.role)) {
      window.location.href = '/dashboard';
      return;
    }
    const currentPlan = localStorage.getItem('topkorbo_plan') || 'free';
    if (user.role === 'tutor' && !['mentor_pro', 'mentor_3months', 'mentor_6months', 'mentor_yearly'].includes(currentPlan)) {
      window.location.href = '/mentor-pricing';
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 15000);
    return () => window.clearInterval(timer);
  }, [user.role, loadDashboard]);

  const updateScheduleForm = (field, value) => {
    setScheduleForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleScheduleStudent = (studentId) => {
    setScheduleForm((prev) => {
      const current = new Set(prev.studentIds);
      if (current.has(studentId)) current.delete(studentId);
      else current.add(studentId);
      return { ...prev, studentIds: Array.from(current) };
    });
  };

  const selectAllStudents = () => {
    const allIds = acceptedStudents.map((entry) => String(entry.student?._id || '')).filter(Boolean);
    setScheduleForm((prev) => ({ ...prev, studentIds: allIds }));
  };

  const clearSelectedStudents = () => {
    setScheduleForm((prev) => ({ ...prev, studentIds: [] }));
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      editingSessionId: '',
      title: 'Weekly Live Class',
      scheduledStart: '',
      durationMinutes: '60',
      description: '',
      audienceType: 'all_accepted',
      studentIds: [],
    });
  };

  const handleEditScheduledClass = (session) => {
    setError('');
    setScheduleForm({
      editingSessionId: session._id,
      title: session.title || 'Weekly Live Class',
      scheduledStart: toDateTimeInputValue(session.scheduledStart),
      durationMinutes: String(session.durationMinutes || 60),
      description: session.description || '',
      audienceType: session.audienceType || 'all_accepted',
      studentIds: Array.isArray(session.invitedStudents)
        ? session.invitedStudents.map((id) => String(id))
        : [],
    });
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleScheduleClass = async () => {
    try {
      setBusy(true);
      setError('');
      const payload = {
        title: scheduleForm.title,
        description: scheduleForm.description,
        scheduledStart: new Date(scheduleForm.scheduledStart).toISOString(),
        durationMinutes: Number(scheduleForm.durationMinutes) || 60,
        audienceType: scheduleForm.audienceType,
        studentIds: scheduleForm.studentIds,
      };
      if (scheduleForm.editingSessionId) {
        await updateMentorScheduledLiveClass(scheduleForm.editingSessionId, payload);
      } else {
        await scheduleMentorLiveClass(payload);
      }
      resetScheduleForm();
      await loadDashboard();
    } catch (err) {
      setError(err.message || `Failed to ${scheduleForm.editingSessionId ? 'update' : 'schedule'} live class.`);
    } finally {
      setBusy(false);
    }
  };

  const handleStartClass = async (session = null) => {
    try {
      setBusy(true);
      setError('');
      const data = await startMentorLiveClass({
        title: session?.title || 'Live Class',
        roomName: dashboard.activeSession?.roomName || session?.roomName || '',
        sessionId: session?._id || '',
      });
      setConnection(data);
      setDashboard((prev) => ({
        ...prev,
        sessionsThisWeek: data.sessionsThisWeek,
        weeklyLimit: data.weeklyLimit,
        activeSession: data.session,
        scheduledSessions: (prev.scheduledSessions || []).filter((item) => item._id !== data.session?._id),
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
      setConnection(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Failed to end live class.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelScheduledClass = async (session) => {
    if (!session?._id) return;

    try {
      setBusy(true);
      setError('');
      await cancelMentorScheduledLiveClass(session._id);
      setCancelSession(null);
      if (scheduleForm.editingSessionId === session._id) {
        resetScheduleForm();
      }
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Failed to cancel scheduled class.');
    } finally {
      setBusy(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return acceptedStudents;
    const q = studentSearch.toLowerCase();
    return acceptedStudents.filter((entry) => {
      const name = (entry.student?.name || '').toLowerCase();
      const stream = (entry.student?.stream || '').toLowerCase();
      const college = (entry.student?.collegeName || '').toLowerCase();
      return name.includes(q) || stream.includes(q) || college.includes(q);
    });
  }, [acceptedStudents, studentSearch]);

  const filteredHistory = useMemo(() => {
    const history = dashboard.classHistory || [];
    if (historyFilter === 'completed') return history.filter((item) => item.status === 'completed');
    if (historyFilter === 'cancelled') return history.filter((item) => item.status === 'cancelled');
    return history;
  }, [dashboard.classHistory, historyFilter]);

  const usagePercent = Math.min(
    100,
    Math.round(((dashboard.sessionsThisWeek || 0) / (dashboard.weeklyLimit || 4)) * 100)
  );

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="live-class" user={user} />
      <main className="dashboard-main">
        <div className="live-page">
          {/* Hero Banner with Quota Indicator */}
          <section className="live-page__intro">
            <div className="live-page__intro-content">
              <div className="live-page__intro-icon">
                <HiVideoCamera size={26} />
              </div>
              <div className="live-page__intro-text">
                <h1>Mentor Live Studio</h1>
                <p>
                  Conduct interactive live classes, share your screen, explain concepts in real-time,
                  and connect with your accepted students.
                </p>
              </div>
            </div>

            <div className="live-page__usage-card">
              <div className="live-page__usage-header">
                <span>Weekly Quota</span>
                <span className="live-page__usage-count">
                  {dashboard.sessionsThisWeek} / {dashboard.weeklyLimit}
                </span>
              </div>
              <div className="live-page__usage-bar">
                <div className="live-page__usage-fill" style={{ width: `${usagePercent}%` }} />
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

          {/* Active Live Room Viewport */}
          {connection ? (
            <section className="live-page__section" style={{ padding: '16px' }}>
              <LiveClassRoom
                token={connection.token}
                wsUrl={connection.wsUrl}
                mode="mentor"
                connect={true}
                sessionTitle={connection.session?.title || 'Live Class'}
                onConnected={() => {
                  setError('');
                }}
                onError={(err) => {
                  console.error('LiveKit mentor connection error:', err);
                  const msg = err?.message || '';
                  if (msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('notallowederror')) {
                    setError('Camera or Microphone access was denied by your browser. Please allow camera and mic permissions in your URL bar and refresh.');
                  } else {
                    setError(`LiveKit connection error: ${msg}. Check LiveKit server connection.`);
                  }
                }}
                onDisconnected={(reason) => {
                  setConnection(null);
                  loadDashboard();
                  setError((prev) => prev || `Live class ended. ${formatDisconnectReason(reason)}`);
                }}
                onEndClass={handleEndClass}
              />
            </section>
          ) : null}

          {/* Broadcast Banner: If there is an active session running but not connected */}
          {!connection && dashboard.activeSession ? (
            <div className="live-page__active-banner">
              <div className="live-page__active-info">
                <span className="live-page__active-pulse-badge">
                  <span className="live-room__live-pulse" />
                  Live Now
                </span>
                <div className="live-page__active-details">
                  <h3>{dashboard.activeSession.title || 'Live Class In Progress'}</h3>
                  <p>
                    Started at {formatClassTime(dashboard.activeSession.actualStart)} • {dashboard.activeSession.durationMinutes || 60} mins duration
                  </p>
                </div>
              </div>
              <div className="live-page__active-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={handleEndClass}
                >
                  End Class
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => handleStartClass(dashboard.activeSession)}
                >
                  <HiPlay size={18} />
                  Rejoin Class
                </button>
              </div>
            </div>
          ) : null}

          {!connection ? (
            <>
              {/* Class Scheduling Studio */}
              <section className="live-page__section">
                <div className="live-page__section-head">
                  <div>
                    <h2>
                      <HiCalendar size={22} color="#c08552" />
                      {scheduleForm.editingSessionId ? 'Edit Scheduled Class' : 'Schedule a Live Class'}
                    </h2>
                    <p>
                      {scheduleForm.editingSessionId
                        ? 'Update the class details or start time for your students.'
                        : 'Plan ahead, notify your accepted students, and start with a single click.'}
                    </p>
                  </div>
                  {scheduleForm.editingSessionId ? (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={resetScheduleForm}>
                      Cancel Edit
                    </button>
                  ) : null}
                </div>

                {/* Quick title template presets */}
                {!scheduleForm.editingSessionId ? (
                  <div className="live-page__template-chips">
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                      Quick Topics:
                    </span>
                    {TEMPLATE_TITLES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="live-page__template-chip"
                        onClick={() => updateScheduleForm('title', t)}
                      >
                        <HiSparkles size={13} />
                        {t}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="live-page__schedule-grid">
                  <div className="live-page__field">
                    <label htmlFor="class-title-input">Class Title</label>
                    <input
                      id="class-title-input"
                      value={scheduleForm.title}
                      onChange={(e) => updateScheduleForm('title', e.target.value)}
                      maxLength={140}
                      placeholder="e.g. Higher Math Calculus Problem Solving"
                    />
                  </div>

                  <div className="live-page__field">
                    <label htmlFor="class-date-input">Date & Time</label>
                    <input
                      id="class-date-input"
                      type="datetime-local"
                      value={scheduleForm.scheduledStart}
                      onChange={(e) => updateScheduleForm('scheduledStart', e.target.value)}
                    />
                  </div>
                </div>

                <div className="live-page__schedule-grid">
                  <div className="live-page__field">
                    <label>Duration</label>
                    <div className="live-page__duration-pills">
                      {['30', '45', '60', '90', '120'].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          className={`live-page__duration-pill ${scheduleForm.durationMinutes === mins ? 'live-page__duration-pill--active' : ''}`}
                          onClick={() => updateScheduleForm('durationMinutes', mins)}
                        >
                          {mins} mins
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="live-page__field">
                    <label htmlFor="class-audience-select">Target Audience</label>
                    <select
                      id="class-audience-select"
                      value={scheduleForm.audienceType}
                      onChange={(e) => updateScheduleForm('audienceType', e.target.value)}
                    >
                      <option value="all_accepted">All accepted students ({acceptedStudents.length})</option>
                      <option value="selected">Selected students only</option>
                    </select>
                  </div>
                </div>

                <div className="live-page__field">
                  <label htmlFor="class-desc-input">Topic Details & Agenda</label>
                  <textarea
                    id="class-desc-input"
                    value={scheduleForm.description}
                    onChange={(e) => updateScheduleForm('description', e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Provide a brief summary of what will be discussed (e.g. Chapter 4 problem set 1-15, doubt solving)."
                  />
                </div>

                {/* Interactive Multi-Select Student Chips if Audience is "Selected" */}
                {scheduleForm.audienceType === 'selected' ? (
                  <div className="live-page__field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label>Select Students ({scheduleForm.studentIds.length} selected)</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllStudents}>
                          Select All
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelectedStudents}>
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="live-page__search-box" style={{ marginBottom: '10px' }}>
                      <HiSearch size={16} color="#8c7b79" />
                      <input
                        type="text"
                        placeholder="Search student by name or stream..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                      />
                    </div>

                    <div className="live-page__student-chips">
                      {filteredStudents.length ? (
                        filteredStudents.map((entry) => {
                          const studentId = String(entry.student?._id || '');
                          const isSelected = scheduleForm.studentIds.includes(studentId);
                          return (
                            <button
                              key={entry.connectionId}
                              type="button"
                              className={`live-page__student-chip ${isSelected ? 'live-page__student-chip--selected' : ''}`}
                              onClick={() => toggleScheduleStudent(studentId)}
                            >
                              {isSelected ? <HiCheck size={14} /> : null}
                              <span>{entry.student?.name || 'Student'}</span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="live-page__empty" style={{ padding: '12px' }}>
                          No students matching your search.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      busy
                      || !scheduleForm.scheduledStart
                      || acceptedStudents.length === 0
                      || (scheduleForm.audienceType === 'selected' && scheduleForm.studentIds.length === 0)
                    }
                    onClick={handleScheduleClass}
                  >
                    <HiCalendar size={18} />
                    {busy
                      ? (scheduleForm.editingSessionId ? 'Saving...' : 'Scheduling...')
                      : (scheduleForm.editingSessionId ? 'Save Changes' : 'Schedule Live Class')}
                  </button>
                </div>
              </section>

              {/* Upcoming Scheduled Classes Grid */}
              <section className="live-page__section">
                <div className="live-page__section-head">
                  <div>
                    <h2>
                      <HiClock size={22} color="#c08552" />
                      Upcoming Scheduled Classes
                    </h2>
                    <p>Classes ready to start when the time arrives.</p>
                  </div>
                  <span className="live-page__section-badge">
                    {dashboard.scheduledSessions?.length || 0} scheduled
                  </span>
                </div>

                {dashboard.scheduledSessions?.length ? (
                  <div className="live-page__cards-grid">
                    {dashboard.scheduledSessions.map((session) => (
                      <article key={session._id} className="live-page__card">
                        <div>
                          <div className="live-page__card-header">
                            <span className="live-page__card-tag live-page__card-tag--upcoming">
                              <HiClock size={12} />
                              Scheduled
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                              {session.durationMinutes || 60} mins
                            </span>
                          </div>

                          <h3 className="live-page__card-title">{session.title}</h3>

                          <div className="live-page__card-meta">
                            <div className="live-page__card-meta-item">
                              <HiCalendar size={15} color="#c08552" />
                              <span>{formatClassTime(session.scheduledStart)}</span>
                            </div>
                            <div className="live-page__card-meta-item">
                              <HiUserGroup size={15} color="#c08552" />
                              <span>
                                {session.audienceType === 'selected' ? 'Selected students' : 'All accepted students'}
                              </span>
                            </div>
                          </div>

                          {session.description ? (
                            <p className="live-page__card-desc">{session.description}</p>
                          ) : null}
                        </div>

                        <div className="live-page__card-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => handleEditScheduledClass(session)}
                            title="Edit class"
                          >
                            <HiPencil size={15} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => setCancelSession(session)}
                            title="Cancel class"
                          >
                            <HiTrash size={15} />
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy || dashboard.sessionsThisWeek >= dashboard.weeklyLimit}
                            onClick={() => handleStartClass(session)}
                          >
                            <HiPlay size={15} />
                            Start Class
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="live-page__empty">
                    <div className="live-page__empty-icon">
                      <HiCalendar />
                    </div>
                    <h4>No scheduled classes</h4>
                    <p>Schedule your next live class session above to invite your students.</p>
                  </div>
                )}
              </section>

              {/* Class History Section */}
              <section className="live-page__section">
                <div className="live-page__section-head">
                  <div>
                    <h2>
                      <HiCheckCircle size={22} color="#c08552" />
                      Class History
                    </h2>
                    <p>Completed and cancelled sessions.</p>
                  </div>

                  <div className="live-page__tab-pills">
                    <button
                      type="button"
                      className={`live-page__tab-pill ${historyFilter === 'all' ? 'live-page__tab-pill--active' : ''}`}
                      onClick={() => setHistoryFilter('all')}
                    >
                      All ({dashboard.classHistory?.length || 0})
                    </button>
                    <button
                      type="button"
                      className={`live-page__tab-pill ${historyFilter === 'completed' ? 'live-page__tab-pill--active' : ''}`}
                      onClick={() => setHistoryFilter('completed')}
                    >
                      Completed
                    </button>
                    <button
                      type="button"
                      className={`live-page__tab-pill ${historyFilter === 'cancelled' ? 'live-page__tab-pill--active' : ''}`}
                      onClick={() => setHistoryFilter('cancelled')}
                    >
                      Cancelled
                    </button>
                  </div>
                </div>

                {filteredHistory.length ? (
                  <div className="live-page__cards-grid">
                    {filteredHistory.map((session) => (
                      <article key={session._id} className="live-page__card">
                        <div>
                          <div className="live-page__card-header">
                            <span
                              className={`live-page__card-tag ${session.status === 'cancelled' ? 'live-page__card-tag--cancelled' : 'live-page__card-tag--completed'}`}
                            >
                              {session.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                              {session.durationMinutes || 60} mins
                            </span>
                          </div>

                          <h3 className="live-page__card-title">{session.title || 'Live Class'}</h3>

                          <div className="live-page__card-meta">
                            <div className="live-page__card-meta-item">
                              <HiCalendar size={15} color="#c08552" />
                              <span>{formatClassTime(session.actualStart || session.scheduledStart)}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '10px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {session.status === 'cancelled'
                              ? 'Session was cancelled'
                              : `Ended ${formatClassTime(session.actualEnd || session.actualStart || session.scheduledStart)}`}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="live-page__empty">
                    <p>No class history found for this filter.</p>
                  </div>
                )}
              </section>

              {/* Accepted Students Roster Section */}
              <section className="live-page__section">
                <div className="live-page__section-head">
                  <div>
                    <h2>
                      <HiUserGroup size={22} color="#c08552" />
                      Accepted Students ({acceptedStudents.length})
                    </h2>
                    <p>Students eligible to attend your live sessions.</p>
                  </div>
                </div>

                {acceptedStudents.length === 0 ? (
                  <div className="live-page__empty">
                    <p>No accepted students yet. Accept student mentorship requests from your mentor dashboard.</p>
                  </div>
                ) : (
                  <div className="live-page__student-roster-grid">
                    {acceptedStudents.map((entry) => (
                      <div key={entry.connectionId} className="live-page__student-roster-card">
                        <div className="live-page__student-roster-avatar">
                          {entry.student?.avatar ? (
                            <img src={entry.student.avatar} alt={entry.student.name} referrerPolicy="no-referrer" />
                          ) : (
                            (entry.student?.name || 'S').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="live-page__student-roster-info">
                          <h4>{entry.student?.name || 'Student'}</h4>
                          <p>
                            {entry.student?.collegeName || entry.student?.stream || entry.student?.academicStatus || 'Accepted Student'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {/* Modal: Cancel Scheduled Class */}
          {cancelSession ? (
            <div
              className="live-page__modal-backdrop"
              role="presentation"
              onClick={() => {
                if (!busy) setCancelSession(null);
              }}
            >
              <div
                className="live-page__modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-class-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 id="cancel-class-title" style={{ margin: 0 }}>Cancel Scheduled Class?</h2>
                  <button
                    type="button"
                    onClick={() => setCancelSession(null)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    aria-label="Close"
                  >
                    <HiX size={20} />
                  </button>
                </div>
                <p style={{ marginTop: '12px' }}>
                  Are you sure you want to cancel <strong>{cancelSession.title || 'this session'}</strong>?
                  Invited students will be notified that the class will not take place.
                </p>
                <div style={{ marginTop: '14px', fontSize: '0.86rem', color: 'var(--live-copper-dark)' }}>
                  <strong>Time:</strong> {formatClassTime(cancelSession.scheduledStart)} ({cancelSession.durationMinutes || 60} mins)
                </div>
                <div className="live-page__modal-actions" style={{ marginTop: '20px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => setCancelSession(null)}
                  >
                    Keep Class
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary live-page__danger-btn"
                    disabled={busy}
                    onClick={() => handleCancelScheduledClass(cancelSession)}
                  >
                    {busy ? 'Cancelling...' : 'Cancel Class'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
