import { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { HiSearch, HiLockClosed, HiAcademicCap, HiSparkles } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import './QuestionBank.css';

export default function QuestionBank() {
  const { t, language } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('academic'); // 'academic', 'admission', 'modeltest'
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Ayhan Arash Tasin',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || 'ayhan.arash.tasin@g.bracu.ac.bd',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const activeTab = 'qbank';

  // Fetch the latest user profile details from the backend to ensure absolute synchronization & verify session validity
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');

    // Client-side Auth Guard
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
        }
      } catch (err) {
        console.error('Error fetching user data on question bank:', err);
      }
    };

    fetchUserData();
  }, []);

  // Academic Subject Card Data
  const academicSubjects = [
    {
      id: 'english_1',
      titleEn: 'English 1st paper',
      titleBn: 'ইংরেজি ১ম পত্র',
      type: 'card-english-1',
      letter: 'A',
      isCustomSvg: false
    },
    {
      id: 'english_2',
      titleEn: 'English 2nd paper',
      titleBn: 'ইংরেজি ২য় পত্র',
      type: 'card-english-2',
      letter: 'a',
      isCustomSvg: false
    },
    {
      id: 'bangla_1',
      titleEn: 'Bangla 1st paper',
      titleBn: 'বাংলা ১ম পত্র',
      type: 'card-bangla-1',
      letter: 'অ',
      isCustomSvg: false
    },
    {
      id: 'bangla_2',
      titleEn: 'Bangla 2nd paper',
      titleBn: 'বাংলা ২য় পত্র',
      type: 'card-bangla-2',
      letter: 'আ',
      isCustomSvg: false
    },
    {
      id: 'ict',
      titleEn: 'ICT',
      titleBn: 'তথ্য ও যোগাযোগ প্রযুক্তি',
      type: 'card-ict',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          <rect x="20" y="30" width="60" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
          <line x1="20" y1="62" x2="80" y2="62" stroke="currentColor" strokeWidth="2" />
          <path d="M 35,70 L 65,70 L 70,78 L 30,78 Z" fill="currentColor" opacity="0.8" />
          <line x1="45" y1="78" x2="55" y2="78" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="46" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M 40,57 C 40,52 60,52 60,57" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    },
    {
      id: 'physics_1',
      titleEn: 'Physics 1st paper',
      titleBn: 'পদার্থবিজ্ঞান ১ম পত্র',
      type: 'card-physics-1',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Newton's Cradle */}
          <line x1="25" y1="25" x2="75" y2="25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          {/* Threads */}
          <line x1="35" y1="25" x2="35" y2="60" stroke="currentColor" strokeWidth="2" />
          <line x1="42" y1="25" x2="42" y2="60" stroke="currentColor" strokeWidth="2" />
          <line x1="50" y1="25" x2="50" y2="60" stroke="currentColor" strokeWidth="2" />
          <line x1="58" y1="25" x2="58" y2="60" stroke="currentColor" strokeWidth="2" />
          <path d="M 66,25 L 76,50" stroke="currentColor" strokeWidth="2" />
          {/* Spheres */}
          <circle cx="35" cy="64" r="4.5" fill="currentColor" />
          <circle cx="42" cy="64" r="4.5" fill="currentColor" />
          <circle cx="50" cy="64" r="4.5" fill="currentColor" />
          <circle cx="58" cy="64" r="4.5" fill="currentColor" />
          <circle cx="78" cy="53" r="4.5" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'physics_2',
      titleEn: 'Physics 2nd paper',
      titleBn: 'পদার্থবিজ্ঞান ২য় পত্র',
      type: 'card-physics-2',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Electromagnet / Multimeter */}
          <rect x="25" y="25" width="50" height="50" rx="8" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="35" y="33" width="30" height="15" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
          <path d="M 40,43 A 15,15 0 0,1 60,43" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="50" y1="43" x2="58" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="42" cy="60" r="4" fill="currentColor" />
          <circle cx="58" cy="60" r="4" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'chemistry_1',
      titleEn: 'Chemistry 1st paper',
      titleBn: 'রসায়ন ১ম পত্র',
      type: 'card-chemistry-1',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Lab beaker and bubbles */}
          <path d="M 35,25 L 45,25 L 45,45 L 30,70 A 8,8 0 0,0 37,80 L 63,80 A 8,8 0 0,0 70,70 L 55,45 L 55,25 L 65,25" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="33" y1="65" x2="67" y2="65" stroke="currentColor" strokeWidth="2" />
          <circle cx="43" cy="55" r="3" fill="currentColor" opacity="0.6" />
          <circle cx="52" cy="40" r="2.5" fill="currentColor" opacity="0.6" />
          <circle cx="48" cy="72" r="3.5" fill="currentColor" opacity="0.8" />
          <circle cx="56" cy="74" r="2" fill="currentColor" opacity="0.8" />
        </svg>
      )
    },
    {
      id: 'chemistry_2',
      titleEn: 'Chemistry 2nd paper',
      titleBn: 'রসায়ন ২য় পত্র',
      type: 'card-chemistry-2',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Test tubes */}
          <rect x="25" y="65" width="50" height="8" rx="2" fill="currentColor" opacity="0.7" />
          <line x1="30" y1="73" x2="30" y2="78" stroke="currentColor" strokeWidth="4" />
          <line x1="70" y1="73" x2="70" y2="78" stroke="currentColor" strokeWidth="4" />
          <line x1="25" y1="78" x2="75" y2="78" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          {/* Tubes */}
          <rect x="38" y="25" width="8" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
          <rect x="54" y="20" width="8" height="45" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>
      )
    },
    {
      id: 'math_1',
      titleEn: 'Higher Math 1st paper',
      titleBn: 'উচ্চতর গণিত ১ম পত্র',
      type: 'card-math-1',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Notebook & Ruler */}
          <rect x="25" y="25" width="45" height="50" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
          <line x1="33" y1="35" x2="58" y2="35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="33" y1="47" x2="58" y2="47" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="33" y1="59" x2="50" y2="59" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          {/* Set square ruler */}
          <path d="M 45,75 L 75,75 L 75,45 Z" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M 55,70 L 70,70 L 70,55 Z" fill="currentColor" opacity="0.3" />
        </svg>
      )
    },
    {
      id: 'math_2',
      titleEn: 'Higher Math 2nd paper',
      titleBn: 'উচ্চতর গণিত ২য় পত্র',
      type: 'card-math-2',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Calculator */}
          <rect x="28" y="22" width="44" height="56" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="36" y="30" width="28" height="10" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
          <circle cx="41" cy="50" r="3.5" fill="currentColor" />
          <circle cx="50" cy="50" r="3.5" fill="currentColor" />
          <circle cx="59" cy="50" r="3.5" fill="currentColor" />
          <circle cx="41" cy="60" r="3.5" fill="currentColor" />
          <circle cx="50" cy="60" r="3.5" fill="currentColor" />
          <circle cx="59" cy="60" r="3.5" fill="currentColor" />
          <circle cx="41" cy="70" r="3.5" fill="currentColor" />
          <circle cx="50" cy="70" r="3.5" fill="currentColor" />
          <circle cx="59" cy="70" r="3.5" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'biology_1',
      titleEn: 'Biology 1st paper',
      titleBn: 'জীববিজ্ঞান ১ম পত্র',
      type: 'card-biology-1',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Microscope */}
          <path d="M 30,78 L 70,78" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M 38,78 L 38,65 L 50,60" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="50" cy="58" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M 58,35 L 42,51" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          <rect x="30" y="55" width="16" height="4" fill="currentColor" />
          {/* Slide stage */}
          <line x1="35" y1="65" x2="60" y2="65" stroke="currentColor" strokeWidth="3" />
        </svg>
      )
    },
    {
      id: 'biology_2',
      titleEn: 'Biology 2nd paper',
      titleBn: 'জীববিজ্ঞান ২য় পত্র',
      type: 'card-biology-2',
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Brain / Cell DNA illustration */}
          <path d="M 30,50 Q 30,25 50,25 Q 70,25 70,50 Q 70,75 50,75 Q 30,75 30,50 Z" fill="none" stroke="currentColor" strokeWidth="4" />
          {/* Helix windings */}
          <path d="M 33,40 Q 50,30 67,40" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M 31,50 Q 50,45 69,50" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M 33,60 Q 50,70 67,60" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="42" y1="36" x2="42" y2="44" stroke="currentColor" strokeWidth="2" />
          <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="58" y1="36" x2="58" y2="44" stroke="currentColor" strokeWidth="2" />
          <line x1="45" y1="58" x2="45" y2="66" stroke="currentColor" strokeWidth="2" />
          <line x1="55" y1="58" x2="55" y2="66" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    }
  ];

  // Admission Varsity Card Data
  const admissionVarsities = [
    { id: 'bup', name: 'BUP', color: 'var(--univ-bup)', bnName: 'বিইউপি' },
    { id: 'gst', name: 'GST', color: 'var(--univ-gst)', bnName: 'জিএসটি' },
    { id: 'agri', name: 'AGRI', color: 'var(--univ-agri)', bnName: 'কৃষি গুচ্ছ' },
    { id: 'medical', name: 'MEDICAL', color: 'var(--univ-medical)', bnName: 'মেডিকেল' },
    { id: 'dental', name: 'DENTAL', color: 'var(--univ-dental)', bnName: 'ডেন্টাল' },
    { id: 'afmc', name: 'AFMC', color: 'var(--univ-afmc)', bnName: 'এএফএমসি' },
    { id: 'du', name: 'DU', color: 'var(--univ-du)', bnName: 'ঢাবি' },
    { id: 'cu', name: 'CU', color: 'var(--univ-cu)', bnName: 'চবি' },
    { id: 'ju', name: 'JU', color: 'var(--univ-ju)', bnName: 'জাবি' },
    { id: 'ru', name: 'RU', color: 'var(--univ-ru)', bnName: 'রাবি' },
    { id: 'buet', name: 'BUET', color: 'var(--univ-buet)', bnName: 'বুয়েট' },
    { id: 'ckruet', name: 'CKRUET', color: 'var(--univ-ckruet)', bnName: 'চুয়েট-কুয়েট-রুয়েট গুচ্ছ' },
    { id: 'ruet', name: 'RUET', color: 'var(--univ-ruet)', bnName: 'রুয়েট' },
    { id: 'kuet', name: 'KUET', color: 'var(--univ-kuet)', bnName: 'কুয়েট' },
    { id: 'mist', name: 'MIST', color: 'var(--univ-mist)', bnName: 'এমআইএসটি' },
    { id: 'cuet', name: 'CUET', color: 'var(--univ-cuet)', bnName: 'চুয়েট' },
    { id: 'butex', name: 'BUTEX', color: 'var(--univ-butex)', bnName: 'বুটেক্স' },
    { id: 'iba', name: 'IBA', color: 'var(--univ-iba)', bnName: 'আইবিএ' },
    { id: 'iut', name: 'IUT', color: 'var(--univ-iut)', bnName: 'আইইউটি' }
  ];

  // Model Test College Card Data
  const modelTestColleges = [
    { id: 0, name: 'Notre Dame College', bnName: 'নটর ডেম কলেজ', city: 'Dhaka', tier: 'Top' },
    { id: 1, name: 'Adamjee Cantonment College', bnName: 'আদমজী ক্যান্টনমেন্ট কলেজ', city: 'Dhaka', tier: 'Top' },
    { id: 2, name: 'Rajuk Uttara Model College', bnName: 'রাজউক উত্তরা মডেল কলেজ', city: 'Dhaka', tier: 'Top' },
    { id: 3, name: 'Holy Cross College', bnName: 'হলি ক্রস কলেজ', city: 'Dhaka', tier: 'Premium' },
    { id: 4, name: 'Viqarunnisa Noon School & College', bnName: 'ভিকারুন্নেসা নূন স্কুল অ্যান্ড কলেজ', city: 'Dhaka', tier: 'Premium' },
    { id: 5, name: 'Dhaka Residential Model College', bnName: 'ঢাকা রেসিডেনশিয়াল মডেল কলেজ', city: 'Dhaka', tier: 'Premium' },
    { id: 6, name: 'Dhaka College', bnName: 'ঢাকা কলেজ', city: 'Dhaka', tier: 'Premium' },
    { id: 7, name: "Birshreshtha Noor Mohammad Public College", bnName: 'বিশ্বস্ত নূর মোহাম্মদ পাবলিক কলেজ', city: 'Dhaka', tier: 'Top' },
    { id: 8, name: 'BAF Shaheen College Dhaka', bnName: 'বিএএফ শাহিন কলেজ ঢাকা', city: 'Dhaka', tier: 'Top' },
    { id: 9, name: 'St. Joseph Higher Secondary School', bnName: 'সেন্ট জোসেফ হায়ার সেকেন্ডারি স্কুল', city: 'Dhaka', tier: 'Premium' },
    { id: 10, name: 'Abdul Kadir Mollah City College', bnName: 'আবদুল কাদির মোল্লা সিটি কলেজ', city: 'Dhaka', tier: 'Standard' },
    { id: 11, name: 'Government Hazi Mohammad Mohsin College', bnName: 'সরকারি হাজী মোহাম্মদ মহসিন কলেজ', city: 'Dhaka', tier: 'Standard' },
    { id: 12, name: 'Chittagong College', bnName: 'চট্টগ্রাম কলেজ', city: 'Chittagong', tier: 'Standard' },
    { id: 13, name: 'Rajshahi College', bnName: 'রাজশাহী কলেজ', city: 'Rajshahi', tier: 'Standard' },
    { id: 14, name: 'Government Azizul Haque College', bnName: 'সরকারি আজিজুল হক কলেজ', city: 'Bogura', tier: 'Standard' },
    { id: 15, name: 'Ananda Mohan College', bnName: 'আনন্দ মোহন কলেজ', city: 'Mymensingh', tier: 'Standard' },
    { id: 16, name: 'Cumilla Victoria Government College', bnName: 'কুমিল্লা ভিক্টোরিয়া সরকারি কলেজ', city: 'Cumilla', tier: 'Standard' },
    { id: 17, name: 'Government Brojomohun College', bnName: 'সরকারি ব্রজমোহন কলেজ', city: 'Rangpur', tier: 'Standard' },
    { id: 18, name: 'MC College', bnName: 'এমসি কলেজ', city: 'Sylhet', tier: 'Standard' },
    { id: 19, name: 'Government Edward College', bnName: 'সরকারি এডওয়ার্ড কলেজ', city: 'Pabna', tier: 'Standard' }
  ];

  // Filter items based on active tab and search query
  const filteredAcademicSubjects = academicSubjects.filter(sub => {
    const query = searchQuery.toLowerCase();
    return sub.titleEn.toLowerCase().includes(query) || sub.titleBn.toLowerCase().includes(query);
  });

  const filteredAdmissionVarsities = admissionVarsities.filter(v => {
    const query = searchQuery.toLowerCase();
    return v.name.toLowerCase().includes(query) || v.bnName.toLowerCase().includes(query);
  });

  const filteredModelTestColleges = modelTestColleges.filter(college => {
    const query = searchQuery.toLowerCase();
    return college.name.toLowerCase().includes(query) || 
           college.bnName.toLowerCase().includes(query) ||
           college.city.toLowerCase().includes(query);
  });

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />

      {/* Main Panel Content */}
      <main className="dashboard-main">
        <header className="dashboard-header qbank-header">
          <div className="dashboard-header__welcome">
            <h2>{t('qbank.title')}</h2>
            <p>{t('qbank.subtitle')}</p>
          </div>
          <div className="dashboard-header__actions">
            <span className="dashboard-header__badge">{t('db.workspace')}</span>
          </div>
        </header>

        {/* Question Bank Workspace Panel */}
        <div className="qbank-workspace animate-fade-in">
          {/* Navigation Control Bar: Tabs & Search */}
          <div className="qbank-controls">
            <div className="qbank-tabs-wrapper">
              <button
                type="button"
                className={`qbank-tab-btn ${activeSubTab === 'academic' ? 'qbank-tab-btn--active' : ''}`}
                onClick={() => {
                  setActiveSubTab('academic');
                  setSearchQuery('');
                }}
              >
                {t('qbank.tab.academic')}
              </button>
              <button
                type="button"
                className={`qbank-tab-btn ${activeSubTab === 'admission' ? 'qbank-tab-btn--active' : ''}`}
                onClick={() => {
                  setActiveSubTab('admission');
                  setSearchQuery('');
                }}
              >
                {t('qbank.tab.admission')}
              </button>
              <button
                type="button"
                className={`qbank-tab-btn ${activeSubTab === 'modeltest' ? 'qbank-tab-btn--active' : ''}`}
                onClick={() => {
                  setActiveSubTab('modeltest');
                  setSearchQuery('');
                }}
              >
                {t('qbank.tab.modeltest')}
              </button>
            </div>

            <div className="qbank-search-bar">
              <span className="qbank-search-icon">
                <HiSearch size={18} />
              </span>
              <input
                type="text"
                placeholder={t('qbank.search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="qbank-search-input"
              />
            </div>
          </div>

          {/* Tab Description Title */}
          <div className="qbank-section-info">
            <h3>
              {activeSubTab === 'academic' && t('qbank.tab.academic')}
              {activeSubTab === 'admission' && t('qbank.tab.admission')}
              {activeSubTab === 'modeltest' && t('qbank.tab.modeltest')}
            </h3>
            <p>
              {activeSubTab === 'academic' && t('qbank.academic.desc')}
              {activeSubTab === 'admission' && t('qbank.admission.desc')}
              {activeSubTab === 'modeltest' && t('qbank.modeltest.desc')}
            </p>
          </div>

          {/* Gird Content Pane */}
          <div className="qbank-grid-container">
            {activeSubTab === 'academic' && (
              <div className="qbank-grid qbank-grid--academic">
                {filteredAcademicSubjects.length > 0 ? (
                  filteredAcademicSubjects.map((sub) => (
                    <div key={sub.id} className={`qbank-card qbank-card--academic ${sub.type}`}>
                      <div className="qbank-card__glow"></div>
                      <div className="qbank-card__visual">
                        {sub.isCustomSvg ? (
                          sub.svg
                        ) : (
                          <span className="qbank-card__letter">{sub.letter}</span>
                        )}
                      </div>
                      <div className="qbank-card__info">
                        <h4 className="qbank-card__subject">
                          {language === 'en' ? sub.titleEn : sub.titleBn}
                        </h4>
                        <span className="qbank-card__sub-label">
                          {sub.id.includes('1') ? (language === 'en' ? '1st paper' : '১ম পত্র') : ''}
                          {sub.id.includes('2') ? (language === 'en' ? '2nd paper' : '২য় পত্র') : ''}
                          {sub.id === 'ict' ? (language === 'en' ? 'HSC Core' : 'এইচএসসি আবশ্যিক') : ''}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="qbank-empty">
                    <p>{language === 'en' ? 'No subjects found matching your search.' : 'আপনার অনুসন্ধানের সাথে মেলে এমন কোনো বিষয় পাওয়া যায়নি।'}</p>
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'admission' && (
              <div className="qbank-grid qbank-grid--admission">
                {filteredAdmissionVarsities.length > 0 ? (
                  filteredAdmissionVarsities.map((v) => (
                    <div key={v.id} className={`qbank-card qbank-card--admission qbank-card--${v.id}`} style={{ '--card-brand': v.color }}>
                      <div className="qbank-card__glow"></div>
                      <div className="qbank-card__visual">
                        <span className="qbank-card__letter">{v.name.slice(0, 2)}</span>
                      </div>
                      <div className="qbank-card__info">
                        <h4 className="qbank-card__subject">{v.name}</h4>
                        <span className="qbank-card__sub-label">
                          {language === 'en' ? 'Question Bank' : 'প্রশ্নব্যাংক'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="qbank-empty">
                    <p>{language === 'en' ? 'No universities found matching your search.' : 'আপনার অনুসন্ধানের সাথে মেলে এমন কোনো বিশ্ববিদ্যালয় পাওয়া যায়নি।'}</p>
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'modeltest' && (
              <div className="qbank-model-test-pane">
                <div className="qbank-college-section">
                  <h3 className="qbank-college-section-title">
                    <HiAcademicCap size={20} />
                    {language === 'en' ? 'College Model Tests' : 'কলেজ মডেল টেস্ট'}
                  </h3>
                  <p className="qbank-college-section-subtitle">
                    {language === 'en' 
                      ? 'Select a college to start practicing with their exam-specific questions' 
                      : 'তাদের পরীক্ষা-নির্দিষ্ট প্রশ্ন দিয়ে অনুশীলন শুরু করতে একটি কলেজ নির্বাচন করুন'}
                  </p>
                  <div className="qbank-grid qbank-grid--college">
                    {filteredModelTestColleges.length > 0 ? (
                      filteredModelTestColleges.map((college) => (
                        <div 
                          key={college.id} 
                          className={`qbank-card qbank-card--college qbank-card--college-${college.id % 20}`}
                        >
                          <div className="qbank-card__glow"></div>
                          <div className="qbank-card__visual">
                            <span className="qbank-card__letter">{college.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
                          </div>
                          <div className="qbank-card__info">
                            <h4 className="qbank-card__subject">{college.name}</h4>
                            <span className="qbank-card__bn-name">{college.bnName}</span>
                            <span className="qbank-card__status">
                              <HiSparkles size={12} />
                              {college.tier} College
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="qbank-empty">
                        <p>{language === 'en' ? 'No colleges found matching your search.' : 'আপনার অনুসন্ধানের সাথে মেলে এমন কোনো কলেজ পাওয়া যায়নি।'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
