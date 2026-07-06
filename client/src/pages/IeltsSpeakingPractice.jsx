import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiArrowLeft, HiCalendar, HiClock, HiUser } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './IeltsSpeakingPractice.css';

export default function IeltsSpeakingPractice() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
  });

  // Booking and Teachers State
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

  // Load teachers and appointments on mount
  useEffect(() => {
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
  }, [language]);

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

  return (
    <div className="ielts-speaking-practice-page">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-speaking-practice-content">
        {/* Header */}
        <header className="ielts-speaking-practice-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(75, 46, 43, 0.08)' }}>
          <button
            onClick={() => navigate('/ielts-prep', { state: { step: 2 } })}
            className="ielts-speaking-back-btn"
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
              {language === 'en' ? 'IELTS Speaking Practice' : 'আইইএলটিএস স্পিকিং প্র্যাকটিস'}
            </h2>
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-speaking-practice-workspace">
          <div className="ielts-speaking-practice-container">

            {/* Appointment booking view */}
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
                        {app.status === 'accepted' && app.meetingLink && (
                          <div className="ielts-app-meeting-link" style={{ marginTop: '12px' }}>
                            <a
                              href={app.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ielts-join-session-btn"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#fff',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                textDecoration: 'none',
                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                              }}
                            >
                              🎥 <span>{language === 'en' ? 'Join Online Session' : 'অনলাইন সেশনে যোগ দিন'}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
