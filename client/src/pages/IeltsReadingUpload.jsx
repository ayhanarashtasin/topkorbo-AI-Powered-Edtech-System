import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiBookOpen, HiArrowLeft, HiUpload } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import './IeltsReadingUpload.css';

const MOCK_READING_SETS = [
  {
    _id: 'reading_mock_1',
    setName: 'Academic Reading: The Future of Artificial Intelligence',
    creator: 'TopKorbo Prep Team',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    passagesCount: 3,
  },
  {
    _id: 'reading_mock_2',
    setName: 'General Reading: Workplace Communication & Team Safety',
    creator: 'Prof. S. Rahman',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    passagesCount: 3,
  }
];

export default function IeltsReadingUpload() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Teacher',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'teacher',
  });

  const [viewMode, setViewMode] = useState('bank'); // 'bank' or 'upload'

  // Auth Guard
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      navigate('/');
      return;
    }
    const role = localStorage.getItem('topkorbo_role');
    if (role !== 'teacher') {
      navigate('/dashboard');
      return;
    }
  }, [navigate]);

  return (
    <div className="ielts-reading-upload-page">
      <Sidebar activeTab="ielts-teacher" user={user} />

      <main className="ielts-reading-upload-content">
        {/* Header */}
        <header className="ielts-reading-upload-header">
          <button 
            onClick={() => {
              if (viewMode === 'upload') {
                setViewMode('bank');
              } else {
                navigate('/ielts-teacher');
              }
            }} 
            className="ielts-reading-upload-back-btn" 
            title={language === 'en' ? 'Go Back' : 'পিছনে যান'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-reading-upload-header-text">
            {viewMode === 'bank' ? (
              <>
                <h2>{language === 'en' ? 'Reading Question Bank' : 'রিডিং প্রশ্ন ব্যাংক'}</h2>
                <p>
                  {language === 'en'
                    ? 'Manage and view all your uploaded IELTS reading passages'
                    : 'আপনার আপলোডকৃত আইইএলটিএস রিডিং প্যাসেজগুলো পরিচালনা এবং দেখুন'}
                </p>
              </>
            ) : (
              <>
                <h2>{language === 'en' ? 'Upload Reading Question' : 'রিডিং প্রশ্ন আপলোড করুন'}</h2>
                <p>
                  {language === 'en'
                    ? 'Create custom Reading comprehension passages and questions'
                    : 'কাস্টম রিডিং কম্প্রিহেনশন প্যাসেজ এবং প্রশ্নাবলী তৈরি করুন'}
                </p>
              </>
            )}
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-reading-upload-workspace">
          {viewMode === 'bank' ? (
            <div className="ielts-reading-upload-container">
              <div className="ielts-bank-header">
                <h3>{language === 'en' ? 'Available Question Sets' : 'বিদ্যমান প্রশ্ন সেটসমূহ'}</h3>
                <button 
                  type="button" 
                  className="ielts-reading-submit-btn-cta" 
                  style={{ 
                    padding: '12px 24px', 
                    fontSize: '0.95rem', 
                    borderRadius: '50px', 
                    margin: 0,
                    background: 'var(--gradient-cta)',
                    color: 'var(--white)',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }} 
                  onClick={() => setViewMode('upload')}
                >
                  <HiUpload size={16} />
                  <span>{language === 'en' ? 'Upload new question' : 'নতুন প্রশ্ন আপলোড করুন'}</span>
                </button>
              </div>

              <div className="ielts-bank-grid">
                {MOCK_READING_SETS.map((set) => (
                  <div key={set._id} className="ielts-bank-card">
                    <div className="ielts-bank-card-info">
                      <h4>{set.setName}</h4>
                      <div className="ielts-bank-card-meta">
                        <span>👤 {set.creator}</span>
                        <span>📅 {new Date(set.createdAt).toLocaleDateString()}</span>
                        <span>📖 {set.passagesCount} Passages</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ielts-reading-upload-container">
              <div className="ielts-reading-upload-card">
                <div className="ielts-reading-placeholder-icon">
                  <HiBookOpen />
                </div>
                <h3>
                  {language === 'en' 
                    ? 'Reading Question Designer' 
                    : 'রিডিং প্রশ্ন ডিজাইনার'}
                </h3>
                <p>
                  {language === 'en'
                    ? 'This new page is ready to be customized! Please provide the details of what should appear here, and I will build it according to your specifications.'
                    : 'এই নতুন পেজটি কাস্টমাইজেশনের জন্য প্রস্তুত! অনুগ্রহ করে এখানে কী কী থাকবে তা জানান, আমি আপনার নির্দেশাবলি অনুযায়ী তা তৈরি করে দেব।'}
                </p>
                <button 
                  type="button" 
                  onClick={() => setViewMode('bank')} 
                  className="ielts-reading-submit-btn-cta" 
                  style={{ 
                    padding: '10px 20px', 
                    fontSize: '0.88rem', 
                    borderRadius: '50px', 
                    border: '1.5px solid rgba(75, 46, 43, 0.2)',
                    fontWeight: 700,
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {language === 'en' ? 'Back to Question Bank' : 'প্রশ্ন ব্যাংকে ফিরে যান'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
