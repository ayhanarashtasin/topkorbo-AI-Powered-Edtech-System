import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiChatAlt2, HiArrowLeft, HiMicrophone, HiStop, HiCalendar, HiClock, HiUser, HiCheckCircle } from 'react-icons/hi';
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

  // Booking and Teachers State
  const [view, setView] = useState('practice'); // 'practice' or 'appointment'
  const [teachers, setTeachers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTimeSlot, setBookingTimeSlot] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Auth Guard
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      navigate('/');
      return;
    }
  }, [navigate]);

  // Load teachers and appointments when appointment view is active
  useEffect(() => {
    if (view === 'appointment') {
      const token = localStorage.getItem('topkorbo_token');
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      const fetchTeachers = async () => {
        try {
          setLoadingTeachers(true);
          const res = await fetch(`${backendBaseUrl}/ielts/teachers`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const resData = await res.json();
          if (resData.success) {
            setTeachers(resData.data);
          }
        } catch (err) {
          console.error('Error fetching IELTS teachers:', err);
          toast.error(language === 'en' ? 'Failed to fetch teachers.' : 'শিক্ষক তালিকা লোড করতে ব্যর্থ হয়েছে।');
        } finally {
          setLoadingTeachers(false);
        }
      };

      const fetchAppointments = async () => {
        try {
          setLoadingAppointments(true);
          const res = await fetch(`${backendBaseUrl}/ielts/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const resData = await res.json();
          if (resData.success) {
            setAppointments(resData.data);
          }
        } catch (err) {
          console.error('Error fetching appointments:', err);
        } finally {
          setLoadingAppointments(false);
        }
      };

      fetchTeachers();
      fetchAppointments();
    }
  }, [view, language]);

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    try {
      setBookingSubmitting(true);
      const token = localStorage.getItem('topkorbo_token');
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      const res = await fetch(`${backendBaseUrl}/ielts/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          teacherId: selectedTeacher._id,
          date: bookingDate,
          timeSlot: bookingTimeSlot,
          message: bookingMessage
        })
      });

      const resData = await res.json();
      if (resData.success) {
        toast.success(language === 'en' ? 'Appointment requested successfully!' : 'অ্যাপয়েন্টমেন্ট সফলভাবে অনুরোধ করা হয়েছে!');
        setSelectedTeacher(null);
        setBookingDate('');
        setBookingTimeSlot('');
        setBookingMessage('');
        // Refresh appointments
        const appRes = await fetch(`${backendBaseUrl}/ielts/appointments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const appData = await appRes.json();
        if (appData.success) {
          setAppointments(appData.data);
        }
      } else {
        toast.error(resData.message || (language === 'en' ? 'Failed to book slot.' : 'স্লট বুক করতে ব্যর্থ হয়েছে।'));
      }
    } catch (err) {
      console.error('Error booking appointment:', err);
      toast.error(language === 'en' ? 'An error occurred.' : 'একটি ত্রুটি ঘটেছে।');
    } finally {
      setBookingSubmitting(false);
    }
  };

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

        {/* View Selector Tabs */}
        <div className="ielts-speaking-views-nav">
          <button 
            className={`ielts-view-tab-btn ${view === 'practice' ? 'active' : ''}`}
            onClick={() => setView('practice')}
          >
            {language === 'en' ? 'Mock Practice Sets' : 'মক প্র্যাকটিস সেট'}
          </button>
          <button 
            className={`ielts-view-tab-btn ${view === 'appointment' ? 'active' : ''}`}
            onClick={() => { setView('appointment'); setSelectedSet(null); }}
          >
            {language === 'en' ? 'Get Appointment for Speaking Test' : 'স্পিকিং টেস্ট অ্যাপয়েন্টমেন্ট'}
          </button>
        </div>

        {/* Workspace */}
        <div className="ielts-speaking-practice-workspace">
          <div className="ielts-speaking-practice-container">
            
            {view === 'practice' ? (
              selectedSet ? (
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
              )
            ) : (
              /* Appointment booking view */
              <div className="ielts-appointment-layout animate-fade-in">
                {/* Book New Appointment Section */}
                <div className="ielts-appointment-booking-section">
                  <h3 className="ielts-speaking-practice-section-title">
                    {language === 'en' ? 'Get Appointment for Speaking Test' : 'স্পিকিং টেস্টের জন্য অ্যাপয়েন্টমেন্ট নিন'}
                  </h3>
                  
                  {loadingTeachers ? (
                    <div className="ielts-speaking-practice-loading">
                      <div className="spinner"></div>
                      <p>{language === 'en' ? 'Loading qualified teachers...' : 'শিক্ষক তালিকা লোড হচ্ছে...'}</p>
                    </div>
                  ) : teachers.length === 0 ? (
                    <div className="ielts-speaking-practice-empty-state">
                      <HiUser size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                      <p>{language === 'en' ? 'No approved IELTS teachers available at the moment.' : 'এই মুহূর্তে কোনো অনুমোদিত আইইএলটিএস শিক্ষক উপলব্ধ নেই।'}</p>
                    </div>
                  ) : (
                    <div className="ielts-speaking-teachers-grid">
                      {teachers.map(teacher => (
                        <div key={teacher._id} className="ielts-teacher-profile-card">
                          <div className="ielts-teacher-profile-card__avatar">
                            {teacher.avatar ? (
                              <img src={teacher.avatar} alt={teacher.name} referrerPolicy="no-referrer" />
                            ) : (
                              teacher.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="ielts-teacher-profile-card__info">
                            <h4>{teacher.name}</h4>
                            <p className="ielts-teacher-univ">🏫 {teacher.universityName}</p>
                            <p className="ielts-teacher-dept">📖 {teacher.department}</p>
                            <div className="ielts-teacher-band-badge">
                              {language === 'en' ? 'IELTS Band:' : 'আইইএলটিএস ব্যান্ড:'} <strong>{teacher.ieltsScore || 'N/A'}</strong>
                            </div>
                          </div>
                          <button 
                            className="ielts-teacher-book-btn"
                            onClick={() => setSelectedTeacher(teacher)}
                          >
                            <HiCalendar size={16} />
                            <span>{language === 'en' ? 'Book Slot' : 'স্লট বুক করুন'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* My Booked Slots Section */}
                <div className="ielts-appointment-history-section">
                  <h3 className="ielts-speaking-practice-section-title">
                    {language === 'en' ? 'My Booked Appointments' : 'আমার বুকিং ইতিহাস'}
                  </h3>

                  {loadingAppointments ? (
                    <div className="ielts-speaking-practice-loading">
                      <p>{language === 'en' ? 'Loading appointments...' : 'অ্যাপয়েন্টমেন্ট লোড হচ্ছে...'}</p>
                    </div>
                  ) : appointments.length === 0 ? (
                    <div className="ielts-speaking-practice-empty-state">
                      <HiCalendar size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                      <p>{language === 'en' ? 'You have not requested any appointments yet.' : 'আপনি এখনও কোনো অ্যাপয়েন্টমেন্ট বুক করেননি।'}</p>
                    </div>
                  ) : (
                    <div className="ielts-appointments-list">
                      {appointments.map(app => (
                        <div key={app._id} className="ielts-appointment-item-card">
                          <div className="ielts-app-header">
                            <span className={`ielts-status-badge ${app.status}`}>
                              {app.status === 'accepted' ? (language === 'en' ? 'Approved' : 'অনুমোদিত') :
                               app.status === 'rejected' ? (language === 'en' ? 'Declined' : 'প্রত্যাখ্যাত') :
                               (language === 'en' ? 'Pending' : 'অপেক্ষমান')}
                            </span>
                            <span className="ielts-app-date-time">
                              <HiCalendar size={14} /> {app.date} &nbsp;|&nbsp; <HiClock size={14} /> {app.timeSlot}
                            </span>
                          </div>
                          <div className="ielts-app-teacher-info">
                            <div className="ielts-app-teacher-avatar">
                              {app.teacher?.avatar ? (
                                <img src={app.teacher.avatar} alt={app.teacher.name} />
                              ) : (
                                app.teacher?.name?.charAt(0).toUpperCase() || 'T'
                              )}
                            </div>
                            <div className="ielts-app-teacher-details">
                              <h5>{app.teacher?.name || 'Unknown Teacher'}</h5>
                              <p>📧 {app.teacher?.email || 'N/A'}</p>
                              {app.teacher?.universityName && (
                                <span className="ielts-app-teacher-univ">🏫 {app.teacher.universityName}</span>
                              )}
                            </div>
                          </div>
                          {app.message && (
                            <div className="ielts-app-student-message">
                              <strong>{language === 'en' ? 'Message:' : 'বার্তা:'}</strong> {app.message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Booking Form Modal */}
            {selectedTeacher && (
              <div className="ielts-booking-modal-overlay">
                <div className="ielts-booking-modal">
                  <div className="ielts-booking-modal__header">
                    <h3>{language === 'en' ? 'Book Speaking Test Appointment' : 'স্পিকিং টেস্ট অ্যাপয়েন্টমেন্ট বুকিং'}</h3>
                    <button className="ielts-booking-modal__close" onClick={() => setSelectedTeacher(null)}>×</button>
                  </div>
                  <form onSubmit={handleCreateAppointment} className="ielts-booking-modal__form">
                    <div className="ielts-booking-modal__teacher-preview">
                      <div className="ielts-booking-modal__avatar">
                        {selectedTeacher.avatar ? (
                          <img src={selectedTeacher.avatar} alt={selectedTeacher.name} />
                        ) : (
                          selectedTeacher.name.charAt(0)
                        )}
                      </div>
                      <div className="ielts-booking-modal__teacher-info">
                        <h4>{selectedTeacher.name}</h4>
                        <p>🏫 {selectedTeacher.universityName}</p>
                        <p>📖 {selectedTeacher.department}</p>
                      </div>
                    </div>

                    <div className="ielts-booking-form-group">
                      <label>{language === 'en' ? 'Date' : 'তারিখ'}</label>
                      <input 
                        type="date" 
                        required 
                        min={new Date().toISOString().split('T')[0]}
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                      />
                    </div>

                    <div className="ielts-booking-form-group">
                      <label>{language === 'en' ? 'Time Slot' : 'সময় স্লট'}</label>
                      <select 
                        required
                        value={bookingTimeSlot}
                        onChange={(e) => setBookingTimeSlot(e.target.value)}
                      >
                        <option value="">-- {language === 'en' ? 'Select Time Slot' : 'সময় স্লট নির্বাচন করুন'} --</option>
                        <option value="10:00 AM - 10:30 AM">10:00 AM - 10:30 AM</option>
                        <option value="11:00 AM - 11:30 AM">11:00 AM - 11:30 AM</option>
                        <option value="12:00 PM - 12:30 PM">12:00 PM - 12:30 PM</option>
                        <option value="02:00 PM - 02:30 PM">02:00 PM - 02:30 PM</option>
                        <option value="03:00 PM - 03:30 PM">03:00 PM - 03:30 PM</option>
                        <option value="04:00 PM - 04:30 PM">04:00 PM - 04:30 PM</option>
                        <option value="05:00 PM - 05:30 PM">05:00 PM - 05:30 PM</option>
                        <option value="07:00 PM - 07:30 PM">07:00 PM - 07:30 PM</option>
                        <option value="08:00 PM - 08:30 PM">08:00 PM - 08:30 PM</option>
                      </select>
                    </div>

                    <div className="ielts-booking-form-group">
                      <label>{language === 'en' ? 'Message (Optional)' : 'বার্তা (ঐচ্ছিক)'}</label>
                      <textarea 
                        rows="3"
                        placeholder={language === 'en' ? 'Specify details or questions you want to cover' : 'আপনি যে বিষয়গুলো নিয়ে আলোচনা করতে চান তা লিখুন'}
                        value={bookingMessage}
                        onChange={(e) => setBookingMessage(e.target.value)}
                      />
                    </div>

                    <div className="ielts-booking-modal__actions">
                      <button type="button" className="ielts-booking-btn-cancel" onClick={() => setSelectedTeacher(null)}>
                        {language === 'en' ? 'Cancel' : 'বাতিল'}
                      </button>
                      <button type="submit" className="ielts-booking-btn-confirm" disabled={bookingSubmitting}>
                        {bookingSubmitting ? (language === 'en' ? 'Booking...' : 'বুকিং হচ্ছে...') : (language === 'en' ? 'Confirm Booking' : 'বুকিং নিশ্চিত করুন')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
