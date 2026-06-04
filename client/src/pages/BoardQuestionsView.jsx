import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiArrowLeft,
  HiOutlineFlag,
  HiOutlineBookmark,
  HiChevronDown,
  HiExclamationCircle
} from 'react-icons/hi';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './BoardQuestionsView.css';
import './MockTestExam.css';

const BOARD_ABBRS = {
  'Dhaka': 'DB',
  'Comilla': 'CB',
  'Rajshahi': 'RB',
  'Jessore': 'JB',
  'Chittagong': 'CtgB',
  'Sylhet': 'SB',
  'Barishal': 'BB',
  'Dinajpur': 'DjB',
  'Mymensingh': 'MB',
  'Madrasa': 'MadB',
  'Technical': 'TB'
};

const getSourceAbbreviation = (type, name, year) => {
  const yearStr = year ? String(year).slice(-2) : '';
  if (type === 'board') {
    const abbr = BOARD_ABBRS[name] || (name ? `${name.charAt(0).toUpperCase()}B` : 'BD');
    return yearStr ? `${abbr} ${yearStr}` : abbr;
  } else if (type === 'admission') {
    return yearStr ? `${name.toUpperCase()} ${year}` : name.toUpperCase();
  } else {
    const collegeAbbrs = {
      'Notre Dame College': 'NDC',
      'Adamjee Cantonment College': 'ACC',
      'Rajuk Uttara Model College': 'RUMC',
      'Holy Cross College': 'HCC',
      'Viqarunnisa Noon School & College': 'VNC',
      'Dhaka Residential Model College': 'DRMC',
      'Dhaka College': 'DC',
      'Birshreshtha Noor Mohammad Public College': 'BNMPC',
      'BAF Shaheen College Dhaka': 'BAFSD',
      'St. Joseph Higher Secondary School': 'SJC',
      'Abdul Kadir Mollah City College': 'AKMCC',
      'Government Hazi Mohammad Mohsin College': 'GHMMC',
      'Chittagong College': 'CC',
      'Rajshahi College': 'RC',
      'Government Azizul Haque College': 'GAHC',
      'Ananda Mohan College': 'AMC',
      'Cumilla Victoria Government College': 'CVGC',
      'Government Brojomohun College': 'GBC',
      'MC College': 'MCC',
      'Government Edward College': 'GEC'
    };
    const abbr = collegeAbbrs[name] || name?.split(' ').map(w => w[0]).join('').toUpperCase() || 'CLG';
    return yearStr ? `${abbr} ${yearStr}` : abbr;
  }
};

function SolutionPanel({ solution, language, renderMath }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="exam-solution-panel" style={{ marginTop: '16px' }}>
      <button
        type="button"
        className="exam-solution-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer' }}
      >
        <span>{language === 'en' ? 'Solution' : 'সমাধান'}</span>
        <HiChevronDown
          className={`exam-chevron ${isOpen ? 'exam-chevron--open' : ''}`}
          size={20}
        />
      </button>
      {isOpen && (
        <div
          className="exam-solution-body"
          dangerouslySetInnerHTML={renderMath(solution)}
        />
      )}
    </div>
  );
}

