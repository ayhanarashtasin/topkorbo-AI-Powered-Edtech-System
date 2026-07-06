import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiVolumeUp, HiArrowLeft, HiArrowRight } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import './IeltsListeningPractice.css';

export default function IeltsListeningPractice() {
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
  const [activeSection, setActiveSection] = useState(1); // 1 to 4

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
        console.error('Error fetching user data in Listening Practice:', err);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Fetch Listening Sets
  useEffect(() => {
    const fetchSets = async () => {
      try {
        const token = localStorage.getItem('topkorbo_token');
        const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${backendBaseUrl}/ielts/listening/sets`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          setSets(resData.data || []);
        } else {
          toast.error(resData.message || (language === 'en' ? 'Failed to load listening sets.' : 'লিসেনিং সেট লোড করতে ব্যর্থ হয়েছে।'));
        }
      } catch (err) {
        console.error('Error fetching listening sets:', err);
        toast.error(language === 'en' ? 'Network error. Could not load sets.' : 'নেটওয়ার্ক সমস্যা। সেট লোড করা যায়নি।');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSets();
  }, [language]);

  // Guard role
  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>IELTS Listening Practice is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Get full backend static file URL
  const getFullFileUrl = (urlPath) => {
    if (!urlPath) return '';
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const serverRoot = apiBase.replace('/api', '');
    return `${serverRoot}${urlPath}`;
  };

  const handleSelectSet = (set) => {
    setSelectedSet(set);
    setActiveSection(1);
    toast.success(
      language === 'en' 
        ? `Loaded: ${set.setName}` 
        : `লোড হয়েছেঃ ${set.setName}`
    );
  };

  const handleClosePractice = () => {
    setSelectedSet(null);
  };

  return (
    <div className="ielts-listening-practice-page">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-listening-practice-content">
        {/* Header */}

        {/* Workspace */}
        <div className="ielts-listening-practice-workspace">
          <div className="ielts-listening-practice-container">
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <p>{language === 'en' ? 'Loading practice sets...' : 'প্র্যাকটিস সেট লোড হচ্ছে...'}</p>
              </div>
            ) : selectedSet ? (
              /* Practice Session UI (Audio Player + PDF booklet side by side/stacked) */
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="ielts-practice-panel"
              >
                <div className="ielts-practice-panel-header">
                  <div>
                    <h3>{selectedSet.setName}</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {language === 'en' ? 'Uploaded by: ' : 'আপলোড করেছেনঃ '} 
                      <strong>{selectedSet.creator?.name || 'Educator'}</strong>
                    </p>
                  </div>
                  <button onClick={handleClosePractice} className="ielts-practice-close-btn">
                    {language === 'en' ? 'Back to Sets' : 'সব সেটে ফিরে যান'}
                  </button>
                </div>

                {/* Section selection navigation */}
                <div className="ielts-practice-sections-nav">
                  {[1, 2, 3, 4].map(sec => (
                    <button
                      key={sec}
                      className={`ielts-practice-section-nav-btn ${activeSection === sec ? 'active' : ''}`}
                      onClick={() => setActiveSection(sec)}
                    >
                      {language === 'en' ? `Section ${sec}` : `সেকশন ${sec}`}
                    </button>
                  ))}
                </div>

                {/* Section specific audio and pdf rendering */}
                {selectedSet.sections && selectedSet.sections.find(s => s.sectionNumber === activeSection) ? (
                  (() => {
                    const sectionData = selectedSet.sections.find(s => s.sectionNumber === activeSection);
                    const audioUrl = getFullFileUrl(sectionData.audioUrl);
                    const pdfUrl = getFullFileUrl(sectionData.pdfUrl);

                    return (
                      <div className="ielts-practice-workspace-body" key={activeSection}>
                        {/* Audio component */}
                        <div className="ielts-practice-audio-container">
                          <HiVolumeUp size={24} style={{ color: 'var(--sky-blue)' }} />
                          <audio 
                            controls 
                            src={audioUrl} 
                            className="ielts-audio-player" 
                          />
                        </div>

                        {/* PDF Booklet Embed */}
                        <div className="ielts-practice-pdf-container">
                          <iframe 
                            src={pdfUrl} 
                            width="100%" 
                            height="600px" 
                            style={{ border: 'none' }} 
                            title={`Question Sheet Section ${activeSection}`}
                          />
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p style={{ textAlign: 'center', color: 'red' }}>
                    {language === 'en' ? 'Section files not found.' : 'সেকশন ফাইল পাওয়া যায়নি।'}
                  </p>
                )}
              </motion.div>
            ) : sets.length > 0 ? (
              /* Lists of sets uploaded */
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ielts-practice-set-grid"
              >
                {sets.map((set) => (
                  <div key={set._id} className="ielts-practice-set-card">
                    <div className="ielts-practice-set-info">
                      <h3>{set.setName}</h3>
                      <div className="ielts-practice-set-meta">
                        <span>👤 {set.creator?.name || 'Educator'}</span>
                        <span>📅 {new Date(set.createdAt).toLocaleDateString()}</span>
                        <span>📑 4 Sections</span>
                      </div>
                    </div>
                    <button onClick={() => handleSelectSet(set)} className="ielts-practice-set-btn">
                      <span>{language === 'en' ? 'Start Test' : 'টেস্ট শুরু করুন'}</span>
                    </button>
                  </div>
                ))}
              </motion.div>
            ) : (
              /* No sets uploaded box */
              <div className="ielts-no-sets-box">
                <span>📭</span>
                <h3>{language === 'en' ? 'No Question Sets Found' : 'কোনো প্রশ্ন সেট পাওয়া যায়নি'}</h3>
                <p>
                  {language === 'en' 
                    ? 'No question sets have been uploaded by teachers yet. Please check back later!'
                    : 'শিক্ষক কর্তৃক আপলোডকৃত কোনো প্রশ্ন সেট এখনও পাওয়া যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন!'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
