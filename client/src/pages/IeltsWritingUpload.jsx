import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiPencilAlt, HiArrowLeft } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import './IeltsWritingUpload.css';

export default function IeltsWritingUpload() {
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
    <div className="ielts-writing-upload-page">
      <Sidebar activeTab="ielts-teacher" user={user} />

      <main className="ielts-writing-upload-content">
        {/* Header */}
        <header className="ielts-writing-upload-header">
          <button 
            onClick={() => navigate('/ielts-teacher')} 
            className="ielts-writing-upload-back-btn" 
            title={language === 'en' ? 'Go Back' : 'পিছনে যান'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-writing-upload-header-text">
            <h2>{language === 'en' ? 'Upload Writing Question' : 'রাইটিং প্রশ্ন আপলোড করুন'}</h2>
            <p>
              {language === 'en'
                ? 'Create custom Writing tasks and essay prompts'
                : 'কাস্টম রাইটিং টাস্ক এবং রচনা প্রম্পট তৈরি করুন'}
            </p>
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-writing-upload-workspace">
          <div className="ielts-writing-upload-container">
            <div className="ielts-writing-upload-card">
              <div className="ielts-writing-placeholder-icon">
                <HiPencilAlt />
              </div>
              <h3>
                {language === 'en' 
                  ? 'Writing Question Designer' 
                  : 'রাইটিং প্রশ্ন ডিজাইনার'}
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
