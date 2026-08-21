import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiCheckCircle, HiArrowLeft, HiPlusCircle, HiDocumentText } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import './MakeContestQuestion.css'; // Reuse form styles

export default function MakeContestQuestionNext() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const contestData = location.state?.contestData || (() => {
    const saved = sessionStorage.getItem('cc_contestData');
    return saved ? JSON.parse(saved) : null;
  })();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { navigate('/'); return; }
    const role = localStorage.getItem('topkorbo_role');
    if (role !== 'teacher') { navigate('/dashboard'); return; }
    // If no contest data was passed, redirect back to the create contest page
    if (!contestData) { navigate('/make-contest-question'); return; }
  }, [navigate, contestData]);

  return (
    <div className="cc-page">
      <Sidebar activeTab="make-contest-question" user={user} />

      <main className="cc-page__content">
        {/* ── Page Header ── */}
        <div className="cc-page__header">
          <div className="cc-page__badge">
            <span className="cc-page__badge-dot"></span>
            Step 2: Add Questions
          </div>
        </div>

        {/* ── Info Card ── */}
        <div className="cc-form">
          <section className="cc-section" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'rgba(192, 133, 82, 0.1)',
              color: '#C08552',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              border: '1.2px solid rgba(192, 133, 82, 0.2)'
            }}>
              <HiDocumentText size={32} />
            </div>
            
            <h2 className="cc-section__title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              {language === 'en' ? 'Contest Details Saved!' : 'কনটেস্টের তথ্য সংরক্ষিত!'}
            </h2>
            
            <p className="cc-section__desc" style={{ maxWidth: '500px', margin: '0 auto 2rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
              {language === 'en'
                ? 'Your contest information has been captured. The question builder for this page will be implemented next.'
                : 'আপনার কনটেস্টের তথ্য সংরক্ষণ করা হয়েছে। এই পেজের প্রশ্ন বিল্ডার শীঘ্রই যুক্ত করা হবে।'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/make-contest-question')}
                className="cc-submit-btn"
                style={{
                  background: 'transparent',
                  border: '2px solid rgba(192, 133, 82, 0.4)',
                  color: '#8C5A3C',
                  boxShadow: 'none',
                  padding: '0.8rem 2rem'
                }}
              >
                <HiArrowLeft size={18} />
                {language === 'en' ? 'Back to Contest Setup' : 'কনটেস্ট সেটআপে ফিরে যান'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/make-contest-question/next-two', { state: { contestData } })}
                className="cc-submit-btn"
                style={{ padding: '0.8rem 2rem' }}
              >
                <HiPlusCircle size={18} />
                {language === 'en' ? 'Create Question' : 'প্রশ্ন তৈরি করুন'}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
