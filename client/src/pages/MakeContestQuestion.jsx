import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiAcademicCap,
  HiBeaker,
  HiBookOpen,
  HiBriefcase,
  HiCalendar,
  HiChartBar,
  HiCheckCircle,
  HiClock,
  HiCog,
  HiCollection,
  HiDocumentText,
  HiGlobeAlt,
  HiLibrary,
  HiPencilAlt,
  HiSelector,
  HiTag
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './MakeContestQuestion.css';

// ─── HSC Subject Data ────────────────────────────────────────────────────────
const HSC_SUBJECTS = [
  { id: 'Physics', labelEn: 'Physics', labelBn: 'পদার্থবিজ্ঞান' },
  { id: 'Chemistry', labelEn: 'Chemistry', labelBn: 'রসায়ন' },
  { id: 'Higher Math', labelEn: 'Higher Math', labelBn: 'উচ্চতর গণিত' },
  { id: 'Biology', labelEn: 'Biology', labelBn: 'জীববিজ্ঞান' },
  { id: 'ICT', labelEn: 'ICT', labelBn: 'তথ্য ও যোগাযোগ প্রযুক্তি' },
  { id: 'English', labelEn: 'English', labelBn: 'ইংরেজি' },
  { id: 'Bangla', labelEn: 'Bangla', labelBn: 'বাংলা' },
];

// ─── Admission Sub-options ───────────────────────────────────────────────────
const ADMISSION_OPTIONS = [
  { id: 'medical', labelEn: 'Medical', labelBn: 'মেডিকেল', icon: HiBriefcase },
  { id: 'varsity', labelEn: 'Varsity', labelBn: 'বিশ্ববিদ্যালয়', icon: HiLibrary },
  { id: 'engineering', labelEn: 'Engineering', labelBn: 'ইঞ্জিনিয়ারিং', icon: HiCog },
];

const VARSITY_OPTIONS = [
  {
    id: 'science',
    badgeEn: 'Science',
    badgeBn: 'বিজ্ঞান',
    labelEn: 'DU A / RU C/ JU A & D/ JnU A/ KU A/ SUST A/ CU A/ GST A',
    labelBn: 'DU A / RU C/ JU A & D/ JnU A/ KU A/ SUST A/ CU A/ GST A',
    icon: HiBeaker
  },
  {
    id: 'commerce',
    badgeEn: 'Commerce',
    badgeBn: 'ব্যবসায় শিক্ষা',
    labelEn: 'DU C / RU B/ JU E/ JnU C/ KU C/ CU C/ GST C',
    labelBn: 'DU C / RU B/ JU E/ JnU C/ KU C/ CU C/ GST C',
    icon: HiChartBar
  },
  {
    id: 'arts',
    badgeEn: 'Humanities',
    badgeBn: 'মানবিক',
    labelEn: 'DU B/ RU A/ JU B & C/ JnU B/ KU B/ CU B & D/ GST B',
    labelBn: 'DU B/ RU A/ JU B & C/ JnU B/ KU B/ CU B & D/ GST B',
    icon: HiPencilAlt
  },
  {
    id: 'iba',
    labelEn: 'IBA',
    labelBn: 'IBA',
    icon: HiBriefcase
  }
];

