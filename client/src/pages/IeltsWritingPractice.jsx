import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiArrowLeft, HiCheckCircle, HiSparkles } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './IeltsWritingPractice.css';

export default function IeltsWritingPractice() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
  });

  const [sets, setSets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState(null);

  // Essay response text state
  const [essayTask1, setEssayTask1] = useState('');
  const [essayTask2, setEssayTask2] = useState('');
  const [wordCount1, setWordCount1] = useState(0);
  const [wordCount2, setWordCount2] = useState(0);

  // Evaluation state
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);

  // Auth Guard
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      navigate('/');
      return;
    }
  }, [navigate]);

  // Fetch writing sets from backend
  useEffect(() => {
    const fetchWritingSets = async () => {
      try {
        const token = localStorage.getItem('topkorbo_token');
        const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${backendBaseUrl}/ielts/writing/sets`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          setSets(resData.data);
        } else {
          setSets([]);
        }
      } catch (err) {
        console.error('Error fetching writing sets:', err);
        setSets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWritingSets();
  }, [language]);

  // Word counter helpers
  useEffect(() => {
    if (!essayTask1.trim()) { setWordCount1(0); return; }
    setWordCount1(essayTask1.trim().split(/\s+/).length);
  }, [essayTask1]);

  useEffect(() => {
    if (!essayTask2.trim()) { setWordCount2(0); return; }
    setWordCount2(essayTask2.trim().split(/\s+/).length);
  }, [essayTask2]);

  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>IELTS Writing Practice is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handleSelectSet = (set) => {
    setSelectedSet(set);
    setEssayTask1('');
    setEssayTask2('');
    setEvaluationResult(null);
    toast.success(language === 'en' ? `Opened ${set.setName}` : `${set.setName} খোলা হয়েছে`);
  };

  const handleEvaluateSet = async () => {
    const hasTask1 = !!selectedSet.task1;
    const hasTask2 = !!selectedSet.task2;

    if (hasTask1 && !essayTask1.trim()) {
      toast.error(language === 'en' ? 'Please type your response for Task 1.' : 'অনুগ্রহ করে টাস্ক ১ এর উত্তর লিখুন।');
      return;
    }
    if (hasTask2 && !essayTask2.trim()) {
      toast.error(language === 'en' ? 'Please type your response for Task 2.' : 'অনুগ্রহ করে টাস্ক ২ এর উত্তর লিখুন।');
      return;
    }

    if (hasTask1 && wordCount1 < 150) {
      toast.error(
        language === 'en'
          ? `Task 1 word count is too low! You wrote ${wordCount1} words (minimum required: 150).`
          : `টাস্ক ১ এর শব্দ সংখ্যা খুব কম! আপনি লিখেছেন ${wordCount1} শব্দ (প্রয়োজনীয় নূন্যতমঃ ১৫০ শব্দ)।`
      );
      return;
    }
    if (hasTask2 && wordCount2 < 250) {
      toast.error(
        language === 'en'
          ? `Task 2 word count is too low! You wrote ${wordCount2} words (minimum required: 250).`
          : `টাস্ক ২ এর শব্দ সংখ্যা খুব কম! আপনি লিখেছেন ${wordCount2} শব্দ (প্রয়োজনীয় নূন্যতমঃ ২৫০ শব্দ)।`
      );
      return;
    }

    setIsEvaluating(true);
    const toastId = toast.loading(language === 'en' ? 'AI is evaluating your writing scripts...' : 'এআই আপনার লেখা মূল্যায়ন করছে...');

    try {
      const token = localStorage.getItem('topkorbo_token');
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${backendBaseUrl}/ielts/writing/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          setId: selectedSet._id,
          task1Answer: essayTask1,
          task2Answer: essayTask2
        })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        setEvaluationResult(resData);
        toast.success(language === 'en' ? 'Evaluation completed!' : 'মূল্যায়ন সম্পন্ন হয়েছে!', { id: toastId });
      } else {
        toast.error(resData.message || 'Evaluation failed.', { id: toastId });
      }
    } catch (err) {
      console.error('Error during AI evaluation:', err);
      toast.error('Network error during AI evaluation.', { id: toastId });
    } finally {
      setIsEvaluating(false);
    }
  };

  const getFullFileUrl = (urlPath) => {
    if (!urlPath) return '';
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const serverRoot = apiBase.replace('/api', '');
    return `${serverRoot}${urlPath}`;
  };

  const renderTaskPrompt = (task, taskLabel) => {
    if (!task) return null;
    return (
      <>
        {task.type === 'pdf' && task.pdfUrl && (
          <div className="ielts-practice-pdf-container" style={{ marginTop: '12px' }}>
            <iframe
              src={getFullFileUrl(task.pdfUrl)}
              width="100%"
              height="500px"
              style={{ border: 'none', borderRadius: '12px' }}
              title={`${taskLabel} PDF Prompt`}
            />
          </div>
        )}
        {task.type === 'image' && task.imageUrl && (
          <div className="ielts-practice-image-container" style={{ marginTop: '12px', textAlign: 'center' }}>
            <img
              src={getFullFileUrl(task.imageUrl)}
              alt={`${taskLabel} Image Prompt`}
              style={{ maxWidth: '100%', maxHeight: '450px', borderRadius: '12px', border: '1px solid rgba(192, 133, 82, 0.15)' }}
            />
          </div>
        )}
        {task.type === 'text' && task.textPrompt && (
          <p style={{ margin: 0, lineHeight: '1.6' }}>{task.textPrompt}</p>
        )}
      </>
    );
  };

  return (
    <div className="ielts-writing-practice-page">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-writing-practice-content">
        {/* Header */}
        <header className="ielts-writing-practice-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(75, 46, 43, 0.08)' }}>
          <button
            onClick={() => navigate('/ielts-prep', { state: { step: 2 } })}
            className="ielts-writing-back-btn"
            title={language === 'en' ? 'Go Back' : 'পিছনে যান'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              borderRadius: '50%',
              transition: 'background-color 0.2s',
              color: 'var(--text-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(75, 46, 43, 0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              {language === 'en' ? 'IELTS Writing Practice' : 'আইইএলটিএস রাইটিং প্র্যাকটিস'}
            </h2>
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-writing-practice-workspace">
          <div className="ielts-writing-practice-container">

            {selectedSet ? (
              /* Writing Room */
              <div className="ielts-writing-practice-panel">
                <div className="ielts-writing-practice-panel-header">
                  <div>
                    <h3>{selectedSet.setName}</h3>
                    <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                      👤 {selectedSet.creator?.name || 'Educator'}
                    </span>
                  </div>
                  <button onClick={() => setSelectedSet(null)} className="ielts-writing-practice-close-btn">
                    {language === 'en' ? 'Back to Sets' : 'সেটগুলোতে ফিরে যান'}
                  </button>
                </div>

                {/* Task 1 */}
                {selectedSet.task1 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div className="ielts-writing-prompt-card">
                      <h4>{language === 'en' ? 'Task 1' : 'টাস্ক ১'} — {language === 'en' ? 'Write at least 150 words' : 'কমপক্ষে ১৫০ শব্দ লিখুন'}</h4>
                      {renderTaskPrompt(selectedSet.task1, 'Task 1')}
                    </div>

                    <div className="ielts-writing-textarea-container">
                      <textarea
                        rows={10}
                        value={essayTask1}
                        onChange={(e) => setEssayTask1(e.target.value)}
                        disabled={isEvaluating || !!evaluationResult}
                        placeholder={language === 'en' ? 'Type your Task 1 response here...' : 'টাস্ক ১ এর উত্তর এখানে লিখুন...'}
                        className="ielts-writing-input-textarea"
                      />
                      <div className="ielts-writing-textarea-footer">
                        <span className="ielts-writing-word-count">
                          {language === 'en' ? 'Word Count: ' : 'শব্দ সংখ্যাঃ '}
                          <strong style={{ color: wordCount1 < 150 ? 'red' : 'green' }}>
                            {wordCount1}
                          </strong> / 150 min
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task 2 */}
                {selectedSet.task2 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div className="ielts-writing-prompt-card">
                      <h4>{language === 'en' ? 'Task 2' : 'টাস্ক ২'} — {language === 'en' ? 'Write at least 250 words' : 'কমপক্ষে ২৫০ শব্দ লিখুন'}</h4>
                      {renderTaskPrompt(selectedSet.task2, 'Task 2')}
                    </div>

                    <div className="ielts-writing-textarea-container">
                      <textarea
                        rows={12}
                        value={essayTask2}
                        onChange={(e) => setEssayTask2(e.target.value)}
                        disabled={isEvaluating || !!evaluationResult}
                        placeholder={language === 'en' ? 'Type your Task 2 response here...' : 'টাস্ক ২ এর উত্তর এখানে লিখুন...'}
                        className="ielts-writing-input-textarea"
                      />
                      <div className="ielts-writing-textarea-footer">
                        <span className="ielts-writing-word-count">
                          {language === 'en' ? 'Word Count: ' : 'শব্দ সংখ্যাঃ '}
                          <strong style={{ color: wordCount2 < 250 ? 'red' : 'green' }}>
                            {wordCount2}
                          </strong> / 250 min
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Evaluation Action Button */}
                {!evaluationResult && (
                  <button
                    onClick={handleEvaluateSet}
                    disabled={isEvaluating}
                    className="ielts-writing-submit-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                    }}
                  >
                    <HiSparkles size={18} />
                    <span>
                      {isEvaluating
                        ? (language === 'en' ? 'Evaluating Answers...' : 'মূল্যায়ন করা হচ্ছে...')
                        : (language === 'en' ? 'Submit for AI Evaluation' : 'এআই মূল্যায়নের জন্য সাবমিট করুন')}
                    </span>
                  </button>
                )}

                {/* AI Evaluation Report Presentation */}
                {evaluationResult && (
                  <div
                    className="ielts-writing-evaluation-results"
                    style={{
                      marginTop: '2rem',
                      padding: '2rem',
                      background: 'rgba(255, 255, 255, 0.98)',
                      borderRadius: '24px',
                      border: '1.5px solid rgba(192, 133, 82, 0.15)',
                      boxShadow: '0 20px 40px rgba(140, 90, 60, 0.08)'
                    }}
                  >
                    <h3
                      style={{
                        margin: '0 0 1.5rem 0',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '2px solid rgba(192, 133, 82, 0.1)',
                        paddingBottom: '1rem'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <HiSparkles style={{ color: '#4f46e5' }} />
                        {language === 'en' ? 'AI Evaluation Report' : 'এআই মূল্যায়ন রিপোর্ট'}
                      </span>
                      <span
                        style={{
                          background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                          color: '#fff',
                          padding: '0.5rem 1.25rem',
                          borderRadius: '50px',
                          fontSize: '1.1rem',
                          fontWeight: '800'
                        }}
                      >
                        {language === 'en'
                          ? `Overall Band Score: ${evaluationResult.overallBandScore}`
                          : `সার্বিক ব্যান্ড স্কোর: ${evaluationResult.overallBandScore}`}
                      </span>
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      {/* Task 1 Evaluation Card */}
                      {evaluationResult.task1Evaluation && (
                        <div
                          style={{
                            background: '#fafbfd',
                            padding: '1.5rem',
                            borderRadius: '16px',
                            border: '1.5px solid rgba(59, 130, 246, 0.12)'
                          }}
                        >
                          <h4
                            style={{
                              margin: '0 0 1rem 0',
                              color: '#1e3a8a',
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '1.1rem',
                              fontWeight: '700'
                            }}
                          >
                            <span>Task 1 Evaluation</span>
                            <span style={{ color: '#2563eb' }}>Band {evaluationResult.task1Evaluation.bandScore}</span>
                          </h4>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                              gap: '1rem',
                              marginBottom: '1.5rem'
                            }}
                          >
                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Task Achievement</span>
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                Band {evaluationResult.task1Evaluation.criteria?.taskAchievement?.score || 0}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.3' }}>
                                {evaluationResult.task1Evaluation.criteria?.taskAchievement?.comments}
                              </p>
                            </div>
                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Coherence & Cohesion</span>
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                Band {evaluationResult.task1Evaluation.criteria?.coherenceCohesion?.score || 0}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.3' }}>
                                {evaluationResult.task1Evaluation.criteria?.coherenceCohesion?.comments}
                              </p>
                            </div>
                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Lexical Resource</span>
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                Band {evaluationResult.task1Evaluation.criteria?.lexicalResource?.score || 0}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.3' }}>
                                {evaluationResult.task1Evaluation.criteria?.lexicalResource?.comments}
                              </p>
                            </div>
                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Grammatical Accuracy</span>
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                Band {evaluationResult.task1Evaluation.criteria?.grammaticalRangeAccuracy?.score || 0}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.3' }}>
                                {evaluationResult.task1Evaluation.criteria?.grammaticalRangeAccuracy?.comments}
                              </p>
                            </div>
                          </div>

                          <div style={{ fontSize: '0.95rem', color: '#334155', lineHeight: '1.6' }}>
                            <p style={{ marginBottom: '1rem' }}>
                              <strong>Narrative Feedback:</strong> {evaluationResult.task1Evaluation.feedback}
                            </p>
                            {evaluationResult.task1Evaluation.suggestions && evaluationResult.task1Evaluation.suggestions.length > 0 && (
                              <div>
                                <strong style={{ color: '#1e3a8a' }}>Suggestions for Betterment:</strong>
                                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {evaluationResult.task1Evaluation.suggestions.map((s, idx) => (
                                    <li key={idx} style={{ color: '#475569' }}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Task 2 Evaluation Card */}
                      {evaluationResult.task2Evaluation && (
                        <div
                          style={{
                            background: '#fafdfb',
                            padding: '1.5rem',
                            borderRadius: '16px',
                            border: '1.5px solid rgba(16, 185, 129, 0.12)'
                          }}
                        >
                          <h4
                            style={{
                              margin: '0 0 1rem 0',
                              color: '#065f46',
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '1.1rem',
                              fontWeight: '700'
                            }}
                          >
                            <span>Task 2 Evaluation</span>
                            <span style={{ color: '#059669' }}>Band {evaluationResult.task2Evaluation.bandScore}</span>
                          </h4>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                              gap: '1rem',
                              marginBottom: '1.5rem'
                            }}
                          >
                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Task Response</span>
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                Band {evaluationResult.task2Evaluation.criteria?.taskAchievement?.score || 0}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.3' }}>
                                {evaluationResult.task2Evaluation.criteria?.taskAchievement?.comments}
                              </p>
                            </div>
                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Coherence & Cohesion</span>
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                Band {evaluationResult.task2Evaluation.criteria?.coherenceCohesion?.score || 0}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.3' }}>
                                {evaluationResult.task2Evaluation.criteria?.coherenceCohesion?.comments}
                              </p>
                            </div>
                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Lexical Resource</span>
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                Band {evaluationResult.task2Evaluation.criteria?.lexicalResource?.score || 0}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.3' }}>
                                {evaluationResult.task2Evaluation.criteria?.lexicalResource?.comments}
                              </p>
                            </div>
                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Grammatical Accuracy</span>
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                Band {evaluationResult.task2Evaluation.criteria?.grammaticalRangeAccuracy?.score || 0}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.3' }}>
                                {evaluationResult.task2Evaluation.criteria?.grammaticalRangeAccuracy?.comments}
                              </p>
                            </div>
                          </div>

                          <div style={{ fontSize: '0.95rem', color: '#334155', lineHeight: '1.6' }}>
                            <p style={{ marginBottom: '1rem' }}>
                              <strong>Narrative Feedback:</strong> {evaluationResult.task2Evaluation.feedback}
                            </p>
                            {evaluationResult.task2Evaluation.suggestions && evaluationResult.task2Evaluation.suggestions.length > 0 && (
                              <div>
                                <strong style={{ color: '#065f46' }}>Suggestions for Betterment:</strong>
                                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {evaluationResult.task2Evaluation.suggestions.map((s, idx) => (
                                    <li key={idx} style={{ color: '#475569' }}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedSet(null)}
                      className="ielts-writing-submit-btn"
                      style={{ background: '#64748b', marginTop: '2rem', display: 'block', alignSelf: 'flex-start' }}
                    >
                      <span>{language === 'en' ? 'Finish Practice' : 'অনুশীলন সম্পন্ন করুন'}</span>
                    </button>
                  </div>
                )}

              </div>
            ) : (
              /* List of sets */
              <div className="ielts-practice-set-grid">
                {isLoading ? (
                  <div style={{ textAlign: 'center', width: '100%', padding: '40px' }}>
                    <p>{language === 'en' ? 'Loading writing sets...' : 'রাইটিং সেট লোড হচ্ছে...'}</p>
                  </div>
                ) : sets.length === 0 ? (
                  <div style={{ textAlign: 'center', width: '100%', padding: '40px' }}>
                    <p style={{ opacity: 0.6 }}>
                      {language === 'en'
                        ? 'No writing sets available yet. Please check back later.'
                        : 'এখনো কোনো রাইটিং সেট পাওয়া যায়নি। অনুগ্রহ করে পরে আবার দেখুন।'}
                    </p>
                  </div>
                ) : (
                  sets.map((set) => (
                    <div key={set._id} className="ielts-practice-set-card">
                      <div className="ielts-practice-set-info">
                        <h3>{set.setName}</h3>
                        <div className="ielts-practice-set-meta">
                          <span>👤 {set.creator?.name || 'Educator'}</span>
                          <span>📑 {[set.task1 && 'Task 1', set.task2 && 'Task 2'].filter(Boolean).join(' & ')}</span>
                          <span>📅 {new Date(set.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button onClick={() => handleSelectSet(set)} className="ielts-practice-set-btn">
                        <span>{language === 'en' ? 'Start Practice' : 'অনুশীলন শুরু করুন'}</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
