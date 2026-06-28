import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiVolumeUp,
  HiBookOpen,
  HiPencilAlt,
  HiChatAlt2,
  HiUpload,
  HiX
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import './IeltsTeacher.css';

export default function IeltsTeacher() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Teacher',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'teacher',
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [activeSegment, setActiveSegment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [questionType, setQuestionType] = useState('mcq');
  const [bandDifficulty, setBandDifficulty] = useState('6.0 - 7.0');
  const [instructions, setInstructions] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [solution, setSolution] = useState('');
  
  // MCQ Options
  const [options, setOptions] = useState([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false }
  ]);

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
        console.error('Error fetching user data in IELTS Teacher:', err);
      }
    };

    fetchUserData();
  }, [navigate]);

  if (user.role !== 'teacher') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>IELTS Teacher Portal is only available for teachers.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const openUploadModal = (segment) => {
    setActiveSegment(segment);
    setShowModal(true);
    // Reset Form
    setInstructions('');
    setQuestionText('');
    setSolution('');
    setQuestionType(segment === 'Listening' || segment === 'Reading' ? 'mcq' : 'essay');
    setOptions([
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ]);
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index].text = value;
    setOptions(newOptions);
  };

  const handleOptionCorrectChange = (index) => {
    const newOptions = options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index
    }));
    setOptions(newOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!questionText.trim()) {
      toast.error(language === 'en' ? 'Please fill in the question text.' : 'অনুগ্রহ করে প্রশ্নের বিবরণ লিখুন।');
      return;
    }

    setIsSubmitting(true);
    // Simulate upload delay
    setTimeout(() => {
      setIsSubmitting(false);
      setShowModal(false);
      toast.success(
        language === 'en'
          ? `IELTS ${activeSegment} question uploaded successfully!`
          : `আইইএলটিএস ${activeSegment} প্রশ্ন সফলভাবে আপলোড হয়েছে!`
      );
    }, 1000);
  };

  return (
    <div className="ielts-teacher-container">
      <Sidebar activeTab="ielts-teacher" user={user} />

      <main className="ielts-teacher-main">
        {/* Header */}
        <header className="ielts-teacher-header">
          <div className="ielts-teacher-header__title">
            <h2>{language === 'en' ? 'IELTS Teacher Portal' : 'আইইএলটিএস টিচার পোর্টাল'}</h2>
            <p>
              {language === 'en'
                ? 'Create, manage, and upload question sheets for IELTS segments.'
                : 'আইইএলটিএস সেগমেন্টের প্রশ্ন তৈরি, পরিচালনা এবং আপলোড করুন।'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.25rem' }}>👨‍🏫</span>
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>
              {language === 'en' ? 'Educator Mode' : 'শিক্ষক প্যানেল'}
            </span>
          </div>
        </header>

        {/* Content Workspace */}
        <div className="ielts-teacher-workspace">
          <div className="ielts-teacher-workspace__body">
            <h1 className="ielts-teacher-section-title">
              {language === 'en' ? 'IELTS Segment Question Bank' : 'আইইএলটিএস সেগমেন্ট প্রশ্ন ব্যাংক'}
            </h1>
            <p className="ielts-teacher-subtitle">
              {language === 'en'
                ? 'Select a segment to add mock test questions, audio transcription references, or writing essay prompts.'
                : 'মক টেস্ট প্রশ্ন, অডিও ট্রান্সক্রিপশন রেফারেন্স অথবা রাইটিং রচনার বিষয় যোগ করতে একটি সেগমেন্ট বেছে নিন।'}
            </p>

            {/* Grid layout containing the 4 segments side-by-side */}
            <div className="ielts-teacher-grid">
              
              {/* Listening Card */}
              <div className="ielts-teacher-card">
                <div>
                  <div className="ielts-teacher-icon"><HiVolumeUp size={32} /></div>
                  <h3>{language === 'en' ? 'Listening' : 'লিসেনিং'}</h3>
                  <p className="ielts-teacher-desc">
                    {language === 'en'
                      ? 'Upload questions, transcripts, and answer sheets. Supports fill-in-the-blanks, MCQs, and labeling tasks.'
                      : 'লিসেনিং প্রশ্ন, ট্রান্সক্রিপ্ট এবং উত্তরপত্র আপলোড করুন। শূন্যস্থান পূরণ, এমসিকিউ এবং লেবেলিং টাস্ক সমর্থন করে।'}
                  </p>
                </div>
                <button className="ielts-upload-btn" onClick={() => navigate('/ielts-teacher/listening/upload')}>
                  <HiUpload size={16} />
                  <span>{language === 'en' ? 'Upload Question' : 'প্রশ্ন আপলোড করুন'}</span>
                </button>
              </div>

              {/* Reading Card */}
              <div className="ielts-teacher-card">
                <div>
                  <div className="ielts-teacher-icon"><HiBookOpen size={32} /></div>
                  <h3>{language === 'en' ? 'Reading' : 'রিডিং'}</h3>
                  <p className="ielts-teacher-desc">
                    {language === 'en'
                      ? 'Input comprehension passages (academic or general) and design corresponding multiple choice or heading matching questions.'
                      : 'রিডিং প্যাসেজ ইনপুট দিন এবং সেই অনুযায়ী মাল্টিপল চয়েস বা হেডিং ম্যাচিং সংক্রান্ত প্রশ্নাবলী ডিজাইন করুন।'}
                  </p>
                </div>
                <button className="ielts-upload-btn" onClick={() => openUploadModal('Reading')}>
                  <HiUpload size={16} />
                  <span>{language === 'en' ? 'Upload Question' : 'প্রশ্ন আপলোড করুন'}</span>
                </button>
              </div>

              {/* Writing Card */}
              <div className="ielts-teacher-card">
                <div>
                  <div className="ielts-teacher-icon"><HiPencilAlt size={32} /></div>
                  <h3>{language === 'en' ? 'Writing' : 'রাইটিং'}</h3>
                  <p className="ielts-teacher-desc">
                    {language === 'en'
                      ? 'Add essay prompts (Task 2) and visual description tasks (Task 1 charts/diagrams) along with high-scoring model answers.'
                      : 'রচনা লেখার টাস্ক এবং চার্ট বা ডায়াগ্রাম বর্ণনার টাস্ক যুক্ত করুন, সাথে আদর্শ মডেল উত্তরপত্রও সরবরাহ করুন।'}
                  </p>
                </div>
                <button className="ielts-upload-btn" onClick={() => openUploadModal('Writing')}>
                  <HiUpload size={16} />
                  <span>{language === 'en' ? 'Upload Question' : 'প্রশ্ন আপলোড করুন'}</span>
                </button>
              </div>

              {/* Speaking Card */}
              <div className="ielts-teacher-card">
                <div>
                  <div className="ielts-teacher-icon"><HiChatAlt2 size={32} /></div>
                  <h3>{language === 'en' ? 'Speaking' : 'স্পিকিং'}</h3>
                  <p className="ielts-teacher-desc">
                    {language === 'en'
                      ? 'Upload speaking prompts, cue cards, and introductory questions. Provide points or structures for band-9 replies.'
                      : 'স্পিকিং প্রম্পট, কিউ কার্ড এবং সাক্ষাৎকার সংক্রান্ত প্রশ্ন যোগ করুন। ব্যান্ড-৯ মানের উত্তরের জন্য রূপরেখা প্রদান করুন।'}
                  </p>
                </div>
                <button className="ielts-upload-btn" onClick={() => openUploadModal('Speaking')}>
                  <HiUpload size={16} />
                  <span>{language === 'en' ? 'Upload Question' : 'প্রশ্ন আপলোড করুন'}</span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Upload Modal Overlay */}
        {showModal && (
          <div className="ielts-modal-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ielts-modal"
            >
              <div className="ielts-modal-header">
                <h2>
                  {language === 'en' 
                    ? `Upload ${activeSegment} Question` 
                    : `${activeSegment} প্রশ্ন আপলোড করুন`}
                </h2>
                <button className="ielts-modal-close" onClick={() => setShowModal(false)}>
                  <HiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="ielts-form">
                
                {/* Form Row: Type and Difficulty */}
                <div className="ielts-form-row">
                  <div className="ielts-form-group">
                    <label>{language === 'en' ? 'Question Type' : 'প্রশ্নের ধরণ'}</label>
                    <select 
                      value={questionType} 
                      onChange={(e) => setQuestionType(e.target.value)}
                      className="ielts-select"
                    >
                      <option value="mcq">{language === 'en' ? 'Multiple Choice (MCQ)' : 'মাল্টিপল চয়েস (MCQ)'}</option>
                      <option value="fill">{language === 'en' ? 'Fill in the Blanks' : 'শূন্যস্থান পূরণ'}</option>
                      <option value="essay">{language === 'en' ? 'Essay/Topic Prompt' : 'রচনা/টপিক প্রম্পট'}</option>
                      <option value="short">{language === 'en' ? 'Short Answer' : 'সংক্ষিপ্ত উত্তর'}</option>
                    </select>
                  </div>

                  <div className="ielts-form-group">
                    <label>{language === 'en' ? 'Difficulty Target (Band)' : 'টার্গেট ব্যান্ড স্কোর'}</label>
                    <select
                      value={bandDifficulty}
                      onChange={(e) => setBandDifficulty(e.target.value)}
                      className="ielts-select"
                    >
                      <option value="4.5 - 5.5">Band 4.5 - 5.5 (Intermediate)</option>
                      <option value="6.0 - 7.0">Band 6.0 - 7.0 (Upper-Intermediate)</option>
                      <option value="7.5 - 9.0">Band 7.5 - 9.0 (Advanced)</option>
                    </select>
                  </div>
                </div>

                {/* Instructions / Context Passage */}
                {(activeSegment === 'Reading' || activeSegment === 'Listening') && (
                  <div className="ielts-form-group">
                    <label>
                      {activeSegment === 'Reading' 
                        ? (language === 'en' ? 'Reading Passage' : 'রিডিং প্যাসেজ') 
                        : (language === 'en' ? 'Listening Transcript Reference' : 'লিসেনিং ট্রান্সক্রিপ্ট রেফারেন্স')}
                    </label>
                    <textarea
                      rows={4}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder={
                        language === 'en'
                          ? 'Paste the passage text or transcript here...'
                          : 'এখানে প্যাসেজ বা অডিওর বিষয়বস্তু লিখুন...'
                      }
                      className="ielts-textarea"
                    />
                  </div>
                )}

                {/* Question Text */}
                <div className="ielts-form-group">
                  <label>{language === 'en' ? 'Question Prompt / Task Description' : 'প্রশ্ন প্রম্পট / টাস্কের বিবরণ'}</label>
                  <textarea
                    rows={3}
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'Enter the question text or essay topic prompt here...'
                        : 'প্রশ্নের মূল টেক্সট বা রচনার টপিক প্রম্পট লিখুন...'
                    }
                    className="ielts-textarea"
                    required
                  />
                </div>

                {/* MCQ Options (Only if type is MCQ) */}
                {questionType === 'mcq' && (
                  <div className="ielts-form-group">
                    <label>{language === 'en' ? 'MCQ Choices (Check the correct option)' : 'এমসিকিউ অপশন (সঠিক অপশনটি চেক করুন)'}</label>
                    <div className="ielts-options-container">
                      {options.map((option, index) => (
                        <div key={index} className="ielts-option-row">
                          <span>{String.fromCharCode(65 + index)}.</span>
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={language === 'en' ? `Option ${String.fromCharCode(65 + index)}` : `অপশন ${String.fromCharCode(65 + index)}`}
                            className="ielts-input"
                            style={{ flex: 1 }}
                            required={questionType === 'mcq'}
                          />
                          <label className="ielts-checkbox-label">
                            <input
                              type="checkbox"
                              checked={option.isCorrect}
                              onChange={() => handleOptionCorrectChange(index)}
                            />
                            {language === 'en' ? 'Correct' : 'সঠিক'}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explanation / Solutions */}
                <div className="ielts-form-group">
                  <label>{language === 'en' ? 'Model Answer / Correct Answer Explanation' : 'আদর্শ উত্তর / সঠিক উত্তরের ব্যাখ্যা'}</label>
                  <textarea
                    rows={3}
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'Provide the correct answer, model answer, or key scoring points...'
                        : 'সঠিক উত্তর বা আদর্শ উত্তরের ব্যাখ্যা এখানে প্রদান করুন...'
                    }
                    className="ielts-textarea"
                  />
                </div>

                {/* Actions */}
                <div className="ielts-modal-actions">
                  <button 
                    type="button" 
                    className="ielts-btn-cancel" 
                    onClick={() => setShowModal(false)}
                    disabled={isSubmitting}
                  >
                    {language === 'en' ? 'Cancel' : 'বাতিল'}
                  </button>
                  <button 
                    type="submit" 
                    className="ielts-btn-submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting 
                      ? (language === 'en' ? 'Uploading...' : 'আপলোড হচ্ছে...') 
                      : (language === 'en' ? 'Upload Question' : 'প্রশ্ন আপলোড করুন')}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
