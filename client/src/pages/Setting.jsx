import { useState, useEffect } from 'react';
import { HiLogout, HiFire, HiSparkles } from 'react-icons/hi';
import { IoSchoolSharp, IoLocationSharp } from 'react-icons/io5';
import { FcGoogle } from 'react-icons/fc'; // Added for Google logo
import { useLanguage } from '../hooks/useLanguage';
import Sidebar from '../components/layout/Sidebar';
import PlanPanel from '../components/settings/PlanPanel';
import './Setting.css';

export default function Setting() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Ayhan Arash Tasin',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || 'ayhan.arash.tasin@g.bracu.ac.bd',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const activeTab = 'settings';

  // Settings view states
  const [settingsActiveTab, setSettingsActiveTab] = useState('personal'); // 'personal', 'academic', 'linking'
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    fullName: user.name || '',
    collegeName: '',
    hscBatch: '2025',
    stream: 'Science',
    academicStatus: 'HSC 2nd Year',
    medium: 'Bangla Medium',
    district: 'Dhaka',
    division: 'Dhaka',
    areaName: '',
    phoneNumber: '',
    dob: '',
    gender: 'Male',
    optionalSubject: 'Math',
    aspirations: [],
    avatar: user.avatar || '',
    // Tutor specific fields
    studentIdNumber: '',
    studentIdCardPhoto: '',
    nidPhoto: '',
    ieltsScore: '',
    ieltsTrf: '',
    interestedToGuide: [],
    universityName: '',
    department: '',
    currentYearSemester: '',
    admissionAchievement: ''
  });

  const handleSignOut = () => {
    // Clear all auth storage keys
    localStorage.removeItem('topkorbo_token');
    localStorage.removeItem('topkorbo_name');
    localStorage.removeItem('topkorbo_avatar');
    localStorage.removeItem('topkorbo_email');
    localStorage.removeItem('topkorbo_phone');

    // Redirect to homepage
    window.location.href = '/';
  };

  // Sync profile details and verify session validity on mount
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
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
          handleSignOut();
          return;
        }

        const resData = await response.json();
        if (resData.success && resData.data) {
          setUser({
            name: resData.data.name,
            avatar: resData.data.avatar || '',
            email: resData.data.email,
            role: resData.data.role
          });
          // Update localStorage
          localStorage.setItem('topkorbo_name', resData.data.name);
          localStorage.setItem('topkorbo_avatar', resData.data.avatar || '');
          localStorage.setItem('topkorbo_email', resData.data.email);
          localStorage.setItem('topkorbo_role', resData.data.role);

          setSettingsForm({
            fullName: resData.data.name || '',
            collegeName: resData.data.collegeName || '',
            hscBatch: resData.data.hscBatch || '2025',
            stream: resData.data.stream || 'Science',
            academicStatus: resData.data.academicStatus || 'HSC 2nd Year',
            medium: resData.data.medium || 'Bangla Medium',
            district: resData.data.district || 'Dhaka',
            division: resData.data.division || 'Dhaka',
            areaName: resData.data.areaName || '',
            phoneNumber: resData.data.phoneNumber ? resData.data.phoneNumber.replace('+880', '') : '',
            dob: resData.data.dob || '',
            gender: resData.data.gender || 'Male',
            optionalSubject: resData.data.optionalSubject || 'Math',
            aspirations: resData.data.aspirations || [],
            avatar: resData.data.avatar || '',
            // Tutor specific fields
            studentIdNumber: resData.data.studentIdNumber || '',
            studentIdCardPhoto: resData.data.studentIdCardPhoto || '',
            nidPhoto: resData.data.nidPhoto || '',
            ieltsScore: resData.data.ieltsScore || '',
            ieltsTrf: resData.data.ieltsTrf || '',
            interestedToGuide: resData.data.interestedToGuide || [],
            universityName: resData.data.universityName || '',
            department: resData.data.department || '',
            currentYearSemester: resData.data.currentYearSemester || '',
            admissionAchievement: resData.data.admissionAchievement || ''
          });
        }
      } catch (err) {
        console.error('Error fetching user data on setting page:', err);
      }
    };

    fetchUserData();
  }, []);

  const handleSettingsInputChange = (e) => {
    const { name, value } = e.target;
    setSettingsForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSettingsAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettingsForm(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSettingsIdCardUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettingsForm(prev => ({ ...prev, studentIdCardPhoto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSettingsNidUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettingsForm(prev => ({ ...prev, nidPhoto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSettingsTrfUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file for IELTS TRF.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettingsForm(prev => ({ ...prev, ieltsTrf: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSettingsGuideCheckboxChange = (guideArea) => {
    setSettingsForm(prev => {
      const exists = prev.interestedToGuide.includes(guideArea);
      const updated = exists
        ? prev.interestedToGuide.filter(g => g !== guideArea)
        : [...prev.interestedToGuide, guideArea];
      return { ...prev, interestedToGuide: updated };
    });
  };

  const handleSaveChanges = async () => {
    setSettingsLoading(true);
    setSettingsSuccess('');
    setSettingsError('');

    try {
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('topkorbo_token');

      let requestBody = {};
      if (user.role === 'tutor' || user.role === 'teacher') {
        requestBody = {
          name: settingsForm.fullName,
          dob: settingsForm.dob,
          gender: settingsForm.gender,
          studentIdNumber: settingsForm.studentIdNumber,
          studentIdCardPhoto: settingsForm.studentIdCardPhoto,
          nidPhoto: settingsForm.nidPhoto,
          ieltsScore: settingsForm.interestedToGuide.includes('IELTS') ? settingsForm.ieltsScore : '',
          ieltsTrf: settingsForm.interestedToGuide.includes('IELTS') ? settingsForm.ieltsTrf : '',
          interestedToGuide: settingsForm.interestedToGuide,
          collegeName: settingsForm.collegeName,
          hscBatch: settingsForm.hscBatch,
          universityName: settingsForm.universityName,
          department: settingsForm.department,
          currentYearSemester: settingsForm.currentYearSemester,
          admissionAchievement: settingsForm.admissionAchievement,
          avatar: settingsForm.avatar
        };
      } else {
        requestBody = {
          name: settingsForm.fullName,
          collegeName: settingsForm.collegeName,
          hscBatch: settingsForm.hscBatch,
          stream: settingsForm.stream,
          academicStatus: settingsForm.academicStatus,
          medium: settingsForm.medium,
          district: settingsForm.district,
          division: settingsForm.division,
          areaName: settingsForm.areaName,
          dob: settingsForm.dob,
          gender: settingsForm.gender,
          optionalSubject: settingsForm.optionalSubject,
          aspirations: settingsForm.aspirations.length > 0 ? settingsForm.aspirations : ['Engineering'],
          avatar: settingsForm.avatar
        };
      }

      const response = await fetch(`${backendBaseUrl}/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const resData = await response.json();
      if (resData.success) {
        setSettingsSuccess('Profile updated successfully! ✨');
        // Update local user state
        setUser({
          name: resData.data.name,
          avatar: resData.data.avatar || '',
          email: resData.data.email,
          role: resData.data.role || user.role
        });
        localStorage.setItem('topkorbo_name', resData.data.name);
        localStorage.setItem('topkorbo_avatar', resData.data.avatar || '');
        localStorage.setItem('topkorbo_email', resData.data.email);
        if (resData.data.role) localStorage.setItem('topkorbo_role', resData.data.role);
      } else {
        setSettingsError(resData.message || 'Failed to save changes.');
      }
    } catch (e) {
      console.error(e);
      setSettingsError('Error communicating with backend.');
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />

      {/* Main Panel Content */}
      <main className="dashboard-main">
        <div className="dashboard-settings">
          {/* Header Banner Showcase */}
          <div className="settings-hero-banner">
            <div className="settings-hero-profile">
              <div className="settings-hero-avatar-wrapper">
                {settingsForm.avatar ? (
                  <img src={settingsForm.avatar} referrerPolicy="no-referrer" alt="Profile" className="settings-hero-avatar" />
                ) : (
                  <div className="settings-hero-avatar-placeholder">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <label htmlFor="settings-avatar-input-hero" className="settings-hero-avatar-edit-overlay" title={t('settings.change_picture')}>
                  <span>📷 {t('settings.change_picture')}</span>
                </label>
                <input
                  type="file"
                  id="settings-avatar-input-hero"
                  accept="image/*"
                  onChange={handleSettingsAvatarUpload}
                  style={{ display: 'none' }}
                />
              </div>
              <div className="settings-hero-info">
                <h3 className="settings-hero-name">{user.name}</h3>
                <p className="settings-hero-email">{user.email}</p>
                <div className="settings-hero-meta">
                  {user.role === 'tutor' || user.role === 'teacher' ? (
                    <>
                      <span className="settings-badge-pill">
                        <span className="settings-badge-icon">
                          <IoSchoolSharp />
                        </span>
                        {settingsForm.universityName || 'University'} - {settingsForm.department || 'Department'}
                      </span>
                      <span className="settings-badge-pill">
                        <span className="settings-badge-icon">
                          <IoLocationSharp />
                        </span>
                        {settingsForm.district || 'Dhaka'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="settings-badge-pill">
                        <span className="settings-badge-icon">
                          <HiFire />
                        </span>
                        {localStorage.getItem('topkorbo_streak') || '0'} {t('settings.streak')}
                      </span>
                      <span className="settings-badge-pill">
                        <span className="settings-badge-icon">
                          <IoSchoolSharp />
                        </span>
                        {t('settings.field.batch')}: HSC_{settingsForm.hscBatch ? settingsForm.hscBatch.slice(-2) : '25'}
                      </span>
                      <span className="settings-badge-pill">
                        <span className="settings-badge-icon">
                          <IoLocationSharp />
                        </span>
                        {settingsForm.district || 'Dhaka'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="settings-hero-stats">
              <div className="settings-stat-card">
                <div className="settings-stat-val">
                  {user.role === 'teacher'
                    ? t('settings.role.teacher')
                    : (user.role === 'tutor' ? t('settings.role.mentor') : t('settings.role.student'))}
                </div>
                <div className="settings-stat-lbl">{t('settings.role')}</div>
              </div>
              <div className="settings-stat-card">
                <div className="settings-stat-val">
                  <span className="pulse-indicator"></span>
                  {t('settings.status')}
                </div>
                <div className="settings-stat-lbl">{t('settings.status.label')}</div>
              </div>
            </div>
          </div>

          {/* Main Settings Grid */}
          <div className="settings-workspace-grid">
            {/* Left Navigation Bar */}
            <div className="settings-nav-sidebar">
              <button
                type="button"
                className={`settings-nav-btn ${settingsActiveTab === 'personal' ? 'settings-nav-btn--active' : ''}`}
                onClick={() => setSettingsActiveTab('personal')}
              >
                <span className="settings-nav-icon">👤</span>
                <div className="settings-nav-label-group">
                  <span className="settings-nav-label">{t('settings.tab.personal')}</span>
                  <span className="settings-nav-sub">Personal Details</span>
                </div>
              </button>

              <button
                type="button"
                className={`settings-nav-btn ${settingsActiveTab === 'academic' ? 'settings-nav-btn--active' : ''}`}
                onClick={() => setSettingsActiveTab('academic')}
              >
                <span className="settings-nav-icon">🎓</span>
                <div className="settings-nav-label-group">
                  <span className="settings-nav-label">{t('settings.tab.academic')}</span>
                  <span className="settings-nav-sub">School & Medium</span>
                </div>
              </button>

              <button
                type="button"
                className={`settings-nav-btn ${settingsActiveTab === 'linking' ? 'settings-nav-btn--active' : ''}`}
                onClick={() => setSettingsActiveTab('linking')}
              >
                <span className="settings-nav-icon">🔗</span>
                <div className="settings-nav-label-group">
                  <span className="settings-nav-label">{t('settings.tab.linking')}</span>
                  <span className="settings-nav-sub">Google Account</span>
                </div>
              </button>

              <button
                type="button"
                className={`settings-nav-btn ${settingsActiveTab === 'subscription' ? 'settings-nav-btn--active' : ''}`}
                onClick={() => setSettingsActiveTab('subscription')}
              >
                <span className="settings-nav-icon">
                  <HiSparkles size={18} />
                </span>
                <div className="settings-nav-label-group">
                  <span className="settings-nav-label">Subscription</span>
                  <span className="settings-nav-sub">Upgrade plan</span>
                </div>
              </button>

              <hr className="settings-nav-divider-line" />

              <button
                type="button"
                className="settings-nav-btn settings-nav-btn--logout"
                onClick={handleSignOut}
              >
                <span className="settings-nav-icon settings-nav-icon--logout">
                  <HiLogout size={18} />
                </span>
                <div className="settings-nav-label-group">
                  <span className="settings-nav-label settings-nav-label--logout">{t('db.menu.signout')}</span>
                  <span className="settings-nav-sub">End Active Session</span>
                </div>
              </button>
            </div>

            {/* Right Active Panel Card */}
            <div className="settings-pane-card">
              {settingsActiveTab === 'personal' && (
                <div className="settings-pane-content animate-fade-in">
                  <div className="settings-pane-header">
                    <h4>{t('settings.tab.personal')}</h4>
                  </div>

                  {user.role === 'tutor' || user.role === 'teacher' ? (
                    <>
                      <div className="settings-field-group">
                        <label className="settings-field-label">Full Name</label>
                        <input
                          type="text"
                          name="fullName"
                          value={settingsForm.fullName}
                          onChange={handleSettingsInputChange}
                          className="settings-field-input"
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">Gender (optional)</label>
                          <select
                            name="gender"
                            value={settingsForm.gender}
                            onChange={handleSettingsInputChange}
                            className="settings-field-select"
                          >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                        <div className="settings-field-group">
                          <label className="settings-field-label">Date of Birth (optional)</label>
                          <input
                            type="date"
                            name="dob"
                            value={settingsForm.dob}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                          />
                        </div>
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">NID Photo</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label htmlFor="settings-nid-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', background: 'rgba(230, 204, 178, 0.15)', border: '1px solid rgba(230, 204, 178, 0.4)', color: 'var(--text-primary)', display: 'inline-flex', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontWeight: '600', fontSize: '0.85rem' }}>
                              {settingsForm.nidPhoto ? 'Change NID' : 'Upload NID Photo'}
                            </label>
                            <input
                              type="file"
                              id="settings-nid-upload"
                              accept="image/*"
                              onChange={handleSettingsNidUpload}
                              style={{ display: 'none' }}
                            />
                            {settingsForm.nidPhoto && (
                              <span style={{ fontSize: '1.2rem', color: '#10B981' }}>✅</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {settingsForm.nidPhoto && (
                        <div className="settings-field-group" style={{ marginTop: '10px', marginBottom: '16px' }}>
                          <label className="settings-field-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>NID Photo Preview</label>
                          <div style={{ width: '100%', height: '140px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid rgba(230, 204, 178, 0.3)', background: '#fcf8f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={settingsForm.nidPhoto} alt="NID Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          </div>
                        </div>
                      )}

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">Student ID Number</label>
                          <input
                            type="text"
                            name="studentIdNumber"
                            value={settingsForm.studentIdNumber}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                            placeholder="e.g. 21101424"
                          />
                        </div>
                        <div className="settings-field-group">
                          <label className="settings-field-label">Student ID Photo</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label htmlFor="settings-id-card-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', background: 'rgba(230, 204, 178, 0.15)', border: '1px solid rgba(230, 204, 178, 0.4)', color: 'var(--text-primary)', display: 'inline-flex', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontWeight: '600', fontSize: '0.85rem' }}>
                              {settingsForm.studentIdCardPhoto ? 'Change Photo' : 'Upload ID Photo'}
                            </label>
                            <input
                              type="file"
                              id="settings-id-card-upload"
                              accept="image/*"
                              onChange={handleSettingsIdCardUpload}
                              style={{ display: 'none' }}
                            />
                            {settingsForm.studentIdCardPhoto && (
                              <span style={{ fontSize: '1.2rem', color: '#10B981' }}>✅</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {settingsForm.studentIdCardPhoto && (
                        <div className="settings-field-group" style={{ marginTop: '10px' }}>
                          <label className="settings-field-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID Photo Preview</label>
                          <div style={{ width: '100%', height: '140px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid rgba(230, 204, 178, 0.3)', background: '#fcf8f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={settingsForm.studentIdCardPhoto} alt="Student ID Card Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="settings-field-group">
                        <label className="settings-field-label">{t('settings.field.fullname')}</label>
                        <input
                          type="text"
                          name="fullName"
                          value={settingsForm.fullName}
                          onChange={handleSettingsInputChange}
                          className="settings-field-input"
                          placeholder={t('settings.field.fullname.placeholder')}
                        />
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.district')}</label>
                          <input
                            type="text"
                            name="district"
                            value={settingsForm.district}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                            placeholder={t('settings.field.district.placeholder')}
                          />
                        </div>
                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.division')}</label>
                          <input
                            type="text"
                            name="division"
                            value={settingsForm.division}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                            placeholder={t('settings.field.division.placeholder')}
                          />
                        </div>
                      </div>

                      <div className="settings-field-group">
                        <label className="settings-field-label">{t('settings.field.area')}</label>
                        <input
                          type="text"
                          name="areaName"
                          value={settingsForm.areaName}
                          onChange={handleSettingsInputChange}
                          className="settings-field-input"
                          placeholder={t('settings.field.area.placeholder')}
                        />
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.dob')}</label>
                          <input
                            type="date"
                            name="dob"
                            value={settingsForm.dob}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                          />
                        </div>
                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.gender')}</label>
                          <select
                            name="gender"
                            value={settingsForm.gender}
                            onChange={handleSettingsInputChange}
                            className="settings-field-select"
                          >
                            <option value="Male">{t('settings.option.gender.male')}</option>
                            <option value="Female">{t('settings.option.gender.female')}</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {settingsActiveTab === 'academic' && (
                <div className="settings-pane-content animate-fade-in">
                  <div className="settings-pane-header">
                    <h4>{(user.role === 'tutor' || user.role === 'teacher') ? 'Academic & Guide Info' : t('settings.tab.academic')}</h4>
                  </div>

                  {(user.role === 'tutor' || user.role === 'teacher') ? (
                    <>
                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">College Name</label>
                          <input
                            type="text"
                            name="collegeName"
                            value={settingsForm.collegeName}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                            placeholder="e.g. Notre Dame College"
                          />
                        </div>

                        <div className="settings-field-group">
                          <label className="settings-field-label">HSC Batch</label>
                          <select
                            name="hscBatch"
                            value={settingsForm.hscBatch}
                            onChange={handleSettingsInputChange}
                            className="settings-field-select"
                          >
                            <option value="2020">HSC 2020</option>
                            <option value="2021">HSC 2021</option>
                            <option value="2022">HSC 2022</option>
                            <option value="2023">HSC 2023</option>
                            <option value="2024">HSC 2024</option>
                            <option value="2025">HSC 2025</option>
                          </select>
                        </div>
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">University Name</label>
                          <input
                            type="text"
                            name="universityName"
                            value={settingsForm.universityName}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                            placeholder="e.g. BUET"
                          />
                        </div>

                        <div className="settings-field-group">
                          <label className="settings-field-label">Department</label>
                          <input
                            type="text"
                            name="department"
                            value={settingsForm.department}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                            placeholder="e.g. CSE"
                          />
                        </div>
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">Current Year / Semester</label>
                          <input
                            type="text"
                            name="currentYearSemester"
                            value={settingsForm.currentYearSemester}
                            onChange={handleSettingsInputChange}
                            className="settings-field-input"
                            placeholder="e.g. 3rd Year 2nd Semester"
                          />
                        </div>

                        <div className="settings-field-group" style={{ opacity: 0, pointerEvents: 'none' }}>
                          <label className="settings-field-label">Placeholder</label>
                          <input type="text" className="settings-field-input" readOnly />
                        </div>
                      </div>

                      <div className="settings-field-group" style={{ marginBottom: '16px' }}>
                        <label className="settings-field-label">Interested to Guide</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginTop: '6px' }}>
                          {['Medical', 'Engineering', 'University', 'Academic', 'IELTS'].map((guideArea) => (
                            <label key={guideArea} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 248, 240, 0.6)', border: '1px solid rgba(230, 204, 178, 0.3)', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '600' }}>
                              <input
                                type="checkbox"
                                checked={settingsForm.interestedToGuide.includes(guideArea)}
                                onChange={() => handleSettingsGuideCheckboxChange(guideArea)}
                                style={{ accentColor: 'var(--sky-blue)', width: '16px', height: '16px' }}
                              />
                              <span>{guideArea}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {settingsForm.interestedToGuide.includes('IELTS') && (
                        <div className="settings-field-row" style={{ background: 'rgba(56, 189, 248, 0.04)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(56, 189, 248, 0.3)', marginBottom: '16px', marginTop: '16px' }}>
                          <div className="settings-field-group">
                            <label className="settings-field-label" style={{ color: 'var(--sky-blue)' }}>IELTS Score</label>
                            <input
                              type="text"
                              name="ieltsScore"
                              placeholder="e.g. 7.5"
                              value={settingsForm.ieltsScore}
                              onChange={handleSettingsInputChange}
                              className="settings-field-input"
                            />
                          </div>

                          <div className="settings-field-group">
                            <label className="settings-field-label" style={{ color: 'var(--sky-blue)' }}>IELTS Test Report Form (TRF) PDF</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '40px', height: 'auto', flexWrap: 'wrap' }}>
                              <label htmlFor="settings-trf-pdf-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', background: 'rgba(230, 204, 178, 0.15)', border: '1px solid rgba(230, 204, 178, 0.4)', color: 'var(--text-primary)', display: 'inline-flex', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontWeight: '600', fontSize: '0.85rem' }}>
                                {settingsForm.ieltsTrf ? 'Change PDF' : 'Upload TRF PDF'}
                              </label>
                              <input
                                type="file"
                                id="settings-trf-pdf-upload"
                                accept="application/pdf"
                                onChange={handleSettingsTrfUpload}
                                style={{ display: 'none' }}
                              />
                              {settingsForm.ieltsTrf && (
                                <span style={{ fontSize: '0.85rem', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span>✅ Loaded</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="settings-field-group">
                        <label className="settings-field-label">Academic or Admission Achievements description (BIO)</label>
                        <textarea
                          name="admissionAchievement"
                          value={settingsForm.admissionAchievement}
                          onChange={handleSettingsInputChange}
                          className="settings-field-input"
                          placeholder="Describe your achievements..."
                          rows={3}
                          style={{ resize: 'vertical', minHeight: '80px', lineHeight: '1.4' }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="settings-field-group">
                        <label className="settings-field-label">{t('settings.field.college')}</label>
                        <input
                          type="text"
                          name="collegeName"
                          value={settingsForm.collegeName}
                          onChange={handleSettingsInputChange}
                          className="settings-field-input"
                          placeholder={t('settings.field.college.placeholder')}
                        />
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.batch')}</label>
                          <select
                            name="hscBatch"
                            value={settingsForm.hscBatch}
                            onChange={handleSettingsInputChange}
                            className="settings-field-select"
                          >
                            <option value="2024">{t('settings.option.hsc').replace('{year}', '2024')}</option>
                            <option value="2025">{t('settings.option.hsc').replace('{year}', '2025')}</option>
                            <option value="2026">{t('settings.option.hsc').replace('{year}', '2026')}</option>
                            <option value="2027">{t('settings.option.hsc').replace('{year}', '2027')}</option>
                          </select>
                        </div>

                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.status')}</label>
                          <select
                            name="academicStatus"
                            value={settingsForm.academicStatus}
                            onChange={handleSettingsInputChange}
                            className="settings-field-select"
                          >
                            <option value="HSC 1st Year">{t('settings.option.status.1')}</option>
                            <option value="HSC 2nd Year">{t('settings.option.status.2')}</option>
                            <option value="HSC Passed">{t('settings.option.status.passed')}</option>
                            <option value="Admission Candidate">{t('settings.option.status.candidate')}</option>
                          </select>
                        </div>
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.medium')}</label>
                          <select
                            name="medium"
                            value={settingsForm.medium}
                            onChange={handleSettingsInputChange}
                            className="settings-field-select"
                          >
                            <option value="Bangla Medium">{t('settings.option.medium.bangla')}</option>
                            <option value="English Version">{t('settings.option.medium.english_ver')}</option>
                            <option value="English Medium">{t('settings.option.medium.english_med')}</option>
                          </select>
                        </div>

                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.stream')}</label>
                          <select
                            name="stream"
                            value={settingsForm.stream}
                            onChange={handleSettingsInputChange}
                            className="settings-field-select"
                          >
                            <option value="Science">{t('settings.option.stream.science')}</option>
                            <option value="Business Studies">{t('settings.option.stream.business')}</option>
                            <option value="Humanities">{t('settings.option.stream.humanities')}</option>
                          </select>
                        </div>
                      </div>

                      <div className="settings-field-row">
                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.goal')}</label>
                          <select
                            name="aspirations"
                            value={settingsForm.aspirations[0] || 'Engineering'}
                            onChange={(e) => setSettingsForm(prev => ({ ...prev, aspirations: [e.target.value] }))}
                            className="settings-field-select"
                          >
                            <option value="Engineering">{t('settings.option.goal.engineering')}</option>
                            <option value="University">{t('settings.option.goal.university')}</option>
                            <option value="Medical">{t('settings.option.goal.medical')}</option>
                          </select>
                        </div>

                        <div className="settings-field-group">
                          <label className="settings-field-label">{t('settings.field.optional_subject')}</label>
                          <select
                            name="optionalSubject"
                            value={settingsForm.optionalSubject || 'Math'}
                            onChange={handleSettingsInputChange}
                            className="settings-field-select"
                          >
                            <option value="Math">{t('settings.option.subject.math')}</option>
                            <option value="Biology">{t('settings.option.subject.biology')}</option>
                            <option value="Statistics">{t('settings.option.subject.statistics')}</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {settingsActiveTab === 'linking' && (
                <div className="settings-pane-content animate-fade-in">
                  <div className="settings-pane-header">
                    <h4>{t('settings.linking.title')}</h4>
                  </div>

                  <div className="settings-visual-card">
                    <div className="settings-visual-google-branding">
                      <div className="settings-visual-google-icon-wrapper">
                        <FcGoogle size={26} />
                      </div>
                      <div className="settings-visual-google-text-group">
                        <h5>{t('settings.linking.google')}</h5>
                        <span className="settings-visual-google-connected-pill">
                          <span className="live-pulse-dot"></span>
                          {t('settings.linking.status')}
                        </span>
                      </div>
                    </div>
                    <p className="settings-visual-google-desc">
                      {t('settings.linking.desc')}
                    </p>
                    <hr className="settings-visual-divider" />
                    <div className="settings-visual-meta-row">
                      <span className="settings-visual-meta-label">Linked Email:</span>
                      <span className="settings-visual-meta-value">{user.email}</span>
                    </div>
                  </div>
                </div>
              )}

              {settingsActiveTab === 'subscription' && (
                <div className="settings-pane-content animate-fade-in">
                  <PlanPanel />
                </div>
              )}

              {/* Global Save Actions Row inside the pane card */}
              {settingsActiveTab !== 'linking' && settingsActiveTab !== 'subscription' && (
                <div className="settings-pane-footer">
                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={settingsLoading}
                    className="settings-save-btn"
                  >
                    {settingsLoading ? t('settings.saving') : t('settings.save')}
                  </button>
                  {settingsSuccess && <p className="settings-feedback-text settings-feedback-text--success">{t('settings.success')}</p>}
                  {settingsError && <p className="settings-feedback-text settings-feedback-text--error">{t('settings.error')}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
