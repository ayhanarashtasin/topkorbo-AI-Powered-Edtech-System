import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiChatAlt2,
  HiArrowLeft,
  HiArrowRight,
  HiPlay,
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import './IeltsSpeaking.css';

export default function IeltsSpeaking() {
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
        console.error('Error fetching user data in IELTS Speaking:', err);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Guard role
  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>IELTS Speaking is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handleStartDemo = () => {
    toast.success(
      language === 'en'
        ? 'Starting Speaking mock interview...'
        : 'স্পিকিং মক ইন্টারভিউ শুরু করা হচ্ছে...'
    );
  };

  return (
    <div className="ielts-speaking-container">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-speaking-main">
        {/* Header */}

        {/* Content */}
        <div className="ielts-speaking-workspace">
          <div className="ielts-speaking-workspace__body">

            {/* Hero / Description Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="ielts-speaking-hero"
            >
              <div className="ielts-speaking-hero__icon-row">
                <div className="ielts-speaking-hero__icon">
                  <HiChatAlt2 size={32} />
                </div>
                <h1>{language === 'en' ? 'Speaking Section Overview' : 'স্পিকিং সেকশন ওভারভিউ'}</h1>
              </div>

              <div className="ielts-speaking-description">
                <p><strong>⏱ Time:</strong> 11–14 minutes</p>
                <p><strong>Three parts.</strong></p>

                {/* Grid layout for Part 1, Part 2, and Part 3 */}
                <div className="ielts-speaking-grid-3">
                  <div className="ielts-speaking-sub-section">
                    <h3>Part 1 (4–5 min)</h3>
                    <p>Questions about:</p>
                    <ul>
                      <li>Yourself</li>
                      <li>Family</li>
                      <li>Study</li>
                      <li>Work</li>
                      <li>Hobbies</li>
                      <li>Daily life</li>
                    </ul>
                  </div>

                  <div className="ielts-speaking-sub-section">
                    <h3>Part 2 (3–4 min)</h3>
                    <p><strong>Cue Card</strong></p>
                    <p>You get:</p>
                    <ul>
                      <li>1 minute to prepare</li>
                      <li>1–2 minutes to speak</li>
                    </ul>
                    <div className="ielts-example-box">
                      <p style={{ margin: 0 }}><strong>Example:</strong></p>
                      <p style={{ margin: '4px 0 0 0', fontStyle: 'italic' }}>
                        Describe a person you admire.
                      </p>
                    </div>
                  </div>

                  <div className="ielts-speaking-sub-section">
                    <h3>Part 3 (4–5 min)</h3>
                    <p><strong>Discussion related to Part 2</strong></p>
                    <p>Questions are more analytical and opinion-based.</p>
                  </div>
                </div>

                {/* Scoring criteria */}
                <div style={{ marginTop: '2rem' }}>
                  <p><strong>Speaking is scored on:</strong></p>
                  <ul>
                    <li>Fluency & Coherence (25%)</li>
                    <li>Lexical Resource (25%)</li>
                    <li>Grammar (25%)</li>
                    <li>Pronunciation (25%)</li>
                  </ul>
                </div>

                {/* Overall band score and rounding calculation */}
                <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(192, 133, 82, 0.1)', paddingTop: '1.5rem' }}>
                  <h3>Overall Band Score</h3>
                  <p>The overall band is the average of your four section scores.</p>
                  
                  <div className="ielts-example-box" style={{ background: 'rgba(192, 133, 82, 0.04)', borderColor: 'var(--sky-blue)' }}>
                    <p style={{ margin: 0, fontWeight: '700' }}>Example Calculation:</p>
                    <table className="ielts-criteria-table" style={{ margin: '10px 0', maxWidth: '300px' }}>
                      <thead>
                        <tr>
                          <th>Section</th>
                          <th>Band</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Listening</td>
                          <td>8.0</td>
                        </tr>
                        <tr>
                          <td>Reading</td>
                          <td>7.5</td>
                        </tr>
                        <tr>
                          <td>Writing</td>
                          <td>6.5</td>
                        </tr>
                        <tr>
                          <td>Speaking</td>
                          <td>7.0</td>
                        </tr>
                      </tbody>
                    </table>

                    <p style={{ margin: '12px 0 6px 0', fontWeight: '600' }}>Average:</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ borderBottom: '1.5px solid var(--text-primary)', padding: '0 8px' }}>8 + 7.5 + 6.5 + 7</span>
                        <span>4</span>
                      </div>
                      <span style={{ fontWeight: '700' }}> = 7.25</span>
                    </div>
                    <p style={{ margin: '8px 0 0 0' }}>
                      An average of <strong>7.25</strong> is rounded up to an <strong>Overall Band 7.5</strong>.
                    </p>
                  </div>

                  <p style={{ marginTop: '1.25rem' }}><strong>Rounding rules:</strong></p>
                  <ul>
                    <li><strong>x.25</strong> → rounded up to <strong>x.5</strong></li>
                    <li><strong>x.75</strong> → rounded up to the next whole band (e.g. <strong>x+1.0</strong>)</li>
                    <li>Otherwise → rounded to the nearest half or whole band as applicable.</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Demo Question Action Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="ielts-speaking-actions"
            >
              <div
                className="ielts-speaking-action-card"
                onClick={handleStartDemo}
              >
                <div className="ielts-speaking-action-card__left">
                  <div className="ielts-speaking-action-card__icon">
                    <HiPlay size={28} />
                  </div>
                  <div className="ielts-speaking-action-card__text">
                    <h3>{language === 'en' ? 'Demo Prompt' : 'ডেমো প্রম্পট'}</h3>
                    <p>
                      {language === 'en'
                        ? 'Try a sample speaking prompt to record and review your response.'
                        : 'উত্তর রেকর্ড ও পর্যালোচনার জন্য একটি নমুনা স্পিকিং প্রম্পট চেষ্টা করুন।'}
                    </p>
                  </div>
                </div>
                <div className="ielts-speaking-action-card__arrow">
                  <HiArrowRight size={22} />
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </main>
    </div>
  );
}
