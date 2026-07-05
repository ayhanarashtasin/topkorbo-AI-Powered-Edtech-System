import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiPencilAlt, HiArrowLeft, HiCheckCircle } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import './IeltsWritingPractice.css';

// Mock IELTS Writing Tasks
const MOCK_WRITING_SETS = [
  {
    _id: 'writing_set_1',
    setName: 'Academic Task 1: Global Energy Consumption Chart',
    taskType: 'Task 1',
    creator: 'TopKorbo Prep Team',
    createdAt: new Date().toISOString(),
    promptTitle: 'Task Description',
    promptText: 'The chart below shows the global energy consumption trends from fossil fuels, nuclear energy, and renewable energy resources between 1980 and 2020. Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
    modelAnswer: `The line graph details the trends in global energy consumption from three distinct sources (fossil fuels, nuclear energy, and renewable energy resources) over a forty-year period between 1980 and 2020.

    Overall, fossil fuels remained the dominant source of energy worldwide by a significant margin throughout the entire timeline, despite showing a slight stabilization in the final decade. In contrast, both nuclear and renewable energy resources experienced slow but steady upward trajectories.

    In 1980, fossil fuel consumption stood at approximately 120 quadrillion BTUs, which was significantly higher than nuclear energy (5 quadrillion BTUs) and renewable energy (under 2 quadrillion BTUs). Over the next three decades, energy consumption from fossil fuels rose sharply, peaking at roughly 180 quadrillion BTUs in 2010 before plateauing through to 2020.

    Concurrently, nuclear energy experienced a moderate increase, rising to nearly 25 quadrillion BTUs by 2005, where it leveled off. Renewable energy resources started as the lowest source but grew continuously, overtaking nuclear energy around 2015 and reaching a peak of approximately 28 quadrillion BTUs in 2020.`,
    minWords: 150
  },
  {
    _id: 'writing_set_2',
    setName: 'Academic Task 2: Free University Education',
    taskType: 'Task 2',
    creator: 'Prof. S. Rahman',
    createdAt: new Date().toISOString(),
    promptTitle: 'Essay Topic Prompt',
    promptText: 'Some people argue that university education should be free for everyone, regardless of their financial background. Others believe that students should pay for their own higher education since it benefits them personally. Discuss both views and give your opinion. Write at least 250 words.',
    modelAnswer: `The debate surrounding the funding of higher education is highly contentious, with arguments split between advocates of fully subsidized tertiary systems and proponents of tuition fees paid by students. While there are clear personal benefits to university degrees, I believe higher education should be free as it acts as an engine for social mobility and national growth.

    On the one hand, supporters of tuition fees argue that higher education is an investment that primarily yields personal, private rewards. Graduates generally secure higher-paying jobs, enjoy better career progression, and experience improved living standards compared to non-graduates. From this perspective, it is reasonable to expect students to bear the financial cost of their studies rather than placing the tax burden on general citizens, many of whom may not have attended university themselves. Additionally, tuition fees supply universities with critical funds to maintain state-of-the-art facilities and secure top-tier academic staff.

    On the other hand, there are compelling reasons why government-funded higher education is vital. Firstly, high tuition fees act as a major deterrent for talented students from low-income households. Making universities free ensures equal opportunities, allowing individuals to succeed based on academic merit rather than their family wealth. Secondly, a highly educated workforce is immensely beneficial to society as a whole. Countries with high rates of tertiary education see increased innovation, stronger economic productivity, and higher tax revenues in the long term, which offsets the initial cost of public funding. For instance, public healthcare, engineering projects, and research rely on graduates whose skills enrich the entire community.

    In conclusion, although the personal advantages of a degree support the case for private funding, the societal benefits of an accessible higher education system are far greater. Removing financial barriers to university studies ensures equality of opportunity and drives national development.`,
    minWords: 250
  }
];

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
  const [essayText, setEssayText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

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
          const dbTasks = [];
          resData.data.forEach(set => {
            if (set.task1) {
              dbTasks.push({
                _id: `${set._id}_task1`,
                setName: `${set.setName} - Task 1`,
                taskType: 'Task 1',
                creator: set.creator?.name || 'Educator',
                createdAt: set.createdAt,
                promptTitle: 'Writing Task 1',
                promptText: set.task1.type === 'text' ? set.task1.textPrompt : (set.task1.type === 'image' ? 'Image Prompt (see below)' : 'PDF Document prompt (see viewer)'),
                pdfUrl: set.task1.type === 'pdf' ? set.task1.pdfUrl : null,
                imageUrl: set.task1.type === 'image' ? set.task1.imageUrl : null,
                minWords: 150,
                modelAnswer: 'This is a student-submitted task. Band-9 model answer is not available.',
              });
            }
            if (set.task2) {
              dbTasks.push({
                _id: `${set._id}_task2`,
                setName: `${set.setName} - Task 2`,
                taskType: 'Task 2',
                creator: set.creator?.name || 'Educator',
                createdAt: set.createdAt,
                promptTitle: 'Writing Task 2',
                promptText: set.task2.type === 'text' ? set.task2.textPrompt : (set.task2.type === 'image' ? 'Image Prompt (see below)' : 'PDF Document prompt (see viewer)'),
                pdfUrl: set.task2.type === 'pdf' ? set.task2.pdfUrl : null,
                imageUrl: set.task2.type === 'image' ? set.task2.imageUrl : null,
                minWords: 250,
                modelAnswer: 'This is a student-submitted task. Band-9 model answer is not available.',
              });
            }
          });

          // Merge custom sets with local mock ones
          setSets([...dbTasks, ...MOCK_WRITING_SETS]);
        } else {
          setSets(MOCK_WRITING_SETS);
        }
      } catch (err) {
        console.error('Error fetching writing sets:', err);
        setSets(MOCK_WRITING_SETS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWritingSets();
  }, [language]);

  // Get full backend static file URL
  const getFullFileUrl = (urlPath) => {
    if (!urlPath) return '';
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const serverRoot = apiBase.replace('/api', '');
    return `${serverRoot}${urlPath}`;
  };

  // Word counter helper
  useEffect(() => {
    if (!essayText.trim()) {
      setWordCount(0);
      return;
    }
    const words = essayText.trim().split(/\s+/);
    setWordCount(words.length);
  }, [essayText]);

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
    setEssayText('');
    setIsSubmitted(false);
    toast.success(language === 'en' ? `Opened ${set.setName}` : `${set.setName} খোলা হয়েছে`);
  };

  const handleSubmitEssay = () => {
    if (wordCount < selectedSet.minWords) {
      toast.error(
        language === 'en'
          ? `Word count is too low! You wrote ${wordCount} words (minimum required: ${selectedSet.minWords}).`
          : `শব্দ সংখ্যা খুব কম! আপনি লিখেছেন ${wordCount} শব্দ (প্রয়োজনীয় নূন্যতমঃ ${selectedSet.minWords} শব্দ)।`
      );
      return;
    }

    setIsSubmitted(true);
    toast.success(
      language === 'en' 
        ? 'Response submitted! Review the band-9 model answer below.' 
        : 'উত্তর সাবমিট হয়েছে! নিচের ব্যান্ড-৯ মডেল উত্তরটি পর্যালোচনা করুন।'
    );
  };

  return (
    <div className="ielts-writing-practice-page">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-writing-practice-content">
        {/* Header */}
        <header className="ielts-writing-practice-header">
          <button 
            onClick={() => navigate('/ielts-prep', { state: { step: 2 } })} 
            className="ielts-writing-practice-back-btn" 
            title={language === 'en' ? 'Go Back to Prep' : 'পিছনে যান'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-writing-practice-header-text">
            <h2>{language === 'en' ? 'IELTS Writing Practice Room' : 'আইইএলটিএস রাইটিং প্র্যাকটিস রুম'}</h2>
            <p>
              {language === 'en'
                ? 'Practice essay tasks and report drafts with benchmark model answers.'
                : 'মডেল উত্তরের সাহায্যে রচনার বিবরণ এবং রিপোর্টের খসড়া অনুশীলন করুন।'}
            </p>
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-writing-practice-workspace">
          <div className="ielts-writing-practice-container">
            
            {selectedSet ? (
              /* Writing Room interface */
              <div className="ielts-writing-practice-panel">
                <div className="ielts-writing-practice-panel-header">
                  <div>
                    <h3>{selectedSet.setName}</h3>
                  </div>
                  <button onClick={() => setSelectedSet(null)} className="ielts-writing-practice-close-btn">
                    {language === 'en' ? 'Back to Tasks' : 'সব টাস্কে ফিরে যান'}
                  </button>
                </div>

                 {/* Prompt box */}
                 <div className="ielts-writing-prompt-card">
                   <h4>{selectedSet.promptTitle} ({selectedSet.taskType})</h4>
                   {selectedSet.pdfUrl && (
                     <div className="ielts-practice-pdf-container" style={{ marginTop: '12px' }}>
                       <iframe 
                         src={getFullFileUrl(selectedSet.pdfUrl)} 
                         width="100%" 
                         height="500px" 
                         style={{ border: 'none', borderRadius: '12px' }} 
                         title="Writing Task PDF Prompt"
                       />
                     </div>
                   )}
                   {selectedSet.imageUrl && (
                     <div className="ielts-practice-image-container" style={{ marginTop: '12px', textAlign: 'center' }}>
                       <img 
                         src={getFullFileUrl(selectedSet.imageUrl)} 
                         alt="Writing Task Image Prompt"
                         style={{ maxWidth: '100%', maxHeight: '450px', borderRadius: '12px', border: '1px solid rgba(192, 133, 82, 0.15)' }} 
                       />
                     </div>
                   )}
                   {!selectedSet.pdfUrl && !selectedSet.imageUrl && (
                     <p style={{ margin: 0, lineHeight: '1.6' }}>{selectedSet.promptText}</p>
                   )}
                 </div>

                {/* Editor Textarea */}
                <div className="ielts-writing-textarea-container">
                  <textarea
                    rows={12}
                    value={essayText}
                    onChange={(e) => setEssayText(e.target.value)}
                    disabled={isSubmitted}
                    placeholder={
                      language === 'en'
                        ? 'Type your response here...'
                        : 'আপনার উত্তর এখানে টাইপ করুন...'
                    }
                    className="ielts-writing-input-textarea"
                  />
                  <div className="ielts-writing-textarea-footer">
                    <span className="ielts-writing-word-count">
                      {language === 'en' ? `Word Count: ` : `শব্দ সংখ্যাঃ `}
                      <strong style={{ color: wordCount < selectedSet.minWords ? 'red' : 'green' }}>
                        {wordCount}
                      </strong> / {selectedSet.minWords} min
                    </span>
                  </div>
                </div>

                {/* Submission action */}
                {!isSubmitted ? (
                  <button onClick={handleSubmitEssay} className="ielts-writing-submit-btn">
                    <HiCheckCircle size={18} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                    <span style={{ verticalAlign: 'middle' }}>{language === 'en' ? 'Submit Answer' : 'উত্তর সাবমিট করুন'}</span>
                  </button>
                ) : (
                  /* Model Answer Review */
                  <div className="ielts-writing-model-answer-box">
                    <h4>{language === 'en' ? 'Band 9 Model Answer' : 'ব্যান্ড-৯ মডেল উত্তর'}</h4>
                    <div className="ielts-writing-model-text">{selectedSet.modelAnswer}</div>
                    
                    <button 
                      onClick={() => setSelectedSet(null)} 
                      className="ielts-writing-submit-btn" 
                      style={{ background: '#64748b', marginTop: '1.5rem', alignSelf: 'flex-start' }}
                    >
                      <span>{language === 'en' ? 'Finish Practice' : 'অনুশীলন সম্পন্ন করুন'}</span>
                    </button>
                  </div>
                )}

              </div>
            ) : (
              /* Lists of sets available */
              <div className="ielts-practice-set-grid">
                {isLoading ? (
                  <div style={{ textAlign: 'center', width: '100%', padding: '40px' }}>
                    <p>{language === 'en' ? 'Loading writing tasks...' : 'রাইটিং টাস্ক লোড হচ্ছে...'}</p>
                  </div>
                ) : (
                  sets.map((set) => (
                    <div key={set._id} className="ielts-practice-set-card">
                      <div className="ielts-practice-set-info">
                        <h3>{set.setName}</h3>
                        <div className="ielts-practice-set-meta">
                          <span>👤 {set.creator}</span>
                          <span>📑 {set.taskType}</span>
                          <span>✍️ {set.minWords}+ words</span>
                        </div>
                      </div>
                      <button onClick={() => handleSelectSet(set)} className="ielts-practice-set-btn">
                        <span>{language === 'en' ? 'Start Task' : 'টাস্ক শুরু করুন'}</span>
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
