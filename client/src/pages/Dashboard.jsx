import { useEffect, useMemo, useState } from 'react';
import { HiArrowRight, HiCheck, HiClock, HiOutlineUserGroup, HiSparkles, HiX } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useLanguage } from '../hooks/useLanguage';
import { usePlan } from '../hooks/usePlan';
import Sidebar from '../components/layout/Sidebar';
import {
  fetchMentorDashboard,
  respondToMentorRequest
} from '../services/mentorApi';
import { getDashboardActivity, getStats } from '../services/practiceApi';
import { getMyRating } from '../services/contestApi';
import httpClient from '../services/httpClient';
import {
  ContestRatingSection,
  DailyProgressSection,
  StudentProfileSection
} from '../components/dashboard/StudentDashboardSections';
import { buildStudentAnalytics } from '../utils/dashboardAnalytics';
import './Dashboard.css';

function formatDate(value, language) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString(language === 'en' ? 'en-US' : 'bn-BD', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

const EMPTY_RATING_DATA = {
  current: 0,
  max: 0,
  contestPoints: 0,
  contestsPlayed: 0,
  unrated: false,
  history: []
};

const EMPTY_MENTOR_DASHBOARD = {
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
};

let dashboardUserRequest = null;

function requestDashboardUser() {
  if (dashboardUserRequest) return dashboardUserRequest;

  const request = httpClient.request('/auth/me');
  dashboardUserRequest = request;
  request.finally(() => {
    if (dashboardUserRequest === request) dashboardUserRequest = null;
  }).catch(() => {});
  return request;
}

function storeAuthFromUrl() {
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
}

function persistDashboardUser(user) {
  localStorage.setItem('topkorbo_name', user.name);
  localStorage.setItem('topkorbo_avatar', user.avatar);
  localStorage.setItem('topkorbo_email', user.email);
  localStorage.setItem('topkorbo_role', user.role);
  localStorage.setItem('topkorbo_collegeName', user.collegeName);
  localStorage.setItem('topkorbo_hscBatch', user.hscBatch);
  localStorage.setItem('topkorbo_username', user.username);
}

function signOutDashboardUser() {
  localStorage.removeItem('topkorbo_token');
  localStorage.removeItem('topkorbo_name');
  localStorage.removeItem('topkorbo_avatar');
  localStorage.removeItem('topkorbo_email');
  localStorage.removeItem('topkorbo_phone');
  localStorage.removeItem('topkorbo_collegeName');
  localStorage.removeItem('topkorbo_hscBatch');
  localStorage.removeItem('topkorbo_username');
  window.location.href = '/';
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

async function requestDashboardContests(authToken, role) {
  const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const endpoint = role === 'teacher' ? '/contests/mine' : '/contests/upcoming';
  const response = await fetch(`${backendBaseUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Failed to load contests.');
  }
  return payload.data || [];
}

export default function Dashboard() {
  const { language } = useLanguage();
  const [user, setUser] = useState(() => ({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
    collegeName: localStorage.getItem('topkorbo_collegeName') || '',
    hscBatch: localStorage.getItem('topkorbo_hscBatch') || '',
    username: localStorage.getItem('topkorbo_username') || ''
  }));
  const [upcomingContests, setUpcomingContests] = useState([]);
  const [mentorDashboard, setMentorDashboard] = useState(EMPTY_MENTOR_DASHBOARD);
  const [practiceStats, setPracticeStats] = useState(null);
  const [studentActivityDays, setStudentActivityDays] = useState([]);
  const [ratingData, setRatingData] = useState(EMPTY_RATING_DATA);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [respondingRequestId, setRespondingRequestId] = useState('');

  const { refresh: refreshPlan } = usePlan();

  const activeTab = 'dashboard';
  const isMentor = user.role === 'tutor' || user.role === 'teacher';
  const isTeacher = user.role === 'teacher';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === '1') {
      refreshPlan();
      toast.success('🎉 Congratulations! Your Mentor Pro subscription is active! All features are unlocked.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refreshPlan]);

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
    let cancelled = false;
    const tokenFromUrl = storeAuthFromUrl();
    const token = tokenFromUrl || localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
      return undefined;
    }

    const loadDashboard = async () => {
      try {
        setDashboardError('');
        const userData = await requestDashboardUser();
        if (cancelled || !userData) return;

        const nextUser = {
          name: userData.name,
          avatar: userData.avatar || '',
          email: userData.email,
          role: userData.role,
          collegeName: userData.collegeName || '',
          hscBatch: userData.hscBatch || '',
          username: userData.username || ''
        };

        setUser(nextUser);
        persistDashboardUser(nextUser);

        if (nextUser.role === 'student') {
          const [statsResult, activityResult, ratingResult] = await Promise.allSettled([
            getStats(),
            getDashboardActivity(getBrowserTimeZone()),
            getMyRating()
          ]);
          if (cancelled) return;

          if (statsResult.status === 'fulfilled') {
            setPracticeStats(statsResult.value);
          } else {
            console.warn('Practice stats unavailable:', statsResult.reason);
          }
          if (activityResult.status === 'fulfilled') {
            setStudentActivityDays(activityResult.value?.days || []);
          } else {
            console.warn('Dashboard activity unavailable:', activityResult.reason);
          }
          if (ratingResult.status === 'fulfilled' && ratingResult.value) {
            setRatingData(ratingResult.value);
          } else if (ratingResult.status === 'rejected') {
            console.warn('Contest rating unavailable:', ratingResult.reason);
          }
        } else {
          const [mentorResult, contestsResult] = await Promise.allSettled([
            fetchMentorDashboard(),
            nextUser.role === 'teacher'
              ? requestDashboardContests(token, nextUser.role)
              : Promise.resolve([])
          ]);
          if (cancelled) return;

          if (mentorResult.status === 'rejected') throw mentorResult.reason;
          setMentorDashboard(mentorResult.value || EMPTY_MENTOR_DASHBOARD);
          if (contestsResult.status === 'fulfilled') {
            setUpcomingContests(contestsResult.value);
          } else {
            console.warn('Dashboard contests unavailable:', contestsResult.reason);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err?.status === 401 || err?.status === 403) {
          signOutDashboardUser();
          return;
        }
        console.error('Error fetching user data on dashboard:', err);
        setDashboardError(err.message || 'Failed to load dashboard data.');
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    };

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const studentAnalytics = useMemo(
    () => buildStudentAnalytics(studentActivityDays),
    [studentActivityDays]
  );

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

  const handleRequestResponse = async (connectionId, action) => {
    try {
      setRespondingRequestId(connectionId);
      await respondToMentorRequest(connectionId, action);
      const mentorData = await fetchMentorDashboard();
      setMentorDashboard(mentorData || EMPTY_MENTOR_DASHBOARD);
    } catch (err) {
      window.alert(err.message || 'Failed to update request.');
    } finally {
      setRespondingRequestId('');
    }
  };

  const renderStudentWorkspace = () => (
    <div className="student-dashboard-grid">
      <StudentProfileSection
        user={user}
        practiceStats={practiceStats}
        ratingData={ratingData}
        progressStats={studentAnalytics.stats}
      />
      <ContestRatingSection ratingData={ratingData} />
      <DailyProgressSection analytics={studentAnalytics} />
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
