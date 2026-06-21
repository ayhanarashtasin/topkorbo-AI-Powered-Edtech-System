import { useEffect, useMemo, useState } from 'react';
import { HiArrowRight, HiChartBar, HiCheck, HiClipboardCheck, HiClock, HiOutlineUserGroup, HiSparkles, HiX } from 'react-icons/hi';
import { useLanguage } from '../hooks/useLanguage';
import Sidebar from '../components/layout/Sidebar';
import {
  fetchMentorDashboard,
  fetchMentors,
  fetchStudentMentorDashboard,
  respondToMentorRequest,
  sendMentorRequest
} from '../services/mentorApi';
import { getStats } from '../services/practiceApi';
import './Dashboard.css';

function formatDate(value, language) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString(language === 'en' ? 'en-US' : 'bn-BD', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDuration(seconds, language) {
  const mins = Math.ceil((seconds || 0) / 60);
  return language === 'en' ? `${mins} min` : `${mins} মিনিট`;
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });
  const [upcomingContests, setUpcomingContests] = useState([]);
  const [mentorCatalog, setMentorCatalog] = useState([]);
  const [studentMentorData, setStudentMentorData] = useState({ mentors: [], recentAttempts: [] });
  const [mentorDashboard, setMentorDashboard] = useState({
    capacity: 30,
    pendingRequests: [],
    students: [],
    overview: {
      totalStudents: 0,
      activeStudents: 0,
      totalAttempts: 0,
      averageStudentScore: 0,
      averageRanking: null,
      subjectInsights: []
    }
  });
  const [practiceStats, setPracticeStats] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [requestingMentorId, setRequestingMentorId] = useState('');
  const [respondingRequestId, setRespondingRequestId] = useState('');

  const activeTab = 'dashboard';
  const isMentor = user.role === 'tutor' || user.role === 'teacher';
  const isTeacher = user.role === 'teacher';
  const isStudent = user.role === 'student';

  const handleSignOut = () => {
    localStorage.removeItem('topkorbo_token');
    localStorage.removeItem('topkorbo_name');
    localStorage.removeItem('topkorbo_avatar');
    localStorage.removeItem('topkorbo_email');
    localStorage.removeItem('topkorbo_phone');
    window.location.href = '/';
  };

  const storeAuthFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return null;

    const name = params.get('name');
    const email = params.get('email');
    const avatar = params.get('avatar');
    const role = params.get('role');

    localStorage.setItem('topkorbo_token', token);
    if (name) localStorage.setItem('topkorbo_name', decodeURIComponent(name));
    if (email) localStorage.setItem('topkorbo_email', decodeURIComponent(email));
    if (avatar) localStorage.setItem('topkorbo_avatar', decodeURIComponent(avatar));
    if (role) localStorage.setItem('topkorbo_role', role);

    window.history.replaceState({}, document.title, window.location.pathname);
    return token;
  };

  const fetchContests = async (authToken, role) => {
    try {
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const endpoint = role === 'teacher' ? '/contests/mine' : '/contests/upcoming';
      const response = await fetch(`${backendBaseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setUpcomingContests(resData.data);
      }
    } catch (err) {
      console.error('Error fetching contests on dashboard:', err);
    }
  };

  const loadMentorData = async (role) => {
    try {
      setDashboardLoading(true);
      setDashboardError('');

      if (role === 'student') {
        const [mentors, studentData] = await Promise.all([
          fetchMentors(),
          fetchStudentMentorDashboard()
        ]);
        setMentorCatalog(Array.isArray(mentors) ? mentors : []);
        setStudentMentorData(studentData || { mentors: [], recentAttempts: [] });
      } else if (role === 'tutor' || role === 'teacher') {
        const mentorData = await fetchMentorDashboard();
        setMentorDashboard(mentorData || {
          capacity: 30,
          pendingRequests: [],
          students: [],
          overview: {
            totalStudents: 0,
            activeStudents: 0,
            totalAttempts: 0,
            averageStudentScore: 0,
            averageRanking: null,
            subjectInsights: []
          }
        });
      }
    } catch (err) {
      console.error('Error loading mentor dashboard:', err);
      setDashboardError(err.message || 'Failed to load dashboard data.');
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleDeleteContest = async (contestId, contestName) => {
    const confirmMessage = language === 'en'
      ? `Delete "${contestName}"? This will also remove all its questions.`
      : `"${contestName}" মুছে ফেলতে চান? এর সাথে সব প্রশ্নও মুছে যাবে।`;
    if (!window.confirm(confirmMessage)) return;

    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;

    const previous = upcomingContests;
    setUpcomingContests((prev) => prev.filter((contest) => contest._id !== contestId));

    try {
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${backendBaseUrl}/contests/${contestId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const resData = await response.json();
      if (!resData.success) {
        setUpcomingContests(previous);
        window.alert(resData.message || 'Failed to delete contest');
      }
    } catch (err) {
      console.error('Error deleting contest:', err);
      setUpcomingContests(previous);
      window.alert('Network error while deleting contest');
    }
  };

  useEffect(() => {
    const tokenFromUrl = storeAuthFromUrl();
    const token = tokenFromUrl || localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    const fetchUserData = async () => {
      try {
        const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${backendBaseUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          handleSignOut();
          return;
        }

        const resData = await response.json();
        if (resData.success && resData.data) {
          const nextUser = {
            name: resData.data.name,
            avatar: resData.data.avatar || '',
            email: resData.data.email,
            role: resData.data.role
          };

          setUser(nextUser);
          localStorage.setItem('topkorbo_name', nextUser.name);
          localStorage.setItem('topkorbo_avatar', nextUser.avatar);
          localStorage.setItem('topkorbo_email', nextUser.email);
          localStorage.setItem('topkorbo_role', nextUser.role);

          if (nextUser.role === 'teacher' || nextUser.role === 'student') {
            fetchContests(token, nextUser.role);
          }

          await loadMentorData(nextUser.role);
        }
      } catch (err) {
        console.error('Error fetching user data on dashboard:', err);
        setDashboardLoading(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    const role = localStorage.getItem('topkorbo_role');
    if (token && (role === 'teacher' || role === 'student')) {
      fetchContests(token, role);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;

    (async () => {
      try {
        const stats = await getStats();
        setPracticeStats(stats);
      } catch (err) {
        console.warn('Practice stats unavailable:', err);
      }
    })();
  }, []);

  const studentMentorStatusById = useMemo(() => {
    const map = new Map();
    (studentMentorData.mentors || []).forEach((item) => {
      if (item.mentor?._id) {
        map.set(item.mentor._id, item.status);
      }
    });
    return map;
  }, [studentMentorData.mentors]);

  const getRemainingTime = (contest) => {
    const offsets = {
      'Asia/Dhaka': '+06:00',
      'Asia/Kolkata': '+05:30',
      'Asia/Dubai': '+04:00',
      'Europe/London': '+00:00',
      'America/New_York': '-05:00',
      'Asia/Tokyo': '+09:00',
      'Asia/Singapore': '+08:00',
      'Australia/Sydney': '+10:00'
    };

    const tz = contest.startTime?.timezone || 'Asia/Dhaka';
    const offset = offsets[tz] || '+06:00';
    let hour = contest.startTime?.hour || 12;
    const minute = contest.startTime?.minute || 0;
    const period = contest.startTime?.period || 'AM';

    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    const pad = (num) => String(num).padStart(2, '0');
    const startStr = `${contest.date}T${pad(hour)}:${pad(minute)}:00${offset}`;
    const startDate = new Date(startStr);
    const now = new Date();
    const diffTime = startDate - now;

    if (diffTime <= 0) {
      const durationHours = contest.duration?.hours || 0;
      const durationMinutes = contest.duration?.minutes || 0;
      const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000) + (durationMinutes * 60 * 1000));

      if (now <= endDate) {
        return language === 'en' ? 'Running now' : 'চলমান রয়েছে';
      }
      return language === 'en' ? 'Ended' : 'শেষ হয়েছে';
    }

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) return language === 'en' ? `${diffDays} day${diffDays > 1 ? 's' : ''} left` : `${diffDays} দিন বাকি`;
    if (diffHours > 0) return language === 'en' ? `${diffHours} hour${diffHours > 1 ? 's' : ''} left` : `${diffHours} ঘণ্টা বাকি`;
    return language === 'en' ? `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} left` : `${diffMinutes} মিনিট বাকি`;
  };

  const handleMentorRequest = async (mentorId) => {
    try {
      setRequestingMentorId(mentorId);
      await sendMentorRequest(mentorId);
      await loadMentorData('student');
    } catch (err) {
      window.alert(err.message || 'Failed to send mentor request.');
    } finally {
      setRequestingMentorId('');
    }
  };

  const handleRequestResponse = async (connectionId, action) => {
    try {
      setRespondingRequestId(connectionId);
      await respondToMentorRequest(connectionId, action);
      await loadMentorData(user.role);
    } catch (err) {
      window.alert(err.message || 'Failed to update request.');
    } finally {
      setRespondingRequestId('');
    }
  };

  const renderPracticeWidget = () => {
    if (!practiceStats || !practiceStats.overall?.totalAttempts) return null;

    return (
      <section className="dashboard-panel dashboard-panel--compact" data-testid="practice-widget">
        <div className="dashboard-panel__header">
          <div>
            <h3>{language === 'en' ? 'Practice Stats' : 'অনুশীলন পরিসংখ্যান'}</h3>
            <p>{language === 'en' ? 'Track your latest practice consistency and accuracy.' : 'তোমার অনুশীলনের অগ্রগতি ও নির্ভুলতা দেখো।'}</p>
          </div>
          <a href="/practice-history" className="practice-widget-link">
            {language === 'en' ? 'View all →' : 'সব দেখুন →'}
          </a>
        </div>
        <div className="practice-widget-grid">
          <div className="practice-widget-stat">
            <HiClipboardCheck size={20} />
            <div>
              <div className="practice-widget-value">{practiceStats.overall.totalAttempts}</div>
              <div className="practice-widget-label">{language === 'en' ? 'Attempts' : 'চেষ্টা'}</div>
            </div>
          </div>
          <div className="practice-widget-stat">
            <HiChartBar size={20} />
            <div>
              <div className="practice-widget-value">{(practiceStats.overall.accuracy * 100).toFixed(0)}%</div>
              <div className="practice-widget-label">{language === 'en' ? 'Accuracy' : 'নির্ভুলতা'}</div>
            </div>
          </div>
          <div className="practice-widget-stat">
            <HiClock size={20} />
            <div>
              <div className="practice-widget-value">{Math.round((practiceStats.overall.totalTimeSeconds || 0) / 60)}m</div>
              <div className="practice-widget-label">{language === 'en' ? 'Total Time' : 'মোট সময়'}</div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderStudentContests = () => {
    if (!isStudent) return null;

    return (
      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h3>{language === 'en' ? 'Upcoming contests' : 'আসন্ন কনটেস্টসমূহ'}</h3>
            <p>{language === 'en' ? 'See your next available contest at a glance.' : 'তোমার পরবর্তী কনটেস্টগুলো এক নজরে দেখো।'}</p>
          </div>
        </div>
        <div className="dashboard-list">
          {upcomingContests.length === 0 ? (
            <div className="dashboard-empty">{language === 'en' ? 'No upcoming contests' : 'কোনো আসন্ন কনটেস্ট নেই'}</div>
          ) : (
            upcomingContests.slice(0, 3).map((contest) => (
              <div key={contest._id} className="dashboard-list__item dashboard-list__item--contest">
                <div>
                  <strong>{contest.name}</strong>
                  <p>{contest.creator?.name || (language === 'en' ? 'Contest' : 'কনটেস্ট')}</p>
                </div>
                <div className="contest-meta">
                  <span>{getRemainingTime(contest)}</span>
                  <span>
                    {contest.startTime?.hour}:{String(contest.startTime?.minute).padStart(2, '0')} {contest.startTime?.period}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    );
  };

  const renderStudentWorkspace = () => (
    <div className="dashboard-panels">
      <section className="dashboard-panel dashboard-panel--catalog">
        <div className="dashboard-panel__header">
          <div>
            <h3>Find mentors</h3>
            <p>Send requests to tutors and mentors, then track who accepted your request.</p>
          </div>
          <span className="dashboard-stat-pill">
            {(studentMentorData.mentors || []).filter((item) => item.status === 'accepted').length} connected
          </span>
        </div>

        <div className="mentor-catalog">
          {mentorCatalog.map((mentor) => {
            const status = studentMentorStatusById.get(mentor._id) || mentor.connectionStatus || 'none';
            const canRequest = status === 'none' || status === 'declined';

            return (
              <article key={mentor._id} className="mentor-card">
                <div className="mentor-card__top">
                  <div className="mentor-avatar">
                    {mentor.avatar ? (
                      <img src={mentor.avatar} alt={mentor.name} referrerPolicy="no-referrer" />
                    ) : (
                      mentor.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h4>{mentor.name}</h4>
                    <p>{mentor.universityName || mentor.collegeName || 'Mentor profile'}</p>
                  </div>
                </div>
                <div className="mentor-badges">
                  {(mentor.interestedToGuide || []).map((item) => (
                    <span key={item} className="dashboard-tag">{item}</span>
                  ))}
                </div>
                <p className="mentor-meta">{mentor.department || mentor.currentYearSemester || 'Academic guide'}</p>
                <p className="mentor-achievement">
                  {mentor.admissionAchievement || 'Supports subject strategy, performance review, and study planning.'}
                </p>
                <button
                  type="button"
                  className={`btn ${canRequest ? 'btn-primary' : 'btn-secondary'} mentor-card__action`}
                  disabled={!canRequest || requestingMentorId === mentor._id}
                  onClick={() => handleMentorRequest(mentor._id)}
                >
                  {status === 'accepted' ? 'Connected' : status === 'pending' ? 'Pending' : status === 'declined' ? 'Request again' : 'Send request'}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {renderPracticeWidget()}

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h3>Your mentor requests</h3>
            <p>Accepted mentors will be able to view your reports, subject-wise scores, and rankings.</p>
          </div>
        </div>

        <div className="dashboard-list">
          {(studentMentorData.mentors || []).length === 0 ? (
            <div className="dashboard-empty">No mentor requests yet. Start by sending one from the list above.</div>
          ) : (
            studentMentorData.mentors.map((item) => (
              <div key={item._id} className="dashboard-list__item">
                <div>
                  <strong>{item.mentor?.name}</strong>
                  <p>{item.mentor?.department || item.mentor?.universityName || 'Mentor'}</p>
                </div>
                <div className={`status-badge status-badge--${item.status}`}>{item.status}</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h3>Recent mock test analytics</h3>
            <p>Your latest attempts are automatically shared with accepted mentors.</p>
          </div>
        </div>

        <div className="dashboard-list">
          {(studentMentorData.recentAttempts || []).length === 0 ? (
            <div className="dashboard-empty">Take a mock test to start building mentor-facing analytics.</div>
          ) : (
            studentMentorData.recentAttempts.map((attempt) => (
              <div key={attempt._id} className="attempt-card">
                <div className="attempt-card__summary">
                  <strong>Score {attempt.score}</strong>
                  <span>{attempt.ranking?.overallPosition ? `Rank #${attempt.ranking.overallPosition}` : 'Ranking pending'}</span>
                </div>
                <div className="attempt-card__meta">
                  <span>{attempt.correct}/{attempt.total} correct</span>
                  <span>{formatDuration(attempt.timeTakenSeconds, language)}</span>
                  <span>{formatDate(attempt.createdAt, language)}</span>
                </div>
                <div className="subject-bars">
                  {(attempt.subjectBreakdown || []).slice(0, 4).map((subject) => {
                    const width = subject.total ? Math.max(8, (subject.correct / subject.total) * 100) : 0;
                    return (
                      <div key={`${attempt._id}-${subject.subject}`} className="subject-bars__row">
                        <span>{subject.subject}</span>
                        <div className="subject-bars__track">
                          <div className="subject-bars__fill" style={{ width: `${width}%` }} />
                        </div>
                        <strong>{subject.correct}/{subject.total}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {renderStudentContests()}
    </div>
  );

  const renderMentorWorkspace = () => (
    <div className="dashboard-panels">
      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h3>Mentor overview</h3>
            <p>Monitor requests, connected students, rankings, and subject trends from one place.</p>
          </div>
          <span className="dashboard-stat-pill">{mentorDashboard.overview.totalStudents}/{mentorDashboard.capacity} students</span>
        </div>

        <div className="overview-grid">
          <div className="overview-card">
            <HiOutlineUserGroup size={20} />
            <strong>{mentorDashboard.overview.totalStudents}</strong>
            <span>Connected students</span>
          </div>
          <div className="overview-card">
            <HiClock size={20} />
            <strong>{mentorDashboard.pendingRequests.length}</strong>
            <span>Pending requests</span>
          </div>
          <div className="overview-card">
            <HiSparkles size={20} />
            <strong>{mentorDashboard.overview.averageStudentScore}</strong>
            <span>Average score</span>
          </div>
          <div className="overview-card">
            <HiArrowRight size={20} />
            <strong>{mentorDashboard.overview.averageRanking || '-'}</strong>
            <span>Average rank</span>
          </div>
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h3>Pending student requests</h3>
            <p>Accept or decline incoming requests directly from the mentor panel.</p>
          </div>
        </div>

        <div className="dashboard-list">
          {mentorDashboard.pendingRequests.length === 0 ? (
            <div className="dashboard-empty">No pending requests right now.</div>
          ) : (
            mentorDashboard.pendingRequests.map((request) => (
              <div key={request._id} className="dashboard-list__item dashboard-list__item--stacked">
                <div>
                  <strong>{request.student.name}</strong>
                  <p>{request.student.collegeName || request.student.stream || 'Student profile'}</p>
                  <small>Requested on {formatDate(request.requestedAt, language)}</small>
                </div>
                <div className="request-actions">
                  <button
                    type="button"
                    className="request-action request-action--accept"
                    disabled={respondingRequestId === request._id}
                    onClick={() => handleRequestResponse(request._id, 'accepted')}
                  >
                    <HiCheck size={16} />
                    Accept
                  </button>
                  <button
                    type="button"
                    className="request-action request-action--decline"
                    disabled={respondingRequestId === request._id}
                    onClick={() => handleRequestResponse(request._id, 'declined')}
                  >
                    <HiX size={16} />
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h3>Subject analytics</h3>
            <p>Quick visualization of the best-performing subjects across your connected students.</p>
          </div>
        </div>

        <div className="subject-insights">
          {(mentorDashboard.overview.subjectInsights || []).length === 0 ? (
            <div className="dashboard-empty">Subject analytics will appear after students finish mock tests.</div>
          ) : (
            mentorDashboard.overview.subjectInsights.map((item) => (
              <div key={item.subject} className="subject-insights__item">
                <div className="subject-insights__head">
                  <strong>{item.subject}</strong>
                  <span>{item.accuracy}% accuracy</span>
                </div>
                <div className="subject-bars__track">
                  <div className="subject-bars__fill" style={{ width: `${Math.max(8, item.accuracy)}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h3>Student analytics</h3>
            <p>Every accepted student gets a compact card with attempts, rankings, and subject-wise performance.</p>
          </div>
        </div>

        <div className="student-grid">
          {mentorDashboard.students.length === 0 ? (
            <div className="dashboard-empty">Accepted students will show up here with their reports.</div>
          ) : (
            mentorDashboard.students.map((entry) => (
              <article key={entry.connectionId} className="student-card">
                <div className="student-card__header">
                  <div>
                    <h4>{entry.student.name}</h4>
                    <p>{entry.student.collegeName || entry.student.stream || 'Student profile'}</p>
                  </div>
                  <span className="dashboard-tag">Joined {formatDate(entry.connectedAt, language)}</span>
                </div>
                <div className="student-card__stats">
                  <div>
                    <span>Attempts</span>
                    <strong>{entry.analytics.totalAttempts}</strong>
                  </div>
                  <div>
                    <span>Avg score</span>
                    <strong>{entry.analytics.averageScore}</strong>
                  </div>
                  <div>
                    <span>Best score</span>
                    <strong>{entry.analytics.bestScore}</strong>
                  </div>
                  <div>
                    <span>Latest rank</span>
                    <strong>{entry.analytics.ranking?.overallPosition ? `#${entry.analytics.ranking.overallPosition}` : '-'}</strong>
                  </div>
                </div>
                <div className="subject-insights">
                  {(entry.analytics.subjectPerformance || []).slice(0, 4).map((subject) => (
                    <div key={`${entry.student._id}-${subject.subject}`} className="subject-insights__item">
                      <div className="subject-insights__head">
                        <strong>{subject.subject}</strong>
                        <span>{subject.correct}/{subject.total}</span>
                      </div>
                      <div className="subject-bars__track">
                        <div className="subject-bars__fill" style={{ width: `${Math.max(8, subject.accuracy)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header__welcome">
            <h2>{t('db.welcome').replace('{name}', user.name.split(' ')[0])}</h2>
            <p>{t('db.welcome.sub')}</p>
          </div>
          <div className="dashboard-header__actions">
            <span className="dashboard-header__badge">
              {user.role === 'teacher' ? t('db.workspace.teacher') : t('db.workspace')}
            </span>
          </div>
        </header>

        <div className={`dashboard-workspace ${isTeacher ? 'dashboard-workspace--teacher' : ''}`}>
          <div className="dashboard-workspace__body">
            {dashboardError ? <div className="dashboard-empty dashboard-empty--error">{dashboardError}</div> : null}
            {dashboardLoading ? <div className="dashboard-empty">Loading dashboard...</div> : null}
            {!dashboardLoading && !dashboardError && (isMentor ? renderMentorWorkspace() : renderStudentWorkspace())}
          </div>

          {isTeacher && (
            <div className="dashboard-upcoming-contests">
              <div className="upcoming-contests-header">
                <h3>{language === 'en' ? 'Upcoming contest' : 'আসন্ন কনটেস্ট'}</h3>
              </div>
              <div className="upcoming-contests-list">
                {upcomingContests.length === 0 ? (
                  <div className="upcoming-contests-empty">
                    <span className="empty-icon">🗓</span>
                    <p>{language === 'en' ? 'No upcoming contests' : 'কোনো আসন্ন কনটেস্ট নেই'}</p>
                  </div>
                ) : (
                  upcomingContests.map((contest) => (
                    <div key={contest._id} className="contest-card-upcoming">
                      <div className="contest-card-upcoming__header">
                        <span className="contest-badge-icon">🏆</span>
                        <h4 className="contest-title" title={contest.name}>{contest.name}</h4>
                        <button
                          type="button"
                          className="contest-card-upcoming__delete"
                          title={language === 'en' ? 'Delete contest' : 'কনটেস্ট মুছুন'}
                          aria-label="Delete contest"
                          onClick={() => handleDeleteContest(contest._id, contest.name)}
                        >
                          🗑️
                        </button>
                      </div>
                      <div className="contest-card-upcoming__details">
                        <div className="contest-detail-item">
                          <span className="detail-icon">⏳</span>
                          <span className="detail-value">{getRemainingTime(contest)}</span>
                        </div>
                        <div className="contest-detail-item">
                          <span className="detail-icon">🕒</span>
                          <span className="detail-value">
                            {contest.startTime?.hour}:{String(contest.startTime?.minute).padStart(2, '0')} {contest.startTime?.period} ({contest.startTime?.timezone})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
