import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiPencilAlt,
  HiArrowLeft,
  HiArrowRight,
  HiPlay,
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import './IeltsWriting.css';

export default function IeltsWriting() {
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
        console.error('Error fetching user data in IELTS Writing:', err);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Guard role
  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>IELTS Writing is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handleStartDemo = () => {
    toast.success(
      language === 'en'
        ? 'Launching Writing practice prompt...'
        : 'রাইটিং প্র্যাকটিস প্রম্পট লোড করা হচ্ছে...'
    );
  };

  return (
    <div className="ielts-writing-container">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-writing-main">
        {/* Header */}
        <header className="ielts-writing-header">
          <div className="ielts-writing-header__left">
            <button
              onClick={() => navigate('/ielts-prep')}
              className="ielts-writing-back-btn"
              title={language === 'en' ? 'Back to IELTS Prep' : 'আইইএলটিএস প্রস্তুতিতে ফিরে যান'}
            >
              <HiArrowLeft size={20} />
            </button>
            <div className="ielts-writing-header__title">
              <h2>{language === 'en' ? 'IELTS Writing' : 'আইইএলটিএস রাইটিং'}</h2>
              <p>
                {language === 'en'
                  ? 'Master the writing module with structured task descriptions and prompt reviews'
                  : 'সুনির্দিষ্ট টাস্ক ও প্রম্পট রিভিউয়ের মাধ্যমে রাইটিং সেকশনটি আয়ত্ত করুন'}
              </p>
            </div>
          </div>
          <div className="ielts-writing-badge">
            <HiPencilAlt size={18} />
            <span>{language === 'en' ? 'Writing Module' : 'রাইটিং মডিউল'}</span>
          </div>
        </header>

        {/* Content */}
        <div className="ielts-writing-workspace">
          <div className="ielts-writing-workspace__body">

            {/* Hero / Description Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="ielts-writing-hero"
            >
              <div className="ielts-writing-hero__icon-row">
                <div className="ielts-writing-hero__icon">
                  <HiPencilAlt size={32} />
                </div>
                <h1>{language === 'en' ? 'Writing Section Overview' : 'রাইটিং সেকশন ওভারভিউ'}</h1>
              </div>

              <div className="ielts-writing-description">
                <p><strong>There are 2 tasks.</strong></p>

                {/* Grid layout for Task 1 and Task 2 */}
                <div className="ielts-writing-grid-2">
                  <div className="ielts-writing-sub-section">
                    <h3>Task 1 (20 minutes)</h3>
                    <p><strong>Academic IELTS</strong></p>
                    <p>Describe:</p>
                    <ul>
                      <li>Graph</li>
                      <li>Chart</li>
                      <li>Table</li>
                      <li>Map</li>
                      <li>Process</li>
                    </ul>
                    <p><strong>Minimum 150 words</strong></p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Worth 1/3 of the Writing score.
                    </p>

                    <p style={{ marginTop: '1.25rem' }}><strong>General Training IELTS</strong></p>
                    <p>Write a letter:</p>
                    <ul>
                      <li>Formal</li>
                      <li>Semi-formal</li>
                      <li>Informal</li>
                    </ul>
                    <p><strong>Minimum 150 words</strong></p>
                  </div>

                  <div className="ielts-writing-sub-section">
                    <h3>Task 2 (40 minutes)</h3>
                    <p>Write an essay.</p>
                    <p><strong>Minimum 250 words</strong></p>
                    <p>Types:</p>
                    <ul>
                      <li>Opinion</li>
                      <li>Discussion</li>
                      <li>Advantages & Disadvantages</li>
                      <li>Problem & Solution</li>
                      <li>Double Question</li>
                    </ul>
                    <p style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-accent)' }}>
                      Worth 2/3 of the Writing score, so it has much more impact on your writing band.
                    </p>
                  </div>
                </div>

                {/* Four Assessment Criteria */}
                <div style={{ marginTop: '2rem' }}>
                  <p><strong>Writing is assessed on four criteria:</strong></p>
                  <p>Each contributes 25%:</p>
                  <table className="ielts-criteria-table">
                    <thead>
                      <tr>
                        <th>Criteria</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Task Achievement/Response</strong></td>
                        <td>How well you answer the prompt and expand your ideas.</td>
                      </tr>
                      <tr>
                        <td><strong>Coherence & Cohesion</strong></td>
                        <td>The organization of paragraphs and logical connection between ideas.</td>
                      </tr>
                      <tr>
                        <td><strong>Lexical Resource (Vocabulary)</strong></td>
                        <td>The range and accuracy of words and collocations used.</td>
                      </tr>
                      <tr>
                        <td><strong>Grammatical Range & Accuracy</strong></td>
                        <td>The variety of sentence structure and number of grammar mistakes.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Demo Question Action Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="ielts-writing-actions"
            >
              <div
                className="ielts-writing-action-card"
                onClick={handleStartDemo}
              >
                <div className="ielts-writing-action-card__left">
                  <div className="ielts-writing-action-card__icon">
                    <HiPlay size={28} />
                  </div>
                  <div className="ielts-writing-action-card__text">
                    <h3>{language === 'en' ? 'Demo Prompt' : 'ডেমো প্রম্পট'}</h3>
                    <p>
                      {language === 'en'
                        ? 'Try a sample writing prompt to write and submit your response.'
                        : 'উত্তর লেখার ও সাবমিট করার জন্য একটি নমুনা রাইটিং প্রম্পট চেষ্টা করুন।'}
                    </p>
                  </div>
                </div>
                <div className="ielts-writing-action-card__arrow">
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
