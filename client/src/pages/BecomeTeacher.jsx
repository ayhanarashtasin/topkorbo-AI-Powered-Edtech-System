import { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import Sidebar from '../components/layout/Sidebar';
import './BecomeTeacher.css';

function LivePartyPopper() {
  const particles = [
    { id: 1, dx: '40px', dy: '-70px', rot: '120deg', color: '#FBBF24', delay: '0s' },
    { id: 2, dx: '-30px', dy: '-80px', rot: '-90deg', color: '#EF4444', delay: '0.1s' },
    { id: 3, dx: '60px', dy: '-50px', rot: '240deg', color: '#3B82F6', delay: '0.2s' },
    { id: 4, dx: '-60px', dy: '-60px', rot: '-180deg', color: '#10B981', delay: '0.05s' },
    { id: 5, dx: '15px', dy: '-110px', rot: '45deg', color: '#EC4899', delay: '0.15s' },
    { id: 6, dx: '80px', dy: '-80px', rot: '360deg', color: '#8B5CF6', delay: '0.25s' },
    { id: 7, dx: '-80px', dy: '-70px', rot: '-360deg', color: '#06B6D4', delay: '0s' },
    { id: 8, dx: '25px', dy: '-130px', rot: '90deg', color: '#F59E0B', delay: '0.3s' },
    { id: 9, dx: '-25px', dy: '-120px', rot: '-90deg', color: '#14B8A6', delay: '0.12s' },
    { id: 10, dx: '50px', dy: '-100px', rot: '150deg', color: '#EC4899', delay: '0.08s' },
    { id: 11, dx: '-50px', dy: '-90px', rot: '-150deg', color: '#3B82F6', delay: '0.22s' },
    { id: 12, dx: '0px', dy: '-150px', rot: '30deg', color: '#10B981', delay: '0.18s' },
  ];

  return (
    <span className="party-popper-wrapper">
      <svg viewBox="0 0 100 100" className="popper-cone-svg">
        <defs>
          <linearGradient id="coneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="stripeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
        </defs>
        <path d="M 20,80 L 35,50 L 55,65 Z" fill="url(#coneGrad)" />
        <path d="M 25,70 L 31,58 L 41,65 Z" fill="url(#stripeGrad)" />
        <path d="M 18,80 L 22,72 L 29,77 Z" fill="url(#accentGrad)" />
        <ellipse cx="45" cy="57.5" rx="12" ry="7" transform="rotate(-36 45 57.5)" fill="#EF4444" />
        <circle cx="58" cy="42" r="3" fill="#FBBF24" />
        <circle cx="68" cy="32" r="2" fill="#3B82F6" />
        <circle cx="50" cy="30" r="2.5" fill="#10B981" />
        <circle cx="62" cy="22" r="1.5" fill="#EC4899" />
        <path d="M 47,51 Q 54,43 56,33" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="2 2" fill="none" />
        <path d="M 39,55 Q 43,45 40,36" stroke="#EC4899" strokeWidth="1.2" stroke-dasharray="2 2" fill="none" />
      </svg>
      <span className="confetti-container">
        {particles.map(p => (
          <span 
            key={p.id} 
            className="confetti-particle"
            style={{
              backgroundColor: p.color,
              left: '50%',
              top: '50%',
              '--dx': p.dx,
              '--dy': p.dy,
              '--rot': p.rot,
              animationDelay: p.delay
            }}
          />
        ))}
      </span>
    </span>
  );
}

export default function BecomeTeacher() {
  const { t, language } = useLanguage();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Ayhan Arash Tasin',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || 'ayhan.arash.tasin@g.bracu.ac.bd',
    role: localStorage.getItem('topkorbo_role') || 'tutor'
  });

  const [teacherApp, setTeacherApp] = useState({
    checkScript: false,
    checkScriptDetails: '',
    createQuestionBank: false,
    createQuestionBankSubjects: [],
    manageContest: false,
    manageContestDetails: '',
    aboutYou: ''
  });

  const [teacherAppStatus, setTeacherAppStatus] = useState(null); // null, 'pending', 'approved', 'rejected'
  const [teacherAppLoading, setTeacherAppLoading] = useState(false);
  const [teacherAppFetchLoading, setTeacherAppFetchLoading] = useState(true);
  const [teacherAppMsg, setTeacherAppMsg] = useState({ type: '', text: '' });
  const [profileLoading, setProfileLoading] = useState(true);

  // Sync profile details, verify session validity, and fetch teacher application in one call
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
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
          localStorage.removeItem('topkorbo_token');
          localStorage.removeItem('topkorbo_name');
          localStorage.removeItem('topkorbo_avatar');
          localStorage.removeItem('topkorbo_email');
          localStorage.removeItem('topkorbo_role');
          window.location.href = '/';
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
          localStorage.setItem('topkorbo_name', resData.data.name);
          localStorage.setItem('topkorbo_avatar', resData.data.avatar || '');
          localStorage.setItem('topkorbo_email', resData.data.email);
          localStorage.setItem('topkorbo_role', resData.data.role);

          // Teacher application data is now included in the /auth/me response
          if (resData.teacherApplication) {
            const app = resData.teacherApplication;
            setTeacherApp({
              checkScript: app.checkScript || false,
              checkScriptDetails: app.checkScriptDetails || '',
              createQuestionBank: app.createQuestionBank || false,
              createQuestionBankSubjects: app.createQuestionBankSubjects || [],
              manageContest: app.manageContest || false,
              manageContestDetails: app.manageContestDetails || '',
              aboutYou: app.aboutYou || ''
            });
            setTeacherAppStatus(app.status);
          } else {
            setTeacherAppStatus(null);
          }
        }
      } catch (err) {
        console.error('Error fetching user data on teacher page:', err);
      } finally {
        setProfileLoading(false);
        setTeacherAppFetchLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSubjectCheckbox = (subj) => {
    setTeacherApp(prev => {
      const subjects = prev.createQuestionBankSubjects;
      const updated = subjects.includes(subj)
        ? subjects.filter(s => s !== subj)
        : [...subjects, subj];
      return { ...prev, createQuestionBankSubjects: updated };
    });
  };

  const handleTeacherSubmit = async (e) => {
    e.preventDefault();

    const isEnglish = language === 'en';
    
    // 1. Verify at least one educator competency is checked
    const hasCompetency = teacherApp.checkScript || teacherApp.createQuestionBank || teacherApp.manageContest;
    if (!hasCompetency) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish 
          ? 'Please enable and describe at least one competency (Script Evaluation, Question Bank, or Contests).'
          : 'অনুগ্রহ করে অন্তত একটি শিক্ষাদান সংক্রান্ত যোগ্যতা সক্রিয় এবং পূরণ করুন (পরীক্ষার খাতা মূল্যায়ন, প্রশ্ন ব্যাংক, বা কন্টেস্ট)।'
      });
      return;
    }

    // 2. Script details validation
    if (teacherApp.checkScript && (!teacherApp.checkScriptDetails || teacherApp.checkScriptDetails.trim().length < 15)) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish 
          ? 'Please write at least 15 characters describing your script checking/grading experience.'
          : 'অনুগ্রহ করে আপনার পরীক্ষার খাতা দেখার অভিজ্ঞতা সম্পর্কে কমপক্ষে ১৫টি অক্ষর লিখুন।'
      });
      return;
    }

    // 3. Question bank subjects selection validation
    if (teacherApp.createQuestionBank && teacherApp.createQuestionBankSubjects.length === 0) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish 
          ? 'Please select at least one specialized subject for the Question Bank.'
          : 'অনুগ্রহ করে প্রশ্ন ব্যাংক তৈরির জন্য কমপক্ষে একটি বিষয় নির্বাচন করুন।'
      });
      return;
    }

    // 4. Contest management details validation
    if (teacherApp.manageContest && (!teacherApp.manageContestDetails || teacherApp.manageContestDetails.trim().length < 15)) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish 
          ? 'Please write at least 15 characters describing your contest management/quiz experience.'
          : 'অনুগ্রহ করে আপনার কুইজ বা কন্টেস্ট পরিচালনার অভিজ্ঞতা সম্পর্কে কমপক্ষে ১৫টি অক্ষর লিখুন।'
      });
      return;
    }

    // 5. About You biography validation
    if (!teacherApp.aboutYou || teacherApp.aboutYou.trim().length < 20) {
      setTeacherAppMsg({
        type: 'error',
        text: t('teacher.validation.about')
      });
      return;
    }

    setTeacherAppLoading(true);
    setTeacherAppMsg({ type: '', text: '' });

    try {
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('topkorbo_token');
      const response = await fetch(`${backendBaseUrl}/auth/teacher-apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(teacherApp)
      });
      const resData = await response.json();
      if (resData.success) {
        setTeacherAppMsg({
          type: 'success',
          text: t('teacher.success')
        });
        setTeacherAppStatus('pending');
      } else {
        setTeacherAppMsg({
          type: 'error',
          text: resData.message || t('teacher.error')
        });
      }
    } catch (err) {
      console.error(err);
      setTeacherAppMsg({
        type: 'error',
        text: t('settings.network_error')
      });
    } finally {
      setTeacherAppLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="teacher" user={user} />

      <main className="dashboard-main">
        {/* Premium White Page Header */}
        <header className="dashboard-header">
          <div className="dashboard-header__welcome">
            <h2>{language === 'en' ? 'Become a Teacher' : 'শিক্ষক হোন'}</h2>
            <p>
              {language === 'en'
                ? 'Join our verified educator team to grade papers, draft question banks, and host contests.'
                : 'আমাদের ভেরিফাইড শিক্ষক প্যানেলে যোগ দিয়ে পরীক্ষার খাতা মূল্যায়ন, প্রশ্ন ব্যাংক তৈরি এবং কুইজ কন্টেস্ট পরিচালনা করুন।'}
            </p>
          </div>
          <div className="dashboard-header__actions">
            <span className="teacher-badge-pill">
              <span className="badge-pulse-dot"></span>
              {language === 'en' ? 'Educator Application' : 'শিক্ষক আবেদনপত্র'}
            </span>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <div className="dashboard-teacher-body">
          <div className="teacher-content-container animate-fade-in">
            {/* Content Loading State */}
            {teacherAppFetchLoading ? (
              <div className="teacher-app-form">
                <div className="teacher-form-grid">
                  {[1, 2, 3, 4].map(idx => (
                    <div key={idx} className="teacher-card-section skeleton-card">
                      <div className="card-section-header">
                        <div className="skeleton-shimmer skeleton-circle" />
                        <div className="card-section-title-group" style={{ flex: 1 }}>
                          <div className="skeleton-shimmer skeleton-title-bar" />
                          <div className="skeleton-shimmer skeleton-text-bar" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="teacher-submit-container">
                  <div className="skeleton-shimmer skeleton-button-bar" />
                </div>
              </div>
            ) : teacherAppStatus === 'pending' ? (
              /* Status Card: Pending Review */
              <div className="teacher-status-card teacher-status-card--pending animate-fade-in">
                <div className="status-graphic-wrapper status-graphic-wrapper--pending">
                  <svg className="clock-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14" className="clock-hands"></polyline>
                  </svg>
                </div>
                <h3>{t('teacher.status.pending')}</h3>
                <p>{t('teacher.status.pending.desc')}</p>

                <div className="teacher-app-preview">
                  <div className="preview-header">
                    <h4>{language === 'en' ? 'Submitted Application Summary' : 'জমা দেওয়া আবেদনের বিবরণ'}</h4>
                  </div>
                  
                  <div className="preview-row">
                    <span className="preview-label">{language === 'en' ? '1. Grading Scripts' : '১. খাতা মূল্যায়ন'}</span>
                    <span className={`preview-value ${teacherApp.checkScript ? 'yes' : 'no'}`}>
                      {teacherApp.checkScript ? (language === 'en' ? 'Enabled' : 'হ্যাঁ') : (language === 'en' ? 'Disabled' : 'না')}
                    </span>
                  </div>
                  {teacherApp.checkScript && teacherApp.checkScriptDetails && (
                    <div className="preview-details">{teacherApp.checkScriptDetails}</div>
                  )}

                  <div className="preview-row">
                    <span className="preview-label">{language === 'en' ? '2. Question Bank Creation' : '২. প্রশ্ন ব্যাংক তৈরি'}</span>
                    <span className={`preview-value ${teacherApp.createQuestionBank ? 'yes' : 'no'}`}>
                      {teacherApp.createQuestionBank ? (language === 'en' ? 'Enabled' : 'হ্যাঁ') : (language === 'en' ? 'Disabled' : 'না')}
                    </span>
                  </div>
                  {teacherApp.createQuestionBank && teacherApp.createQuestionBankSubjects.length > 0 && (
                    <div className="preview-subjects">
                      {teacherApp.createQuestionBankSubjects.map(s => <span key={s} className="subj-badge">{s}</span>)}
                    </div>
                  )}

                  <div className="preview-row">
                    <span className="preview-label">{language === 'en' ? '3. Contest Organizing' : '৩. প্রতিযোগিতা পরিচালনা'}</span>
                    <span className={`preview-value ${teacherApp.manageContest ? 'yes' : 'no'}`}>
                      {teacherApp.manageContest ? (language === 'en' ? 'Enabled' : 'হ্যাঁ') : (language === 'en' ? 'Disabled' : 'না')}
                    </span>
                  </div>
                  {teacherApp.manageContest && teacherApp.manageContestDetails && (
                    <div className="preview-details">{teacherApp.manageContestDetails}</div>
                  )}

                  <div className="preview-bio-block">
                    <div className="preview-bio-label">{language === 'en' ? '4. About You (Educator BIO)' : '৪. আপনার সম্পর্কে বিস্তারিত'}</div>
                    <div className="preview-bio-text">{teacherApp.aboutYou}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTeacherAppStatus(null)}
                  className="btn-revise-application"
                >
                  {t('teacher.reapply')}
                </button>
              </div>
            ) : teacherAppStatus === 'approved' ? (
              /* Status Card: Approved Celebrations */
              <div className="teacher-status-card teacher-status-card--approved animate-fade-in">
                <div className="status-graphic-wrapper status-graphic-wrapper--approved">
                  <svg className="trophy-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                    <path d="M4 22h16"></path>
                    <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
                    <path d="M12 2a6 6 0 0 1 6 6v1H6V8a6 6 0 0 1 6-6Z"></path>
                  </svg>
                </div>
                <h3 className="approved-title-flex">
                  {t('teacher.status.approved').replace('🎉', '')} 
                  <LivePartyPopper />
                </h3>
                <p>{t('teacher.status.approved.desc')}</p>
                
                <div className="teacher-congrats-features">
                  <div className="congrats-item">
                    <span className="item-icon">✓</span>
                    <span>{language === 'en' ? 'Script Evaluator Module Enabled' : 'স্ক্রিপ্ট ইভালুয়েশন মডিউল সক্রিয়'}</span>
                  </div>
                  <div className="congrats-item">
                    <span className="item-icon">✓</span>
                    <span>{language === 'en' ? 'LaTeX Question Author Suite Ready' : 'ল্যাটেক্স প্রশ্ন প্রণয়ন স্যুট প্রস্তুত'}</span>
                  </div>
                  <div className="congrats-item">
                    <span className="item-icon">✓</span>
                    <span>{language === 'en' ? 'Mock Contest Coordinator Dashboard Active' : 'মক কন্টেস্ট কোঅর্ডিনেটর ড্যাশবোর্ড চালু'}</span>
                  </div>
                </div>

                <button type="button" className="btn-go-studio">
                  {t('teacher.status.approved.cta')}
                </button>
              </div>
            ) : (
              /* Redesigned Form: 2x2 Grid Layout */
              <form onSubmit={handleTeacherSubmit} className="teacher-app-form">
                {teacherAppStatus === 'rejected' && (
                  <div className="teacher-rejected-banner">
                    <div className="rejected-icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                    </div>
                    <div className="rejected-text">
                      <h5>{t('teacher.status.rejected')}</h5>
                      <p>{t('teacher.status.rejected.desc')}</p>
                    </div>
                  </div>
                )}

                <div className="teacher-form-grid">
                  {/* Section 1: Check Script */}
                  <div className={`teacher-card-section ${teacherApp.checkScript ? 'is-active' : ''}`}>
                    <div className="card-section-header">
                      <div className="card-section-icon-wrapper card-section-icon-wrapper--peach">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                      </div>
                      <div className="card-section-title-group">
                        <h4>{t('teacher.script.label')}</h4>
                        <p>{t('teacher.script.desc')}</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={teacherApp.checkScript}
                          onChange={(e) => setTeacherApp(prev => ({ ...prev, checkScript: e.target.checked }))}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    
                    <div className={`card-section-body-wrapper ${teacherApp.checkScript ? 'is-expanded' : ''}`}>
                      <div className="card-section-body-inner">
                        <textarea
                          className="teacher-field-textarea"
                          placeholder={t('teacher.script.placeholder')}
                          value={teacherApp.checkScriptDetails}
                          onChange={(e) => setTeacherApp(prev => ({ ...prev, checkScriptDetails: e.target.value }))}
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Question Bank */}
                  <div className={`teacher-card-section ${teacherApp.createQuestionBank ? 'is-active' : ''}`}>
                    <div className="card-section-header">
                      <div className="card-section-icon-wrapper card-section-icon-wrapper--ice-blue">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                      </div>
                      <div className="card-section-title-group">
                        <h4>{t('teacher.qbank.label')}</h4>
                        <p>{t('teacher.qbank.desc')}</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={teacherApp.createQuestionBank}
                          onChange={(e) => setTeacherApp(prev => ({ ...prev, createQuestionBank: e.target.checked }))}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className={`card-section-body-wrapper ${teacherApp.createQuestionBank ? 'is-expanded' : ''}`}>
                      <div className="card-section-body-inner">
                        <label className="teacher-field-label">
                          {t('teacher.qbank.select_subjects')}
                        </label>
                        <div className="subjects-grid">
                          {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'ICT'].map(subj => (
                            <label key={subj} className={`subject-tag-checkbox ${teacherApp.createQuestionBankSubjects.includes(subj) ? 'active' : ''}`}>
                              <input
                                type="checkbox"
                                checked={teacherApp.createQuestionBankSubjects.includes(subj)}
                                onChange={() => handleSubjectCheckbox(subj)}
                                style={{ display: 'none' }}
                              />
                              <span>{subj}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Manage Contest */}
                  <div className={`teacher-card-section ${teacherApp.manageContest ? 'is-active' : ''}`}>
                    <div className="card-section-header">
                      <div className="card-section-icon-wrapper card-section-icon-wrapper--gold">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </div>
                      <div className="card-section-title-group">
                        <h4>{t('teacher.contest.label')}</h4>
                        <p>{t('teacher.contest.desc')}</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={teacherApp.manageContest}
                          onChange={(e) => setTeacherApp(prev => ({ ...prev, manageContest: e.target.checked }))}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className={`card-section-body-wrapper ${teacherApp.manageContest ? 'is-expanded' : ''}`}>
                      <div className="card-section-body-inner">
                        <textarea
                          className="teacher-field-textarea"
                          placeholder={t('teacher.contest.placeholder')}
                          value={teacherApp.manageContestDetails}
                          onChange={(e) => setTeacherApp(prev => ({ ...prev, manageContestDetails: e.target.value }))}
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: About You (Direct Input, always visible/symmetrical) */}
                  <div className="teacher-card-section teacher-card-section--always-active">
                    <div className="card-section-header">
                      <div className="card-section-icon-wrapper card-section-icon-wrapper--purple">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v-2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                      <div className="card-section-title-group">
                        <h4>{t('teacher.about.label')}</h4>
                        <p>{t('teacher.about.desc')}</p>
                      </div>
                    </div>

                    <div className="card-section-body-direct">
                      <textarea
                        className="teacher-field-textarea"
                        placeholder={t('teacher.about.placeholder')}
                        value={teacherApp.aboutYou}
                        onChange={(e) => setTeacherApp(prev => ({ ...prev, aboutYou: e.target.value }))}
                        rows={4}
                        style={{ minHeight: '100px', flex: 1 }}
                      />
                      <div className="char-counter">
                        <span>{teacherApp.aboutYou.length}</span> / 500 characters
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Action Row */}
                <div className="teacher-submit-container">
                  <button
                    type="submit"
                    disabled={teacherAppLoading}
                    className="btn-submit-application"
                  >
                    {teacherAppLoading ? t('teacher.submitting') : t('teacher.submit')}
                  </button>
                  {teacherAppMsg.text && (
                    <p className={`settings-feedback-text settings-feedback-text--${teacherAppMsg.type}`}>
                      {teacherAppMsg.text}
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
