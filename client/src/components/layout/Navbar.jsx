import { useState, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { HiMenuAlt3, HiX } from 'react-icons/hi';
import { IoGlobeOutline } from 'react-icons/io5';
import SignUpModal from './SignUpModal';
import logo from '../../assets/logo.png';
import './Navbar.css';

export default function Navbar() {
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
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for Google Redirect Callback parameters on mount and handle automatic redirect or modal prompt
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const signupRequired = params.get('signupRequired') === 'true';
    const isComplete = params.get('isComplete') === 'true';

    if (token) {
      // Save user identity details
      localStorage.setItem('topkorbo_token', token);
      
      const name = params.get('name');
      const email = params.get('email');
      const avatar = params.get('avatar');
      const role = params.get('role');
      
      if (name) localStorage.setItem('topkorbo_name', decodeURIComponent(name));
      if (email) localStorage.setItem('topkorbo_email', decodeURIComponent(email));
      if (avatar) localStorage.setItem('topkorbo_avatar', decodeURIComponent(avatar));
      if (role) localStorage.setItem('topkorbo_role', role);
      setUserRole(role || '');
      
      if (isComplete) {
        // Fully registered user: redirect to dashboard directly!
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.href = '/dashboard';
      } else {
        // Partially registered: show profile completion modal
        setModalMode('signup');
        setShowSignUpModal(true);
      }
    } else if (signupRequired) {
      // User tried to log in but has no account: show signup modal directly
      setModalMode('signup');
      setShowSignUpModal(true);
    }
  }, []);

  const navLinks = [
    { label: t('nav.features'), href: '#features' },
    { label: t('nav.arena'), href: '#arena' },
    { label: t('nav.ai'), href: '#ai' },
    { label: t('nav.battle'), href: '#battle' },
    { label: t('nav.mentors'), href: '#mentors' },
  ];
  const liveClassHref = userRole === 'student'
    ? '/student/live-class'
    : (userRole === 'tutor' || userRole === 'teacher' ? '/mentor/live-class' : '');

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`} id="navbar">
      <div className="navbar__container container">
        <a href="#" className="navbar__logo" id="nav-logo">
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

        <ul className={`navbar__links ${mobileOpen ? 'navbar__links--open' : ''}`}>
          {navLinks.map((link, i) => (
            <li key={i}>
              <a
                href={link.href}
                className="navbar__link"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}

          {isLoggedIn ? (
            <li className="navbar__mobile-actions" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch', width: '100%', padding: '0 16px' }}>
              <a href="/dashboard" className="btn btn-secondary btn-sm" id="nav-dashboard-mobile" style={{ width: '100%', textAlign: 'center' }}>
                {t('db.menu.dashboard') || 'Dashboard'}
              </a>
              {liveClassHref ? (
                <a href={liveClassHref} className="btn btn-primary btn-sm" id="nav-live-class-mobile" style={{ width: '100%', textAlign: 'center' }}>
                  Live Class
                </a>
              ) : null}
              <a 
                href="/setting" 
                className="navbar__user-name-link" 
                id="nav-user-name-mobile" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  textDecoration: 'none', 
                  color: 'var(--text-primary)', 
                  fontWeight: '600', 
                  justifyContent: 'center', 
                  padding: '8px' 
                }}
                onClick={() => setMobileOpen(false)}
              >
                {userAvatar ? (
                  <img src={userAvatar} referrerPolicy="no-referrer" alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid var(--sky-blue)', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--sky-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span>{userName}</span>
              </a>
            </li>
          ) : (
            <li className="navbar__mobile-actions">
              <button className="navbar__login-btn" id="nav-login-mobile" onClick={() => { setModalMode('login'); setShowSignUpModal(true); setMobileOpen(false); }}>
                {t('nav.login')}
              </button>
              <button className="navbar__signup-btn" id="nav-signup-mobile" onClick={() => { setModalMode('signup'); setShowSignUpModal(true); setMobileOpen(false); }}>
                {t('nav.signup')}
              </button>
            </li>
          )}
        </ul>

        <div className="navbar__actions">
          <button
            className="navbar__lang-toggle"
            onClick={toggleLanguage}
            aria-label="Toggle language"
            id="lang-toggle"
          >
            <IoGlobeOutline size={18} />
            <span>{language === 'en' ? 'বাং' : 'EN'}</span>
          </button>

          {isLoggedIn ? (
            <div className="navbar__user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a href="/dashboard" className="btn btn-secondary btn-sm" id="nav-dashboard-btn">
                {t('db.menu.dashboard') || 'Dashboard'}
              </a>
              {liveClassHref ? (
                <a href={liveClassHref} className="btn btn-primary btn-sm" id="nav-live-class-btn">
                  Live Class
                </a>
              ) : null}
              <a 
                href="/setting" 
                className="navbar__user-name-link" 
                id="nav-user-name" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  textDecoration: 'none', 
                  color: 'var(--text-primary)', 
                  fontWeight: '600',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {userAvatar ? (
                  <img src={userAvatar} referrerPolicy="no-referrer" alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid var(--sky-blue)', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--sky-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="navbar__user-name-text">{userName}</span>
              </a>
            </div>
          ) : (
            <>
              <button className="navbar__login-btn" id="nav-login" onClick={() => { setModalMode('login'); setShowSignUpModal(true); }}>
                {t('nav.login')}
              </button>
              <button className="navbar__signup-btn" id="nav-signup" onClick={() => { setModalMode('signup'); setShowSignUpModal(true); }}>
                {t('nav.signup')}
              </button>
            </>
          )}
        </div>

        <button
          className="navbar__mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          id="mobile-menu-toggle"
        >
          {mobileOpen ? <HiX size={26} /> : <HiMenuAlt3 size={26} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="navbar__overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Render the beautiful choices Modal */}
      <SignUpModal isOpen={showSignUpModal} onClose={() => setShowSignUpModal(false)} initialMode={modalMode} />
    </nav>
  );
}
