import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiVolumeUp,
  HiBookOpen,
  HiPencilAlt,
  HiChatAlt2,
  HiArrowLeft,
  HiArrowRight,
  HiClipboardList,
  HiAcademicCap
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import './IeltsPrep.css';

export default function IeltsPrep() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
  });

  const [step, setStep] = useState(location.state?.step || 1);

  // Auth Guard
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      navigate('/');
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
          navigate('/');
          return;
        }

        const resData = await response.json();
        if (resData.success && resData.data) {
          const u = resData.data;
          setUser({
            name: u.name,
            avatar: u.avatar || '',
            email: u.email,
            role: u.role,
          });
        }
      } catch (err) {
        console.error('Error fetching user data in IELTS Prep:', err);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Guard role
  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>IELTS Preparation is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handleStartPrep = () => {
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSelectSegment = (segmentName) => {
    toast.success(
      language === 'en'
        ? `Entering ${segmentName} module...`
        : `${segmentName} মডিউলে প্রবেশ করা হচ্ছে...`
    );
  };

  return (
    <div className="ielts-prep-container">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-prep-main">
        {/* Header */}
        <header className="ielts-prep-header">
          <div className="ielts-prep-header__title">
            <h2>{language === 'en' ? 'IELTS Preparation' : 'আইইএলটিএস প্রস্তুতি'}</h2>
            <p>
              {language === 'en'
                ? 'Master the IELTS exam with comprehensive section reviews'
                : 'সম্পূর্ণ সেকশন রিভিউর মাধ্যমে আইইএলটিএস পরীক্ষায় ভালো স্কোর করুন'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.25rem' }}>🇬🇧</span>
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>IELTS Academic & GT</span>
          </div>
        </header>

        {/* Content Workspace */}
        <div className="ielts-prep-workspace">
          <div className="ielts-prep-workspace__body">

            {step === 1 ? (
              /* ================= STEP 1: Overview & Info ================= */
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="ielts-overview-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                  <HiAcademicCap size={32} style={{ color: 'var(--sky-blue)' }} />
                  <h1 className="ielts-title">
                    {language === 'en' ? 'IELTS Academic & General' : 'আইইএলটিএস একাডেমিক ও জেনারেল'}
                  </h1>
                </div>

                <p className="ielts-description">
                  {language === 'en'
                    ? "The International English Language Testing System (IELTS) is the world's most popular high-stakes English language proficiency test for study, work, and migration. It assesses your abilities in four key communication areas: Listening, Reading, Writing, and Speaking."
                    : "ইন্টারন্যাশনাল ইংলিশ ল্যাঙ্গুয়েজ টেস্টিং সিস্টেম (IELTS) পড়াশোনা, কর্মসংস্থান বা অভিবাসনের জন্য বিশ্বের সর্বাধিক জনপ্রিয় উচ্চ-মানের ইংরেজি ভাষা দক্ষতা পরীক্ষা। এটি চারটি প্রধান যোগাযোগের ক্ষেত্রে আপনার দক্ষতা মূল্যায়ন করে: লিসেনিং, রিডিং, রাইটিং এবং স্পিকিং।"}
                </p>

                {/* Mark Distribution Section */}
                <div className="ielts-distribution-section">
                  <h3 className="ielts-section-title">
                    {language === 'en' ? 'Mark Distribution & Exam Structure' : 'নম্বর বন্টন ও পরীক্ষার গঠন'}
                  </h3>

                  <div className="ielts-grid-4">
                    {/* Listening */}
                    <div className="ielts-dist-card" onClick={() => navigate('/ielts-prep/listening')} style={{ cursor: 'pointer' }}>
                      <div className="ielts-dist-icon"><HiVolumeUp size={24} /></div>
                      <h4>{language === 'en' ? 'Listening' : 'লিসেনিং'}</h4>
                      <span className="ielts-dist-detail">
                        {language === 'en' ? '4 Sections | 40 Questions' : '৪টি সেকশন | ৪০টি প্রশ্ন'}
                      </span>
                      <span className="ielts-dist-duration">
                        {language === 'en' ? '30 Mins' : '৩০ মিনিট'}
                      </span>
                    </div>

                    {/* Reading */}
                    <div className="ielts-dist-card" onClick={() => navigate('/ielts-prep/reading')} style={{ cursor: 'pointer' }}>
                      <div className="ielts-dist-icon"><HiBookOpen size={24} /></div>
                      <h4>{language === 'en' ? 'Reading' : 'রিডিং'}</h4>
                      <span className="ielts-dist-detail">
                        {language === 'en' ? '3 Passages | 40 Questions' : '৩টি প্যাসেজ | ৪০টি প্রশ্ন'}
                      </span>
                      <span className="ielts-dist-duration">
                        {language === 'en' ? '60 Mins' : '৬০ মিনিট'}
                      </span>
                    </div>

                    {/* Writing */}
                    <div className="ielts-dist-card" onClick={() => navigate('/ielts-prep/writing')} style={{ cursor: 'pointer' }}>
                      <div className="ielts-dist-icon"><HiPencilAlt size={24} /></div>
                      <h4>{language === 'en' ? 'Writing' : 'রাইটিং'}</h4>
                      <span className="ielts-dist-detail">
                        {language === 'en' ? '2 Tasks (Report/Essay)' : '২টি টাস্ক (রিপোর্ট/রচনা)'}
                      </span>
                      <span className="ielts-dist-duration">
                        {language === 'en' ? '60 Mins' : '৬০ মিনিট'}
                      </span>
                    </div>

                    {/* Speaking */}
                    <div className="ielts-dist-card" onClick={() => navigate('/ielts-prep/speaking')} style={{ cursor: 'pointer' }}>
                      <div className="ielts-dist-icon"><HiChatAlt2 size={24} /></div>
                      <h4>{language === 'en' ? 'Speaking' : 'স্পিকিং'}</h4>
                      <span className="ielts-dist-detail">
                        {language === 'en' ? '3 Parts (Face-to-Face)' : '৩টি পার্ট (সাক্ষাৎকার)'}
                      </span>
                      <span className="ielts-dist-duration">
                        {language === 'en' ? '11-14 Mins' : '১১-১৪ মিনিট'}
                      </span>
                    </div>
                  </div>
                </div>


                {/* Start Button */}
                <div className="ielts-btn-container">
                  <button onClick={handleStartPrep} className="ielts-btn-primary">
                    <span>{language === 'en' ? 'Start Preparation' : 'প্রস্তুতি শুরু করুন'}</span>
                    <HiArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            ) : (
              /* ================= STEP 2: The 4 Segments ================= */
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Section Header with Back button */}
                <div className="ielts-segments-header">
                  <button onClick={handleBack} className="ielts-back-btn" title={language === 'en' ? 'Go Back' : 'পিছনে যান'}>
                    <HiArrowLeft size={20} />
                  </button>
                  <div>
                    <h1 className="ielts-section-title" style={{ margin: 0 }}>
                      {language === 'en' ? 'Select IELTS Segment' : 'আইইএলটিএস সেগমেন্ট নির্বাচন করুন'}
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {language === 'en'
                        ? 'Select one of the four segments below to practice standard questions.'
                        : 'মানসম্মত প্রশ্ন অনুশীলন করার জন্য নিচের চারটি সেগমেন্টের যেকোনো একটি নির্বাচন করুন।'}
                    </p>
                  </div>
                </div>

                {/* Grid of the 4 segments */}
                <div className="ielts-segments-grid">
                  {/* Listening Card */}
                  <div className="ielts-segment-card" onClick={() => navigate('/ielts-prep/listening/practice')}>
                    <div className="ielts-segment-icon"><HiVolumeUp size={36} /></div>
                    <h3>{language === 'en' ? 'Listening Practice' : 'লিসেনিং প্র্যাকটিস'}</h3>
                    <p className="ielts-segment-desc">
                      {language === 'en'
                        ? 'Practice listening to native conversations, monologues, and academic lectures with real-time feedback.'
                        : 'রিয়েল-টাইম ফিডব্যাক সহ ইংরেজিভাষীদের কথোপকথন, একক বক্তৃতা এবং একাডেমিক লেকচার শোনার অনুশীলন করুন।'}
                    </p>
                    <span className="ielts-segment-meta">
                      {language === 'en' ? '40 Questions' : '৪০টি প্রশ্ন'}
                    </span>
                  </div>

                  {/* Reading Card */}
                  <div className="ielts-segment-card" onClick={() => navigate('/ielts-prep/reading/practice')}>
                    <div className="ielts-segment-icon"><HiBookOpen size={36} /></div>
                    <h3>{language === 'en' ? 'Reading Practice' : 'রিডিং প্র্যাকটিস'}</h3>
                    <p className="ielts-segment-desc">
                      {language === 'en'
                        ? 'Enhance your skimming, scanning, and analytical comprehension using curated passages.'
                        : 'সংগৃহীত প্যাসেজ ব্যবহারের মাধ্যমে স্কিমিং, স্ক্যানিং এবং বিশ্লেষণাত্মক রিডিং দক্ষতা বৃদ্ধি করুন।'}
                    </p>
                    <span className="ielts-segment-meta">
                      {language === 'en' ? '3 Passages' : '৩টি প্যাসেজ'}
                    </span>
                  </div>

                  {/* Writing Card */}
                  <div className="ielts-segment-card" onClick={() => navigate('/ielts-prep/writing/practice')}>
                    <div className="ielts-segment-icon"><HiPencilAlt size={36} /></div>
                    <h3>{language === 'en' ? 'Writing Practice' : 'রাইটিং প্র্যাকটিস'}</h3>
                    <p className="ielts-segment-desc">
                      {language === 'en'
                        ? 'Practice drafting charts, process diagrams, and analytical essays with clear structured tasks.'
                        : 'চার্ট, প্রক্রিয়ার চিত্র এবং বিশ্লেষণাত্মক প্রবন্ধ লেখার সাথে সাথে রচনার গঠন নিখুঁত করুন।'}
                    </p>
                    <span className="ielts-segment-meta">
                      {language === 'en' ? '2 Tasks' : '২টি টাস্ক'}
                    </span>
                  </div>

                  {/* Speaking Card */}
                  <div className="ielts-segment-card" onClick={() => navigate('/ielts-prep/speaking/practice')}>
                    <div className="ielts-segment-icon"><HiChatAlt2 size={36} /></div>
                    <h3>{language === 'en' ? 'Speaking Practice' : 'স্পিকিং প্র্যাকটিস'}</h3>
                    <p className="ielts-segment-desc">
                      {language === 'en'
                        ? 'Review face-to-face topics, practice response formatting, and study interactive feedback.'
                        : 'সাক্ষাৎকারের বিষয়বস্তু পর্যালোচনা করুন, কথা বলার গঠন এবং ইন্টারঅ্যাক্টিভ ফিডব্যাক নিয়ে কাজ করুন।'}
                    </p>
                    <span className="ielts-segment-meta">
                      {language === 'en' ? '3 Parts' : '৩টি পার্ট'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
