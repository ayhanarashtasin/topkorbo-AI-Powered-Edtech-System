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
import { getStats, listMyAttempts } from '../services/practiceApi';
import { getMyRating } from '../services/contestApi';
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

function getInitials(name) {
  return (name || 'Student')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'S';
}

function toLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Codeforces-style rating tiers. A student's rating is derived from how well
// they perform in mock tests / practice, mapped onto this scale.
const RATING_TIERS = [
  { name: 'Newbie', min: 0, color: '#9aa0a6' },
  { name: 'Pupil', min: 1200, color: '#1aa334' },
  { name: 'Specialist', min: 1400, color: '#03a89e' },
  { name: 'Expert', min: 1600, color: '#3b5bdb' },
  { name: 'Candidate Master', min: 1900, color: '#a11bbf' },
  { name: 'Master', min: 2100, color: '#ff8c00' },
  { name: 'Grandmaster', min: 2400, color: '#e8462c' }
];

function getRatingTier(rating) {
  let tier = RATING_TIERS[0];
  for (const candidate of RATING_TIERS) {
    if (rating >= candidate.min) tier = candidate;
  }
  return tier;
}

function getHeatLevel(solved) {
  if (solved <= 0) return 0;
  if (solved <= 2) return 1;
  if (solved <= 4) return 2;
  if (solved <= 6) return 3;
  return 4;
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
    collegeName: localStorage.getItem('topkorbo_collegeName') || '',
    hscBatch: localStorage.getItem('topkorbo_hscBatch') || '',
    username: localStorage.getItem('topkorbo_username') || ''
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
  const [studentAttempts, setStudentAttempts] = useState([]);
  const [ratingData, setRatingData] = useState({ current: null, max: null, unrated: true, history: [] });
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
    localStorage.removeItem('topkorbo_collegeName');
    localStorage.removeItem('topkorbo_hscBatch');
    localStorage.removeItem('topkorbo_username');
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
        setMentorCatalog([]);
        setStudentMentorData({ mentors: [], recentAttempts: [] });
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
            role: resData.data.role,
            collegeName: resData.data.collegeName || '',
            hscBatch: resData.data.hscBatch || '',
            username: resData.data.username || ''
          };

          setUser(nextUser);
          localStorage.setItem('topkorbo_name', nextUser.name);
          localStorage.setItem('topkorbo_avatar', nextUser.avatar);
          localStorage.setItem('topkorbo_email', nextUser.email);
          localStorage.setItem('topkorbo_role', nextUser.role);
          localStorage.setItem('topkorbo_collegeName', nextUser.collegeName);
          localStorage.setItem('topkorbo_hscBatch', nextUser.hscBatch);
          localStorage.setItem('topkorbo_username', nextUser.username);

          if (nextUser.role === 'teacher') {
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
    if (token && role === 'teacher') {
      fetchContests(token, role);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;
    const role = localStorage.getItem('topkorbo_role');

    (async () => {
      try {
        const stats = await getStats();
        setPracticeStats(stats);
      } catch (err) {
        console.warn('Practice stats unavailable:', err);
      }

      // Students get the full attempt history for their daily solved heatmap,
      // plus their real contest rating history for the rating graph.
      if (role === 'student' || !role) {
        try {
          const res = await listMyAttempts({ limit: 200, sort: '-createdAt' });
          setStudentAttempts(res?.items || []);
        } catch (err) {
          console.warn('Practice attempts unavailable:', err);
        }
        try {
          const rating = await getMyRating();
          if (rating) setRatingData(rating);
        } catch (err) {
          console.warn('Contest rating unavailable:', err);
        }
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

  // Derive the daily-solved heatmap and solved/streak stats from the student's
  // real practice/mock-test attempts (no external platform data).
  const studentAnalytics = useMemo(() => {
    const chronological = (studentAttempts || [])
      .filter((attempt) => attempt && attempt.createdAt)
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Count problems solved (correct answers) per calendar day.
    const solvedByDay = new Map();
    chronological.forEach((attempt) => {
      const key = toLocalDateKey(attempt.createdAt);
      const solved = (attempt.questions || []).filter((q) => q.isCorrect === true).length;
      solvedByDay.set(key, (solvedByDay.get(key) || 0) + solved);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build a GitHub/Codeforces-style calendar: columns are weeks (Sun→Sat),
    // rows are weekdays. The last column contains today.
    const weekCount = 53;
    const gridStart = new Date(today);
    gridStart.setDate(today.getDate() - today.getDay() - (weekCount - 1) * 7);

    const weeks = [];
    const monthLabels = [];
    let previousMonth = -1;
    for (let week = 0; week < weekCount; week += 1) {
      const column = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
        const cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + week * 7 + dayOfWeek);
        if (cellDate > today) {
          column.push(null);
        } else {
          const key = toLocalDateKey(cellDate);
          column.push({ date: key, solved: solvedByDay.get(key) || 0 });
        }
      }
      // Month label shown on the first week that starts a new month.
      const weekStart = new Date(gridStart);
      weekStart.setDate(gridStart.getDate() + week * 7);
      const month = weekStart.getMonth();
      monthLabels.push(month !== previousMonth ? MONTH_LABELS[month] : '');
      previousMonth = month;
      weeks.push(column);
    }

    // Solved totals and "in a row" streaks over rolling windows.
    const yearAgo = new Date(today);
    yearAgo.setDate(today.getDate() - 364);
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 29);

    let solvedAllTime = 0;
    let solvedLastYear = 0;
    let solvedLastMonth = 0;
    solvedByDay.forEach((solved, key) => {
      if (solved <= 0) return;
      solvedAllTime += solved;
      const date = parseDateKey(key);
      if (date >= yearAgo && date <= today) solvedLastYear += solved;
      if (date >= monthAgo && date <= today) solvedLastMonth += solved;
    });

    const activeKeys = [...solvedByDay.keys()].filter((key) => solvedByDay.get(key) > 0).sort();
    const activeSet = new Set(activeKeys);
    const earliest = activeKeys.length ? parseDateKey(activeKeys[0]) : today;
    const maxStreakInRange = (startDate) => {
      let max = 0;
      let current = 0;
      const cursor = new Date(startDate);
      while (cursor <= today) {
        if (activeSet.has(toLocalDateKey(cursor))) {
          current += 1;
          if (current > max) max = current;
        } else {
          current = 0;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return max;
    };

    return {
      weeks,
      monthLabels,
      stats: {
        solvedAllTime,
        solvedLastYear,
        solvedLastMonth,
        maxStreakAllTime: maxStreakInRange(earliest),
        maxStreakLastYear: maxStreakInRange(yearAgo),
        maxStreakLastMonth: maxStreakInRange(monthAgo)
      }
    };
  }, [studentAttempts]);

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

  const renderStudentWorkspace = () => {
    const overall = practiceStats?.overall || {};
    const { weeks, monthLabels, stats } = studentAnalytics;

    const overallAccuracy = Math.round((overall.accuracy || 0) * 100);
    const solvedTotal = typeof overall.correctQuestions === 'number' ? overall.correctQuestions : stats.solvedAllTime;
    const attemptedTotal = overall.attemptedQuestions || 0;
    const sessionCount = overall.totalAttempts || 0;

    // Real, DB-backed contest rating history. Empty until the student has
    // taken part in a contest that has ended.
    const ratingHistory = ratingData.history || [];
    const hasRating = ratingHistory.length > 0;
    const currentRating = ratingData.current;
    const maxRating = ratingData.max;
    const currentTier = hasRating ? getRatingTier(currentRating) : null;
    const lastDelta = hasRating ? ratingHistory[ratingHistory.length - 1].delta : 0;
    const shortDate = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Codeforces-style chart geometry. Aspect ratio is preserved (no stretch),
    // so markers stay round and the line stays crisp.
    const plot = { left: 60, right: 984, top: 20, bottom: 314 };
    const ratingValues = ratingHistory.map((point) => point.newRating);
    const dataMin = ratingValues.length ? Math.min(...ratingValues) : 1200;
    const dataMax = ratingValues.length ? Math.max(...ratingValues) : 1600;
    const yMin = Math.max(600, Math.floor((dataMin - 90) / 100) * 100);
    let yMax = Math.ceil((dataMax + 90) / 100) * 100;
    if (yMax - yMin < 400) yMax = yMin + 400;
    const xOf = (index) => (ratingHistory.length <= 1
      ? (plot.left + plot.right) / 2
      : plot.left + (index / (ratingHistory.length - 1)) * (plot.right - plot.left));
    const yOf = (rating) => plot.bottom - ((rating - yMin) / (yMax - yMin)) * (plot.bottom - plot.top);
    const chartPoints = ratingHistory.map((item, index) => ({ ...item, x: xOf(index), y: yOf(item.newRating) }));
    const linePath = chartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(' ');

    const ratingBands = RATING_TIERS.map((tier, index) => {
      const next = RATING_TIERS[index + 1];
      const low = Math.max(tier.min, yMin);
      const high = Math.min(next ? next.min : yMax, yMax);
      if (high <= low) return null;
      return { color: tier.color, yTop: yOf(high), yBottom: yOf(low) };
    }).filter(Boolean);

    const yTicks = RATING_TIERS.map((tier) => tier.min).filter((value) => value > yMin && value < yMax);
    const labelEvery = Math.max(1, Math.ceil(ratingHistory.length / 6));

    const metricCards = [
      {
        name: 'Rating',
        subtitle: currentTier ? currentTier.name : 'Unrated',
        primaryLabel: 'Current',
        primaryValue: hasRating ? currentRating : '—',
        secondaryLabel: 'Max',
        secondaryValue: hasRating ? maxRating : '—',
        accent: currentTier ? currentTier.color : '#9aa0a6'
      },
      {
        name: 'Problems solved',
        subtitle: sessionCount ? `${overallAccuracy}% accuracy` : 'Start practicing',
        primaryLabel: 'Solved',
        primaryValue: solvedTotal,
        secondaryLabel: 'Attempted',
        secondaryValue: attemptedTotal,
        accent: '#4f8fba'
      }
    ];

    return (
      <div className="student-dashboard-grid">
        <section className="dashboard-panel student-profile-section">
          <div className="student-profile-card">
            <div className="student-profile-card__main">
              <div className="student-profile-avatar" aria-label={`${user.name} profile picture`}>
                {user.avatar ? <img src={user.avatar} alt={user.name} /> : <span>{getInitials(user.name)}</span>}
              </div>
              <div>
                <span className="student-profile-kicker">Student profile</span>
                <h3>{user.name}</h3>
                <p>{user.collegeName || 'College name not added yet'}</p>
                <div className="student-profile-meta">
                  <span>{user.hscBatch ? `HSC ${user.hscBatch}` : 'HSC batch not set'}</span>
                  <span>{user.email || 'Student account'}</span>
                </div>
              </div>
            </div>

            <div className="student-rating-cards">
              {metricCards.map((card) => (
                <article key={card.name} className="student-rating-card" style={{ '--rating-accent': card.accent }}>
                  <div className="student-rating-card__top">
                    <strong>{card.name}</strong>
                    <span>{card.subtitle}</span>
                  </div>
                  <div className="student-rating-card__values">
                    <div>
                      <span>{card.primaryLabel}</span>
                      <strong>{card.primaryValue}</strong>
                    </div>
                    <div>
                      <span>{card.secondaryLabel}</span>
                      <strong>{card.secondaryValue}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-panel student-rating-graph-section">
          <div className="dashboard-panel__header student-section-header">
            <div>
              <h3>Contest rating</h3>
              <p>Your rating changes only when you participate in a contest.</p>
            </div>
            {hasRating && (
              <div className="student-graph-summary">
                <span className="cf-rank-pill" style={{ '--rank-color': currentTier.color }}>
                  {currentTier.name} {currentRating}
                </span>
                <span className="dashboard-stat-pill">Max {maxRating}</span>
                <span className={`student-rating-change ${lastDelta >= 0 ? 'student-rating-change--up' : 'student-rating-change--down'}`}>
                  {lastDelta >= 0 ? '+' : ''}{lastDelta}
                </span>
              </div>
            )}
          </div>

          {hasRating ? (
            <>
              <div className="cf-rating-chart" role="img" aria-label="Student rating progression chart">
                <svg viewBox="0 0 1000 344">
                  {ratingBands.map((band, index) => (
                    <rect
                      key={`band-${index}`}
                      x={plot.left}
                      y={band.yTop}
                      width={plot.right - plot.left}
                      height={band.yBottom - band.yTop}
                      fill={band.color}
                      opacity="0.13"
                    />
                  ))}

                  {yTicks.map((rating) => {
                    const y = yOf(rating);
                    return (
                      <g key={`tick-${rating}`}>
                        <line x1={plot.left} x2={plot.right} y1={y} y2={y} className="cf-chart-gridline" />
                        <text x={plot.left - 10} y={y + 4} textAnchor="end" className="cf-chart-axis-text">{rating}</text>
                      </g>
                    );
                  })}

                  <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="cf-chart-axis-line" />

                  <path
                    d={linePath}
                    fill="none"
                    className="cf-rating-line"
                    vectorEffect="non-scaling-stroke"
                  />

                  {chartPoints.map((point, index) => {
                    const tier = getRatingTier(point.newRating);
                    const showLabel = index % labelEvery === 0 || index === chartPoints.length - 1;
                    return (
                      <g key={`pt-${index}`} className="cf-rating-point">
                        <title>{`${point.contestName} · Rank ${point.rank}/${point.participants} · ${point.newRating} (${tier.name}) · ${shortDate(point.date)}`}</title>
                        <circle cx={point.x} cy={point.y} r="9" fill="transparent" />
                        <circle cx={point.x} cy={point.y} r="3.6" fill={tier.color} stroke="#ffffff" strokeWidth="1.4" />
                        {showLabel ? (
                          <text x={point.x} y="336" textAnchor="middle" className="cf-chart-axis-text cf-chart-date-text">
                            {shortDate(point.date)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="student-contest-trend-list">
                {ratingHistory.slice(-4).map((item, index) => {
                  const tier = getRatingTier(item.newRating);
                  return (
                    <div key={`${item.date}-${index}`} className="student-contest-trend-item">
                      <div>
                        <strong>{item.contestName}</strong>
                        <span>{shortDate(item.date)} · Rank #{item.rank}/{item.participants} · <em style={{ color: tier.color, fontStyle: 'normal', fontWeight: 600 }}>{tier.name} {item.newRating}</em></span>
                      </div>
                      <span className={item.delta >= 0 ? 'trend-up' : 'trend-down'}>{item.delta >= 0 ? '+' : ''}{item.delta}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="dashboard-empty">
              You are unrated. Register for a contest and participate — your rating appears here once the contest ends.
            </div>
          )}
        </section>

        <section className="dashboard-panel student-progress-section">
          <div className="dashboard-panel__header student-section-header">
            <div>
              <h3>Daily problem-solving progress</h3>
              <p>Each square is one day. Hover a square to see how many problems you solved that day.</p>
            </div>
            <span className="dashboard-stat-pill">Last 12 months</span>
          </div>

          <div className="student-progress-heatmap" aria-label="Daily solved problem calendar">
            <div className="student-heatmap-grid">
              {monthLabels.map((label, weekIndex) =>
                label ? (
                  <span
                    key={`m-${weekIndex}`}
                    className="student-heatmap-month"
                    style={{ gridColumn: weekIndex + 2, gridRow: 1 }}
                  >
                    {label}
                  </span>
                ) : null
              )}

              {[['Mon', 1], ['Wed', 3], ['Fri', 5]].map(([label, dayIndex]) => (
                <span
                  key={label}
                  className="student-heatmap-weekday"
                  style={{ gridColumn: 1, gridRow: dayIndex + 2 }}
                >
                  {label}
                </span>
              ))}

              {weeks.map((column, weekIndex) =>
                column.map((cell, dayIndex) =>
                  cell ? (
                    <span
                      key={cell.date}
                      className={`student-heat-cell student-heat-cell--${getHeatLevel(cell.solved)}`}
                      style={{ gridColumn: weekIndex + 2, gridRow: dayIndex + 2 }}
                      title={`${cell.solved} problem${cell.solved === 1 ? '' : 's'} solved · ${cell.date}`}
                      aria-label={`${cell.date}: ${cell.solved} problems solved`}
                    />
                  ) : null
                )
              )}
            </div>
          </div>

          <div className="student-heatmap-legend" aria-hidden="true">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => <i key={level} className={`student-heat-cell student-heat-cell--${level}`} />)}
            <span>More</span>
          </div>

          <div className="student-progress-stats student-progress-stats--solve">
            <div>
              <strong>{stats.solvedAllTime}</strong>
              <span>solved for all time</span>
            </div>
            <div>
              <strong>{stats.solvedLastYear}</strong>
              <span>solved for the last year</span>
            </div>
            <div>
              <strong>{stats.solvedLastMonth}</strong>
              <span>solved for the last month</span>
            </div>
            <div>
              <strong>{stats.maxStreakAllTime}</strong>
              <span>max. in a row</span>
            </div>
            <div>
              <strong>{stats.maxStreakLastYear}</strong>
              <span>in a row for the last year</span>
            </div>
            <div>
              <strong>{stats.maxStreakLastMonth}</strong>
              <span>in a row for the last month</span>
            </div>
          </div>
        </section>
      </div>
    );
  };

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