export default function BoardQuestionsView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();

  const state = location.state || {};
  const {
    sourceType = 'board',
    name = '',
    year = '',
    subject = '',
    paper = '',
    questionType = 'mcq'
  } = state;

  const [user, setUser] = useState({ role: 'student', name: 'Student' });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('topkorbo_token');
        if (!token) {
          navigate('/');
          return;
        }
        const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${backendBaseUrl}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success && data.data) {
          setUser(data.data);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUserData();
  }, [navigate]);

  useEffect(() => {
    if (!name || (sourceType !== 'admission' && (!subject || !paper))) {
      setLoading(false);
      return;
    }

    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('topkorbo_token');
        const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const params = new URLSearchParams({
          sourceType,
          name,
          type: questionType
        });
        if (subject) params.append('subject', subject);
        if (paper) params.append('paper', paper);
        if (year) params.append('year', year);
        if (state.shift) params.append('shift', state.shift);

        const response = await fetch(`${backendBaseUrl}/questions/by-source?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await response.json();
        if (resData.success && resData.data) {
          setQuestions(resData.data.questions || []);
        }
      } catch (err) {
        console.error('Error fetching source questions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [subject, paper, sourceType, name, year, questionType, state.shift]);

  const toBnNum = (numStr) => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(numStr).replace(/\d/g, d => bnDigits[d]);
  };

  const title = useMemo(() => {
    if (language === 'en') {
      const label = sourceType === 'board' ? 'Board' : sourceType === 'admission' ? 'Admission' : 'College';
      return `${name} ${label}${year ? ' ' + year : ''}`;
    } else {
      const label = sourceType === 'board' ? 'বোর্ড' : sourceType === 'admission' ? 'ভর্তি' : 'কলেজ';
      return `${name} ${label}${year ? ' ' + toBnNum(year) : ''}`;
    }
  }, [sourceType, name, year, language]);

  const subtitle = useMemo(() => {
    const timeLimit = sourceType === 'admission' ? (language === 'en' ? '1 Hour' : '১ ঘন্টা') : (language === 'en' ? '25 mins' : '২৫ মিনিট');
    if (language === 'en') {
      return `Questions: ${questions.length} · Time: ${timeLimit}`;
    } else {
      return `প্রশ্ন ${toBnNum(questions.length)} · সময় ${timeLimit}`;
    }
  }, [questions.length, language, sourceType]);

  const translatedSubject = useMemo(() => {
    const subjectMap = {
      'Physics': 'পদার্থবিজ্ঞান',
      'Chemistry': 'রসায়ন',
      'Higher Math': 'উচ্চতর গণিত',
      'Biology': 'জীববিজ্ঞান'
    };
    return subjectMap[subject] || subject;
  }, [subject]);

  const translatedPaper = useMemo(() => {
    const paperMap = {
      '1st': '১ম',
      '2nd': '২য়'
    };
    return paperMap[paper] || paper;
  }, [paper]);

  const renderMath = (text) => {
    if (!text) return { __html: '' };

    const renderedText = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, p1) => {
      try { return katex.renderToString(p1.trim(), { displayMode: true, throwOnError: false }); }
      catch (e) { return match; }
    }).replace(/\$([^\$]+)\$/g, (match, p1) => {
      try { return katex.renderToString(p1.trim(), { displayMode: false, throwOnError: false }); }
      catch (e) { return match; }
    });

    return { __html: renderedText };
  };

  const getOptionPrefix = (index) => {
    if (language === 'en') {
      return ['A', 'B', 'C', 'D'][index] || '';
    }
    return ['ক', 'খ', 'গ', 'ঘ'][index] || '';
  };

  const handleOptionSelect = (questionId, optionIndex) => {
    if (showAllAnswers) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: prev[questionId] === optionIndex ? null : optionIndex
    }));
  };

  if (!name || (sourceType !== 'admission' && !subject)) {
    return (
      <div className="exam-room-container">
        <header className="exam-header-card">
          <button type="button" className="exam-back-btn" onClick={() => navigate(-1)}>
            <HiArrowLeft size={22} />
          </button>
          <h1 className="exam-title">{language === 'en' ? 'No Source Selected' : 'কোনো উৎস নির্বাচন করা হয়নি'}</h1>
          <p className="exam-timer-text">
            {language === 'en'
              ? 'Please pick a board or college from the Question Bank to view its questions.'
              : 'প্রশ্ন দেখতে অনুগ্রহ করে কোয়েশ্চন ব্যাংক থেকে একটি বোর্ড বা কলেজ নির্বাচন করুন।'}
          </p>
        </header>
      </div>
    );
  }

  const abbr = getSourceAbbreviation(sourceType, name, year);

  return (
    <div className="exam-room-container">
      <header className="exam-header-card">
        <button type="button" className="exam-back-btn" onClick={() => navigate(-1)}>
          <HiArrowLeft size={22} />
        </button>
        <h1 className="exam-title">{title}</h1>
        <p className="exam-timer-text">{subtitle}</p>

        {/* Toggle Show/Hide Answers Button */}
        {questions.length > 0 && (
          <button
            type="button"
            className="exam-show-answers-toggle-btn"
            onClick={() => setShowAllAnswers(!showAllAnswers)}
          >
            {showAllAnswers
              ? (language === 'en' ? 'Hide Answers' : 'উত্তর লুকান')
              : (language === 'en' ? 'Show Answers' : 'উত্তর দেখান')}
          </button>
        )}
      </header>

      {sourceType !== 'admission' && (
        <h2 className="bqv-subject-title">
          {language === 'en'
            ? `${subject} ${paper ? paper + ' Paper' : ''} (${questions.length})`
            : `${translatedSubject} ${translatedPaper ? '(' + translatedPaper + ' পত্র)' : ''} (${toBnNum(questions.length)})`}
        </h2>
      )}

      <div className="exam-questions-list">
        {loading ? (
          <div className="exam-question-card" style={{ textAlign: 'center', padding: '40px' }}>
            <p>{t('qbank.source_action.preview_loading') || 'Loading questions...'}</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="exam-question-card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <HiExclamationCircle size={42} style={{ color: '#94A3B8' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1F2937', margin: 0 }}>
                {language === 'en'
                  ? 'No questions found for this source yet.'
                  : 'এই উৎসের জন্য এখনও কোনো প্রশ্ন যোগ করা হয়নি।'}
              </h3>
              <p style={{ color: '#6B7280', margin: 0 }}>
                {language === 'en'
                  ? 'Once teachers upload questions tagged to this board/college + year, they will appear here.'
                  : 'যখন শিক্ষকরা এই বোর্ড/কলেজ ও বছরের সাথে ট্যাগ করা প্রশ্ন আপলোড করবেন, সেগুলো এখানে দেখা যাবে।'}
              </p>
            </div>
          </div>
        ) : (
          questions.map((q, idx) => {
            const id = q._id || idx;
            const isMcq = q.type === 'mcq';
            const isCq = q.type === 'cq';
            const questionKey = q._id || `q-${idx}`;

            const getOptionState = (optIdx) => {
              if (!showAllAnswers) return '';
              const selectedIndex = selectedAnswers[questionKey];
              const correctIndex = q.options?.findIndex(o => o.isCorrect);

              if (optIdx === correctIndex) return 'correct';
              if (optIdx === selectedIndex && selectedIndex !== correctIndex) return 'wrong';
              return '';
            };

            return (
              <div key={id} className="exam-question-card">
                {/* Meta tags and actions positioned like the image */}
                <div className="exam-question-meta-right">
                  {abbr && (
                    <span className="exam-question-tag exam-question-tag--board">
                      {abbr}
                    </span>
                  )}
                  <button type="button" className="exam-meta-action-btn" title="Report">
                    <HiOutlineFlag size={18} />
                  </button>
                  <button type="button" className="exam-meta-action-btn" title="Bookmark">
                    <HiOutlineBookmark size={18} />
                  </button>
                </div>

                {/* Question text */}
                <div className="exam-question-top">
                  <div className="exam-question-text-wrapper">
                    <span className="exam-question-number">
                      {language === 'en' ? `${idx + 1}. ` : `${toBnNum(idx + 1)}. `}
                    </span>
                    <span
                      className="exam-question-text"
                      dangerouslySetInnerHTML={renderMath(q.questionText)}
                    />
                  </div>
                </div>

                {/* Question image */}
                {q.imageUrl && (
                  <div className="exam-question-image">
                    <img src={q.imageUrl} alt="Question figure" />
                  </div>
                )}

                {/* MCQ Options */}
                {isMcq && q.options && (
                  <div className="exam-options-grid">
                    {q.options.map((opt, optIdx) => {
                      const isOptSelected = selectedAnswers[questionKey] === optIdx;
                      const optionState = getOptionState(optIdx);
                      return (
                        <button
                          key={optIdx}
                          className={`exam-option-btn ${isOptSelected && !showAllAnswers ? 'exam-option-btn--selected' : ''} ${optionState ? `exam-option-btn--${optionState}` : ''}`}
                          onClick={() => handleOptionSelect(questionKey, optIdx)}
                          type="button"
                        >
                          <div className={`exam-option-prefix ${isOptSelected && !showAllAnswers ? 'exam-option-prefix--selected' : ''} ${optionState ? `exam-option-prefix--${optionState}` : ''}`}>
                            {getOptionPrefix(optIdx)}
                          </div>
                          <div
                            className="exam-option-text"
                            dangerouslySetInnerHTML={renderMath(opt.text)}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* CQ stem and parts */}
                {isCq && q.cq && (
                  <div className="bqv-cq" style={{ border: '2px solid #E2E8F0', background: '#F8FAFC', color: '#1E293B', borderRadius: '8px', padding: '16px' }}>
                    <p className="bqv-cq__stem" dangerouslySetInnerHTML={renderMath(q.cq.description)} style={{ margin: 0, fontWeight: 600 }} />
                    {Array.isArray(q.cq.parts) && q.cq.parts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        {q.cq.parts.map((p, pi) => (
                          <div key={pi} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.95rem' }}>
                            <span style={{ fontWeight: '700', color: '#4F46E5', minWidth: '24px' }}>({p.label})</span>
                            <span dangerouslySetInnerHTML={renderMath(p.text)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Written placeholder */}
                {!isMcq && !isCq && q.questionText && (
                  <div style={{ fontStyle: 'italic', color: '#6B7280', marginTop: '8px' }}>
                    {language === 'en' ? 'Written Question' : 'লিখিত প্রশ্ন'}
                  </div>
                )}


              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
