import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiArrowLeft, HiInformationCircle } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import './IeltsSpeakingDemo.css';

export default function IeltsSpeakingDemo() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
  });

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
        console.error('Error fetching user data in Speaking Demo:', err);
      }
    };

    const topkorbo_role = localStorage.getItem('topkorbo_role');
    if (topkorbo_role) {
      setUser(prev => ({ ...prev, role: topkorbo_role }));
    }

    fetchUserData();
  }, [navigate]);

  // Guard role
  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>This demo is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="ielts-speaking-demo-page">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-speaking-demo-content">
        {/* Header */}
        <div className="ielts-speaking-demo-header">
          <button
            onClick={() => navigate('/ielts-prep/speaking')}
            className="ielts-speaking-demo-back-btn"
            title={language === 'en' ? 'Go Back' : 'পিছনে যান'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-speaking-demo-header-text">
            <h2>{language === 'en' ? 'IELTS Speaking Demo Prompt' : 'আইইএলটিএস স্পিকিং ডেমো প্রম্পট'}</h2>
            <p>
              {language === 'en'
                ? 'Review sample IELTS speaking questions to get familiar with the interview structure.'
                : 'ইন্টারভিউয়ের গঠন সম্পর্কে ধারণা পেতে নমুনা আইইএলটিএস স্পিকিং প্রশ্নসমূহ পর্যালোচনা করুন।'}
            </p>
          </div>
        </div>

        {/* Workspace */}
        <div className="ielts-speaking-demo-workspace">
          <div className="ielts-speaking-demo-container">

            {/* Read-only Banner */}
            <div className="ielts-demo-notice-banner">
              <HiInformationCircle size={22} />
              <span>
                {language === 'en'
                  ? 'This is a read-only preview of IELTS tasks. Answer recording or evaluation is not available here.'
                  : 'এটি আইইএলটিএস টাস্কের একটি রিড-অনলি প্রিভিউ। উত্তর রেকর্ড করা বা মূল্যায়নের কোনো বিকল্প এখানে নেই।'}
              </span>
            </div>

            {/* Speaking Prompt Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="ielts-demo-speaking-card"
            >
              <h2 className="ielts-speaking-set-title">
                {language === 'en' ? 'IELTS Speaking Set 1' : 'আইইএলটিএস স্পিকিং সেট ১'}
              </h2>

              {/* Part 1 */}
              <div className="ielts-speaking-part-section">
                <h3 className="ielts-speaking-part-header">
                  {language === 'en' ? 'Part 1: Introduction & Interview' : 'পার্ট ১: পরিচিতি ও সাক্ষাৎকার'}
                </h3>
                <div className="ielts-speaking-questions-box">
                  <ul className="ielts-speaking-questions-list">
                    <li>
                      <span style={{ fontWeight: 'bold' }}>1.</span>
                      <span>{language === 'en' ? 'Can you introduce yourself?' : 'আপনি কি নিজের পরিচয় দিতে পারেন?'}</span>
                    </li>
                    <li>
                      <span style={{ fontWeight: 'bold' }}>2.</span>
                      <span>{language === 'en' ? 'What do you usually do in your free time?' : 'আপনি সাধারণত অবসর সময়ে কি করেন?'}</span>
                    </li>
                    <li>
                      <span style={{ fontWeight: 'bold' }}>3.</span>
                      <span>{language === 'en' ? 'Do you prefer spending time alone or with friends? Why?' : 'আপনি কি একা নাকি বন্ধুদের সাথে সময় কাটাতে পছন্দ করেন? কেন?'}</span>
                    </li>
                    <li>
                      <span style={{ fontWeight: 'bold' }}>4.</span>
                      <span>{language === 'en' ? 'What kind of music do you enjoy listening to?' : 'আপনি কোন ধরনের গান শুনতে পছন্দ করেন?'}</span>
                    </li>
                    <li>
                      <span style={{ fontWeight: 'bold' }}>5.</span>
                      <span>{language === 'en' ? 'Has your taste in music changed over the years?' : 'বছরের পর বছর ধরে কি গানের প্রতি আপনার রুচি পরিবর্তন হয়েছে?'}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Part 2 */}
              <div className="ielts-speaking-part-section">
                <h3 className="ielts-speaking-part-header">
                  {language === 'en' ? 'Part 2: Cue Card' : 'পার্ট ২: কিউ কার্ড'}
                </h3>
                <div className="ielts-speaking-cue-card-box">
                  <p style={{ fontWeight: 'bold' }}>
                    {language === 'en'
                      ? 'Describe a memorable journey you have taken.'
                      : 'আপনার নেয়া একটি স্মরণীয় ভ্রমণের বর্ণনা দিন।'}
                  </p>
                  <p>{language === 'en' ? 'You should say:' : 'আপনার বলা উচিত:'}</p>
                  <ul>
                    <li>{language === 'en' ? 'where you went,' : 'আপনি কোথায় গিয়েছিলেন,'}</li>
                    <li>{language === 'en' ? 'who you went with,' : 'আপনি কার সাথে গিয়েছিলেন,'}</li>
                    <li>{language === 'en' ? 'what you did there,' : 'আপনি সেখানে কি করেছিলেন,'}</li>
                  </ul>
                  <p>{language === 'en' ? 'and explain why this journey was memorable.' : 'এবং ব্যাখ্যা করুন কেন এই ভ্রমণটি স্মরণীয় ছিল।'}</p>
                  <div className="ielts-speaking-time-hint">
                    {language === 'en' ? '*(Speak for 1–2 minutes.)*' : '*(১-২ মিনিট কথা বলুন।)*'}
                  </div>
                </div>
              </div>

              {/* Part 3 */}
              <div className="ielts-speaking-part-section">
                <h3 className="ielts-speaking-part-header">
                  {language === 'en' ? 'Part 3: Discussion' : 'পার্ট ৩: আলোচনা'}
                </h3>
                <div className="ielts-speaking-questions-box">
                  <ul className="ielts-speaking-questions-list">
                    <li>
                      <span style={{ fontWeight: 'bold' }}>1.</span>
                      <span>{language === 'en' ? 'Why do people enjoy traveling?' : 'মানুষ কেন ভ্রমণ উপভোগ করে?'}</span>
                    </li>
                    <li>
                      <span style={{ fontWeight: 'bold' }}>2.</span>
                      <span>{language === 'en' ? 'Do you think people travel more nowadays than in the past?' : 'আপনি কি মনে করেন আজকাল মানুষ অতীতের চেয়ে বেশি ভ্রমণ করে?'}</span>
                    </li>
                    <li>
                      <span style={{ fontWeight: 'bold' }}>3.</span>
                      <span>{language === 'en' ? 'What are the advantages and disadvantages of tourism?' : 'পর্যটনের সুবিধা এবং অসুবিধাগুলো কি কি?'}</span>
                    </li>
                    <li>
                      <span style={{ fontWeight: 'bold' }}>4.</span>
                      <span>{language === 'en' ? 'How can governments promote responsible tourism?' : 'সরকার কিভাবে দায়িত্বশীল পর্যটনকে উৎসাহিত করতে পারে?'}</span>
                    </li>
                  </ul>
                </div>
              </div>

            </motion.div>

          </div>
        </div>
      </main>
    </div>
  );
}