// ─── Timezone Data ───────────────────────────────────────────────────────────
const TIMEZONES = [
  { id: 'Asia/Dhaka', label: 'Bangladesh (BST)', offset: '+06:00' },
  { id: 'Asia/Kolkata', label: 'India (IST)', offset: '+05:30' },
  { id: 'Asia/Dubai', label: 'Dubai (GST)', offset: '+04:00' },
  { id: 'Europe/London', label: 'London (GMT/BST)', offset: '+00:00' },
  { id: 'America/New_York', label: 'New York (EST)', offset: '-05:00' },
  { id: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
  { id: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+08:00' },
  { id: 'Australia/Sydney', label: 'Sydney (AEST)', offset: '+10:00' },
];

export default function MakeContestQuestion() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  // ── Form State (restored from sessionStorage) ──
  const [contestName, setContestName] = useState(() => sessionStorage.getItem('cc_contestName') || '');
  const [contestDate, setContestDate] = useState(() => sessionStorage.getItem('cc_contestDate') || '');
  const [durationHours, setDurationHours] = useState(() => sessionStorage.getItem('cc_durationHours') || '1');
  const [durationMinutes, setDurationMinutes] = useState(() => sessionStorage.getItem('cc_durationMinutes') || '0');
  const [startHour, setStartHour] = useState(() => sessionStorage.getItem('cc_startHour') || '10');
  const [startMinute, setStartMinute] = useState(() => sessionStorage.getItem('cc_startMinute') || '00');
  const [startPeriod, setStartPeriod] = useState(() => sessionStorage.getItem('cc_startPeriod') || 'AM');
  const [timezone, setTimezone] = useState(() => sessionStorage.getItem('cc_timezone') || 'Asia/Dhaka');
  const [level, setLevel] = useState(() => sessionStorage.getItem('cc_level') || '');
  const [selectedSubjects, setSelectedSubjects] = useState(() => {
    const saved = sessionStorage.getItem('cc_selectedSubjects');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedAdmission, setSelectedAdmission] = useState(() => sessionStorage.getItem('cc_selectedAdmission') || '');
  const [varsitySubtype, setVarsitySubtype] = useState(() => sessionStorage.getItem('cc_varsitySubtype') || '');
  const [questionType, setQuestionType] = useState(() => sessionStorage.getItem('cc_questionType') || 'mcq');

  // ── Persist form state to sessionStorage ──
  useEffect(() => { sessionStorage.setItem('cc_contestName', contestName); }, [contestName]);
  useEffect(() => { sessionStorage.setItem('cc_contestDate', contestDate); }, [contestDate]);
  useEffect(() => { sessionStorage.setItem('cc_durationHours', durationHours); }, [durationHours]);
  useEffect(() => { sessionStorage.setItem('cc_durationMinutes', durationMinutes); }, [durationMinutes]);
  useEffect(() => { sessionStorage.setItem('cc_startHour', startHour); }, [startHour]);
  useEffect(() => { sessionStorage.setItem('cc_startMinute', startMinute); }, [startMinute]);
  useEffect(() => { sessionStorage.setItem('cc_startPeriod', startPeriod); }, [startPeriod]);
  useEffect(() => { sessionStorage.setItem('cc_timezone', timezone); }, [timezone]);
  useEffect(() => { sessionStorage.setItem('cc_level', level); }, [level]);
  useEffect(() => { sessionStorage.setItem('cc_selectedSubjects', JSON.stringify(selectedSubjects)); }, [selectedSubjects]);
  useEffect(() => { sessionStorage.setItem('cc_selectedAdmission', selectedAdmission); }, [selectedAdmission]);
  useEffect(() => { sessionStorage.setItem('cc_varsitySubtype', varsitySubtype); }, [varsitySubtype]);
  useEffect(() => { sessionStorage.setItem('cc_questionType', questionType); }, [questionType]);

  // Keep `questionType` valid when the level/admission context changes.
  // e.g. switching from HSC to Admission+Medical should not keep 'cq' selected.
  useEffect(() => {
    let validIds;
    if (level === 'hsc') {
      validIds = ['mcq', 'cq', 'both'];
    } else if (level === 'admission' && selectedAdmission === 'medical') {
      validIds = ['mcq'];
    } else if (level === 'admission' && (selectedAdmission === 'varsity' || selectedAdmission === 'engineering')) {
      validIds = ['mcq', 'written', 'both'];
    } else {
      validIds = ['mcq'];
    }
    if (!validIds.includes(questionType)) {
      setQuestionType(validIds[0]);
    }
  }, [level, selectedAdmission]); // intentionally exclude `questionType` to avoid loops

  const activeTab = 'make-contest-question';

  // ── Auth Guard ──
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { window.location.href = '/'; return; }

    const fetchUserData = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const resData = await res.json();
          const data = resData.data || {};
          setUser({
            name: data.name || '',
            avatar: data.avatar || '',
            email: data.email || '',
            role: data.role || 'student'
          });
          localStorage.setItem('topkorbo_name', data.name || '');
          localStorage.setItem('topkorbo_avatar', data.avatar || '');
          localStorage.setItem('topkorbo_email', data.email || '');
          localStorage.setItem('topkorbo_role', data.role || 'student');
          if (data.role !== 'teacher') window.location.href = '/dashboard';
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    };
    fetchUserData();
  }, []);

  // ── Subject Toggle (max 2) ──
  const toggleSubject = (subjectId) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(s => s !== subjectId);
      }
      return [...prev, subjectId];
    });
  };

  // ── Level Change Handler ──
  const handleLevelChange = (newLevel) => {
    setLevel(newLevel);
    setSelectedSubjects([]);
    setSelectedAdmission('');
    setVarsitySubtype('');
  };

  // ── Form Validation ──
  const isFormValid = () => {
    if (!contestName.trim()) return false;
    if (!contestDate) return false;
    if (!level) return false;
    if (level === 'hsc' && selectedSubjects.length === 0) return false;
    if (level === 'admission' && !selectedAdmission) return false;
    if (level === 'admission' && selectedAdmission === 'varsity' && !varsitySubtype) return false;
    if (!questionType) return false;
    return true;
  };

  // ── Proceed to Next Page (no database submission) ──
  const handleProceedToQuestions = () => {
    const isEnglish = language === 'en';

    if (!contestName.trim()) {
      toast.error(isEnglish ? 'Please enter a contest name' : 'কনটেস্টের নাম লিখুন');
      return;
    }
    if (!contestDate) {
      toast.error(isEnglish ? 'Please select a contest date' : 'কনটেস্টের তারিখ নির্বাচন করুন');
      return;
    }
    if (!level) {
      toast.error(isEnglish ? 'Please select a level (HSC or Admission)' : 'লেভেল নির্বাচন করুন (HSC অথবা এডমিশন)');
      return;
    }
    if (level === 'hsc' && selectedSubjects.length === 0) {
      toast.error(isEnglish ? 'Please select at least one subject' : 'কমপক্ষে একটি বিষয় নির্বাচন করুন');
      return;
    }
    if (level === 'admission' && !selectedAdmission) {
      toast.error(isEnglish ? 'Please select an admission type' : 'এডমিশনের ধরন নির্বাচন করুন');
      return;
    }
    if (level === 'admission' && selectedAdmission === 'varsity' && !varsitySubtype) {
      toast.error(isEnglish ? 'Please select a varsity sub-type' : 'ভার্সিটি ইউনিট নির্বাচন করুন');
      return;
    }
    if (!questionType) {
      toast.error(isEnglish ? 'Please select a question type' : 'প্রশ্নের ধরন নির্বাচন করুন');
      return;
    }

    // Collect contest data without sending to database
    const contestData = {
      name: contestName.trim(),
      date: contestDate,
      duration: {
        hours: parseInt(durationHours),
        minutes: parseInt(durationMinutes)
      },
      startTime: {
        hour: parseInt(startHour),
        minute: parseInt(startMinute),
        period: startPeriod,
        timezone
      },
      level,
      ...(level === 'hsc' ? { subjects: selectedSubjects } : {}),
      ...(level === 'admission' ? { admissionType: selectedAdmission } : {}),
      ...(level === 'admission' && selectedAdmission === 'varsity' ? { admissionSubtype: varsitySubtype } : {}),
      questionType
    };

    // Save to sessionStorage so all subsequent pages can access it
    sessionStorage.setItem('cc_contestData', JSON.stringify(contestData));

    // Navigate to the next page, passing contest data via router state
    navigate('/make-contest-question/next-two', { state: { contestData } });
  };

  // ── Minimum date is today ──
  const today = new Date().toISOString().split('T')[0];

  let questionTypeOptions;
  if (level === 'hsc') {
    questionTypeOptions = [
      { id: 'mcq', labelEn: 'MCQ (Multiple Choice)', labelBn: 'MCQ (বহুনির্বাচনী)', icon: HiSelector },
      { id: 'cq', labelEn: 'CQ (Creative Question)', labelBn: 'CQ (সৃজনশীল)', icon: HiDocumentText },
      { id: 'both', labelEn: 'Both MCQ and CQ', labelBn: 'MCQ এবং CQ উভয়ই', icon: HiCollection }
    ];
  } else if (level === 'admission' && selectedAdmission === 'medical') {
    questionTypeOptions = [
      { id: 'mcq', labelEn: 'MCQ (Multiple Choice)', labelBn: 'MCQ (বহুনির্বাচনী)', icon: HiSelector }
    ];
  } else if (level === 'admission' && (selectedAdmission === 'varsity' || selectedAdmission === 'engineering')) {
    questionTypeOptions = [
      { id: 'mcq', labelEn: 'MCQ (Multiple Choice)', labelBn: 'MCQ (বহুনির্বাচনী)', icon: HiSelector },
      { id: 'written', labelEn: 'Written', labelBn: 'লিখিত', icon: HiPencilAlt },
      { id: 'both', labelEn: 'MCQ & Written', labelBn: 'MCQ এবং লিখিত', icon: HiCollection }
    ];
  } else {
    questionTypeOptions = [
      { id: 'mcq', labelEn: 'MCQ (Multiple Choice)', labelBn: 'MCQ (বহুনির্বাচনী)', icon: HiSelector }
    ];
  }

  return (
    <div className="cc-page">
      <Sidebar activeTab={activeTab} user={user} />

      <main className="cc-page__content">
        {/* ── Page Header ── */}
        <div className="cc-page__header">
          <div className="cc-page__badge">
            <span className="cc-page__badge-dot"></span>
            Teacher Studio
          </div>
          <h1 className="cc-page__title">
            {language === 'en' ? 'Create Contest' : 'কনটেস্ট তৈরি'}
          </h1>
          <p className="cc-page__subtitle">
            {language === 'en'
              ? 'Design and schedule a competitive academic contest for students.'
              : 'শিক্ষার্থীদের জন্য একটি প্রতিযোগিতামূলক একাডেমিক কনটেস্ট ডিজাইন এবং সময়সূচী নির্ধারণ করুন।'}
          </p>
        </div>

        {/* ── Form Sections ── */}
        <div className="cc-form">

          {/* ──────── TOP GRID: small sections + Level ──────── */}
          <div className="cc-form-grid">

          {/* ──────── 1. CONTEST NAME ──────── */}
          <section className="cc-section cc-section--name">
            <div className="cc-section__header">
              <div className="cc-section__icon"><HiTag size={18} /></div>
              <div>
                <h2 className="cc-section__title">
                  {language === 'en' ? 'Contest Name' : 'কনটেস্টের নাম'}
                </h2>
                <p className="cc-section__desc">
                  {language === 'en'
                    ? 'Enter a descriptive name for your contest.'
                    : 'আপনার কনটেস্টের জন্য একটি বর্ণনামূলক নাম লিখুন।'}
                </p>
              </div>
            </div>
            <div className="cc-name-input-container">
              <input
                type="text"
                id="contest-name"
                className="cc-input"
                placeholder={language === 'en' ? 'e.g. Science Olympiad 2026' : 'যেমন: বিজ্ঞান অলিম্পিয়াড ২০২৬'}
                value={contestName}
                onChange={(e) => setContestName(e.target.value)}
              />
            </div>
          </section>

          {/* ──────── 2. CONTEST DATE ──────── */}
          <section className="cc-section cc-section--date">
            <div className="cc-section__header">
              <div className="cc-section__icon"><HiCalendar size={18} /></div>
              <div>
                <h2 className="cc-section__title">
                  {language === 'en' ? 'Contest Date' : 'কনটেস্টের তারিখ'}
                </h2>
                <p className="cc-section__desc">
                  {language === 'en'
                    ? 'Select the date when the contest will take place.'
                    : 'কনটেস্ট অনুষ্ঠিত হওয়ার তারিখ নির্বাচন করুন।'}
                </p>
              </div>
            </div>
            <div className="cc-date-picker">
              <input
                type="date"
                id="contest-date"
                className="cc-input cc-input--date"
                value={contestDate}
                onChange={(e) => setContestDate(e.target.value)}
                min={today}
              />
              {contestDate && (
                <div className="cc-date-preview">
                  <HiCalendar size={16} />
                  <span>{new Date(contestDate + 'T00:00:00').toLocaleDateString(language === 'en' ? 'en-US' : 'bn-BD', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}</span>
                </div>
              )}
            </div>
          </section>

          {/* ──────── 3. DURATION ──────── */}
          <section className="cc-section cc-section--duration">
            <div className="cc-section__header">
              <div className="cc-section__icon"><HiClock size={18} /></div>
              <div>
                <h2 className="cc-section__title">
                  {language === 'en' ? 'Duration' : 'সময়কাল'}
                </h2>
                <p className="cc-section__desc">
                  {language === 'en'
                    ? 'Set how long the contest will last (hours and minutes).'
                    : 'কনটেস্ট কতক্ষণ চলবে তা নির্ধারণ করুন (ঘণ্টা ও মিনিট)।'}
                </p>
              </div>
            </div>
            <div className="cc-duration-row">
              <div className="cc-duration-group">
                <label className="cc-label" htmlFor="dur-hours">
                  {language === 'en' ? 'Hours' : 'ঘণ্টা'}
                </label>
                <select
                  id="dur-hours"
                  className="cc-select"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                >
                  {[0,1,2,3,4,5,6].map(h => (
                    <option key={h} value={h}>{h} {language === 'en' ? 'hr' : 'ঘণ্টা'}</option>
                  ))}
                </select>
              </div>
              <span className="cc-duration-colon">:</span>
              <div className="cc-duration-group">
                <label className="cc-label" htmlFor="dur-mins">
                  {language === 'en' ? 'Minutes' : 'মিনিট'}
                </label>
                <select
                  id="dur-mins"
                  className="cc-select"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                >
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2,'0')} {language === 'en' ? 'min' : 'মিনিট'}</option>
                  ))}
                </select>
              </div>
              <div className="cc-duration-preview">
                <HiClock size={16} />
                <span>{durationHours}h {String(durationMinutes).padStart(2,'0')}m</span>
              </div>
            </div>
          </section>

          {/* ──────── 4. STARTING TIME ──────── */}
          <section className="cc-section cc-section--start">
            <div className="cc-section__header">
              <div className="cc-section__icon"><HiGlobeAlt size={18} /></div>
              <div>
                <h2 className="cc-section__title">
                  {language === 'en' ? 'Starting Time' : 'শুরুর সময়'}
                </h2>
                <p className="cc-section__desc">
                  {language === 'en'
                    ? 'Set the contest start time with timezone (world clock).'
                    : 'টাইমজোন সহ কনটেস্টের শুরুর সময় নির্ধারণ করুন (বিশ্ব ঘড়ি)।'}
                </p>
              </div>
            </div>
            <div className="cc-time-row">
              <div className="cc-time-group">
                <label className="cc-label" htmlFor="start-hour">
                  {language === 'en' ? 'Hour' : 'ঘণ্টা'}
                </label>
                <select
                  id="start-hour"
                  className="cc-select"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                >
                  {Array.from({length: 12}, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2,'0')}</option>
                  ))}
                </select>
              </div>
              <span className="cc-time-colon">:</span>
              <div className="cc-time-group">
                <label className="cc-label" htmlFor="start-min">
                  {language === 'en' ? 'Minute' : 'মিনিট'}
                </label>
                <select
                  id="start-min"
                  className="cc-select"
                  value={startMinute}
                  onChange={(e) => setStartMinute(e.target.value)}
                >
                  {[
                    '00','05','10','15','20','25','30','35','40','45','50','55'
                  ].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="cc-time-group">
                <label className="cc-label">{language === 'en' ? 'Period' : 'পর্ব'}</label>
                <div className="cc-period-toggle">
                  <button
                    type="button"
                    className={`cc-period-btn ${startPeriod === 'AM' ? 'cc-period-btn--active' : ''}`}
                    onClick={() => setStartPeriod('AM')}
                  >AM</button>
                  <button
                    type="button"
                    className={`cc-period-btn ${startPeriod === 'PM' ? 'cc-period-btn--active' : ''}`}
                    onClick={() => setStartPeriod('PM')}
                  >PM</button>
                </div>
              </div>
              <div className="cc-time-group cc-time-group--tz">
                <label className="cc-label" htmlFor="timezone">
                  {language === 'en' ? 'Timezone' : 'টাইমজোন'}
                </label>
                <select
                  id="timezone"
                  className="cc-select cc-select--tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label} (UTC{tz.offset})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ──────── 5. LEVEL ──────── */}
          <section className="cc-section cc-section--level">
            <div className="cc-section__header">
              <div className="cc-section__icon"><HiAcademicCap size={18} /></div>
              <div>
                <h2 className="cc-section__title">
                  {language === 'en' ? 'Level' : 'লেভেল'}
                </h2>
                <p className="cc-section__desc">
                  {language === 'en'
                    ? 'Choose the contest level — HSC or Admission.'
                    : 'কনটেস্টের লেভেল নির্বাচন করুন — HSC অথবা এডমিশন।'}
                </p>
              </div>
            </div>

            {/* Level Toggle */}
            <div className="cc-level-toggle">
              <button
                type="button"
                className={`cc-level-btn ${level === 'hsc' ? 'cc-level-btn--active' : ''}`}
                onClick={() => handleLevelChange('hsc')}
              >
                <span className="cc-level-btn__icon"><HiBookOpen size={22} /></span>
                <span className="cc-level-btn__text">HSC</span>
              </button>
              <button
                type="button"
                className={`cc-level-btn ${level === 'admission' ? 'cc-level-btn--active' : ''}`}
                onClick={() => handleLevelChange('admission')}
              >
                <span className="cc-level-btn__icon"><HiAcademicCap size={22} /></span>
                <span className="cc-level-btn__text">
                  {language === 'en' ? 'Admission' : 'এডমিশন'}
                </span>
              </button>
            </div>

            {/* ── HSC: Subject Picker ── */}
            {level === 'hsc' && (
              <div className="cc-sub-section cc-sub-section--fade-in">
                <div className="cc-sub-section__header">
                  <h3 className="cc-sub-section__title">
                    {language === 'en' ? 'Select Subjects' : 'বিষয় নির্বাচন করুন'}
                  </h3>
                  <span className="cc-sub-section__hint">
                    {language === 'en'
                      ? `Selected: ${selectedSubjects.length}`
                      : `নির্বাচিত: ${selectedSubjects.length}`}
                  </span>
                </div>
                <div className="cc-subject-grid">
                  {HSC_SUBJECTS.map(sub => {
                    const isSelected = selectedSubjects.includes(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        className={`cc-subject-chip ${isSelected ? 'cc-subject-chip--active' : ''}`}
                        onClick={() => toggleSubject(sub.id)}
                      >
                        {isSelected && <HiCheckCircle size={16} className="cc-subject-chip__check" />}
                        <span>{language === 'en' ? sub.labelEn : sub.labelBn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Admission: Sub-options ── */}
            {level === 'admission' && (
              <div className="cc-sub-section cc-sub-section--fade-in">
                <h3 className="cc-sub-section__title">
                  {language === 'en' ? 'Select Admission Type' : 'এডমিশনের ধরন নির্বাচন করুন'}
                </h3>
                <div className="cc-admission-grid">
                  {ADMISSION_OPTIONS.map(opt => {
                    const OptionIcon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`cc-admission-card ${selectedAdmission === opt.id ? 'cc-admission-card--active' : ''}`}
                        onClick={() => {
                          setSelectedAdmission(opt.id);
                          if (opt.id !== 'varsity') {
                            setVarsitySubtype('');
                          }
                        }}
                      >
                        <span className="cc-admission-card__icon"><OptionIcon size={22} /></span>
                        <span className="cc-admission-card__label">
                          {language === 'en' ? opt.labelEn : opt.labelBn}
                        </span>
                        {selectedAdmission === opt.id && (
                          <HiCheckCircle size={18} className="cc-admission-card__check" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Admission: Varsity Sub-options ── */}
            {level === 'admission' && selectedAdmission === 'varsity' && (
              <div className="cc-sub-section cc-sub-section--fade-in" style={{ marginTop: '1.5rem' }}>
                <h3 className="cc-sub-section__title">
                  {language === 'en' ? 'Select Varsity Unit' : 'ভার্সিটি ইউনিট নির্বাচন করুন'}
                </h3>
                <div className="cc-admission-grid cc-admission-grid--varsity" style={{ marginTop: '1rem' }}>
                  {VARSITY_OPTIONS.map(opt => {
                    const OptionIcon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`cc-admission-card ${varsitySubtype === opt.id ? 'cc-admission-card--active' : ''}`}
                        onClick={() => setVarsitySubtype(opt.id)}
                      >
                        {opt.badgeEn && (
                          <span className="cc-admission-card__badge">
                            {language === 'en' ? opt.badgeEn : opt.badgeBn}
                          </span>
                        )}
                        <span className="cc-admission-card__icon"><OptionIcon size={22} /></span>
                        <span className="cc-admission-card__label" style={{ padding: opt.badgeEn ? '0.4rem 0.2rem 0' : '0' }}>
                          {language === 'en' ? opt.labelEn : opt.labelBn}
                        </span>
                        {varsitySubtype === opt.id && (
                          <HiCheckCircle size={18} className={`cc-admission-card__check ${opt.badgeEn ? 'cc-admission-card__check--left' : ''}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          </div>
          {/* ── end cc-form-grid ── */}

          {/* ──────── 6. QUESTION TYPE ──────── */}
          <section className="cc-section">
            <div className="cc-section__header">
              <div className="cc-section__icon"><HiDocumentText size={18} /></div>
              <div>
                <h2 className="cc-section__title">
                  {language === 'en' ? 'Question Type' : 'প্রশ্নের ধরন'}
                </h2>
                <p className="cc-section__desc">
                  {language === 'en'
                    ? 'Select the format of the questions in this contest.'
                    : 'এই কনটেস্টে প্রশ্নের ফরম্যাট নির্বাচন করুন।'}
                </p>
              </div>
            </div>

            <div className="cc-qtype-grid">
              {questionTypeOptions.map(opt => {
                const OptionIcon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`cc-qtype-card ${questionType === opt.id ? 'cc-qtype-card--active' : ''}`}
                    onClick={() => setQuestionType(opt.id)}
                  >
                    <span className="cc-qtype-card__icon"><OptionIcon size={22} /></span>
                    <span className="cc-qtype-card__label">
                      {language === 'en' ? opt.labelEn : opt.labelBn}
                    </span>
                    {questionType === opt.id && (
                      <HiCheckCircle size={18} className="cc-qtype-card__check" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ──────── PROCEED TO QUESTIONS ──────── */}
          <div className="cc-submit-bar">
            <button
              type="button"
              className="cc-submit-btn"
              onClick={handleProceedToQuestions}
            >
              <HiDocumentText size={18} />
              {language === 'en' ? 'Make Contest Question' : 'কনটেস্টের প্রশ্ন তৈরি করুন'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
