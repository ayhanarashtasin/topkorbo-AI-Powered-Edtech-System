import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiChatAlt2, HiArrowLeft, HiMicrophone, HiStop } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import './IeltsSpeakingPractice.css';

// Mock IELTS Speaking Sets
const MOCK_SPEAKING_SETS = [
  {
    _id: 'speaking_set_1',
    setName: 'Speaking Mock Test 1: Travel and Home Environment',
    creator: 'TopKorbo Expert Panel',
    createdAt: new Date().toISOString(),
    part1: [
      'Do you like traveling? Why or why not?',
      'What is your favorite place that you have visited?',
      'Would you prefer to travel alone or in a group?'
    ],
    part2Prompt: 'Describe a city or town you would like to visit in the future. You should say: where it is, what you would like to do there, who you would like to go with, and explain why you want to visit this specific place.',
    part3: [
      'What are the advantages and disadvantages of international tourism?',
      'How does travel affect a person\'s cultural perspective?',
      'Do you think modern eco-tourism is truly beneficial for nature?'
    ]
  },
  {
    _id: 'speaking_set_2',
    setName: 'Speaking Mock Test 2: Technology and Everyday Habits',
    creator: 'Dr. S. Rahman',
    createdAt: new Date().toISOString(),
    part1: [
      'How often do you use technology in your daily study routine?',
      'What is your favorite mobile application? Why?',
      'Do you think people spend too much time on their phones nowadays?'
    ],
    part2Prompt: 'Describe a useful piece of technology that you use regularly. You should say: what it is, how long you have had it, what you use it for, and explain how it makes your life easier.',
    part3: [
      'In what ways has technology changed classroom education over the last decade?',
      'Do you believe artificial intelligence will replace human teachers in the future?',
      'What security risks are associated with massive dependency on smart devices?'
    ]
  }
];

