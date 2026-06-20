import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiCheckCircle, HiArrowLeft, HiCalendar, HiClock, HiAcademicCap, HiBookOpen, HiPencilAlt, HiTag } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './MakeContestQuestion.css';
import './MakeContestQuestionNextTwo.css';

export default function MakeContestQuestionConfirm() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const contestData = location.state?.contestData || (() => {
    const saved = sessionStorage.getItem('cc_contestData');
    return saved ? JSON.parse(saved) : null;
  })();

  const confirmedQuestions = location.state?.confirmedQuestions || (() => {
    const saved = sessionStorage.getItem('cc_confirmedQuestions');
    return saved ? JSON.parse(saved) : [];
  })();

  const qbankSelections = location.state?.qbankSelections || (() => {
    const saved = sessionStorage.getItem('cc_qbankSelections');
    return saved ? JSON.parse(saved) : null;
  })();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Auth Guard ──
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { navigate('/'); return; }
    const role = localStorage.getItem('topkorbo_role');
    if (role !== 'teacher') { navigate('/dashboard'); return; }
    if (!contestData) { navigate('/make-contest-question'); return; }
  }, [navigate, contestData]);

  const handleSubmitContest = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      if (!token) {
        toast.error(language === 'en' ? 'Session expired. Please log in.' : 'সেশন শেষ হয়ে গেছে। অনুগ্রহ করে লগইন করুন।');
        setIsSubmitting(false);
        return;
      }

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      const payload = {
        ...contestData,
        qbankSelections,
        confirmedQuestions
      };

      const response = await fetch(`${API_BASE}/contests/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (response.ok) {
        toast.success(language === 'en' ? 'Contest created successfully!' : 'কনটেস্ট সফলভাবে তৈরি হয়েছে!');
        
        // Clear all contest setup session storage items
        sessionStorage.removeItem('cc_contestName');
        sessionStorage.removeItem('cc_contestDate');
        sessionStorage.removeItem('cc_durationHours');
        sessionStorage.removeItem('cc_durationMinutes');
        sessionStorage.removeItem('cc_startHour');
        sessionStorage.removeItem('cc_startMinute');
        sessionStorage.removeItem('cc_startPeriod');
        sessionStorage.removeItem('cc_timezone');
        sessionStorage.removeItem('cc_level');
        sessionStorage.removeItem('cc_selectedSubjects');
        sessionStorage.removeItem('cc_selectedAdmission');
        sessionStorage.removeItem('cc_varsitySubtype');
        sessionStorage.removeItem('cc_questionType');
        sessionStorage.removeItem('cc_contestData');
        sessionStorage.removeItem('cc_qbankSelections');
        sessionStorage.removeItem('cc_confirmedQuestions');
        sessionStorage.removeItem('cc_qbank_step');
        sessionStorage.removeItem('cc_qbank_selectedSubjectIds');
        sessionStorage.removeItem('cc_qbank_selectedChapters');
        sessionStorage.removeItem('cc_qbank_topicsMap');
        sessionStorage.removeItem('cc_qbank_selectedTopics');

        navigate('/dashboard');
      } else {
        toast.error(resData.message || (language === 'en' ? 'Failed to create contest' : 'কনটেস্ট তৈরি করতে ব্যর্থ হয়েছে'));
      }
    } catch (err) {
      console.error('Error creating contest:', err);
      toast.error(language === 'en' ? 'Network error. Please try again.' : 'নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cc-page">
      <Sidebar activeTab="make-contest-question" user={user} />

      <main className="cc-page__content">
        {/* ── Page Header ── */}
        <div className="cc-page__header">
          <div className="cc-page__badge">
            <span className="cc-page__badge-dot"></span>
            {language === 'en' ? 'Step 3: Final Review' : 'ধাপ ৩: চূড়ান্ত পর্যালোচনা'}
          </div>
          <h1 className="cc-page__title">
            {language === 'en' ? 'Confirm Contest & Questions' : 'কনটেস্ট এবং প্রশ্নাবলী নিশ্চিত করুন'}
          </h1>
          <p className="cc-page__subtitle">
            {language === 'en'
              ? 'Review all the details of the contest and the selected question set before publishing.'
              : 'প্রকাশ করার আগে কনটেস্টের সমস্ত বিবরণ এবং নির্বাচিত প্রশ্ন সেট পর্যালোচনা করে নিন।'}
          </p>
        </div>

        {/* ── Summary Layout ── */}
        <div className="cc-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', width: '100%', boxSizing: 'border-box' }} className="cc-confirm-grid">
            
            {/* ── Left Card: Contest Details Summary ── */}
            <section className="cc-section" style={{ height: 'fit-content' }}>
              <div className="cc-section__header">
                <div className="cc-section__icon"><HiTag size={18} /></div>
                <div>
                  <h2 className="cc-section__title">
                    {language === 'en' ? 'Contest Details' : 'কনটেস্টের বিবরণ'}
                  </h2>
                </div>
              </div>

              {contestData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🏷️</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {language === 'en' ? 'Contest Name' : 'কনটেস্টের নাম'}
                      </strong>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {contestData.name}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem' }}><HiCalendar size={20} style={{ color: '#C08552' }} /></span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {language === 'en' ? 'Date' : 'তারিখ'}
                      </strong>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {contestData.date}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem' }}><HiClock size={20} style={{ color: '#C08552' }} /></span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {language === 'en' ? 'Duration' : 'সময়কাল'}
                      </strong>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {contestData.duration?.hours} {language === 'en' ? 'hours' : 'ঘণ্টা'} {contestData.duration?.minutes} {language === 'en' ? 'minutes' : 'মিনিট'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>⏰</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {language === 'en' ? 'Start Time' : 'শুরুর সময়'}
                      </strong>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {contestData.startTime?.hour}:{String(contestData.startTime?.minute).padStart(2, '0')} {contestData.startTime?.period} ({contestData.startTime?.timezone})
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem' }}><HiAcademicCap size={20} style={{ color: '#C08552' }} /></span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {language === 'en' ? 'Standard Level' : 'স্ট্যান্ডার্ড লেভেল'}
                      </strong>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                        {contestData.level} {contestData.admissionType ? `(${contestData.admissionType}${contestData.admissionSubtype ? ` - ${contestData.admissionSubtype === 'arts' ? 'humanities' : contestData.admissionSubtype}` : ''})` : ''}
                      </span>
                    </div>
                  </div>

                  {contestData.subjects && contestData.subjects.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>📚</span>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {language === 'en' ? 'Subjects' : 'বিষয়সমূহ'}
                        </strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                          {contestData.subjects.map(s => (
                            <span key={s} style={{ background: 'rgba(192, 133, 82, 0.1)', color: '#8C5A3C', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>📝</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {language === 'en' ? 'Question Format' : 'প্রশ্নের ফরম্যাট'}
                      </strong>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                        {contestData.questionType}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ── Right Card: Assigned Questions Summary ── */}
            <section className="cc-section" style={{ height: 'fit-content' }}>
              <div className="cc-section__header">
                <div className="cc-section__icon"><HiBookOpen size={18} /></div>
                <div>
                  <h2 className="cc-section__title">
                    {language === 'en' ? 'Assigned Questions' : 'যুক্তকৃত প্রশ্নসমূহ'}
                  </h2>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.25rem' }}>
                
                {/* Manually Created Questions Count */}
                <div style={{ background: '#FFFBF7', border: '1.5px solid rgba(192, 133, 82, 0.15)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <HiPencilAlt size={18} style={{ color: '#8C5A3C' }} />
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {language === 'en' ? 'Manually Drafted Questions' : 'ম্যানুয়ালি তৈরি করা প্রশ্ন'}
                    </strong>
                  </div>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#8C5A3C' }}>
                    {confirmedQuestions.length}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    {language === 'en' ? 'questions drafted locally' : 'টি প্রশ্ন যোগ করা হয়েছে'}
                  </span>
                </div>

                {/* Question Bank Selections Summary */}
                <div style={{ background: '#FFFBF7', border: '1.5px solid rgba(192, 133, 82, 0.15)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <HiBookOpen size={18} style={{ color: '#8C5A3C' }} />
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {language === 'en' ? 'Question Bank Chapters' : 'প্রশ্ন ব্যাংক অধ্যায়সমূহ'}
                    </strong>
                  </div>

                  {qbankSelections && qbankSelections.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {qbankSelections.map((sel, idx) => (
                        <div key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: '700', color: '#8C5A3C' }}>
                            {sel.subject} ({sel.paper}):
                          </span>
                          <span style={{ marginLeft: '0.4rem' }}>
                            {sel.chapters.map(ch => ch.name).join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {language === 'en' ? 'No question bank chapters selected' : 'কোনো প্রশ্ন ব্যাংক অধ্যায় নির্বাচন করা হয়নি'}
                    </span>
                  )}
                </div>

              </div>
            </section>
          </div>

          {/* ── Action buttons bar ── */}
          <div className="cc-submit-bar" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', marginTop: '2rem' }}>
            <button
              type="button"
              onClick={() => navigate('/make-contest-question/next-two', { state: { contestData, qbankSelections } })}
              className="cc-submit-btn"
              disabled={isSubmitting}
              style={{
                background: 'transparent',
                border: '2px solid rgba(192, 133, 82, 0.4)',
                color: '#8C5A3C',
                boxShadow: 'none',
                padding: '0.8rem 2rem'
              }}
            >
              <HiArrowLeft size={18} />
              {language === 'en' ? 'Back to Questions' : 'প্রশ্নাবলী এডিটে ফিরে যান'}
            </button>

            <button
              type="button"
              onClick={handleSubmitContest}
              className="cc-submit-btn cq-create-contest-btn"
              disabled={isSubmitting}
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
              {isSubmitting
                ? (language === 'en' ? 'Submitting...' : 'জমা দেওয়া হচ্ছে...')
                : (language === 'en' ? 'Submit contest details and Questions' : 'কনটেস্টের বিবরণ এবং প্রশ্নাবলী জমা দিন')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
