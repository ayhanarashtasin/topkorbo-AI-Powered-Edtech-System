import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiBookOpen, HiArrowLeft } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import './IeltsReadingUpload.css';

export default function IeltsReadingUpload() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Teacher',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'teacher',
  });

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
            onClick={() => navigate('/ielts-teacher')} 
            className="ielts-reading-upload-back-btn" 
            title={language === 'en' ? 'Go Back' : 'পিছনে যান'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-reading-upload-header-text">
            <h2>{language === 'en' ? 'Upload Reading Question' : 'রিডিং প্রশ্ন আপলোড করুন'}</h2>
            <p>
              {language === 'en'
                ? 'Create custom Reading comprehension passages and questions'
                : 'কাস্টম রিডিং কম্প্রিহেনশন প্যাসেজ এবং প্রশ্নাবলী তৈরি করুন'}
            </p>
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-reading-upload-workspace">
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
