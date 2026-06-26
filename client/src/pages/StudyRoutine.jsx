import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import {
  HiCalendar,
  HiChatAlt2,
  HiOutlineRefresh,
  HiPaperAirplane,
  HiSparkles,
  HiChevronLeft,
  HiChevronRight
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import StatsBar from '../components/study/StatsBar';
import CalendarView from '../components/study/CalendarView';
import DayDetailList from '../components/study/DayDetailList';
import { aiApi } from '../services/aiApi';
import { studyRoutineApi } from '../services/studyRoutineApi';
import { todayKey, toISODate, findDayByKey } from '../utils/dateHelpers';
import './StudyRoutine.css';

const STORAGE_KEY = 'topkorbo_study_routine_messages';

const STARTERS = [
  'I need a 35-day study plan for Physics and Math, 6 days a week. Exam in about 2 months.',
  'Make a 30-day plan covering Chemistry 1st Paper chapters 1-8. HSC 2nd year, Science.',
  'I want a 40-day routine for HSC prep — weak in Biology, need to cover Bangla and English too.'
];

function loadStoredMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((m) => m && m.role && m.content)
      : [];
  } catch {
    return [];
  }
}

/**
 * Map low-level Groq / network errors into a friendly user message.
 * Falls back to `fallback` for unknown errors.
 */
function formatAiError(err, fallback = 'AI mentor unavailable.') {
  const status = err?.status || err?.statusCode || 0;
  const raw = String(err?.message || '');
  if (status === 503 || /over capacity|overloaded|service unavailable/i.test(raw)) {
    return 'AI is busy right now (over capacity). Tried several times — please try again in a minute.';
  }
  if (status === 429 || /rate limit|too many requests/i.test(raw)) {
    return 'Too many requests — please slow down and try again in a moment.';
  }
  if (status === 0 || /network error|failed to fetch/i.test(raw)) {
    return 'Network problem. Check your connection and try again.';
  }
  if (status >= 500) {
    return 'AI service hit an error. Please try again shortly.';
  }
  return err?.message || fallback;
}

