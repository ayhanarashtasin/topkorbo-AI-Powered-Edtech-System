import { useState, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { HiMenuAlt3, HiX } from 'react-icons/hi';
import { IoGlobeOutline } from 'react-icons/io5';
import SignUpModal from './SignUpModal';
import { clearAuthStorage } from '../../utils/authStorage';
import './Navbar.css';

export default function Navbar({ initialAuthMode = null }) {
  const { t, language, toggleLanguage } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [modalMode, setModalMode] = useState('signup'); // 'signup' or 'login'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    const name = localStorage.getItem('topkorbo_name');
    const avatar = localStorage.getItem('topkorbo_avatar');
    const role = localStorage.getItem('topkorbo_role');
    if (token) {
      setUserRole(role || '');
      setIsLoggedIn(true);
      setUserName(name || '');
      setUserAvatar(avatar || '');
      setUserRole(role || '');
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for Google Redirect Callback parameters on mount and handle automatic redirect or modal prompt
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const signupRequired = params.get('signupRequired') === 'true';
    const isComplete = params.get('isComplete') === 'true';

    if (signupRequired) {
      clearAuthStorage();
      setIsLoggedIn(false);
      setUserName('');
      setUserAvatar('');
      setUserRole('');
      setModalMode('signup');
      setShowSignUpModal(true);
    } else if (token) {
      // Save user identity details
      localStorage.setItem('topkorbo_token', token);
      
      const name = params.get('name');
      const email = params.get('email');
      const avatar = params.get('avatar');
      const role = params.get('role');
      const forumRole = params.get('forumRole');
      
      if (name) localStorage.setItem('topkorbo_name', decodeURIComponent(name));
      if (email) localStorage.setItem('topkorbo_email', decodeURIComponent(email));
      if (avatar) localStorage.setItem('topkorbo_avatar', decodeURIComponent(avatar));
      if (role) localStorage.setItem('topkorbo_role', role);
      if (forumRole) localStorage.setItem('topkorbo_forum_role', decodeURIComponent(forumRole));
      setUserRole(role || '');
      
      if (isComplete) {
        // Fully registered admins should land in the admin workspace immediately.
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.href = forumRole === 'admin' ? '/admin/dashboard' : '/dashboard';
      } else {
        // Partially registered: show profile completion modal
        setModalMode('signup');
        setShowSignUpModal(true);
      }
    } else if (initialAuthMode) {
      // User tried to log in but has no account: show signup modal directly
      setModalMode(initialAuthMode === 'login' ? 'login' : 'signup');
      setShowSignUpModal(true);
    }
  }, [initialAuthMode]);

  const navLinks = [
    { label: t('nav.features'), href: '#features' },
    { label: t('nav.arena'), href: '#arena' },
    { label: t('nav.ai'), href: '#ai' },
    { label: t('nav.battle'), href: '#battle' },
    { label: t('nav.mentors'), href: '#mentors' },
    { label: t('nav.pricing') || 'Pricing', href: '/pricing' },
  ];

  const liveClassHref = userRole === 'student'
    ? '/student/live-class'
    : (userRole === 'tutor' || userRole === 'teacher' ? '/mentor/live-class' : '');

  return (
    <>
      <header className={`navbar-wrapper ${scrolled ? 'navbar-wrapper--scrolled' : ''}`}>
      <nav className="navbar" id="navbar" aria-label="Main Navigation">
        {/* Left Side: Brand Logo & Text */}
        <div className="navbar__brand">
          <a href="/" className="navbar__logo" id="nav-logo" aria-label="Topkorbo Home">
            <div className="navbar__logo-svg-wrapper">
              <svg viewBox="0 0 100 100" fill="none" className="navbar__logo-svg" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="tkLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#C08552" />
                    <stop offset="35%" stopColor="#D4A373" />
                    <stop offset="70%" stopColor="#8C5A3C" />
                    <stop offset="100%" stopColor="#4B2E2B" />
                  </linearGradient>
                </defs>
                
                {/* Skull Cap Base */}
                <path d="M 28,45 C 28,45 28,58 50,68 C 72,58 72,45 72,45" stroke="url(#tkLogoGrad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="rgba(37, 24, 23, 0.2)" />
                
                {/* Cap Diamond */}
                <path d="M 50,15 L 90,36 L 50,57 L 10,36 Z" stroke="url(#tkLogoGrad)" strokeWidth="4.5" strokeLinejoin="round" fill="rgba(37, 24, 23, 0.55)" />
                <path d="M 50,19 L 82,36 L 50,53 L 18,36 Z" stroke="url(#tkLogoGrad)" strokeWidth="1" strokeLinejoin="round" fill="url(#tkLogoGrad)" fillOpacity="0.08" />
                
                {/* Monogram T & K */}
                {/* Stylized T */}
                <path d="M 37,25 H 63 M 50,25 V 45" stroke="url(#tkLogoGrad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 37,25 V 29 M 63,25 V 29" stroke="url(#tkLogoGrad)" strokeWidth="3" strokeLinecap="round" />
                
                {/* Stylized K */}
                <path d="M 44,28 V 44" stroke="url(#tkLogoGrad)" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M 44,36 L 55,28 M 44,36 L 55,44" stroke="url(#tkLogoGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* Tassel Cord */}
                <path d="M 50,36 C 40,30 20,25 18,32 L 18,50" stroke="url(#tkLogoGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                
                {/* Tassel Ring/Knot */}
                <circle cx="18" cy="52" r="3.5" fill="url(#tkLogoGrad)" />
                
                {/* Tassel Fringe */}
                <path d="M 14,55 H 22 L 24,78 H 12 Z" fill="url(#tkLogoGrad)" />
              </svg>
            </div>
            <span className="navbar__logo-text">𝖙𝖔𝖕ƙ𝖔𝖗𝖇𝖔</span>
          </a>
        </div>

        {/* Center: Desktop Navigation Links */}
        <ul className="navbar__links">
          {navLinks.map((link, i) => (
            <li key={i} className="navbar__item">
              <a
                href={link.href}
                className="navbar__link"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Right Side: Language & Auth / User Controls */}
        <div className="navbar__actions">
          <button
            className="navbar__lang-toggle"
            onClick={toggleLanguage}
            aria-label="Toggle language"
            id="lang-toggle"
            type="button"
          >
            <IoGlobeOutline size={16} />
            <span>{language === 'en' ? 'বাং' : 'EN'}</span>
          </button>

          {isLoggedIn ? (
            <div className="navbar__user-group">
              <a href="/dashboard" className="navbar__btn navbar__btn--outline" id="nav-dashboard-btn">
                {t('db.menu.dashboard') || 'Dashboard'}
              </a>
              {liveClassHref ? (
                <a href={liveClassHref} className="navbar__btn navbar__btn--filled" id="nav-live-class-btn">
                  Live Class
                </a>
              ) : null}
              <a 
                href="/setting" 
                className="navbar__user-profile" 
                id="nav-user-name"
                title={userName || 'Profile'}
              >
                {userAvatar ? (
                  <img src={userAvatar} referrerPolicy="no-referrer" alt={userName || 'User'} className="navbar__avatar" />
                ) : (
                  <div className="navbar__avatar navbar__avatar--fallback">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="navbar__user-name-text">{userName}</span>
              </a>
            </div>
          ) : (
            <div className="navbar__auth-group">
              <button 
                type="button"
                className="navbar__btn navbar__btn--outline" 
                id="nav-login" 
                onClick={() => { setModalMode('login'); setShowSignUpModal(true); }}
              >
                {t('nav.login')}
              </button>
              <button 
                type="button"
                className="navbar__btn navbar__btn--filled" 
                id="nav-signup" 
                onClick={() => { setModalMode('signup'); setShowSignUpModal(true); }}
              >
                {t('nav.signup')}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Action Controls: Language & Hamburger */}
        <div className="navbar__mobile-controls">
          <button
            className="navbar__lang-toggle navbar__lang-toggle--mobile"
            onClick={toggleLanguage}
            aria-label="Toggle language"
            type="button"
          >
            <IoGlobeOutline size={15} />
            <span>{language === 'en' ? 'বাং' : 'EN'}</span>
          </button>
          
          <button
            className="navbar__mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            id="mobile-menu-toggle"
            type="button"
          >
            {mobileOpen ? <HiX size={22} /> : <HiMenuAlt3 size={22} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="navbar__mobile-dropdown" id="mobile-menu">
            <ul className="navbar__mobile-links">
              {navLinks.map((link, i) => (
                <li key={i}>
                  <a
                    href={link.href}
                    className="navbar__mobile-link"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="navbar__mobile-divider" />

            <div className="navbar__mobile-actions">
              {isLoggedIn ? (
                <>
                  <a 
                    href="/setting" 
                    className="navbar__mobile-profile-card" 
                    id="nav-user-name-mobile"
                    onClick={() => setMobileOpen(false)}
                  >
                    {userAvatar ? (
                      <img src={userAvatar} referrerPolicy="no-referrer" alt={userName || 'User'} className="navbar__avatar" />
                    ) : (
                      <div className="navbar__avatar navbar__avatar--fallback">
                        {userName ? userName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="navbar__mobile-profile-details">
                      <span className="navbar__mobile-profile-name">{userName}</span>
                      <span className="navbar__mobile-profile-subtitle">Account Settings</span>
                    </div>
                  </a>
                  <a href="/dashboard" className="navbar__btn navbar__btn--outline navbar__btn--block" id="nav-dashboard-mobile" onClick={() => setMobileOpen(false)}>
                    {t('db.menu.dashboard') || 'Dashboard'}
                  </a>
                  {liveClassHref ? (
                    <a href={liveClassHref} className="navbar__btn navbar__btn--filled navbar__btn--block" id="nav-live-class-mobile" onClick={() => setMobileOpen(false)}>
                      Live Class
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    className="navbar__btn navbar__btn--outline navbar__btn--block" 
                    id="nav-login-mobile" 
                    onClick={() => { setModalMode('login'); setShowSignUpModal(true); setMobileOpen(false); }}
                  >
                    {t('nav.login')}
                  </button>
                  <button 
                    type="button"
                    className="navbar__btn navbar__btn--filled navbar__btn--block" 
                    id="nav-signup-mobile" 
                    onClick={() => { setModalMode('signup'); setShowSignUpModal(true); setMobileOpen(false); }}
                  >
                    {t('nav.signup')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {mobileOpen && (
        <div className="navbar__overlay" onClick={() => setMobileOpen(false)} />
      )}
    </header>

    {/* Render SignUp/Login Modal at root level to guarantee independent pointer events and z-index stack */}
    <SignUpModal 
      key={modalMode} 
      isOpen={showSignUpModal} 
      onClose={() => setShowSignUpModal(false)} 
      initialMode={modalMode} 
    />
  </>
);
}
