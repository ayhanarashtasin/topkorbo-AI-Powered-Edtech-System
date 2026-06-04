import { useState, useEffect } from 'react';
import { HiArrowRight } from 'react-icons/hi';
import { useLanguage } from '../hooks/useLanguage';
import Sidebar from '../components/layout/Sidebar';
import './Dashboard.css';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Ayhan Arash Tasin',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || 'ayhan.arash.tasin@g.bracu.ac.bd',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });
  const [upcomingContests, setUpcomingContests] = useState([]);

  const activeTab = 'dashboard';

  const handleSignOut = () => {
    // Clear all auth storage keys
    localStorage.removeItem('topkorbo_token');
    localStorage.removeItem('topkorbo_name');
    localStorage.removeItem('topkorbo_avatar');
    localStorage.removeItem('topkorbo_email');
    localStorage.removeItem('topkorbo_phone');

    // Redirect to homepage
    window.location.href = '/';
  };

  const fetchContests = async (authToken) => {
    try {
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${backendBaseUrl}/contests/mine`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
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

  // Fetch the latest user profile details from the backend to ensure absolute synchronization & verify session validity
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');

    // Client-side Auth Guard: Redirect unauthenticated requests to landing page
    if (!token) {
      window.location.href = '/';
      return;
    }

    const fetchUserData = async () => {
      try {
        const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

        const response = await fetch(`${backendBaseUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          // Token has expired or is invalid: force log out
          handleSignOut();
          return;
        }

        const resData = await response.json();
        if (resData.success && resData.data) {
          setUser({
            name: resData.data.name,
            avatar: resData.data.avatar || '',
            email: resData.data.email,
            role: resData.data.role
          });
          // Update localStorage
          localStorage.setItem('topkorbo_name', resData.data.name);
          localStorage.setItem('topkorbo_avatar', resData.data.avatar || '');
          localStorage.setItem('topkorbo_email', resData.data.email);
          localStorage.setItem('topkorbo_role', resData.data.role);

          if (resData.data.role === 'teacher') {
            fetchContests(token);
          }
        }
      } catch (err) {
        console.error('Error fetching user data on dashboard:', err);
      }
    };

    fetchUserData();
  }, []);

  // Fetch contests immediately if role is cached as teacher
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    const role = localStorage.getItem('topkorbo_role');
    if (token && role === 'teacher') {
      fetchContests(token);
    }
  }, []);

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

    if (diffDays > 0) {
      return language === 'en' 
        ? `${diffDays} day${diffDays > 1 ? 's' : ''} left` 
        : `${diffDays} দিন বাকি`;
    }
    if (diffHours > 0) {
      return language === 'en'
        ? `${diffHours} hour${diffHours > 1 ? 's' : ''} left`
        : `${diffHours} ঘণ্টা বাকি`;
    }
    return language === 'en'
      ? `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} left`
      : `${diffMinutes} মিনিট বাকি`;
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />

      {/* Main Panel Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header__welcome">
            <h2>{t('db.welcome').replace('{name}', user.name.split(' ')[0])}</h2>
            <p>{t('db.welcome.sub')}</p>
          </div>
          <div className="dashboard-header__actions">
            <span className="dashboard-header__badge">{t('db.workspace')}</span>
          </div>
        </header>

        {/* Blank Page / Main content workspace area */}
        <div className={`dashboard-workspace ${user.role === 'teacher' ? 'dashboard-workspace--teacher' : ''}`}>
          <div className="dashboard-workspace__card">
            <div className="dashboard-workspace__illustration-wrapper">
              <svg className="dashboard-workspace__illustration" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="illGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(192, 133, 82, 0.4)" />
                    <stop offset="100%" stopColor="rgba(75, 46, 43, 0.1)" />
                  </linearGradient>
                </defs>
                <circle cx="100" cy="100" r="80" fill="url(#illGrad)" stroke="var(--sky-blue)" strokeWidth="1.5" strokeDasharray="6 6" />
                <path d="M 60,110 L 85,135 L 140,80" stroke="var(--sky-blue)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="100" cy="40" r="6" fill="var(--sky-blue)" />
                <circle cx="160" cy="120" r="4" fill="var(--sky-blue)" />
                <circle cx="40" cy="90" r="5" fill="var(--sky-blue)" />
              </svg>
            </div>
            <h3>{t('db.blank.title')}</h3>
            <p>
              {t('db.blank.desc')}
            </p>
            <button className="btn btn-primary dashboard-workspace__cta">
              <span>{t('db.blank.cta')}</span>
              <HiArrowRight size={16} />
            </button>
          </div>

          {user.role === 'teacher' && (
            <div className="dashboard-upcoming-contests">
              <div className="upcoming-contests-header">
                <h3>{language === 'en' ? 'Upcoming contest' : 'আসন্ন কনটেস্ট'}</h3>
              </div>
              <div className="upcoming-contests-list">
                {upcomingContests.length === 0 ? (
                  <div className="upcoming-contests-empty">
                    <span className="empty-icon">📅</span>
                    <p>{language === 'en' ? 'No upcoming contests' : 'কোনো আসন্ন কনটেস্ট নেই'}</p>
                  </div>
                ) : (
                  upcomingContests.map((contest) => (
                    <div key={contest._id} className="contest-card-upcoming">
                      <div className="contest-card-upcoming__header">
                        <span className="contest-badge-icon">🏆</span>
                        <h4 className="contest-title" title={contest.name}>{contest.name}</h4>
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
