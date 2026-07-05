import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiPencilAlt, HiArrowLeft, HiUpload, HiCheckCircle, HiX, HiDocumentText, HiPhotograph } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
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

  const getFullFileUrl = (urlPath) => {
    if (!urlPath) return '';
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const serverRoot = apiBase.replace('/api', '');
    return `${serverRoot}${urlPath}`;
  };

  const [setName, setSetName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('bank'); // 'bank' or 'upload'
  const [dbSets, setDbSets] = useState([]);
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [selectedSetForDetails, setSelectedSetForDetails] = useState(null);

  // Task 1 and Task 2 states
  const [task1Type, setTask1Type] = useState('text'); // 'pdf', 'text', or 'image'
  const [task1Text, setTask1Text] = useState('');
  const [task1Pdf, setTask1Pdf] = useState(null);
  const [task1Image, setTask1Image] = useState(null);

  const [task2Type, setTask2Type] = useState('text'); // 'pdf', 'text', or 'image'
  const [task2Text, setTask2Text] = useState('');
  const [task2Pdf, setTask2Pdf] = useState(null);
  const [task2Image, setTask2Image] = useState(null);

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

  // Fetch writing sets
  const fetchSets = async () => {
    try {
      setIsLoadingSets(true);
      const token = localStorage.getItem('topkorbo_token');
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${backendBaseUrl}/ielts/writing/sets`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        setDbSets(resData.data || []);
      }
    } catch (err) {
      console.error('Error fetching writing sets:', err);
    } finally {
      setIsLoadingSets(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'bank') {
      fetchSets();
    }
  }, [viewMode]);

  const handleFileChange = (task, type, file) => {
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (type === 'pdf') {
      if (ext !== '.pdf') {
        toast.error(
          language === 'en'
            ? 'Only PDF files are allowed'
            : 'শুধুমাত্র পিডিএফ ফাইল আপলোড করা যাবে'
        );
        return;
      }
      if (task === 1) {
        setTask1Pdf(file);
      } else {
        setTask2Pdf(file);
      }
    } else if (type === 'image') {
      const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      if (!allowedExts.includes(ext)) {
        toast.error(
          language === 'en'
            ? 'Only image files are allowed (.png, .jpg, .jpeg, .webp, .gif)'
            : 'শুধুমাত্র ইমেজ ফাইল আপলোড করা যাবে (.png, .jpg, .jpeg, .webp, .gif)'
        );
        return;
      }
      if (task === 1) {
        setTask1Image(file);
      } else {
        setTask2Image(file);
      }
    }
  };

  const handleRemoveFile = (task, type) => {
    if (task === 1) {
      if (type === 'pdf') setTask1Pdf(null);
      else setTask1Image(null);
    } else {
      if (type === 'pdf') setTask2Pdf(null);
      else setTask2Image(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!setName.trim()) {
      toast.error(
        language === 'en'
          ? 'Please provide a Question Set Name'
          : 'অনুগ্রহ করে প্রশ্ন সেটের নাম দিন'
      );
      return;
    }

    // Task 1 validations
    if (task1Type === 'pdf' && !task1Pdf) {
      toast.error(
        language === 'en'
          ? 'Please upload a PDF file for Task 1'
          : 'অনুগ্রহ করে টাস্ক ১-এর জন্য একটি পিডিএফ ফাইল আপলোড করুন'
      );
      return;
    }
    if (task1Type === 'image' && !task1Image) {
      toast.error(
        language === 'en'
          ? 'Please upload a picture file for Task 1'
          : 'অনুগ্রহ করে টাস্ক ১-এর জন্য একটি ছবি আপলোড করুন'
      );
      return;
    }
    if (task1Type === 'text' && !task1Text.trim()) {
      toast.error(
        language === 'en'
          ? 'Please enter a text prompt for Task 1'
          : 'অনুগ্রহ করে টাস্ক ১-এর জন্য টেক্সট প্রম্পট লিখুন'
      );
      return;
    }

    // Task 2 validations
    if (task2Type === 'pdf' && !task2Pdf) {
      toast.error(
        language === 'en'
          ? 'Please upload a PDF file for Task 2'
          : 'অনুগ্রহ করে টাস্ক ২-এর জন্য একটি পিডিএফ ফাইল আপলোড করুন'
      );
      return;
    }
    if (task2Type === 'image' && !task2Image) {
      toast.error(
        language === 'en'
          ? 'Please upload a picture file for Task 2'
          : 'অনুগ্রহ করে টাস্ক ২-এর জন্য একটি ছবি আপলোড করুন'
      );
      return;
    }
    if (task2Type === 'text' && !task2Text.trim()) {
      toast.error(
        language === 'en'
          ? 'Please enter a text prompt for Task 2'
          : 'অনুগ্রহ করে টাস্ক ২-এর জন্য টেক্সট প্রম্পট লিখুন'
      );
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      language === 'en'
        ? 'Uploading writing question set to server...'
        : 'সার্ভারে রাইটিং প্রশ্ন সেট আপলোড করা হচ্ছে...'
    );

    try {
      const token = localStorage.getItem('topkorbo_token');
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      const formData = new FormData();
      formData.append('setName', setName.trim());
      formData.append('task1Type', task1Type);
      formData.append('task2Type', task2Type);

      if (task1Type === 'pdf') {
        formData.append('task1Pdf', task1Pdf);
      } else if (task1Type === 'image') {
        formData.append('task1Image', task1Image);
      } else {
        formData.append('task1Text', task1Text.trim());
      }

      if (task2Type === 'pdf') {
        formData.append('task2Pdf', task2Pdf);
      } else if (task2Type === 'image') {
        formData.append('task2Image', task2Image);
      } else {
        formData.append('task2Text', task2Text.trim());
      }

      const response = await fetch(`${backendBaseUrl}/ielts/writing/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        toast.success(
          language === 'en'
            ? 'IELTS Writing question set submitted successfully!'
            : 'আইইএলটিএস রাইটিং প্রশ্ন সেট সফলভাবে সাবমিট হয়েছে!',
          { id: toastId }
        );
        setSetName('');
        setTask1Text('');
        setTask2Text('');
        setTask1Pdf(null);
        setTask2Pdf(null);
        setTask1Image(null);
        setTask2Image(null);
        setViewMode('bank');
      } else {
        toast.error(
          resData.message || (language === 'en' ? 'Failed to upload question set.' : 'প্রশ্ন সেট আপলোড করতে ব্যর্থ হয়েছে।'),
          { id: toastId }
        );
      }
    } catch (err) {
      console.error('Error submitting writing set:', err);
      toast.error(
        language === 'en' ? 'Network error. Please try again.' : 'নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।',
        { id: toastId }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ielts-writing-upload-page">
      <Sidebar activeTab="ielts-teacher" user={user} />

      <main className="ielts-writing-upload-content">
        {/* Header */}
        <header className="ielts-writing-upload-header">
          <button
            onClick={() => {
              if (viewMode === 'upload') {
                setViewMode('bank');
              } else {
                navigate('/ielts-teacher');
              }
            }}
            className="ielts-writing-upload-back-btn"
            title={language === 'en' ? 'Go Back' : 'পিছনে যান'}
            disabled={isSubmitting}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-writing-upload-header-text">
            {viewMode === 'bank' ? (
              <>
                <h2>{language === 'en' ? 'Writing Question Bank' : 'রাইটিং প্রশ্ন ব্যাংক'}</h2>
                <p>
                  {language === 'en'
                    ? 'Manage and view all your uploaded IELTS writing question sheets'
                    : 'আপনার আপলোডকৃত আইইএলটিএস রাইটিং প্রশ্নপত্রগুলো পরিচালনা এবং দেখুন'}
                </p>
              </>
            ) : (
              <>
                <h2>{language === 'en' ? 'Upload Writing Question Set' : 'রাইটিং প্রশ্ন সেট আপলোড করুন'}</h2>
                <p>
                  {language === 'en'
                    ? 'Create a custom Writing question set with Tasks 1 & 2 using PDF documents or text prompts.'
                    : 'পিডিএফ ডকুমেন্ট অথবা টেক্সট প্রম্পট ব্যবহার করে টাস্ক ১ এবং টাস্ক ২ সম্বলিত কাস্টম রাইটিং প্রশ্ন সেট তৈরি করুন।'}
                </p>
              </>
            )}
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-writing-upload-workspace">
          {viewMode === 'bank' ? (
            <div className="ielts-writing-upload-container">
              <div className="ielts-bank-header">
                <h3>{language === 'en' ? 'Available Question Sets' : 'বিদ্যমান প্রশ্ন সেটসমূহ'}</h3>
                <button
                  type="button"
                  className="ielts-writing-submit-btn-cta"
                  style={{ padding: '12px 24px', fontSize: '0.95rem', borderRadius: '50px', margin: 0 }}
                  onClick={() => setViewMode('upload')}
                >
                  <HiUpload size={16} style={{ marginRight: '6px' }} />
                  <span>{language === 'en' ? 'Upload new question' : 'নতুন প্রশ্ন আপলোড করুন'}</span>
                </button>
              </div>

              {isLoadingSets ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                  <p>{language === 'en' ? 'Loading question bank...' : 'প্রশ্ন ব্যাংক লোড হচ্ছে...'}</p>
                </div>
              ) : dbSets.length === 0 ? (
                <div className="ielts-bank-empty">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontStyle: 'italic' }}>
                    {language === 'en' ? 'No question sets uploaded yet.' : 'এখনো কোনো প্রশ্ন সেট আপলোড করা হয়নি।'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="ielts-bank-grid">
                    {dbSets.map((set) => (
                      <div 
                        key={set._id} 
                        className="ielts-bank-card"
                        onClick={() => setSelectedSetForDetails(set)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="ielts-bank-card-info">
                          <h4>{set.setName}</h4>
                          <div className="ielts-bank-card-meta">
                            <span>👤 {set.creator?.name || 'Educator'}</span>
                            <span>📅 {new Date(set.createdAt).toLocaleDateString()}</span>
                            <span>📝 Task 1 ({set.task1?.type}), Task 2 ({set.task2?.type})</span>
                          </div>
                          <button 
                            type="button"
                            className="ielts-view-clean-btn"
                            style={{
                              marginTop: '12px',
                              background: 'rgba(192, 133, 82, 0.08)',
                              border: '1px solid rgba(192, 133, 82, 0.15)',
                              color: 'var(--text-primary)',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s',
                              alignSelf: 'flex-start'
                            }}
                          >
                            <span>{language === 'en' ? 'View Question Set' : 'প্রশ্ন বিবরণী দেখুন'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedSetForDetails && (
                    <div className="ielts-clean-modal-overlay" onClick={() => setSelectedSetForDetails(null)}>
                      <div className="ielts-clean-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="ielts-clean-modal-header">
                          <h3>{selectedSetForDetails.setName}</h3>
                          <button type="button" className="ielts-clean-modal-close" onClick={() => setSelectedSetForDetails(null)}>
                            <HiX size={20} />
                          </button>
                        </div>
                        <div className="ielts-clean-modal-body">
                          {/* Task 1 Section */}
                          <div className="ielts-clean-task-section">
                            <h4>Task 1 ({selectedSetForDetails.task1?.type === 'text' ? (language === 'en' ? 'Text' : 'টেক্সট') : selectedSetForDetails.task1?.type === 'pdf' ? 'PDF' : (language === 'en' ? 'Image' : 'ছবি')})</h4>
                            
                            <div className="ielts-original-prompt-container">
                              {selectedSetForDetails.task1?.type === 'pdf' && selectedSetForDetails.task1?.pdfUrl && (
                                <div className="ielts-modal-pdf-container">
                                  <iframe 
                                    src={getFullFileUrl(selectedSetForDetails.task1.pdfUrl)} 
                                    width="100%" 
                                    height="380px" 
                                    style={{ border: '1px solid rgba(192, 133, 82, 0.15)', borderRadius: '12px' }} 
                                    title="Task 1 PDF"
                                  />
                                </div>
                              )}

                              {selectedSetForDetails.task1?.type === 'image' && selectedSetForDetails.task1?.imageUrl && (
                                <div className="ielts-modal-image-container" style={{ textAlign: 'center' }}>
                                  <img 
                                    src={getFullFileUrl(selectedSetForDetails.task1.imageUrl)} 
                                    alt="Task 1 Prompt"
                                    style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '12px', border: '1px solid rgba(192, 133, 82, 0.15)' }} 
                                  />
                                </div>
                              )}

                              {selectedSetForDetails.task1?.type === 'text' && (
                                <div className="ielts-clean-prompt-box">
                                  {selectedSetForDetails.task1?.textPrompt}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Task 2 Section */}
                          <div className="ielts-clean-task-section" style={{ marginTop: '24px' }}>
                            <h4>Task 2 ({selectedSetForDetails.task2?.type === 'text' ? (language === 'en' ? 'Text' : 'টেক্সট') : selectedSetForDetails.task2?.type === 'pdf' ? 'PDF' : (language === 'en' ? 'Image' : 'ছবি')})</h4>
                            
                            <div className="ielts-original-prompt-container">
                              {selectedSetForDetails.task2?.type === 'pdf' && selectedSetForDetails.task2?.pdfUrl && (
                                <div className="ielts-modal-pdf-container">
                                  <iframe 
                                    src={getFullFileUrl(selectedSetForDetails.task2.pdfUrl)} 
                                    width="100%" 
                                    height="380px" 
                                    style={{ border: '1px solid rgba(192, 133, 82, 0.15)', borderRadius: '12px' }} 
                                    title="Task 2 PDF"
                                  />
                                </div>
                              )}

                              {selectedSetForDetails.task2?.type === 'image' && selectedSetForDetails.task2?.imageUrl && (
                                <div className="ielts-modal-image-container" style={{ textAlign: 'center' }}>
                                  <img 
                                    src={getFullFileUrl(selectedSetForDetails.task2.imageUrl)} 
                                    alt="Task 2 Prompt"
                                    style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '12px', border: '1px solid rgba(192, 133, 82, 0.15)' }} 
                                  />
                                </div>
                              )}

                              {selectedSetForDetails.task2?.type === 'text' && (
                                <div className="ielts-clean-prompt-box">
                                  {selectedSetForDetails.task2?.textPrompt}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="ielts-writing-upload-container">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>

                {/* Question Set Title Card */}
                <div className="ielts-writing-upload-card">
                  <h3>{language === 'en' ? 'General Information' : 'সাধারণ তথ্য'}</h3>
                  <div className="ielts-writing-input-group">
                    <label htmlFor="set-name-input">
                      {language === 'en' ? 'Question Set Name / Title' : 'প্রশ্ন সেটের নাম / শিরোনাম'}
                    </label>
                    <input
                      id="set-name-input"
                      type="text"
                      value={setName}
                      onChange={(e) => setSetName(e.target.value)}
                      placeholder={
                        language === 'en'
                          ? 'e.g. Cambridge IELTS 18 Writing Practice 1'
                          : 'যেমনঃ ক্যামব্রিজ আইইএলটিএস ১৮ রাইটিং প্র্যাকটিস ১'
                      }
                      className="ielts-writing-set-name-input"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Task 1 Upload Card */}
                <div className="ielts-writing-upload-card text-left">
                  <div className="ielts-writing-card-header">
                    <h3>{language === 'en' ? 'Writing Task 1 (Academic or General)' : 'রাইটিং টাস্ক ১ (একাডেমিক অথবা জেনারেল)'}</h3>
                    <div className="ielts-writing-toggle-group">
                      <button
                        type="button"
                        className={`ielts-writing-toggle-btn ${task1Type === 'text' ? 'active' : ''}`}
                        onClick={() => setTask1Type('text')}
                        disabled={isSubmitting}
                      >
                        {language === 'en' ? 'Text Prompt' : 'টেক্সট প্রম্পট'}
                      </button>
                      <button
                        type="button"
                        className={`ielts-writing-toggle-btn ${task1Type === 'pdf' ? 'active' : ''}`}
                        onClick={() => setTask1Type('pdf')}
                        disabled={isSubmitting}
                      >
                        {language === 'en' ? 'PDF Upload' : 'পিডিএফ আপলোড'}
                      </button>
                      <button
                        type="button"
                        className={`ielts-writing-toggle-btn ${task1Type === 'image' ? 'active' : ''}`}
                        onClick={() => setTask1Type('image')}
                        disabled={isSubmitting}
                      >
                        {language === 'en' ? 'Picture Upload' : 'ছবি আপলোড'}
                      </button>
                    </div>
                  </div>

                  <div className="ielts-writing-card-body">
                    {task1Type === 'text' && (
                      <div className="ielts-writing-input-group">
                        <label htmlFor="task1-text-input">
                          {language === 'en' ? 'Task 1 Essay Prompt Text' : 'টাস্ক ১ রচনা প্রম্পট টেক্সট'}
                        </label>
                        <textarea
                          id="task1-text-input"
                          rows={6}
                          value={task1Text}
                          onChange={(e) => setTask1Text(e.target.value)}
                          placeholder={
                            language === 'en'
                              ? 'Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.'
                              : 'প্রধান বৈশিষ্ঠ্যগুলো উল্লেখ করে তথ্যটি সংক্ষেপ করুন এবং প্রয়োজন অনুযায়ী তুলনা করুন। নূন্যতম ১৫০ শব্দ লিখুন।'
                          }
                          className="ielts-writing-set-textarea"
                          disabled={isSubmitting}
                        />
                      </div>
                    )}

                    {task1Type === 'pdf' && (
                      <div className="ielts-writing-file-group">
                        {task1Pdf ? (
                          <div className="ielts-writing-file-uploaded">
                            <button
                              type="button"
                              className="ielts-writing-remove-file-btn"
                              onClick={() => handleRemoveFile(1, 'pdf')}
                              disabled={isSubmitting}
                            >
                              <HiX size={16} />
                            </button>
                            <HiDocumentText size={32} className="ielts-writing-file-icon success" />
                            <span className="ielts-writing-file-status">
                              {language === 'en' ? 'PDF Selected' : 'পিডিএফ সিলেক্টেড'}
                            </span>
                            <span className="ielts-writing-file-name">{task1Pdf.name}</span>
                          </div>
                        ) : (
                          <div className="ielts-writing-file-dropzone">
                            <HiUpload size={32} className="ielts-writing-file-icon" />
                            <span className="ielts-writing-file-label">
                              {language === 'en' ? 'Upload Task 1 PDF Document' : 'টাস্ক ১ পিডিএফ ডকুমেন্ট আপলোড করুন'}
                            </span>
                            <span className="ielts-writing-file-sublabel">(.pdf only)</span>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleFileChange(1, 'pdf', e.target.files[0])}
                              className="ielts-writing-file-input"
                              disabled={isSubmitting}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {task1Type === 'image' && (
                      <div className="ielts-writing-file-group">
                        {task1Image ? (
                          <div className="ielts-writing-file-uploaded">
                            <button
                              type="button"
                              className="ielts-writing-remove-file-btn"
                              onClick={() => handleRemoveFile(1, 'image')}
                              disabled={isSubmitting}
                            >
                              <HiX size={16} />
                            </button>
                            <img
                              src={URL.createObjectURL(task1Image)}
                              alt="Task 1 Preview"
                              className="ielts-writing-image-preview"
                            />
                            <span className="ielts-writing-file-status">
                              {language === 'en' ? 'Image Selected' : 'ছবি সিলেক্টেড'}
                            </span>
                            <span className="ielts-writing-file-name">{task1Image.name}</span>
                          </div>
                        ) : (
                          <div className="ielts-writing-file-dropzone">
                            <HiPhotograph size={32} className="ielts-writing-file-icon" />
                            <span className="ielts-writing-file-label">
                              {language === 'en' ? 'Upload Task 1 Picture' : 'টাস্ক ১ ছবি আপলোড করুন'}
                            </span>
                            <span className="ielts-writing-file-sublabel">(.png, .jpg, .jpeg, .webp, .gif)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange(1, 'image', e.target.files[0])}
                              className="ielts-writing-file-input"
                              disabled={isSubmitting}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Task 2 Upload Card */}
                <div className="ielts-writing-upload-card text-left">
                  <div className="ielts-writing-card-header">
                    <h3>{language === 'en' ? 'Writing Task 2 (Essay Prompt)' : 'রাইটিং টাস্ক ২ (রচনা প্রম্পট)'}</h3>
                    <div className="ielts-writing-toggle-group">
                      <button
                        type="button"
                        className={`ielts-writing-toggle-btn ${task2Type === 'text' ? 'active' : ''}`}
                        onClick={() => setTask2Type('text')}
                        disabled={isSubmitting}
                      >
                        {language === 'en' ? 'Text Prompt' : 'টেক্সট প্রম্পট'}
                      </button>
                      <button
                        type="button"
                        className={`ielts-writing-toggle-btn ${task2Type === 'pdf' ? 'active' : ''}`}
                        onClick={() => setTask2Type('pdf')}
                        disabled={isSubmitting}
                      >
                        {language === 'en' ? 'PDF Upload' : 'পিডিএফ আপলোড'}
                      </button>
                      <button
                        type="button"
                        className={`ielts-writing-toggle-btn ${task2Type === 'image' ? 'active' : ''}`}
                        onClick={() => setTask2Type('image')}
                        disabled={isSubmitting}
                      >
                        {language === 'en' ? 'Picture Upload' : 'ছবি আপলোড'}
                      </button>
                    </div>
                  </div>

                  <div className="ielts-writing-card-body">
                    {task2Type === 'text' && (
                      <div className="ielts-writing-input-group">
                        <label htmlFor="task2-text-input">
                          {language === 'en' ? 'Task 2 Essay Prompt Text' : 'টাস্ক ২ রচনা প্রম্পট টেক্সট'}
                        </label>
                        <textarea
                          id="task2-text-input"
                          rows={6}
                          value={task2Text}
                          onChange={(e) => setTask2Text(e.target.value)}
                          placeholder={
                            language === 'en'
                              ? 'Discuss both views and give your opinion. Write at least 250 words.'
                              : 'উভয় দৃষ্টিভঙ্গি আলোচনা করে আপনার মতামত দিন। নূন্যতম ২৫০ শব্দ লিখুন।'
                          }
                          className="ielts-writing-set-textarea"
                          disabled={isSubmitting}
                        />
                      </div>
                    )}

                    {task2Type === 'pdf' && (
                      <div className="ielts-writing-file-group">
                        {task2Pdf ? (
                          <div className="ielts-writing-file-uploaded">
                            <button
                              type="button"
                              className="ielts-writing-remove-file-btn"
                              onClick={() => handleRemoveFile(2, 'pdf')}
                              disabled={isSubmitting}
                            >
                              <HiX size={16} />
                            </button>
                            <HiDocumentText size={32} className="ielts-writing-file-icon success" />
                            <span className="ielts-writing-file-status">
                              {language === 'en' ? 'PDF Selected' : 'পিডিএফ সিলেক্টেড'}
                            </span>
                            <span className="ielts-writing-file-name">{task2Pdf.name}</span>
                          </div>
                        ) : (
                          <div className="ielts-writing-file-dropzone">
                            <HiUpload size={32} className="ielts-writing-file-icon" />
                            <span className="ielts-writing-file-label">
                              {language === 'en' ? 'Upload Task 2 PDF Document' : 'টাস্ক ২ পিডিএফ ডকুমেন্ট আপলোড করুন'}
                            </span>
                            <span className="ielts-writing-file-sublabel">(.pdf only)</span>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleFileChange(2, 'pdf', e.target.files[0])}
                              className="ielts-writing-file-input"
                              disabled={isSubmitting}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {task2Type === 'image' && (
                      <div className="ielts-writing-file-group">
                        {task2Image ? (
                          <div className="ielts-writing-file-uploaded">
                            <button
                              type="button"
                              className="ielts-writing-remove-file-btn"
                              onClick={() => handleRemoveFile(2, 'image')}
                              disabled={isSubmitting}
                            >
                              <HiX size={16} />
                            </button>
                            <img
                              src={URL.createObjectURL(task2Image)}
                              alt="Task 2 Preview"
                              className="ielts-writing-image-preview"
                            />
                            <span className="ielts-writing-file-status">
                              {language === 'en' ? 'Image Selected' : 'ছবি সিলেক্টেড'}
                            </span>
                            <span className="ielts-writing-file-name">{task2Image.name}</span>
                          </div>
                        ) : (
                          <div className="ielts-writing-file-dropzone">
                            <HiPhotograph size={32} className="ielts-writing-file-icon" />
                            <span className="ielts-writing-file-label">
                              {language === 'en' ? 'Upload Task 2 Picture' : 'টাস্ক ২ ছবি আপলোড করুন'}
                            </span>
                            <span className="ielts-writing-file-sublabel">(.png, .jpg, .jpeg, .webp, .gif)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange(2, 'image', e.target.files[0])}
                              className="ielts-writing-file-input"
                              disabled={isSubmitting}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Question Set Button */}
                <div className="ielts-writing-submit-container">
                  <button
                    type="submit"
                    className="ielts-writing-submit-btn-cta"
                    disabled={isSubmitting}
                  >
                    <HiCheckCircle size={22} />
                    <span>
                      {isSubmitting
                        ? (language === 'en' ? 'Submitting Question Set...' : 'প্রশ্ন সেট সাবমিট হচ্ছে...')
                        : (language === 'en' ? 'Submit Question Set' : 'প্রশ্ন সেট সাবমিট করুন')}
                    </span>
                  </button>
                </div>

              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

