import { useState, useEffect } from 'react';
import { HiArrowRight } from 'react-icons/hi';
import { useLanguage } from '../hooks/useLanguage';
import Sidebar from '../components/layout/Sidebar';
import './Dashboard.css';

export default function Dashboard() {
  const { t } = useLanguage();
  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Ayhan Arash Tasin',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || 'ayhan.arash.tasin@g.bracu.ac.bd',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

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
        }
      } catch (err) {
        console.error('Error fetching user data on dashboard:', err);
      }
    };

    fetchUserData();
  }, []);

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
        <div className="dashboard-workspace">
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
        </div>
      </main>
    </div>
  );
}
