import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiArrowLeft, HiInformationCircle } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import './IeltsWritingDemo.css';

export default function IeltsWritingDemo() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
  });

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
        console.error('Error fetching user data in Writing Demo:', err);
      }
    };

    const topkorbo_role = localStorage.getItem('topkorbo_role');
    if (topkorbo_role) {
      setUser(prev => ({ ...prev, role: topkorbo_role }));
    }

    fetchUserData();
  }, [navigate]);

  // Guard role
  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>This demo is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Data points for Television line: (X, Y)
  // X indices: 0 (6am), 1 (8am), 2 (10am), 3 (12pm), 4 (2pm), 5 (4pm), 6 (6pm), 7 (8pm), 8 (10pm), 9 (12am), 10 (2am), 11 (4am), 12 (6am)
  const tvPoints = [
    { x: 150, y: 290, label: '6:00 AM', val: '0%' },
    { x: 191.7, y: 260, label: '8:00 AM', val: '6%' },
    { x: 233.3, y: 260, label: '10:00 AM', val: '6%' },
    { x: 275, y: 275, label: '12:00 Noon', val: '3%' },
    { x: 316.7, y: 215, label: '2:00 PM', val: '15%' },
    { x: 358.3, y: 220, label: '4:00 PM', val: '14%' },
    { x: 400, y: 90, label: '6:00 PM', val: '40%' },
    { x: 441.7, y: 55, label: '8:00 PM', val: '47%' },
    { x: 483.3, y: 70, label: '10:00 PM', val: '44%' },
    { x: 525, y: 165, label: '12:00 Midnight', val: '25%' },
    { x: 566.7, y: 265, label: '2:00 AM', val: '5%' },
    { x: 608.3, y: 280, label: '4:00 AM', val: '2%' },
    { x: 650, y: 285, label: '6:00 AM', val: '1%' },
  ];

  // Data points for Radio line: (X, Y)
  const radioPoints = [
    { x: 150, y: 250, label: '6:00 AM', val: '8%' },
    { x: 191.7, y: 155, label: '8:00 AM', val: '27%' },
    { x: 233.3, y: 180, label: '10:00 AM', val: '22%' },
    { x: 275, y: 195, label: '12:00 Noon', val: '19%' },
    { x: 316.7, y: 225, label: '2:00 PM', val: '13%' },
    { x: 358.3, y: 220, label: '4:00 PM', val: '14%' },
    { x: 400, y: 240, label: '6:00 PM', val: '10%' },
    { x: 441.7, y: 250, label: '8:00 PM', val: '8%' },
    { x: 483.3, y: 260, label: '10:00 PM', val: '6%' },
    { x: 525, y: 255, label: '12:00 Midnight', val: '7%' },
    { x: 566.7, y: 280, label: '2:00 AM', val: '2%' },
    { x: 608.3, y: 285, label: '4:00 AM', val: '1%' },
    { x: 650, y: 280, label: '6:00 AM', val: '2%' },
  ];

  const tvPathD = tvPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const radioPathD = radioPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="ielts-writing-demo-page">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-writing-demo-content">
        {/* Header */}
        <div className="ielts-writing-demo-header">
          <button
            onClick={() => navigate('/ielts-prep/writing')}
            className="ielts-writing-demo-back-btn"
            title={language === 'en' ? 'Go Back' : 'পিছনে যান'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-writing-demo-header-text">
            <h2>{language === 'en' ? 'IELTS Writing Demo Prompt' : 'আইইএলটিএস রাইটিং ডেমো প্রম্পট'}</h2>
            <p>
              {language === 'en'
                ? 'Review sample IELTS writing questions to get familiar with the test format.'
                : 'পরীক্ষার ফরম্যাট সম্পর্কে ধারণা পেতে নমুনা আইইএলটিএস রাইটিং প্রশ্নসমূহ পর্যালোচনা করুন।'}
            </p>
          </div>
        </div>

        {/* Workspace */}
        <div className="ielts-writing-demo-workspace">
          <div className="ielts-writing-demo-container">

            {/* Read only Banner */}
            <div className="ielts-demo-notice-banner">
              <HiInformationCircle size={22} />
              <span>
                {language === 'en'
                  ? 'This is a read-only preview of IELTS tasks. Answer submission or grading option is not available here.'
                  : 'এটি আইইএলটিএস টাস্কের একটি রিড-অনলি প্রিভিউ। উত্তর জমা দেওয়া বা গ্রেডিংয়ের কোনো বিকল্প এখানে নেই।'}
              </span>
            </div>

            {/* WRITING TASK 1 CARD */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="ielts-demo-task-card"
            >
              <div className="ielts-demo-task-header">
                <h3>Writing Task 1</h3>
                <p>You should spend about 20 minutes on this task.</p>
              </div>

              <div className="ielts-demo-task-instructions-box">
                <p>
                  <strong>The graph below shows radio and television audiences throughout the day in 1992.</strong>
                </p>
                <p>
                  <strong>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</strong>
                </p>
              </div>

              <div className="ielts-demo-word-count-hint">
                Write at least 150 words.
              </div>

              <div className="ielts-demo-graph-title">
                Radio and television audiences in UK, October – December 1992
              </div>

              {/* Responsive custom SVG Line Graph */}
              <div className="ielts-demo-graph-container">
                <svg
                  width="700"
                  height="360"
                  viewBox="0 0 700 360"
                  className="ielts-demo-svg-graph"
                >
                  {/* Grid Lines and Y Ticks */}
                  {[
                    { label: '50%', y: 40 },
                    { label: '40%', y: 90 },
                    { label: '30%', y: 140 },
                    { label: '20%', y: 190 },
                    { label: '10%', y: 240 },
                    { label: '0%', y: 290 },
                  ].map((tick, i) => (
                    <g key={i}>
                      <line
                        x1="150"
                        y1={tick.y}
                        x2="650"
                        y2={tick.y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                      />
                      <text
                        x="135"
                        y={tick.y + 4}
                        fill="#4a5568"
                        fontSize="12"
                        textAnchor="end"
                        fontWeight="600"
                      >
                        {tick.label}
                      </text>
                    </g>
                  ))}

                  {/* Y Axis Vertical Title */}
                  <text
                    x="30"
                    y="165"
                    fill="#4a5568"
                    fontSize="12"
                    fontWeight="700"
                    transform="rotate(-90, 30, 165)"
                    textAnchor="middle"
                  >
                    Percentage of UK population (over 4 years old)
                  </text>

                  {/* X Axis Line */}
                  <line
                    x1="150"
                    y1="290"
                    x2="650"
                    y2="290"
                    stroke="#1a202c"
                    strokeWidth="1.5"
                  />

                  {/* Y Axis Line */}
                  <line
                    x1="150"
                    y1="40"
                    x2="150"
                    y2="290"
                    stroke="#1a202c"
                    strokeWidth="1.5"
                  />

                  {/* X Axis Ticks and Labels */}
                  {[                    { label: '6 00', x: 150 },                    { label: '8 00', x: 191.7 },                    { label: '10 00', x: 233.3 },                    { label: '12 00', sub: 'Noon', x: 275 },                    { label: '2 00', x: 316.7 },                    { label: '4 00', x: 358.3 },                    { label: '6 00', x: 400 },                    { label: '8 00', x: 441.7 },                    { label: '10 00', x: 483.3 },                    { label: '12 00', sub: 'Midnight', x: 525 },                    { label: '2 00', x: 566.7 },                    { label: '4 00', x: 608.3 },                    { label: '6 00', x: 650 },                  ].map((tick, i) => (
                    <g key={i}>
                      <line
                        x1={tick.x}
                        y1="290"
                        x2={tick.x}
                        y2="296"
                        stroke="#1a202c"
                        strokeWidth="1.5"
                      />
                      <text
                        x={tick.x}
                        y="312"
                        fill="#4a5568"
                        fontSize="11"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {tick.label}
                      </text>
                      {tick.sub && (
                        <text
                          x={tick.x}
                          y="324"
                          fill="#4a5568"
                          fontSize="9.5"
                          textAnchor="middle"
                          fontWeight="700"
                        >
                          {tick.sub}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* X Axis Title */}
                  <text
                    x="400"
                    y="348"
                    fill="#1a202c"
                    fontSize="13"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    Time of day or night
                  </text>

                  {/* Legend Box */}
                  <g transform="translate(250, 48)">
                    <rect
                      width="180"
                      height="50"
                      fill="#ffffff"
                      stroke="#4a5568"
                      strokeWidth="1.5"
                      rx="4"
                    />
                    
                    {/* Television Legend */}
                    <line
                      x1="15"
                      y1="18"
                      x2="55"
                      y2="18"
                      stroke="#2b6cb0"
                      strokeWidth="2.5"
                      strokeDasharray="6, 3"
                    />
                    <text x="65" y="22" fill="#2d3748" fontSize="12" fontWeight="600">
                      Television
                    </text>

                    {/* Radio Legend */}
                    <line
                      x1="15"
                      y1="36"
                      x2="55"
                      y2="36"
                      stroke="#e53e3e"
                      strokeWidth="2"
                      strokeDasharray="2, 2"
                    />
                    <text x="65" y="40" fill="#2d3748" fontSize="12" fontWeight="600">
                      Radio
                    </text>
                  </g>

                  {/* Line Paths */}
                  {/* Television Line */}
                  <path
                    d={tvPathD}
                    fill="none"
                    stroke="#2b6cb0"
                    strokeWidth="2.5"
                    className="ielts-writing-demo-svg-line-tv"
                  />
                  {/* Radio Line */}
                  <path
                    d={radioPathD}
                    fill="none"
                    stroke="#e53e3e"
                    strokeWidth="2"
                    className="ielts-writing-demo-svg-line-radio"
                  />

                  {/* Line dots for Television */}
                  {tvPoints.map((p, i) => (
                    <circle
                      key={`tv-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="#2b6cb0"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="ielts-writing-demo-svg-dot"
                    >
                      <title>{`Television at ${p.label}: ${p.val}`}</title>
                    </circle>
                  ))}

                  {/* Line dots for Radio */}
                  {radioPoints.map((p, i) => (
                    <circle
                      key={`radio-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r="3.5"
                      fill="#e53e3e"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="ielts-writing-demo-svg-dot"
                    >
                      <title>{`Radio at ${p.label}: ${p.val}`}</title>
                    </circle>
                  ))}
                </svg>
              </div>
            </motion.div>

            {/* WRITING TASK 2 CARD */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="ielts-demo-task-card"
            >
              <div className="ielts-demo-task-header">
                <h3>Writing Task 2</h3>
                <p>You should spend about 40 minutes on this task.</p>
              </div>

              <div className="ielts-demo-task-instructions-box">
                <p>Write about the following topic:</p>
                <p style={{ textIndent: '20px', fontWeight: 'bold', margin: '15px 0' }}>
                  Children who are brought up in families that do not have large amounts of money are better prepared to deal with the problems of adult life than children brought up by wealthy parents.
                </p>
                <p>
                  <strong>To what extent do you agree or disagree with this opinion?</strong>
                </p>
              </div>

              <div className="ielts-demo-task-instructions-box" style={{ border: 'none', padding: '0', background: 'transparent' }}>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  Give reasons for your answer and include any relevant examples from your own knowledge or experience.
                </p>
              </div>

              <div className="ielts-demo-word-count-hint">
                Write at least 250 words.
              </div>
            </motion.div>

          </div>
        </div>
      </main>
    </div>
  );
}