export default function StudyRoutine() {
  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [stats, setStats] = useState({
    streakDays: 0,
    todayCompletionPct: 0,
    overallCompletionPct: 0,
    bySubject: {},
    byDay: []
  });
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(todayKey());

  // AI Modify panel
  const [showModifyPanel, setShowModifyPanel] = useState(false);
  const [modifyInput, setModifyInput] = useState('');
  const [isModifying, setIsModifying] = useState(false);

  const messagesEndRef = useRef(null);
  const activeTab = 'study-routine';

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    const init = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const resp = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.status === 401) {
          localStorage.removeItem('topkorbo_token');
          window.location.href = '/';
          return;
        }
        const payload = await resp.json();
        if (payload.success && payload.data) {
          const u = {
            name: payload.data.name,
            avatar: payload.data.avatar || '',
            email: payload.data.email,
            role: payload.data.role
          };
          setUser(u);
          ['name', 'avatar', 'email', 'role'].forEach((k) =>
            localStorage.setItem(`topkorbo_${k}`, u[k])
          );
        }

        const [routineRes, statsRes] = await Promise.all([
          studyRoutineApi.get(),
          studyRoutineApi.getStats().catch(() => null)
        ]);
        if (routineRes?.routine) setActiveRoutine(routineRes.routine);
        // httpClient auto-unwraps { success, data } → returns `data` directly.
        if (statsRes) setStats(statsRes);
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setIsFetching(false);
      }
    };
    init();
  }, []);

  // Default selected day → today, falling back to first day in routine
  useEffect(() => {
    if (!activeRoutine?.routine?.length) return;
    const today = todayKey();
    const match = findDayByKey(activeRoutine, today);
    if (match) {
      setSelectedDayKey(today);
      setCalendarCursor(today);
    } else if (!selectedDayKey) {
      const first = activeRoutine.routine.find((d) => d.dayDate) || activeRoutine.routine[0];
      if (first?.dayDate) {
        const key = toISODate(first.dayDate);
        setSelectedDayKey(key);
        setCalendarCursor(key);
      } else {
        setSelectedDayKey(activeRoutine.routine[0]._id);
      }
    }
  }, [activeRoutine, selectedDayKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    if (!activeRoutine) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, activeRoutine]);

  const canSend = input.trim().length > 0 && !isLoading;

  // --- Send chat message ---
  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || isLoading) return;

    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setIsLoading(true);

    try {
      const result = await aiApi.studyRoutine({ messages: next });
      setMessages((curr) => [
        ...curr,
        { role: 'assistant', content: result.reply, routineReady: result.routineReady }
      ]);

      if (result.routineReady && Array.isArray(result.routine) && result.routine.length > 0) {
        try {
          const startDate =
            result.studentProfile?.startDate ||
            (result.routine[0]?.dayDate ? toISODate(result.routine[0].dayDate) : null);
          const durationDays = result.studentProfile?.planDurationDays || null;
          const saveRes = await studyRoutineApi.save(result.routine, result.examInfo, result.studentProfile, {
            startDate,
            durationDays
          });
          if (saveRes?.routine) {
            setActiveRoutine(saveRes.routine);
            const today = todayKey();
            const todayDay = findDayByKey(saveRes.routine, today);
            if (todayDay) {
              setSelectedDayKey(today);
              setCalendarCursor(today);
            } else {
              const firstWithDate = saveRes.routine.routine?.find((d) => d.dayDate) || saveRes.routine.routine?.[0];
              const key = firstWithDate?.dayDate ? toISODate(firstWithDate.dayDate) : null;
              if (key) {
                setSelectedDayKey(key);
                setCalendarCursor(key);
              }
            }
            localStorage.removeItem(STORAGE_KEY);
            toast.success('🎉 Your exam preparation routine is ready!');
            try {
              const statsRes = await studyRoutineApi.getStats();
              if (statsRes) setStats(statsRes);
            } catch {}
          }
        } catch (e) {
          console.error('Save failed:', e);
          toast.error('Routine generated but failed to save. Try again.');
        }
      }
    } catch (err) {
      console.error('Chat failed:', err);
      const msg = formatAiError(err);
      toast.error(msg, { duration: 6000 });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Reset ---
  const resetConversation = async () => {
    if (!window.confirm('Reset your study routine? This deletes your tracker and progress.')) return;
    try {
      if (activeRoutine) {
        await studyRoutineApi.delete();
        setActiveRoutine(null);
        setSelectedDayKey(null);
      }
      setMessages([]);
      setInput('');
      localStorage.removeItem(STORAGE_KEY);
      setShowModifyPanel(false);
      setStats({ streakDays: 0, todayCompletionPct: 0, overallCompletionPct: 0, bySubject: {}, byDay: [] });
      toast.success('Routine reset. Start fresh!');
    } catch {
      toast.error('Failed to reset.');
    }
  };

  // --- Toggle segment ---
  const toggleSegment = useCallback(async (dayId, segmentId, current) => {
    const newVal = !current;
    setActiveRoutine((prev) => {
      if (!prev) return prev;
      const u = JSON.parse(JSON.stringify(prev));
      const seg = u.routine.find((d) => d._id === dayId)?.segments.find((s) => s._id === segmentId);
      if (seg) seg.completed = newVal;
      return u;
    });
    // Optimistic stats update
    setStats((prev) => {
      const delta = newVal ? 1 : -1;
      return {
        ...prev,
        overallCompletionPct: Math.max(0, Math.min(100, prev.overallCompletionPct + delta))
      };
    });
    try {
      await studyRoutineApi.toggleSegment(dayId, segmentId, newVal);
      // Refresh stats quietly after toggle
      try {
        const statsRes = await studyRoutineApi.getStats();
        if (statsRes) setStats(statsRes);
      } catch {}
    } catch {
      toast.error('Failed to update.');
      setActiveRoutine((prev) => {
        const u = JSON.parse(JSON.stringify(prev));
        const seg = u.routine.find((d) => d._id === dayId)?.segments.find((s) => s._id === segmentId);
        if (seg) seg.completed = current;
        return u;
      });
      setStats((prev) => {
        const delta = newVal ? -1 : 1;
        return {
          ...prev,
          overallCompletionPct: Math.max(0, Math.min(100, prev.overallCompletionPct + delta))
        };
      });
    }
  }, []);

  // --- Inline edit ---
  const saveEdit = async (dayId, segment, fields) => {
    const res = await studyRoutineApi.updateSegment(dayId, segment._id, fields);
    if (res?.routine) setActiveRoutine(res.routine);
  };

  // --- AI Modify ---
  const sendModification = async () => {
    if (!modifyInput.trim() || isModifying || !activeRoutine?.routine) return;
    setIsModifying(true);
    try {
      const res = await studyRoutineApi.modifyRoutineAI(modifyInput.trim(), activeRoutine.routine);
      if (res?.routine && Array.isArray(res.routine)) {
        const saveRes = await studyRoutineApi.replaceRoutine(res.routine);
        if (saveRes?.routine) {
          setActiveRoutine(saveRes.routine);
          toast.success('Routine modified by AI!');
          setModifyInput('');
          try {
            const statsRes = await studyRoutineApi.getStats();
            if (statsRes) setStats(statsRes);
          } catch {}
        }
      }
    } catch (err) {
      toast.error(formatAiError(err, 'AI modification failed.'), { duration: 6000 });
    } finally {
      setIsModifying(false);
    }
  };

  // --- Navigation helpers ---
  const navigateDay = (direction) => {
    const days = activeRoutine?.routine || [];
    if (days.length === 0) return;
    const current = selectedDayKey
      ? findDayByKey(activeRoutine, selectedDayKey)
      : null;
    let idx;
    if (!current) {
      idx = 0;
    } else {
      idx = days.findIndex((d) => d._id === current._id);
      idx = idx + direction;
    }
    if (idx < 0) idx = 0;
    if (idx >= days.length) idx = days.length - 1;
    const target = days[idx];
    if (target?.dayDate) {
      const key = toISODate(target.dayDate);
      setSelectedDayKey(key);
      setCalendarCursor(key);
    }
  };

  const goToToday = () => {
    const t = todayKey();
    setSelectedDayKey(t);
    setCalendarCursor(t);
  };

  const examDateLabel = useMemo(() => {
    if (!activeRoutine?.examInfo?.examDate) return null;
    const d = new Date(activeRoutine.examInfo.examDate);
    const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? `${diff} days until exam` : 'Exam date passed';
  }, [activeRoutine]);

  if (isFetching) {
    return (
      <div className="dashboard-container">
        <Sidebar activeTab={activeTab} user={user} />
        <main
          className="dashboard-main"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}
        >
          <span className="routine-spinner" /> Loading...
        </main>
      </div>
    );
  }

  const currentDay = selectedDayKey ? findDayByKey(activeRoutine, selectedDayKey) : null;

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />
      <main className="dashboard-main">
        <header className="dashboard-header routine-header">
          <div className="dashboard-header__welcome">
            <h2>
              <HiCalendar className="routine-header-icon" /> AI Study Routine
            </h2>
            <p>Date-aware study planner with streak tracking and calendar view.</p>
          </div>
          <div className="routine-header-actions">
            {examDateLabel && <span className="routine-exam-countdown">{examDateLabel}</span>}
            <span className={`routine-status ${activeRoutine ? 'routine-status--ready' : ''}`}>
              {activeRoutine ? 'Routine Active' : messages.length === 0 ? 'Ready to start' : 'Collecting details'}
            </span>
            <button
              type="button"
              className="routine-icon-btn"
              onClick={resetConversation}
              title="Reset"
              disabled={isLoading && !activeRoutine}
            >
              <HiOutlineRefresh />
            </button>
          </div>
        </header>

        <div className="dashboard-workspace routine-workspace">
          {activeRoutine && activeRoutine.routine?.length > 0 ? (
            <section className="routine-tracker-panel">
              {/* Header + Stats */}
              <div className="routine-tracker-header">
                <div className="routine-tracker-header__top">
                  <div>
                    <h3>📋 {activeRoutine.examInfo?.examName || 'Study Routine'}</h3>
                    <p>
                      {activeRoutine.startDate && (
                        <>
                          Started{' '}
                          {new Date(activeRoutine.startDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          {activeRoutine.durationDays && <> · {activeRoutine.durationDays}-day plan</>}
                        </>
                      )}
                      {!activeRoutine.startDate && 'Click a day in the calendar → tick off tasks as you go.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="routine-modify-btn"
                  onClick={() => setShowModifyPanel(!showModifyPanel)}
                >
                  <HiSparkles /> {showModifyPanel ? 'Close AI Modifier' : 'Modify with AI'}
                </button>
              </div>

              {/* Stats bar */}
              <StatsBar
                stats={stats}
                routine={activeRoutine}
                examDate={activeRoutine.examInfo?.examDate}
              />

              {/* AI Modify Panel */}
              {showModifyPanel && (
                <div className="routine-modify-panel">
                  <p>
                    Tell the AI how to change your routine. For example:{' '}
                    <em>"Move all Biology to evening"</em> or{' '}
                    <em>"Add more Physics on weekends"</em>
                  </p>
                  <div className="routine-modify-input-row">
                    <textarea
                      value={modifyInput}
                      onChange={(e) => setModifyInput(e.target.value)}
                      placeholder='e.g. "Swap Biology and Physics on Monday"'
                      rows={2}
                      disabled={isModifying}
                    />
                    <button
                      onClick={sendModification}
                      disabled={!modifyInput.trim() || isModifying}
                      className="routine-send-btn"
                    >
                      {isModifying ? (
                        <>
                          <span className="routine-spinner" /> Modifying...
                        </>
                      ) : (
                        <>
                          <HiSparkles /> Apply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Calendar + Day Detail layout */}
              <div className="routine-tracker-grid">
                <div className="routine-calendar-pane">
                  <div className="routine-calendar-pane__header">
                    <h4>📅 Calendar</h4>
                    <button
                      type="button"
                      className="routine-today-btn"
                      onClick={goToToday}
                      disabled={selectedDayKey === todayKey()}
                    >
                      Today
                    </button>
                  </div>
                  <CalendarView
                    routine={activeRoutine}
                    selectedDayKey={calendarCursor}
                    onSelectDay={(key) => {
                      setSelectedDayKey(key);
                      setCalendarCursor(key);
                    }}
                  />
                </div>
                <div className="routine-day-pane">
                  <div className="routine-day-pane__nav">
                    <button
                      type="button"
                      className="routine-day-nav-btn"
                      onClick={() => navigateDay(-1)}
                      aria-label="Previous day"
                    >
                      <HiChevronLeft />
                    </button>
                    <span className="routine-day-pane__date">
                      {currentDay?.dayDate
                        ? new Date(currentDay.dayDate).toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'No day selected'}
                    </span>
                    <button
                      type="button"
                      className="routine-day-nav-btn"
                      onClick={() => navigateDay(1)}
                      aria-label="Next day"
                    >
                      <HiChevronRight />
                    </button>
                  </div>
                  <DayDetailList
                    day={currentDay}
                    dayKey={selectedDayKey}
                    onToggle={toggleSegment}
                    onEdit={saveEdit}
                  />
                </div>
              </div>
            </section>
          ) : (
            /* === Chat UI === */
            <section className="routine-shell">
              <aside className="routine-context-panel">
                <div className="routine-context-panel__top">
                  <span className="routine-context-panel__icon">
                    <HiSparkles />
                  </span>
                  <div>
                    <h3>Study Mentor</h3>
                    <p>
                      Tell the AI about your exam, subjects, papers, chapters, and schedule.
                      Pick a 30, 35, or 40-day plan!
                    </p>
                  </div>
                </div>
                <div className="routine-starter-list">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="routine-starter"
                      onClick={() => sendMessage(s)}
                      disabled={isLoading}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </aside>

              <section className="routine-chat-panel">
                <div className="routine-chat-scroll">
                  {messages.length === 0 && (
                    <div className="routine-empty-state">
                      <HiChatAlt2 />
                      <h3>Plan your exam preparation</h3>
                      <p>
                        The mentor will ask about your exam, subjects, papers, and chapters — then
                        generate a personalized date-aware tracker.
                      </p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <article
                      key={`${msg.role}-${i}`}
                      className={`routine-message routine-message--${msg.role}`}
                    >
                      <div className="routine-message__avatar">
                        {msg.role === 'assistant' ? <HiSparkles /> : user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="routine-message__body">
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                    </article>
                  ))}
                  {isLoading && (
                    <article className="routine-message routine-message--assistant">
                      <div className="routine-message__avatar">
                        <HiSparkles />
                      </div>
                      <div className="routine-message__body routine-message__body--loading">
                        <span className="routine-spinner" /> Building your study plan...
                      </div>
                    </article>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form
                  className="routine-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Example: I need a 35-day HSC study plan, 6 days/week, weak in Biology..."
                    rows={2}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <button type="submit" className="routine-send-btn" disabled={!canSend}>
                    <HiPaperAirplane /> <span>Send</span>
                  </button>
                </form>
              </section>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}