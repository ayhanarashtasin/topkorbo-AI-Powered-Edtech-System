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
    role: localStorage.getItem('topkorbo_role') || 'tutor',
    interestedToGuide: JSON.parse(localStorage.getItem('topkorbo_interestedToGuide') || '[]')
  });

  const [teacherApp, setTeacherApp] = useState({
    checkScript: false,
    checkScriptDetails: '',
    createQuestionBank: false,
    createQuestionBankSubjects: [],
    manageContest: false,
    manageContestDetails: '',
    takeIeltsSpeaking: false,
    takeIeltsSpeakingDetails: '',
    createIeltsQSet: false,
    createIeltsQSetDetails: '',
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
          localStorage.removeItem('topkorbo_interestedToGuide');
          window.location.href = '/';
          return;
        }

        const resData = await response.json();
        if (resData.success && resData.data) {
          setUser({
            name: resData.data.name,
            avatar: resData.data.avatar || '',
            email: resData.data.email,
            role: resData.data.role,
            interestedToGuide: resData.data.interestedToGuide || []
          });
          localStorage.setItem('topkorbo_name', resData.data.name);
          localStorage.setItem('topkorbo_avatar', resData.data.avatar || '');
          localStorage.setItem('topkorbo_email', resData.data.email);
          localStorage.setItem('topkorbo_role', resData.data.role);
          localStorage.setItem('topkorbo_interestedToGuide', JSON.stringify(resData.data.interestedToGuide || []));

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
              takeIeltsSpeaking: app.takeIeltsSpeaking || false,
              takeIeltsSpeakingDetails: app.takeIeltsSpeakingDetails || '',
              createIeltsQSet: app.createIeltsQSet || false,
              createIeltsQSetDetails: app.createIeltsQSetDetails || '',
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

  const guidesIelts = user.interestedToGuide && user.interestedToGuide.some(g => g.toUpperCase() === 'IELTS');
  const guidesOthers = user.interestedToGuide && user.interestedToGuide.some(g => g.toUpperCase() !== 'IELTS');
  const onlyIelts = guidesIelts && !guidesOthers;

  const toBnNum = (num) => {
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/[0-9]/g, (digit) => bnNums[digit]);
  };

  const handleTeacherSubmit = async (e) => {
    e.preventDefault();

    const isEnglish = language === 'en';
    
    // 1. Verify at least one educator competency is checked
    const hasCompetency = teacherApp.checkScript || 
                          (!onlyIelts && teacherApp.createQuestionBank) || 
                          (!onlyIelts && teacherApp.manageContest) ||
                          (guidesIelts && teacherApp.takeIeltsSpeaking) ||
                          (guidesIelts && teacherApp.createIeltsQSet);
    if (!hasCompetency) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish 
          ? 'Please enable and describe at least one competency.'
          : 'অনুগ্রহ করে অন্তত একটি শিক্ষাদান সংক্রান্ত যোগ্যতা সক্রিয় এবং বিবরণ পূরণ করুন।'
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
    if (!onlyIelts && teacherApp.createQuestionBank && teacherApp.createQuestionBankSubjects.length === 0) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish 
          ? 'Please select at least one specialized subject for the Question Bank.'
          : 'অনুগ্রহ করে প্রশ্ন ব্যাংক তৈরির জন্য কমপক্ষে একটি বিষয় নির্বাচন করুন।'
      });
      return;
    }

    // 4. Contest management details validation
    if (!onlyIelts && teacherApp.manageContest && (!teacherApp.manageContestDetails || teacherApp.manageContestDetails.trim().length < 15)) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish 
          ? 'Please write at least 15 characters describing your contest management/quiz experience.'
          : 'অনুগ্রহ করে আপনার কুইজ বা কন্টেস্ট পরিচালনার অভিজ্ঞতা সম্পর্কে কমপক্ষে ১৫টি অক্ষর লিখুন।'
      });
      return;
    }

    // 5. IELTS Speaking details validation
    if (guidesIelts && teacherApp.takeIeltsSpeaking && (!teacherApp.takeIeltsSpeakingDetails || teacherApp.takeIeltsSpeakingDetails.trim().length < 15)) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish
          ? 'Please write at least 15 characters describing your IELTS speaking mock test conducting experience.'
          : 'অনুগ্রহ করে আপনার আইইএলটিএস স্পিকিং মক টেস্ট নেওয়ার অভিজ্ঞতা সম্পর্কে কমপক্ষে ১৫টি অক্ষর লিখুন।'
      });
      return;
    }

    // 6. IELTS Question Set details validation
    if (guidesIelts && teacherApp.createIeltsQSet && (!teacherApp.createIeltsQSetDetails || teacherApp.createIeltsQSetDetails.trim().length < 15)) {
      setTeacherAppMsg({
        type: 'error',
        text: isEnglish
          ? 'Please write at least 15 characters describing your IELTS question creation experience.'
          : 'অনুগ্রহ করে আপনার আইইএলটিএস প্রশ্ন তৈরি করার অভিজ্ঞতা সম্পর্কে কমপক্ষে ১৫টি অক্ষর লিখুন।'
      });
      return;
    }

    // 7. About You biography validation
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

  const cardSections = [];

  // 1. Script Check (Always)
  cardSections.push({
    id: 'checkScript',
    type: 'toggle',
    titleEn: 'Can you grade or check student scripts?',
    titleBn: 'আপনি কি শিক্ষার্থীদের পরীক্ষার স্ক্রিপ্ট বা খাতা মূল্যায়ন করতে পারবেন?',
    descEn: 'Evaluating exams, writing helpful corrections, and giving suggestions.',
    descBn: 'পরীক্ষার খাতা মূল্যায়ন করা, প্রয়োজনীয় সমাধান ও মতামত প্রদান।',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
    colorClass: 'card-section-icon-wrapper--peach',
    checked: teacherApp.checkScript,
    onChange: (val) => setTeacherApp(prev => ({ ...prev, checkScript: val })),
    body: (
      <textarea
        className="teacher-field-textarea"
        placeholder={language === 'en' ? 'Describe your script checking/grading experience...' : 'আপনার স্ক্রিপ্ট দেখার অভিজ্ঞতা বর্ণনা করুন...'}
        value={teacherApp.checkScriptDetails}
        onChange={(e) => setTeacherApp(prev => ({ ...prev, checkScriptDetails: e.target.value }))}
        rows={3}
      />
    )
  });

  // 2. Question Bank (Only if not only IELTS)
  if (!onlyIelts) {
    cardSections.push({
      id: 'createQuestionBank',
      type: 'toggle',
      titleEn: 'Can you create a Question bank?',
      titleBn: 'আপনি কি প্রশ্ন ব্যাংক তৈরি করতে পারবেন?',
      descEn: 'Drafting standardized mock questions, subject-wise quizzes, and detailed feedback.',
      descBn: 'মানসম্মত মক পরীক্ষার প্রশ্ন তৈরি করা, বিষয়ভিত্তিক কুইজ এবং বিস্তারিত ফিডব্যাক প্রদান।',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      ),
      colorClass: 'card-section-icon-wrapper--ice-blue',
      checked: teacherApp.createQuestionBank,
      onChange: (val) => setTeacherApp(prev => ({ ...prev, createQuestionBank: val })),
      body: (
        <>
          <label className="teacher-field-label">
            {language === 'en' ? 'Select Specialized Subjects:' : 'বিশেষজ্ঞ বিষয়গুলো নির্বাচন করুন:'}
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
        </>
      )
    });
  }

  // 3. Manage Contest (Only if not only IELTS)
  if (!onlyIelts) {
    cardSections.push({
      id: 'manageContest',
      type: 'toggle',
      titleEn: 'Can you organize and manage academic contests?',
      titleBn: 'আপনি কি অ্যাকাডেমিক প্রতিযোগিতা বা কন্টেস্ট আয়োজন করতে পারবেন?',
      descEn: 'Creating rules, curating problem sets, setting time-to-solve pacing, and monitoring live Elo leaderboards.',
      descBn: 'নিয়ম তৈরি করা, সমস্যা নির্বাচন, সময় নির্ধারণ এবং লাইভ লিডারবোর্ড মনিটর করা।',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
      colorClass: 'card-section-icon-wrapper--gold',
      checked: teacherApp.manageContest,
      onChange: (val) => setTeacherApp(prev => ({ ...prev, manageContest: val })),
      body: (
        <textarea
          className="teacher-field-textarea"
          placeholder={language === 'en' ? 'Describe your contest management/quiz experience...' : 'আপনার কন্টেস্ট বা কুইজ পরিচালনার অভিজ্ঞতা বর্ণনা করুন...'}
          value={teacherApp.manageContestDetails}
          onChange={(e) => setTeacherApp(prev => ({ ...prev, manageContestDetails: e.target.value }))}
          rows={3}
        />
      )
    });
  }

  // 4. IELTS Speaking (If IELTS is chosen)
  if (guidesIelts) {
    cardSections.push({
      id: 'takeIeltsSpeaking',
      type: 'toggle',
      titleEn: 'Can you take IELTS speaking test?',
      titleBn: 'আপনি কি আইইএলটিএস স্পিকিং পরীক্ষা নিতে পারবেন?',
      descEn: 'Conducting online speaking mock tests, evaluation, and providing detailed band score feedback.',
      descBn: 'অনলাইনে স্পিকিং মক টেস্ট নেওয়া, মূল্যায়ন করা এবং ব্যান্ড স্কোরের ফিডব্যাক দেওয়া।',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      ),
      colorClass: 'card-section-icon-wrapper--gold',
      checked: teacherApp.takeIeltsSpeaking,
      onChange: (val) => setTeacherApp(prev => ({ ...prev, takeIeltsSpeaking: val })),
      body: (
        <textarea
          className="teacher-field-textarea"
          placeholder={language === 'en' ? 'Describe your experience conducting IELTS speaking mock tests or interviews...' : 'আইইএলটিএস স্পিকিং মক টেস্ট বা ইন্টারভিউ নেওয়ার অভিজ্ঞতা বিস্তারিত লিখুন...'}
          value={teacherApp.takeIeltsSpeakingDetails}
          onChange={(e) => setTeacherApp(prev => ({ ...prev, takeIeltsSpeakingDetails: e.target.value }))}
          rows={3}
        />
      )
    });
  }

  // 5. IELTS Question Set (If IELTS is chosen)
  if (guidesIelts) {
    cardSections.push({
      id: 'createIeltsQSet',
      type: 'toggle',
      titleEn: 'Can you create a IELTS Question set and detailed solutions?',
      titleBn: 'আপনি কি আইইএলটিএস প্রশ্ন সেট এবং বিস্তারিত সমাধান তৈরি করতে পারবেন?',
      descEn: 'Formulating IELTS Reading, Listening, Writing, or Speaking sets with model answers.',
      descBn: 'মডেল উত্তর সহ আইইএলটিএস রিডিং, লিসেনিং, রাইটিং বা স্পিকিং সেট তৈরি করা।',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
      colorClass: 'card-section-icon-wrapper--purple',
      checked: teacherApp.createIeltsQSet,
      onChange: (val) => setTeacherApp(prev => ({ ...prev, createIeltsQSet: val })),
      body: (
        <textarea
          className="teacher-field-textarea"
          placeholder={language === 'en' ? 'Describe your experience in creating IELTS question sets (Reading, Listening, Writing, Speaking) and drafting model answers...' : 'আইইএলটিএস প্রশ্ন সেট তৈরি এবং মডেল উত্তর লেখার অভিজ্ঞতা বিস্তারিত লিখুন...'}
          value={teacherApp.createIeltsQSetDetails}
          onChange={(e) => setTeacherApp(prev => ({ ...prev, createIeltsQSetDetails: e.target.value }))}
          rows={3}
        />
      )
    });
  }

  // 6. About You (Educator BIO) (Always)
  cardSections.push({
    id: 'aboutYou',
    type: 'direct',
    titleEn: 'About You (Educator BIO)',
    titleBn: 'আপনার সম্পর্কে (শিক্ষক পরিচিতি)',
    descEn: 'Tell our administrators about your teaching style, achievements, student guide experience, or anything that makes you the best candidate.',
    descBn: 'আপনার শিক্ষাদান পদ্ধতি, অর্জন, শিক্ষার্থীদের গাইড করার অভিজ্ঞতা বা এমন কিছু যা আপনাকে সেরা প্রার্থী করে তোলে তা লিখুন।',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v-2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    ),
    colorClass: 'card-section-icon-wrapper--purple',
    body: (
      <>
        <textarea
          className="teacher-field-textarea"
          placeholder={language === 'en' ? 'Write a compelling bio (minimum 20 characters) showcasing why we should select you...' : 'কমপক্ষে ২০টি অক্ষরে শিক্ষক হিসেবে আপনার যোগ্যতা উপস্থাপন করে একটি পরিচিতি লিখুন...'}
          value={teacherApp.aboutYou}
          onChange={(e) => setTeacherApp(prev => ({ ...prev, aboutYou: e.target.value }))}
          rows={4}
          style={{ minHeight: '100px', flex: 1 }}
        />
        <div className="char-counter">
          <span>{teacherApp.aboutYou.length}</span> / 500 characters
        </div>
      </>
    )
  });

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
                  
                  {(() => {
                    let previewIdx = 1;
                    const rows = [];

                    // 1. Script check
                    rows.push(
                      <div key="checkScript" className="preview-group" style={{ marginBottom: '16px' }}>
                        <div className="preview-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '6px' }}>
                          <span className="preview-label" style={{ fontWeight: '600' }}>
                            {language === 'en' ? `${previewIdx}. Grading Scripts` : `${toBnNum(previewIdx)}. খাতা মূল্যায়ন`}
                          </span>
                          <span className={`preview-value ${teacherApp.checkScript ? 'yes' : 'no'}`}>
                            {teacherApp.checkScript ? (language === 'en' ? 'Enabled' : 'হ্যাঁ') : (language === 'en' ? 'Disabled' : 'না')}
                          </span>
                        </div>
                        {teacherApp.checkScript && teacherApp.checkScriptDetails && (
                          <div className="preview-details" style={{ marginTop: '6px', fontSize: '14px', color: '#666', background: '#fcf8f5', padding: '8px 12px', borderRadius: '8px' }}>{teacherApp.checkScriptDetails}</div>
                        )}
                      </div>
                    );
                    previewIdx++;

                    // 2. Question Bank (Only if not only IELTS)
                    if (!onlyIelts) {
                      rows.push(
                        <div key="createQuestionBank" className="preview-group" style={{ marginBottom: '16px' }}>
                          <div className="preview-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '6px' }}>
                            <span className="preview-label" style={{ fontWeight: '600' }}>
                              {language === 'en' ? `${previewIdx}. Question Bank Creation` : `${toBnNum(previewIdx)}. প্রশ্ন ব্যাংক তৈরি`}
                            </span>
                            <span className={`preview-value ${teacherApp.createQuestionBank ? 'yes' : 'no'}`}>
                              {teacherApp.createQuestionBank ? (language === 'en' ? 'Enabled' : 'হ্যাঁ') : (language === 'en' ? 'Disabled' : 'না')}
                            </span>
                          </div>
                          {teacherApp.createQuestionBank && teacherApp.createQuestionBankSubjects.length > 0 && (
                            <div className="preview-subjects" style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {teacherApp.createQuestionBankSubjects.map(s => <span key={s} className="subj-badge" style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1' }}>{s}</span>)}
                            </div>
                          )}
                        </div>
                      );
                      previewIdx++;
                    }

                    // 3. Manage Contest (Only if not only IELTS)
                    if (!onlyIelts) {
                      rows.push(
                        <div key="manageContest" className="preview-group" style={{ marginBottom: '16px' }}>
                          <div className="preview-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '6px' }}>
                            <span className="preview-label" style={{ fontWeight: '600' }}>
                              {language === 'en' ? `${previewIdx}. Contest Organizing` : `${toBnNum(previewIdx)}. প্রতিযোগিতা পরিচালনা`}
                            </span>
                            <span className={`preview-value ${teacherApp.manageContest ? 'yes' : 'no'}`}>
                              {teacherApp.manageContest ? (language === 'en' ? 'Enabled' : 'হ্যাঁ') : (language === 'en' ? 'Disabled' : 'না')}
                            </span>
                          </div>
                          {teacherApp.manageContest && teacherApp.manageContestDetails && (
                            <div className="preview-details" style={{ marginTop: '6px', fontSize: '14px', color: '#666', background: '#fcf8f5', padding: '8px 12px', borderRadius: '8px' }}>{teacherApp.manageContestDetails}</div>
                          )}
                        </div>
                      );
                      previewIdx++;
                    }

                    // 4. IELTS Speaking (If IELTS is chosen)
                    if (guidesIelts) {
                      rows.push(
                        <div key="takeIeltsSpeaking" className="preview-group" style={{ marginBottom: '16px' }}>
                          <div className="preview-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '6px' }}>
                            <span className="preview-label" style={{ fontWeight: '600' }}>
                              {language === 'en' ? `${previewIdx}. IELTS Speaking Test` : `${toBnNum(previewIdx)}. আইইএলটিএস স্পিকিং পরীক্ষা`}
                            </span>
                            <span className={`preview-value ${teacherApp.takeIeltsSpeaking ? 'yes' : 'no'}`}>
                              {teacherApp.takeIeltsSpeaking ? (language === 'en' ? 'Enabled' : 'হ্যাঁ') : (language === 'en' ? 'Disabled' : 'না')}
                            </span>
                          </div>
                          {teacherApp.takeIeltsSpeaking && teacherApp.takeIeltsSpeakingDetails && (
                            <div className="preview-details" style={{ marginTop: '6px', fontSize: '14px', color: '#666', background: '#fcf8f5', padding: '8px 12px', borderRadius: '8px' }}>{teacherApp.takeIeltsSpeakingDetails}</div>
                          )}
                        </div>
                      );
                      previewIdx++;
                    }

                    // 5. IELTS Question Set (If IELTS is chosen)
                    if (guidesIelts) {
                      rows.push(
                        <div key="createIeltsQSet" className="preview-group" style={{ marginBottom: '16px' }}>
                          <div className="preview-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '6px' }}>
                            <span className="preview-label" style={{ fontWeight: '600' }}>
                              {language === 'en' ? `${previewIdx}. IELTS Question Set & Solutions` : `${toBnNum(previewIdx)}. আইইএলটিএস প্রশ্ন ও সমাধান`}
                            </span>
                            <span className={`preview-value ${teacherApp.createIeltsQSet ? 'yes' : 'no'}`}>
                              {teacherApp.createIeltsQSet ? (language === 'en' ? 'Enabled' : 'হ্যাঁ') : (language === 'en' ? 'Disabled' : 'না')}
                            </span>
                          </div>
                          {teacherApp.createIeltsQSet && teacherApp.createIeltsQSetDetails && (
                            <div className="preview-details" style={{ marginTop: '6px', fontSize: '14px', color: '#666', background: '#fcf8f5', padding: '8px 12px', borderRadius: '8px' }}>{teacherApp.createIeltsQSetDetails}</div>
                          )}
                        </div>
                      );
                      previewIdx++;
                    }

                    // 6. Bio
                    rows.push(
                      <div key="aboutYou" className="preview-bio-block" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '2px dashed rgba(0,0,0,0.08)' }}>
                        <div className="preview-bio-label" style={{ fontWeight: '700', fontSize: '15px', color: '#c08552', marginBottom: '8px' }}>
                          {language === 'en' ? `${previewIdx}. About You (Educator BIO)` : `${toBnNum(previewIdx)}. আপনার সম্পর্কে বিস্তারিত`}
                        </div>
                        <div className="preview-bio-text" style={{ fontSize: '14px', lineHeight: '1.6', color: '#444' }}>{teacherApp.aboutYou}</div>
                      </div>
                    );

                    return rows;
                  })()}
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
                  {cardSections.map((section, sectionIdx) => {
                    const numberLabel = language === 'en' 
                      ? `${sectionIdx + 1}. ` 
                      : `${toBnNum(sectionIdx + 1)}. `;

                    const titleText = language === 'en' ? section.titleEn : section.titleBn;
                    const descText = language === 'en' ? section.descEn : section.descBn;

                    if (section.type === 'toggle') {
                      return (
                        <div key={section.id} className={`teacher-card-section ${section.checked ? 'is-active' : ''}`}>
                          <div className="card-section-header">
                            <div className={`card-section-icon-wrapper ${section.colorClass}`}>
                              {section.icon}
                            </div>
                            <div className="card-section-title-group">
                              <h4>{numberLabel}{titleText}</h4>
                              <p>{descText}</p>
                            </div>
                            <label className="toggle-switch">
                              <input
                                type="checkbox"
                                checked={section.checked}
                                onChange={(e) => section.onChange(e.target.checked)}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                          
                          <div className={`card-section-body-wrapper ${section.checked ? 'is-expanded' : ''}`}>
                            <div className="card-section-body-inner">
                              {section.body}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // section.type === 'direct'
                      return (
                        <div key={section.id} className="teacher-card-section teacher-card-section--always-active">
                          <div className="card-section-header">
                            <div className={`card-section-icon-wrapper ${section.colorClass}`}>
                              {section.icon}
                            </div>
                            <div className="card-section-title-group">
                              <h4>{numberLabel}{titleText}</h4>
                              <p>{descText}</p>
                            </div>
                          </div>

                          <div className="card-section-body-direct">
                            {section.body}
                          </div>
                        </div>
                      );
                    }
                  })}
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
