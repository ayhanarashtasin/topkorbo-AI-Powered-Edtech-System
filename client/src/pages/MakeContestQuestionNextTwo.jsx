import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiArrowLeft, HiPlusCircle, HiBookOpen, HiPencilAlt, HiPhotograph, HiX, HiSearch, HiCheckCircle } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './MakeContestQuestion.css';
import './MakeContestQuestionNextTwo.css';



export default function MakeContestQuestionNextTwo() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const contestData = location.state?.contestData || (() => {
    const saved = sessionStorage.getItem('cc_contestData');
    return saved ? JSON.parse(saved) : null;
  })();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const qbankSelections = location.state?.qbankSelections || (() => {
    const saved = sessionStorage.getItem('cc_qbankSelections');
    return saved ? JSON.parse(saved) : null;
  })();

  // Persist qbankSelections when received via router state
  useEffect(() => {
    if (location.state?.qbankSelections) {
      sessionStorage.setItem('cc_qbankSelections', JSON.stringify(location.state.qbankSelections));
    }
  }, [location.state?.qbankSelections]);

  // ── UI State ──
  const [confirmedQuestions, setConfirmedQuestions] = useState(() => {
    const saved = sessionStorage.getItem('cc_confirmedQuestions');
    return saved ? JSON.parse(saved) : [];
  });

  const [showOptions, setShowOptions] = useState(() => {
    const savedConfirmed = sessionStorage.getItem('cc_confirmedQuestions');
    const hasConfirmed = savedConfirmed ? JSON.parse(savedConfirmed).length > 0 : false;
    return location.state?.showOptions || hasConfirmed || false;
  });       // "Add Question" clicked → show 2 options
  const [activeOption, setActiveOption] = useState('');          // 'new'
  const [questionText, setQuestionText] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);     // Array of { file, preview }

  // ── Auth Guard ──
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { navigate('/'); return; }
    const role = localStorage.getItem('topkorbo_role');
    if (role !== 'teacher') { navigate('/dashboard'); return; }
    if (!contestData) { navigate('/make-contest-question'); return; }
  }, [navigate, contestData]);

  // ── Handlers ──
  const handleAddQuestion = () => {
    setShowOptions(true);
  };

  const handleChooseQBank = () => {
    navigate('/make-contest-question/choose-qbank', { state: { contestData, qbankSelections } });
  };

  const handleAddNew = () => {
    setActiveOption('new');
  };

  const handleBackToOptions = () => {
    setActiveOption('');
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleConfirmQuestion = async () => {
    if (!questionText.trim() && uploadedImages.length === 0) {
      toast.error(language === 'en' ? 'Please add question text or upload an image.' : 'অনুগ্রহ করে প্রশ্নের টেক্সট লিখুন অথবা ছবি আপলোড করুন।');
      return;
    }

    try {
      const imageBase64s = [];
      for (const img of uploadedImages) {
        if (img.file) {
          const base64 = await fileToBase64(img.file);
          imageBase64s.push(base64);
        } else if (img.preview) {
          imageBase64s.push(img.preview);
        }
      }

      const newQ = {
        id: Date.now(),
        text: questionText.trim(),
        images: imageBase64s
      };

      const updated = [...confirmedQuestions, newQ];
      setConfirmedQuestions(updated);
      sessionStorage.setItem('cc_confirmedQuestions', JSON.stringify(updated));

      // Reset fields
      setQuestionText('');
      setUploadedImages([]);
      
      // Jump back to options page (previous page)
      setActiveOption('');
      setShowOptions(true);
      toast.success(language === 'en' ? 'Question saved temporarily!' : 'প্রশ্ন সাময়িকভাবে সংরক্ষণ করা হয়েছে!');
    } catch (err) {
      console.error('Error confirming question:', err);
      toast.error(language === 'en' ? 'Failed to process images.' : 'ছবি প্রক্রিয়া করতে ব্যর্থ হয়েছে।');
    }
  };

  const handleRemoveConfirmedQuestion = (index) => {
    const updated = confirmedQuestions.filter((_, idx) => idx !== index);
    setConfirmedQuestions(updated);
    sessionStorage.setItem('cc_confirmedQuestions', JSON.stringify(updated));
    toast.success(language === 'en' ? 'Question removed.' : 'প্রশ্ন মুছে ফেলা হয়েছে।');
  };

  const handleConfirmContestQuestion = () => {
    navigate('/make-contest-question/confirm', {
      state: {
        contestData,
        confirmedQuestions,
        qbankSelections
      }
    });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setUploadedImages(prev => [...prev, ...newImages]);
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index) => {
    setUploadedImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };



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
          <h1 className="cc-page__title">
            {language === 'en' ? 'Create Questions' : 'প্রশ্ন তৈরি করুন'}
          </h1>
          <p className="cc-page__subtitle">
            {language === 'en'
              ? 'Add questions to your contest from the question bank or create new ones.'
              : 'প্রশ্ন ব্যাংক থেকে অথবা নতুন প্রশ্ন তৈরি করে আপনার কনটেস্টে প্রশ্ন যোগ করুন।'}
          </p>
        </div>

        {/* ── Content ── */}
        <div className="cc-form">

          {/* ═══════ Confirmed Questions List ═══════ */}
          {confirmedQuestions.length > 0 && !activeOption && (
            <section className="cc-section cq-confirmed-list-section cq-section--animated">
              <div className="cq-options-header" style={{ marginBottom: '1.25rem' }}>
                <h3 className="cc-section__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  📝 {language === 'en' ? 'Uploaded Questions' : 'আপলোডকৃত প্রশ্নসমূহ'}
                </h3>
                <p className="cc-section__desc" style={{ marginTop: '0.25rem' }}>
                  {language === 'en'
                    ? 'Review the questions you have added to this contest so far.'
                    : 'আপনার কনটেস্টে এ পর্যন্ত যোগ করা প্রশ্নসমূহ দেখে নিন।'}
                </p>
              </div>

              <div className="cq-confirmed-questions-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {confirmedQuestions.map((q, idx) => (
                  <div key={q.id || idx} className="cq-confirmed-question-card" style={{
                    background: '#FFFBF7',
                    border: '1.5px solid rgba(192, 133, 82, 0.2)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    position: 'relative',
                    boxShadow: '0 4px 15px rgba(192, 133, 82, 0.04)'
                  }}>
                    {/* Header: Question Number & Delete Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{
                        background: 'rgba(192, 133, 82, 0.15)',
                        color: '#8C5A3C',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        padding: '0.3rem 0.8rem',
                        borderRadius: '20px',
                        letterSpacing: '0.5px'
                      }}>
                        {language === 'en' ? `Question ${idx + 1}` : `প্রশ্ন ${idx + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveConfirmedQuestion(idx)}
                        style={{
                          background: 'rgba(220, 50, 50, 0.08)',
                          color: '#DC3232',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 50, 50, 0.15)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220, 50, 50, 0.08)' }}
                      >
                        <HiX size={14} />
                        {language === 'en' ? 'Remove' : 'মুছে ফেলুন'}
                      </button>
                    </div>

                    {/* Question Text */}
                    {q.text && (
                      <p style={{
                        margin: '0 0 1rem 0',
                        fontSize: '0.95rem',
                        color: 'var(--text-primary)',
                        lineHeight: '1.6',
                        fontWeight: '500',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {q.text}
                      </p>
                    )}

                    {/* Question Images */}
                    {q.images && q.images.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {q.images.map((imgSrc, imgIdx) => (
                          <div key={imgIdx} style={{
                            width: '140px',
                            height: '100px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1.5px solid rgba(192, 133, 82, 0.15)',
                            background: '#fff'
                          }}>
                            <img src={imgSrc} alt={`Question ${idx + 1} Image ${imgIdx + 1}`} style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══════ Initial: "Add Question" Button ═══════ */}
          {!showOptions && (
            <section className="cc-section cq-add-section" onClick={handleAddQuestion}>
              <div className="cq-add-trigger">
                <div className="cq-add-trigger__icon">
                  <HiPlusCircle size={32} />
                </div>
                <div className="cq-add-trigger__text">
                  <h3>{language === 'en' ? 'Add Question' : 'প্রশ্ন যোগ করুন'}</h3>
                  <p>{language === 'en'
                    ? 'Click here to add a question to your contest'
                    : 'আপনার কনটেস্টে প্রশ্ন যোগ করতে এখানে ক্লিক করুন'}</p>
                </div>
              </div>
            </section>
          )}

          {/* ═══════ After "Add Question" → Two Options ═══════ */}
          {showOptions && !activeOption && (
            <section className="cc-section cq-options-section">
              <div className="cq-options-header">
                <h3 className="cc-section__title">
                  {language === 'en' ? 'How would you like to add a question?' : 'আপনি কিভাবে প্রশ্ন যোগ করতে চান?'}
                </h3>
                <p className="cc-section__desc">
                  {language === 'en'
                    ? 'Choose from existing questions or create a new one.'
                    : 'বিদ্যমান প্রশ্ন থেকে বেছে নিন অথবা একটি নতুন তৈরি করুন।'}
                </p>
              </div>

              <div className="cq-options-grid">
                {/* Option 1: Choose from Question Bank */}
                <button type="button" className="cq-option-card" onClick={handleChooseQBank}>
                  <div className="cq-option-card__icon">
                    <HiBookOpen size={28} />
                  </div>
                  <h4 className="cq-option-card__title">
                    {language === 'en' ? 'Choose from Question Bank' : 'প্রশ্ন ব্যাংক থেকে বেছে নিন'}
                  </h4>
                  <p className="cq-option-card__desc">
                    {language === 'en'
                      ? 'Browse and select from your existing question library'
                      : 'আপনার বিদ্যমান প্রশ্ন লাইব্রেরি ব্রাউজ করুন এবং নির্বাচন করুন'}
                  </p>
                </button>

                {/* Option 2: Add New Question */}
                <button type="button" className="cq-option-card" onClick={handleAddNew}>
                  <div className="cq-option-card__icon cq-option-card__icon--new">
                    <HiPencilAlt size={28} />
                  </div>
                  <h4 className="cq-option-card__title">
                    {language === 'en' ? 'Add New Question' : 'নতুন প্রশ্ন যোগ করুন'}
                  </h4>
                  <p className="cq-option-card__desc">
                    {language === 'en'
                      ? 'Write a new question with text and/or upload diagrams'
                      : 'টেক্সট এবং/অথবা ডায়াগ্রাম আপলোড করে নতুন প্রশ্ন লিখুন'}
                  </p>
                </button>
              </div>
            </section>
          )}

          {/* ═══════ Selected Question Bank Chapters ═══════ */}
          {qbankSelections && qbankSelections.length > 0 && (
            <section className="cc-section cq-selection-summary-card">
              <div className="cq-section-top-bar" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="cc-section__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  📚 {language === 'en' ? 'Selected Chapters' : 'নির্বাচিত অধ্যায়সমূহ'}
                </h3>
                <button
                  type="button"
                  className="cq-back-btn"
                  onClick={handleChooseQBank}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1.5px solid rgba(192, 133, 82, 0.25)', borderRadius: '8px', background: '#FFFBF7', color: '#8C5A3C' }}
                >
                  ✏️ {language === 'en' ? 'Edit Selection' : 'পরিবর্তন করুন'}
                </button>
              </div>

              <div className="cq-selected-chapters-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {qbankSelections.map((sel, idx) => (
                  <div key={idx} style={{
                    background: '#FFFBF7',
                    border: '1.2px solid rgba(192, 133, 82, 0.15)',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 800, color: '#8C5A3C', fontSize: '0.95rem' }}>
                        {sel.subject} ({sel.paper === '1st' ? (language === 'en' ? '1st paper' : '১ম পত্র') : (language === 'en' ? '2nd paper' : '২য় পত্র')})
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {sel.chapters.map((ch, cidx) => (
                        <span key={cidx} style={{
                          background: 'rgba(192, 133, 82, 0.08)',
                          border: '1px solid rgba(192, 133, 82, 0.15)',
                          borderRadius: '999px',
                          padding: '0.3rem 0.8rem',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#8C5A3C',
                        }}>
                          {ch.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══════ Option 2 Expanded: Add New Question ═══════ */}
          {activeOption === 'new' && (
            <section className="cc-section cq-new-section cq-section--animated">
              <div className="cq-section-top-bar">
                <button type="button" className="cq-back-btn" onClick={handleBackToOptions}>
                  <HiArrowLeft size={16} />
                  {language === 'en' ? 'Back' : 'ফিরে যান'}
                </button>
                <h3 className="cc-section__title" style={{ margin: 0 }}>
                  ✏️ {language === 'en' ? 'Add New Question' : 'নতুন প্রশ্ন যোগ করুন'}
                </h3>
              </div>

              {/* Text Input Area */}
              <div className="cq-new-field">
                <label className="cc-label">
                  {language === 'en' ? 'Question Text' : 'প্রশ্নের টেক্সট'}
                </label>
                <textarea
                  className="cc-input cq-new-textarea"
                  placeholder={language === 'en'
                    ? 'Type your question here...'
                    : 'এখানে আপনার প্রশ্ন লিখুন...'}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  rows={5}
                />
              </div>

              {/* Image / Diagram Upload */}
              <div className="cq-new-field">
                <label className="cc-label">
                  {language === 'en' ? 'Diagram / Image (optional)' : 'ডায়াগ্রাম / ছবি (ঐচ্ছিক)'}
                </label>

                <div
                  className="cq-upload-zone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <HiPhotograph size={32} className="cq-upload-zone__icon" />
                  <p className="cq-upload-zone__text">
                    {language === 'en'
                      ? 'Click to upload images or diagrams'
                      : 'ছবি বা ডায়াগ্রাম আপলোড করতে ক্লিক করুন'}
                  </p>
                  <span className="cq-upload-zone__hint">
                    PNG, JPG, JPEG, GIF, SVG
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={handleImageUpload}
                  />
                </div>

                {/* Preview Uploaded Images */}
                {uploadedImages.length > 0 && (
                  <div className="cq-upload-previews">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="cq-upload-preview">
                        <img src={img.preview} alt={`Upload ${idx + 1}`} />
                        <button
                          type="button"
                          className="cq-upload-preview__remove"
                          onClick={() => handleRemoveImage(idx)}
                        >
                          <HiX size={14} />
                        </button>
                        <span className="cq-upload-preview__name">
                          {img.file.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Submit/Back bar ── */}
          <div className="cc-submit-bar" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
            <button
              type="button"
              onClick={() => {
                if (activeOption === 'new') {
                  handleBackToOptions();
                } else if (showOptions && confirmedQuestions.length === 0) {
                  setShowOptions(false);
                } else {
                  navigate('/make-contest-question/next', { state: { contestData } });
                }
              }}
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
              {language === 'en' ? 'Back' : 'ফিরে যান'}
            </button>

            {activeOption === 'new' && (
              <button
                type="button"
                onClick={handleConfirmQuestion}
                className="cc-submit-btn cq-confirm-btn"
                style={{
                  background: '#C08552',
                  border: 'none',
                  color: '#fff',
                  padding: '0.8rem 2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(192, 133, 82, 0.2)'
                }}
              >
                <HiCheckCircle size={20} />
                {language === 'en' ? 'Confirm Question' : 'প্রশ্ন নিশ্চিত করুন'}
              </button>
            )}

            {!activeOption && (confirmedQuestions.length > 0 || (qbankSelections && qbankSelections.length > 0)) && (
              <button
                type="button"
                onClick={handleConfirmContestQuestion}
                className="cc-submit-btn cq-create-contest-btn"
                style={{
                  background: '#8C5A3C',
                  border: 'none',
                  color: '#fff',
                  padding: '0.8rem 2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(140, 90, 60, 0.2)'
                }}
              >
                <HiCheckCircle size={20} />
                {language === 'en' ? 'Confirm Contest Question' : 'কনটেস্টের প্রশ্ন নিশ্চিত করুন'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
