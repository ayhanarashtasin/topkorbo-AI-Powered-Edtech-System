import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import LiveClassRoom from '../components/liveclass/LiveClassRoom';
import { cancelMentorScheduledLiveClass, endMentorLiveClass, fetchMentorLiveDashboard, scheduleMentorLiveClass, startMentorLiveClass, updateMentorScheduledLiveClass } from '../services/liveClassApi';
import { fetchMentorDashboard } from '../services/mentorApi';
import { DisconnectReason } from 'livekit-client';
import './LiveClassPages.css';

const emptyDashboard = {
  sessionsThisWeek: 0,
  weeklyLimit: 4,
  activeSession: null,
  scheduledSessions: [],
  classHistory: [],
};

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
  const [connection, setConnection] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [cancelSession, setCancelSession] = useState(null);

  const formatDisconnectReason = (reason) => {
    if (reason === undefined || reason === null) return '';
    const name = DisconnectReason[reason] || String(reason);
    if (name === 'DUPLICATE_IDENTITY') {
      return 'LiveKit disconnected because another tab/device is already connected with the same mentor identity.';
    }
    if (name === 'ROOM_DELETED') {
      return 'The video room closed, but the class stays saved until you end it or time finishes. Use Rejoin Class to reconnect.';
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

  const toDateTimeInputValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  };

  const loadDashboard = async () => {
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
  };

  useEffect(() => {
    if (!['tutor', 'teacher'].includes(user.role)) {
      window.location.href = '/dashboard';
      return;
    }
    const currentPlan = localStorage.getItem('topkorbo_plan') || 'free';
    if (user.role === 'tutor' && !['mentor_pro', 'mentor_yearly'].includes(currentPlan)) {
      window.location.href = '/mentor-pricing';
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setConnected(false);
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
      setConnected(false);
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

          {connection ? (
            <LiveClassRoom
              token={connection.token}
              wsUrl={connection.wsUrl}
              mode="mentor"
              connect={true}
              sessionTitle={connection.session?.title || 'Live Class'}
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
                loadDashboard();
                setError((prev) => prev || `Live class disconnected. ${formatDisconnectReason(reason)}`);
              }}
              onEndClass={handleEndClass}
            />
          ) : null}
          {connection && !connected ? (
            <div className="live-page__hint">
              Connecting to LiveKit at <strong>{connection.wsUrl}</strong>
            </div>
          ) : null}

          {!connection && dashboard.activeSession ? (
            <section className="live-page__schedule">
              <div className="live-page__section-head">
                <div>
                  <h2>Current Live Class</h2>
                  <p>This class stays available until you end it or the scheduled duration finishes.</p>
                </div>
                <span>Live</span>
              </div>
              <article className="live-page__card">
                <div>
                  <h3>{dashboard.activeSession.title || 'Live Class'}</h3>
                  <p>{formatClassTime(dashboard.activeSession.actualStart)} - {dashboard.activeSession.durationMinutes || 60} minutes</p>
                  <small>{dashboard.activeSession.description || 'Class is ready to rejoin.'}</small>
                </div>
                <div className="live-page__card-actions">
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
                    Rejoin Class
                  </button>
                </div>
              </article>
            </section>
          ) : null}

          {!connection ? (
            <section className="live-page__schedule">
              <div className="live-page__section-head">
                <div>
                  <h2>{scheduleForm.editingSessionId ? 'Edit Scheduled Class' : 'Schedule a Class'}</h2>
                  <p>{scheduleForm.editingSessionId ? 'Save changes and notify students about the updated class time or details.' : 'Pick a time once, notify accepted students, and start the class when it is time.'}</p>
                </div>
                {scheduleForm.editingSessionId ? (
                  <button type="button" className="btn btn-secondary" onClick={resetScheduleForm}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              <div className="live-page__schedule-grid">
                <label className="live-page__field">
                  <span>Class title</span>
                  <input
                    value={scheduleForm.title}
                    onChange={(e) => updateScheduleForm('title', e.target.value)}
                    maxLength={140}
                  />
                </label>
                <label className="live-page__field">
                  <span>Date and time</span>
                  <input
                    type="datetime-local"
                    value={scheduleForm.scheduledStart}
                    onChange={(e) => updateScheduleForm('scheduledStart', e.target.value)}
                  />
                </label>
                <label className="live-page__field">
                  <span>Duration</span>
                  <select
                    value={scheduleForm.durationMinutes}
                    onChange={(e) => updateScheduleForm('durationMinutes', e.target.value)}
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                  </select>
                </label>
                <label className="live-page__field">
                  <span>Students</span>
                  <select
                    value={scheduleForm.audienceType}
                    onChange={(e) => updateScheduleForm('audienceType', e.target.value)}
                  >
                    <option value="all_accepted">All accepted students</option>
                    <option value="selected">Selected students</option>
                  </select>
                </label>
              </div>

              <label className="live-page__field">
                <span>Topic or note</span>
                <textarea
                  value={scheduleForm.description}
                  onChange={(e) => updateScheduleForm('description', e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </label>

              {scheduleForm.audienceType === 'selected' ? (
                <div className="live-page__invite-list">
                  {acceptedStudents.length ? acceptedStudents.map((entry) => {
                    const studentId = String(entry.student?._id || '');
                    return (
                      <label key={entry.connectionId} className="live-page__invite-item">
                        <input
                          type="checkbox"
                          checked={scheduleForm.studentIds.includes(studentId)}
                          onChange={() => toggleScheduleStudent(studentId)}
                        />
                        <span>{entry.student?.name || 'Student'}</span>
                      </label>
                    );
                  }) : (
                    <div className="live-page__empty">No accepted students available.</div>
                  )}
                </div>
              ) : null}

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
                {busy ? (scheduleForm.editingSessionId ? 'Saving...' : 'Scheduling...') : (scheduleForm.editingSessionId ? 'Save Changes' : 'Schedule Class')}
              </button>
            </section>
          ) : null}

          {!connection ? (
            <section className="live-page__schedule">
              <div className="live-page__section-head">
                <div>
                  <h2>Upcoming Scheduled Classes</h2>
                  <p>Start a scheduled class from here when you are ready.</p>
                </div>
                <span>{dashboard.scheduledSessions?.length || 0} scheduled</span>
              </div>
              {dashboard.scheduledSessions?.length ? (
                <div className="live-page__directory">
                  {dashboard.scheduledSessions.map((session) => (
                    <article key={session._id} className="live-page__card">
                      <div>
                        <h3>{session.title}</h3>
                        <p>{formatClassTime(session.scheduledStart)} - {session.durationMinutes || 60} minutes</p>
                        <small>{session.description || (session.audienceType === 'selected' ? 'Selected students' : 'All accepted students')}</small>
                      </div>
                      <div className="live-page__card-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy}
                          onClick={() => handleEditScheduledClass(session)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy}
                          onClick={() => setCancelSession(session)}
                        >
                          Cancel Class
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy || dashboard.sessionsThisWeek >= dashboard.weeklyLimit}
                          onClick={() => handleStartClass(session)}
                        >
                          Start Class
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="live-page__empty">No scheduled classes yet.</div>
              )}
            </section>
          ) : null}

          {!connection ? (
            <section className="live-page__schedule">
              <div className="live-page__section-head">
                <div>
                  <h2>Class History</h2>
                  <p>Recently completed and cancelled classes.</p>
                </div>
                <span>{dashboard.classHistory?.length || 0} classes</span>
              </div>
              {dashboard.classHistory?.length ? (
                <div className="live-page__directory">
                  {dashboard.classHistory.map((session) => (
                    <article key={session._id} className="live-page__card">
                      <div>
                        <h3>{session.title || 'Live Class'}</h3>
                        <p>{formatClassTime(session.actualStart || session.scheduledStart)} - {session.durationMinutes || 60} minutes</p>
                        <small>
                          {session.status === 'cancelled'
                            ? 'Cancelled'
                            : `Ended ${formatClassTime(session.actualEnd || session.actualStart || session.scheduledStart)}`}
                        </small>
                      </div>
                      <button type="button" className="btn btn-secondary" disabled>
                        {session.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="live-page__empty">No class history yet.</div>
              )}
            </section>
          ) : null}

          <section className="live-page__students">
            <div className="live-page__students-head">
              <div>
                <h2>Accepted Students</h2>
                <p>Only these accepted students can see and join your live sessions.</p>
              </div>
              <span>{acceptedStudents.length} student{acceptedStudents.length === 1 ? '' : 's'}</span>
            </div>

            {acceptedStudents.length === 0 ? (
              <div className="live-page__empty">No accepted students yet. Accept student requests from your dashboard first.</div>
            ) : (
              <div className="live-page__student-grid">
                {acceptedStudents.map((entry) => (
                  <article key={entry.connectionId} className="live-page__student-card">
                    <div className="live-page__student-avatar">
                      {entry.student?.avatar ? (
                        <img src={entry.student.avatar} alt={entry.student.name} referrerPolicy="no-referrer" />
                      ) : (
                        (entry.student?.name || 'S').charAt(0)
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
                onClick={(event) => event.stopPropagation()}
              >
                <h2 id="cancel-class-title">Cancel Class</h2>
                <p>
                  Cancel <strong>{cancelSession.title || 'this scheduled class'}</strong>? Students will be notified that this class is cancelled.
                </p>
                <div className="live-page__modal-meta">
                  {formatClassTime(cancelSession.scheduledStart)} - {cancelSession.durationMinutes || 60} minutes
                </div>
                <div className="live-page__modal-actions">
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