export default function IeltsSpeakingPractice() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
  });

  const [selectedSet, setSelectedSet] = useState(null);
  const [activeStep, setActiveStep] = useState(1); // 1 = Part 1, 2 = Part 2 (Cue Card), 3 = Part 3

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrls, setRecordedUrls] = useState({}); // { stepNum: audioUrl }
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Auth Guard
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      navigate('/');
      return;
    }
  }, [navigate]);

  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>IELTS Speaking Practice is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handleSelectSet = (set) => {
    setSelectedSet(set);
    setActiveStep(1);
    setRecordedUrls({});
    setIsRecording(false);
    toast.success(language === 'en' ? `Opened ${set.setName}` : `${set.setName} খোলা হয়েছে`);
  };

  // Start voice recording using MediaRecorder API
  const handleStartRecording = async () => {
    if (isRecording) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);
        
        setRecordedUrls(prev => ({
          ...prev,
          [activeStep]: audioUrl
        }));
        
        // Stop all track streams
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      toast.success(language === 'en' ? 'Recording started... Speak clearly.' : 'রেকর্ডিং শুরু হয়েছে... স্পষ্ট করে কথা বলুন।');
    } catch (err) {
      console.error('Failed to start audio recording:', err);
      toast.error(
        language === 'en'
          ? 'Microphone access denied or not supported.'
          : 'মাইক্রোফোন অ্যাক্সেস পাওয়া যায়নি।'
      );
    }
  };

  // Stop voice recording
  const handleStopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    toast.success(language === 'en' ? 'Recording stopped.' : 'রেকর্ডিং বন্ধ হয়েছে।');
  };

  return (
    <div className="ielts-speaking-practice-page">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-speaking-practice-content">
        {/* Header */}
        <header className="ielts-speaking-practice-header">
          <button 
            onClick={() => navigate('/ielts-prep', { state: { step: 2 } })} 
            className="ielts-speaking-practice-back-btn" 
            title={language === 'en' ? 'Go Back to Prep' : 'পিছনে যান'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-speaking-practice-header-text">
            <h2>{language === 'en' ? 'IELTS Speaking Practice Room' : 'আইইএলটিএস স্পিকিং প্র্যাকটিস রুম'}</h2>
            <p>
              {language === 'en'
                ? 'Practice standard speaking tasks with active voice recording capabilities.'
                : 'ভয়েস রেকর্ডিং ফিচারের সাহায্যে স্ট্যান্ডার্ড স্পিকিং মডিউল অনুশীলন করুন।'}
            </p>
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-speaking-practice-workspace">
          <div className="ielts-speaking-practice-container">
            
            {selectedSet ? (
              /* Speaking Practice dashboard */
              <div className="ielts-speaking-practice-panel">
                <div className="ielts-speaking-practice-panel-header">
                  <div>
                    <h3>{selectedSet.setName}</h3>
                  </div>
                  <button onClick={() => setSelectedSet(null)} className="ielts-speaking-practice-close-btn">
                    {language === 'en' ? 'Back to Tests' : 'সব টেস্টে ফিরে যান'}
                  </button>
                </div>

                {/* Steps Navbar (Part 1, 2, 3) */}
                <div className="ielts-speaking-steps-nav">
                  <button 
                    className={`ielts-speaking-step-btn ${activeStep === 1 ? 'active' : ''}`}
                    onClick={() => { setActiveStep(1); setIsRecording(false); }}
                  >
                    {language === 'en' ? 'Part 1: Intro Questions' : 'পার্ট ১ঃ পরিচিতিমূলক প্রশ্ন'}
                  </button>
                  <button 
                    className={`ielts-speaking-step-btn ${activeStep === 2 ? 'active' : ''}`}
                    onClick={() => { setActiveStep(2); setIsRecording(false); }}
                  >
                    {language === 'en' ? 'Part 2: Cue Card' : 'পার্ট ২ঃ কিউ কার্ড'}
                  </button>
                  <button 
                    className={`ielts-speaking-step-btn ${activeStep === 3 ? 'active' : ''}`}
                    onClick={() => { setActiveStep(3); setIsRecording(false); }}
                  >
                    {language === 'en' ? 'Part 3: Discussion' : 'পার্ট ৩ঃ আলোচনা'}
                  </button>
                </div>

                {/* Body depending on step */}
                <div className="ielts-speaking-step-body" key={activeStep}>
                  {activeStep === 1 && (
                    <div className="ielts-speaking-questions-list">
                      <p style={{ fontWeight: '600', color: 'var(--text-accent)' }}>
                        {language === 'en' ? 'Answer the following introductory questions:' : 'নিচের পরিচিতিমূলক প্রশ্নগুলোর উত্তর দিনঃ'}
                      </p>
                      <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedSet.part1.map((q, idx) => (
                          <li key={idx}><strong>{q}</strong></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="ielts-speaking-cuecard-box">
                      <h4>{language === 'en' ? 'Candidate Cue Card' : 'ক্যান্ডিডেট কিউ কার্ড'}</h4>
                      <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: '1.6', fontStyle: 'italic', textAlign: 'center' }}>
                        {selectedSet.part2Prompt}
                      </p>
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="ielts-speaking-questions-list">
                      <p style={{ fontWeight: '600', color: 'var(--text-accent)' }}>
                        {language === 'en' ? 'Discuss the following analytical questions related to Part 2:' : 'পার্ট ২ সম্পর্কিত নিচের বিশ্লেষণাত্মক প্রশ্নগুলো নিয়ে আলোচনা করুনঃ'}
                      </p>
                      <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedSet.part3.map((q, idx) => (
                          <li key={idx}><strong>{q}</strong></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recorder container */}
                  <div className="ielts-speaking-recorder-box">
                    <span className="ielts-speaking-recording-status">
                      {isRecording 
                        ? (language === 'en' ? '🔴 Recording voice...' : '🔴 কথা রেকর্ড হচ্ছে...') 
                        : (language === 'en' ? 'Record your response' : 'আপনার উত্তরটি রেকর্ড করুন')}
                    </span>
                    
                    {!isRecording ? (
                      <button onClick={handleStartRecording} className="ielts-speaking-record-btn">
                        <HiMicrophone />
                      </button>
                    ) : (
                      <button onClick={handleStopRecording} className="ielts-speaking-record-btn recording">
                        <HiStop />
                      </button>
                    )}

                    {recordedUrls[activeStep] && (
                      <div className="ielts-speaking-audio-player-container">
                        <span>{language === 'en' ? 'Listen to your recording:' : 'আপনার রেকর্ডিংটি শুনুনঃ'}</span>
                        <audio src={recordedUrls[activeStep]} controls />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              /* Lists of sets available */
              <div className="ielts-practice-set-grid">
                {MOCK_SPEAKING_SETS.map((set) => (
                  <div key={set._id} className="ielts-practice-set-card">
                    <div className="ielts-practice-set-info">
                      <h3>{set.setName}</h3>
                      <div className="ielts-practice-set-meta">
                        <span>👤 {set.creator}</span>
                        <span>📑 3 Parts Practice</span>
                      </div>
                    </div>
                    <button onClick={() => handleSelectSet(set)} className="ielts-practice-set-btn">
                      <span>{language === 'en' ? 'Start Test' : 'টেস্ট শুরু করুন'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
