import { useState } from 'react';
import { HiHome, HiAcademicCap, HiBookOpen, HiUpload, HiClipboardList, HiCalendar } from 'react-icons/hi';
import { useLanguage } from '../../hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar({ activeTab, user }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  // Defensive defaults so the sidebar never crashes if the parent passes a
  // partial `user` (e.g. during the initial render before /auth/me resolves).
  const safeUser = {
    name: 'Student',
    avatar: '',
    role: 'student',
    ...(user || {})
  };
  const userInitial = (safeUser.name && safeUser.name.length)
    ? safeUser.name.charAt(0).toUpperCase()
    : 'S';

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    localStorage.getItem('topkorbo_sidebar_collapsed') === 'true'
  );

  const toggleSidebar = () => {
    const nextVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextVal);
    localStorage.setItem('topkorbo_sidebar_collapsed', String(nextVal));
  };

  const menuItems = [
    { id: 'dashboard', label: t('db.menu.dashboard'), icon: <HiHome size={20} /> }
  ];

  // Show Question Bank for students, tutors, and teachers
  if (safeUser.role === 'student' || safeUser.role === 'tutor' || safeUser.role === 'teacher') {
    menuItems.push({
      id: 'qbank',
      label: t('db.menu.qbank'),
      icon: <HiBookOpen size={20} />
    });
    menuItems.push({
      id: 'mock-test',
      label: t('db.menu.mock_test'),
      icon: <HiClipboardList size={20} />
    });
  }

  // Show teacher application tab only for tutors or approved teachers
  if (safeUser.role === 'tutor' || safeUser.role === 'teacher') {
    menuItems.push({
      id: 'teacher',
      label: t('db.menu.teacher'),
      icon: <HiAcademicCap size={20} />
    });
  }

  // Show Upload Question and Create Contest tabs only for teachers
  if (safeUser.role === 'teacher') {
    menuItems.push({
      id: 'upload-question',
      label: t('db.menu.upload_question'),
      icon: <HiUpload size={20} />
    });
    menuItems.push({
      id: 'make-contest-question',
      label: t('db.menu.make_contest'),
      icon: <HiCalendar size={20} />
    });
  }

  return (
    <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'dashboard-sidebar--collapsed' : ''}`}>
      {/* Sidebar Logo */}
      <div className="dashboard-sidebar__logo-container">
        <a href="/dashboard" className="dashboard-sidebar__logo">
          <svg viewBox="0 0 100 100" fill="none" className="dashboard-sidebar__logo-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="dbLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C08552" />
                <stop offset="35%" stopColor="#D4A373" />
                <stop offset="70%" stopColor="#8C5A3C" />
                <stop offset="100%" stopColor="#4B2E2B" />
              </linearGradient>
            </defs>
            <path d="M 28,45 C 28,45 28,58 50,68 C 72,58 72,45 72,45" stroke="url(#dbLogoGrad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="rgba(37, 24, 23, 0.2)" />
            <path d="M 50,15 L 90,36 L 50,57 L 10,36 Z" stroke="url(#dbLogoGrad)" strokeWidth="4.5" strokeLinejoin="round" fill="rgba(37, 24, 23, 0.55)" />
            <path d="M 50,19 L 82,36 L 50,53 L 18,36 Z" stroke="url(#dbLogoGrad)" strokeWidth="1" strokeLinejoin="round" fill="url(#dbLogoGrad)" fillOpacity="0.08" />
            <path d="M 37,25 H 63 M 50,25 V 45" stroke="url(#dbLogoGrad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 37,25 V 29 M 63,25 V 29" stroke="url(#dbLogoGrad)" strokeWidth="3" strokeLinecap="round" />
            <path d="M 44,28 V 44" stroke="url(#dbLogoGrad)" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 44,36 L 55,28 M 44,36 L 55,44" stroke="url(#dbLogoGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 50,36 C 40,30 20,25 18,32 L 18,50" stroke="url(#dbLogoGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <circle cx="18" cy="52" r="3.5" fill="url(#dbLogoGrad)" />
            <path d="M 14,55 H 22 L 24,78 H 12 Z" fill="url(#dbLogoGrad)" />
          </svg>
          {!isSidebarCollapsed && (
            <span className="dashboard-sidebar__logo-text">𝖙𝖔𝖕ƙ𝖔𝖗𝖇𝖔</span>
          )}
        </a>

        <button
          type="button"
          className="dashboard-sidebar__toggle-btn"
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? t('db.menu.open_sidebar') : t('db.menu.close_sidebar')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dashboard-sidebar__toggle-icon">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <div className="dashboard-sidebar__toggle-tooltip">
            <span className="tooltip-action">
              {isSidebarCollapsed ? (language === 'en' ? 'Open' : 'খুলুন') : (language === 'en' ? 'Close' : 'বন্ধ করুন')}
            </span>{' '}
            <span className="tooltip-target">
              {language === 'en' ? 'sidebar' : 'সাইডবার'}
            </span>
          </div>
        </button>
      </div>

      {/* Sidebar Menu Items */}
      <nav className="dashboard-sidebar__nav">
        <ul className="dashboard-sidebar__menu">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => {
                  if (item.id === 'teacher') navigate('/teacher');
                  else if (item.id === 'qbank') {
                    sessionStorage.removeItem('qbank_selected_subject_id');
                    sessionStorage.removeItem('qbank_selected_prep_stream');
                    sessionStorage.removeItem('qbank_selected_source_context');
                    window.dispatchEvent(new Event('reset-qbank'));
                    navigate('/qbank');
                  }
                  else if (item.id === 'upload-question') navigate('/upload-question');
                  else if (item.id === 'make-contest-question') navigate('/make-contest-question');
                  else if (item.id === 'mock-test') navigate('/mock-test');
                  else navigate('/dashboard');
                }}
                className={`dashboard-sidebar__menu-btn ${activeTab === item.id ? 'dashboard-sidebar__menu-btn--active' : ''}`}
              >
                <span className="dashboard-sidebar__menu-icon">{item.icon}</span>
                {!isSidebarCollapsed && (
                  <span className="dashboard-sidebar__menu-label">{item.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sidebar Footer: Profile */}
      <div className="dashboard-sidebar__footer">
        {/* Profile Badge - Click to go to Settings */}
        <div
          className="dashboard-sidebar__profile"
          onClick={() => navigate('/setting')}
          style={{ cursor: 'pointer' }}
          title={t('db.menu.settings')}
        >
          <div className="dashboard-sidebar__avatar-wrapper">
            {safeUser.avatar ? (
              <img src={safeUser.avatar} referrerPolicy="no-referrer" alt="Profile" className="dashboard-sidebar__avatar" />
            ) : (
              <div className="dashboard-sidebar__avatar-placeholder">
                {userInitial}
              </div>
            )}
          </div>
          {!isSidebarCollapsed && (
            <div className="dashboard-sidebar__user-info">
              <h4 className="dashboard-sidebar__user-name">{safeUser.name}</h4>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
