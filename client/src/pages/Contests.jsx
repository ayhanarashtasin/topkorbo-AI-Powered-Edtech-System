import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiCalendar,
  HiClock,
  HiAcademicCap,
  HiBookOpen,
  HiSearch,
  HiCollection,
  HiArrowRight
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import './Contests.css';

export default function Contests() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });
  
  const [contests, setContests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all'); // 'all', 'hsc', 'admission'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'mcq', 'cq', 'both'
  const [now, setNow] = useState(new Date());
  
  const [selectedResult, setSelectedResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);

  const activeTab = 'contests';

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth Guard & fetch contests
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
          setUser({
            name: resData.data.name,
            avatar: resData.data.avatar || '',
            email: resData.data.email,
            role: resData.data.role
          });
        }
      } catch (err) {
        console.error('Error fetching user data on contests page:', err);
      }
    };

    const fetchAllUpcomingContests = async () => {
      try {
        const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${backendBaseUrl}/contests/upcoming`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const resData = await response.json();
        if (resData.success && resData.data) {
          setContests(resData.data);
        }
      } catch (err) {
        console.error('Error fetching contests:', err);
      }
    };

    fetchUserData();
    fetchAllUpcomingContests();
  }, [navigate]);

  const getContestTimeInfo = (contest) => {
    const offsets = {
      'Asia/Dhaka': '+06:00',
      'Asia/Kolkata': '+05:30',
      'Asia/Dubai': '+04:00',
      'Europe/London': '+00:00',
      'America/New_York': '-05:00',
      'Asia/Tokyo': '+09:00',
      'Asia/Singapore': '+08:00',
      'Australia/Sydney': '+10:00'
    };

    const tz = contest.startTime?.timezone || 'Asia/Dhaka';
    const offset = offsets[tz] || '+06:00';

    let hour = contest.startTime?.hour || 12;
    const minute = contest.startTime?.minute || 0;
    const period = contest.startTime?.period || 'AM';

    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    const pad = (num) => String(num).padStart(2, '0');
    const startStr = `${contest.date}T${pad(hour)}:${pad(minute)}:00${offset}`;
    const startDate = new Date(startStr);

    const durationHours = contest.duration?.hours || 0;
    const durationMinutes = contest.duration?.minutes || 0;
    const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000) + (durationMinutes * 60 * 1000));

    const diffToStart = startDate - now;
    const diffToEnd = endDate - now;

    if (diffToStart > 0) {
      // Upcoming
      const d = Math.floor(diffToStart / (1000 * 60 * 60 * 24));
      const h = Math.floor((diffToStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diffToStart % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffToStart % (1000 * 60)) / 1000);

      let text = '';
      if (d > 0) text = `${d}d ${h}h ${m}m ${s}s`;
      else if (h > 0) text = `${h}h ${m}m ${s}s`;
      else text = `${m}m ${s}s`;

      return {
        status: 'upcoming',
        badgeText: language === 'en' ? 'Upcoming' : 'আসন্ন',
        remainingText: language === 'en' ? `Starts in: ${text}` : `শুরু হতে বাকি: ${text}`,
        startDate,
        endDate
      };
    } else if (diffToEnd > 0) {
      // Running
      const h = Math.floor((diffToEnd % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diffToEnd % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffToEnd % (1000 * 60)) / 1000);

      const text = `${h}h ${m}m ${s}s`;

      return {
        status: 'running',
        badgeText: language === 'en' ? 'Running' : 'চলমান',
        remainingText: language === 'en' ? `Ends in: ${text}` : `শেষ হতে বাকি: ${text}`,
        startDate,
        endDate
      };
    } else {
      // Ended
      return {
        status: 'ended',
        badgeText: language === 'en' ? 'Ended' : 'শেষ হয়েছে',
        remainingText: language === 'en' ? 'Contest has ended' : 'কনটেস্টটি শেষ হয়েছে',
        startDate,
        endDate
      };
    }
  };

  const getFormatLabel = (qtype) => {
    if (qtype === 'mcq') return language === 'en' ? 'MCQ Only' : 'শুধুমাত্র MCQ';
    if (qtype === 'cq') return language === 'en' ? 'CQ Only' : 'শুধুমাত্র CQ';
    if (qtype === 'written') return language === 'en' ? 'Written Only' : 'শুধুমাত্র লিখিত';
    return language === 'en' ? 'MCQ & Written/CQ' : 'MCQ এবং লিখিত/CQ';
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(language === 'en' ? 'en-US' : 'bn-BD', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (startTime) => {
    if (!startTime) return '';
    return `${startTime.hour}:${String(startTime.minute).padStart(2, '0')} ${startTime.period}`;
  };

  const handleParticipate = async (contestId) => {
    try {
      const token = localStorage.getItem('topkorbo_token');
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${backendBaseUrl}/contests/${contestId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        const populatedContest = resData.data;

        if (!populatedContest.questions || populatedContest.questions.length === 0) {
          alert(language === 'en' ? 'This contest has no questions' : 'এই কনটেস্টে কোনো প্রশ্ন নেই');
          return;
        }

        // Clean up any old exam keys
        [
          'mock_test_step',
          'mock_test_subject_ids',
          'mock_test_chapters',
          'mock_test_selected_topics',
          'mock_exam_standard',
          'mock_question_type',
          'mock_total_questions',
          'mock_exam_duration',
          'mock_negative_marking',
          'mock_exam_questions',
          'mock_exam_config',
          'mock_exam_from_qbank',
          'mock_exam_answers',
          'mock_exam_end_time',
          'mock_exam_submitted',
          'mock_exam_review_mode',
          'mock_exam_time_left',
          'mock_exam_written_answers',
          'mock_exam_ai_evals'
        ].forEach((key) => sessionStorage.removeItem(key));

        // Save contest questions and config for the exam room
        sessionStorage.setItem('mock_exam_questions', JSON.stringify(populatedContest.questions));
        sessionStorage.setItem('mock_exam_config', JSON.stringify({
          duration: (populatedContest.duration.hours * 60) + populatedContest.duration.minutes,
          negativeMarking: true,
          questionType: populatedContest.questionType,
          standard: populatedContest.name,
          totalQuestions: populatedContest.questions.length,
          contestId: populatedContest._id
        }));
        sessionStorage.setItem('mock_exam_from_qbank', 'false');

        // Go to exam room
        navigate('/mock-test/exam');
      } else {
        alert(resData.message || 'Failed to enter contest');
      }
    } catch (err) {
      console.error('Error starting contest exam:', err);
      alert('Network error while starting contest');
    }
  };

  const handleViewResult = async (contestId) => {
    setLoadingResult(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${backendBaseUrl}/contests/${contestId}/result`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setSelectedResult(resData.data);
        setShowResultModal(true);
      } else {
        alert(resData.message || 'Failed to fetch result');
      }
    } catch (err) {
      console.error('Error fetching contest result:', err);
      alert('Network error while fetching result');
    } finally {
      setLoadingResult(false);
    }
  };

  // 1) Filter
  const filteredContests = contests.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || c.level === levelFilter;
    const matchesType = typeFilter === 'all' || c.questionType === typeFilter;
    return matchesSearch && matchesLevel && matchesType;
  });

  // 2) Sort by nearest (starting time) first
  const sortedContests = [...filteredContests].sort((a, b) => {
    const offsets = {
      'Asia/Dhaka': '+06:00',
      'Asia/Kolkata': '+05:30',
      'Asia/Dubai': '+04:00',
      'Europe/London': '+00:00',
      'America/New_York': '-05:00',
      'Asia/Tokyo': '+09:00',
      'Asia/Singapore': '+08:00',
      'Australia/Sydney': '+10:00'
    };
    
    const getStartMs = (c) => {
      const tz = c.startTime?.timezone || 'Asia/Dhaka';
      const offset = offsets[tz] || '+06:00';
      let hour = c.startTime?.hour || 12;
      const minute = c.startTime?.minute || 0;
      const period = c.startTime?.period || 'AM';
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      const pad = (num) => String(num).padStart(2, '0');
      return new Date(`${c.date}T${pad(hour)}:${pad(minute)}:00${offset}`).getTime();
    };

    return getStartMs(a) - getStartMs(b);
  });

  return (
    <div className="contests-page">
      <Sidebar activeTab={activeTab} user={user} />

      <main className="contests-content">
        <header className="contests-header">
          <div className="contests-header__badge">
            <span className="contests-header__badge-dot"></span>
            {language === 'en' ? 'Contests Arena' : 'কনটেস্ট এরিনা'}
          </div>
          <h1 className="contests-title">
            {language === 'en' ? 'All Contests' : 'সকল কনটেস্টসমূহ'}
          </h1>
          <p className="contests-subtitle">
            {language === 'en'
              ? 'Join academic contests, test your knowledge against other students, and build your profile.'
              : 'একাডেমিক কনটেস্টগুলোতে অংশগ্রহণ করুন, অন্যান্য শিক্ষার্থীদের সাথে নিজের মেধা যাচাই করুন এবং আপনার প্রোফাইল উন্নত করুন।'}
          </p>
        </header>

        {/* Filters and Search Bar */}
        <section className="contests-filter-bar">
          <div className="contests-search-wrapper">
            <HiSearch className="contests-search-icon" size={20} />
            <input
              type="text"
              placeholder={language === 'en' ? 'Search contests...' : 'কনটেস্ট খুঁজুন...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="contests-search-input"
            />
          </div>

          <div className="contests-filters">
            {/* Level Filter */}
            <div className="contests-select-group">
              <HiAcademicCap className="select-icon" size={16} />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="contests-select"
              >
                <option value="all">{language === 'en' ? 'All Levels' : 'সকল লেভেল'}</option>
                <option value="hsc">HSC</option>
                <option value="admission">{language === 'en' ? 'Admission' : 'এডমিশন'}</option>
              </select>
            </div>

            {/* Format Filter */}
            <div className="contests-select-group">
              <HiCollection className="select-icon" size={16} />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="contests-select"
              >
                <option value="all">{language === 'en' ? 'All Formats' : 'সকল ফরম্যাট'}</option>
                <option value="mcq">MCQ</option>
                <option value="cq">CQ</option>
                <option value="both">{language === 'en' ? 'Mixed' : 'মিশ্রিত'}</option>
              </select>
            </div>
          </div>
        </section>

        {/* Contests Table Section */}
        <section className="contests-table-section">
          {sortedContests.length === 0 ? (
            <div className="contests-empty-state">
              <div className="empty-icon-wrap">📅</div>
              <h3>{language === 'en' ? 'No Contests Found' : 'কোনো কনটেস্ট পাওয়া যায়নি'}</h3>
              <p>
                {language === 'en'
                  ? 'Try adjusting your filters or search keywords.'
                  : 'অনুগ্রহ করে ফিল্টার পরিবর্তন করে অথবা অন্য কি-ওয়ার্ড লিখে পুনরায় চেষ্টা করুন।'}
              </p>
            </div>
          ) : (
            <div className="contests-table-container">
              <table className="contests-table">
                <thead>
                  <tr>
                    <th>{language === 'en' ? 'Contest' : 'কনটেস্ট'}</th>
                    <th>{language === 'en' ? 'Level & Format' : 'লেভেল ও ফরম্যাট'}</th>
                    <th>{language === 'en' ? 'Subjects / Units' : 'বিষয় / ইউনিট'}</th>
                    <th>{language === 'en' ? 'Duration' : 'সময়কাল'}</th>
                    <th>{language === 'en' ? 'Hosted By' : 'আয়োজক'}</th>
                    <th>{language === 'en' ? 'Start Time' : 'শুরুর সময়'}</th>
                    <th>{language === 'en' ? 'Countdown / Status' : 'কাউন্টডাউন / স্ট্যাটাস'}</th>
                    <th className="text-right">{language === 'en' ? 'Action' : 'অ্যাকশন'}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedContests.map((contest, index) => {
                    const timeInfo = getContestTimeInfo(contest);
                    const isUpcoming = timeInfo.status === 'upcoming';
                    const isRunning = timeInfo.status === 'running';

                    return (
                      <motion.tr
                        key={contest._id}
                        className={`contest-row contest-row--${timeInfo.status}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        {/* Title & Badge */}
                        <td>
                          <div className="contest-name-cell">
                            <span className={`status-dot status-dot--${timeInfo.status}`}></span>
                            <div className="contest-title-wrap">
                              <span className="contest-row-title" title={contest.name}>
                                {contest.name}
                              </span>
                              <span className={`status-badge-inline status-badge-inline--${timeInfo.status}`}>
                                {timeInfo.badgeText}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Level & Format */}
                        <td>
                          <div className="contest-level-format-cell">
                            <span className="capitalize-level">{contest.level}</span>
                            <span className="format-subtext">{getFormatLabel(contest.questionType)}</span>
                          </div>
                        </td>

                        {/* Subjects / Units */}
                        <td>
                          <div className="contest-badges-cell">
                            {contest.level === 'hsc' && contest.subjects?.map((sub) => (
                              <span key={sub} className="badge badge--subject">{sub}</span>
                            ))}
                            {contest.level === 'admission' && (
                              <>
                                <span className="badge badge--adm-type capitalize">{contest.admissionType}</span>
                                {contest.admissionSubtype && (
                                  <span className="badge badge--adm-sub capitalize">{contest.admissionSubtype}</span>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        {/* Duration */}
                        <td>
                          <span className="duration-text">
                            {contest.duration.hours}h {contest.duration.minutes}m
                          </span>
                        </td>

                        {/* Hosted By */}
                        <td>
                          <span className="organizer-name">
                            {contest.creator ? contest.creator.name : '—'}
                          </span>
                        </td>

                        {/* Start Time */}
                        <td>
                          <div className="start-time-cell">
                            <span className="start-date">{formatDate(contest.date)}</span>
                            <span className="start-time-sub">
                              {formatTime(contest.startTime)} ({contest.startTime?.timezone})
                            </span>
                          </div>
                        </td>

                        {/* Countdown */}
                        <td>
                          <div className="countdown-cell">
                            <span className={`countdown-value countdown-value--${timeInfo.status}`}>
                              {timeInfo.remainingText}
                            </span>
                          </div>
                        </td>

                        {/* CTA */}
                        <td className="text-right">
                          {contest.hasParticipated ? (
                            <button
                              className="contest-table-cta contest-table-cta--result"
                              onClick={() => handleViewResult(contest._id)}
                            >
                              <span>
                                {language === 'en' ? 'View Result' : 'ফলাফল দেখুন'}
                              </span>
                              <HiArrowRight size={14} />
                            </button>
                          ) : (
                            <button
                              className={`contest-table-cta ${isRunning ? 'contest-table-cta--active' : ''}`}
                              disabled={isUpcoming}
                              onClick={() => {
                                if (isRunning || timeInfo.status === 'ended') {
                                  handleParticipate(contest._id);
                                }
                              }}
                            >
                              <span>
                                {isRunning
                                  ? (language === 'en' ? 'Participate' : 'অংশ নিন')
                                  : isUpcoming
                                  ? (language === 'en' ? 'Wait' : 'অপেক্ষা')
                                  : (language === 'en' ? 'Practice' : 'অনুশীলন')}
                              </span>
                              <HiArrowRight size={14} />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Result Modal */}
      {showResultModal && selectedResult && (
        <div className="contest-modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="contest-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="contest-modal-close" onClick={() => setShowResultModal(false)}>
              &times;
            </button>
            <div className="contest-modal-header">
              <span className="contest-modal-header-icon">🏆</span>
              <h2>{language === 'en' ? 'Contest Results' : 'কনটেস্টের ফলাফল'}</h2>
            </div>
            
            <div className="contest-metrics-grid">
              <div className="contest-metric-item score">
                <span className="metric-label">{language === 'en' ? 'Marks Obtained' : 'প্রাপ্ত নম্বর'}</span>
                <strong className="metric-val">
                  {selectedResult.userResult ? `${selectedResult.userResult.score} / ${selectedResult.userResult.totalQuestions}` : '—'}
                </strong>
              </div>
              <div className="contest-metric-item percentage">
                <span className="metric-label">{language === 'en' ? 'Percentage' : 'শতকরা হার'}</span>
                <strong className="metric-val">
                  {selectedResult.userResult ? `${selectedResult.userResult.percentage}%` : '—'}
                </strong>
              </div>
              <div className="contest-metric-item rank">
                <span className="metric-label">{language === 'en' ? 'Rank' : 'র‍্যাংক/অবস্থান'}</span>
                <strong className="metric-val">
                  {selectedResult.userResult ? `# ${selectedResult.userResult.rank}` : '—'}
                </strong>
              </div>
              <div className="contest-metric-item time">
                <span className="metric-label">{language === 'en' ? 'Time Taken' : 'ব্যয়িত সময়'}</span>
                <strong className="metric-val">
                  {selectedResult.userResult ? `${Math.floor(selectedResult.userResult.timeTakenSeconds / 60)}m ${selectedResult.userResult.timeTakenSeconds % 60}s` : '—'}
                </strong>
              </div>
            </div>

            <div className="contest-leaderboard-section">
              <h3>
                <span className="leaderboard-icon">👑</span>
                {language === 'en' ? 'Leaderboard (Top 3)' : 'লিডারবোর্ড (শীর্ষ ৩)'}
              </h3>
              <div className="leaderboard-ranks">
                <div className="leaderboard-rank-row gold">
                  <span className="rank-badge">1st</span>
                  <span className="rank-name">{selectedResult.leaderboard?.first}</span>
                </div>
                <div className="leaderboard-rank-row silver">
                  <span className="rank-badge">2nd</span>
                  <span className="rank-name">{selectedResult.leaderboard?.second}</span>
                </div>
                <div className="leaderboard-rank-row bronze">
                  <span className="rank-badge">3rd</span>
                  <span className="rank-name">{selectedResult.leaderboard?.third}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
