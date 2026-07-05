import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiArrowLeft,
  HiOutlineFlag,
  HiOutlineBookmark,
  HiChevronDown,
  HiExclamationCircle,
  HiEye,
  HiSparkles,
  HiX,
  HiPaperAirplane,
  HiPaperClip
} from 'react-icons/hi';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { buildInlinePayload, submitAttempt as saveInlineAttempt } from '../services/practiceApi';
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

function SolutionPanel({ solution, solutionImageUrl, language, renderMath, forceOpen }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(forceOpen);
  }, [forceOpen]);

  let isCqSolution = false;
  let parsedSolutions = [];
  try {
    if (solution && (solution.trim().startsWith('[') || solution.trim().startsWith('{'))) {
      const parsed = JSON.parse(solution);
      if (Array.isArray(parsed)) {
        isCqSolution = true;
        parsedSolutions = parsed;
      }
    }
  } catch (e) {
    // Not a JSON solution
  }

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
        <div className="exam-solution-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          {isCqSolution ? (
            parsedSolutions.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: idx < parsedSolutions.length - 1 ? '1px solid #E2E8F0' : 'none', paddingBottom: idx < parsedSolutions.length - 1 ? '12px' : '0' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '700', color: '#4F46E5', minWidth: '24px' }}>({item.label.toLowerCase()})</span>
                  <span dangerouslySetInnerHTML={renderMath(item.text)} />
                </div>
                {item.imageUrl && (
                  <div style={{ marginTop: '8px', maxWidth: '100%', overflow: 'hidden' }}>
                    <img src={item.imageUrl} alt={`Solution Part ${item.label.toUpperCase()}`} style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain', borderRadius: '6px' }} />
                  </div>
                )}
              </div>
            ))
          ) : (
            <>
              {solution && <div dangerouslySetInnerHTML={renderMath(solution)} />}
              {solutionImageUrl && (
                <div style={{ marginTop: '8px', maxWidth: '100%', overflow: 'hidden' }}>
                  <img src={solutionImageUrl} alt="Solution Figure" style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain', borderRadius: '6px' }} />
                </div>
              )}
              {!solution && !solutionImageUrl && (
                <div style={{ color: '#94A3B8', fontStyle: 'italic' }}>
                  {language === 'en' ? 'No explanation added yet.' : 'এখনও ব্যাখ্যা যোগ করা হয়নি।'}
                </div>
              )}
            </>
          )}
        </div>
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
  // Track when each question was first rendered so we can record time-spent
  const questionStartRef = useRef({});

  // AI Explanation & Tutor Modal states
  const [explanationModalQuestion, setExplanationModalQuestion] = useState(null);
  const [explanationTab, setExplanationTab] = useState("manual");
  const [aiExplanations, setAiExplanations] = useState({});
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiChatThreads, setAiChatThreads] = useState({});
  const [followUpText, setFollowUpText] = useState("");
  const [followUpImage, setFollowUpImage] = useState(null);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const followUpFileRef = useRef(null);

  const processImageFile = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const renderMarkdownWithMath = (text) => {
    if (!text) return { __html: "" };

    // Normalize double backslashes to single backslashes for LaTeX commands/symbols
    const normalizedText = text.replace(/\\\\([a-zA-Z\d_{}%])/g, '\\$1');

    const mathBlocks = [];

    // 1. Extract and render display math: $$...$$
    let processed = normalizedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, p1) => {
      try {
        const rendered = katex.renderToString(p1.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        const index = mathBlocks.length;
        mathBlocks.push(rendered);
        return `%%MATH_BLOCK_${index}%%`;
      } catch (e) {
        return match;
      }
    });

    // 2. Extract and render inline math: $...$
    processed = processed.replace(/\$([^\$]+)\$/g, (match, p1) => {
      try {
        const rendered = katex.renderToString(p1.trim(), {
          displayMode: false,
          throwOnError: false,
        });
        const index = mathBlocks.length;
        mathBlocks.push(rendered);
        return `%%MATH_BLOCK_${index}%%`;
      } catch (e) {
        return match;
      }
    });

    // 3. Apply markdown formatting to the remaining text (with placeholders)
    processed = processed
      // Headings: ### Heading, ## Heading, # Heading
      .replace(/^### (.+)$/gm, '<div style="font-size:15px;font-weight:700;color:#4F46E5;margin:16px 0 6px;border-bottom:1px solid #E2E8F0;padding-bottom:4px;">$1</div>')
      .replace(/^## (.+)$/gm, '<div style="font-size:17px;font-weight:700;color:#1E293B;margin:20px 0 8px;border-bottom:2px solid #6366F1;padding-bottom:6px;">$1</div>')
      .replace(/^# (.+)$/gm, '<div style="font-size:19px;font-weight:800;color:#1E293B;margin:20px 0 10px;border-bottom:2px solid #6366F1;padding-bottom:6px;">$1</div>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1E293B;">$1</strong>')
      // Numbered steps
      .replace(/^(\d+)\.\s/gm, '<span style="display:inline-block;background:#6366F1;color:#FFF;font-weight:700;font-size:13px;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;margin-right:8px;">$1</span>')
      // Bullet points
      .replace(/^[-•]\s(.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;"><span style="color:#6366F1;font-weight:bold;margin-top:2px;">•</span><span>$1</span></div>')
      // Line breaks
      .replace(/\n\n/g, '<div style="margin:12px 0;"></div>')
      .replace(/\n/g, '<br/>');

    // 4. Restore the math blocks
    mathBlocks.forEach((renderedMath, index) => {
      processed = processed.replace(`%%MATH_BLOCK_${index}%%`, () => renderedMath);
    });

    return { __html: processed };
  };

  const handleSendFollowUp = async () => {
    if (!explanationModalQuestion || isSendingFollowUp) return;
    const text = followUpText.trim();
    if (!text && !followUpImage) return;

    const qId = explanationModalQuestion._id;
    const currentThread = aiChatThreads[qId] || [];

    // 1. Construct the new user message
    const userMessage = {
      role: "user",
      content: text,
      image: followUpImage || undefined
    };

    // 2. Optimistically append user message to local state
    setAiChatThreads(prev => ({
      ...prev,
      [qId]: [...currentThread, userMessage]
    }));

    // Clear follow-up input states
    setFollowUpText("");
    setFollowUpImage(null);
    setIsSendingFollowUp(true);

    try {
      const backendBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${backendBaseUrl}/evaluate/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("topkorbo_token") || localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          questionId: qId,
          history: currentThread,
          message: text,
          studentImageBase64: userMessage.image
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Append AI response
        setAiChatThreads(prev => ({
          ...prev,
          [qId]: [
            ...(prev[qId] || []),
            { role: "assistant", content: data.response }
          ]
        }));
      } else {
        const errData = await res.json().catch(() => ({}));
        setAiChatThreads(prev => ({
          ...prev,
          [qId]: [
            ...(prev[qId] || []),
            { role: "assistant", content: `Error: ${errData.msg || "Failed to send message."}` }
          ]
        }));
      }
    } catch (err) {
      setAiChatThreads(prev => ({
        ...prev,
        [qId]: [
          ...(prev[qId] || []),
          { role: "assistant", content: `Network Error: ${err.message}` }
        ]
      }));
    } finally {
      setIsSendingFollowUp(false);
    }
  };

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
    const newSelected =
      selectedAnswers[questionId] === optionIndex ? null : optionIndex;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: newSelected
    }));

    // ── Inline practice persistence (option B): every answered Q is logged
    //    as a lightweight `inline_qbank` PracticeAttempt in the backend.
    try {
      const idx = typeof questionId === "string" && questionId.startsWith("q-")
        ? Number(questionId.slice(2))
        : questions.findIndex((qq) => (qq._id || `q-${questions.indexOf(qq)}`) === questionId);
      const question = questions[idx];
      if (!question) return;
      const startedAt = questionStartRef.current[questionId] || Date.now();
      const timeSpent = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      const payload = buildInlinePayload({
        question,
        selectedIndex: newSelected,
        timeSpentSeconds: timeSpent
      });
      saveInlineAttempt(payload).catch((err) =>
        console.warn("[practice] inline save failed", err)
      );
    } catch (err) {
      console.warn("[practice] inline save failed", err);
    }
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
            // Stamp the moment the question enters the DOM for time-spent tracking
            if (!questionStartRef.current[`q-${idx}`] && !questionStartRef.current[id]) {
              questionStartRef.current[id] = Date.now();
            }
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
                  <button
                    type="button"
                    className="exam-meta-action-btn"
                    onClick={() => {
                      setExplanationModalQuestion(q);
                      setExplanationTab("manual");
                    }}
                    title={
                      language === "en"
                        ? "Show Explanation"
                        : "ব্যাখ্যা দেখুন"
                    }
                  >
                    <HiEye size={18} />
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

                {user?.role !== 'student' && (
                  <SolutionPanel
                    solution={q.solution}
                    solutionImageUrl={q.solutionImageUrl}
                    language={language}
                    renderMath={renderMath}
                    forceOpen={showAllAnswers}
                  />
                )}

              </div>
            );
          })
        )}
      </div>
      {explanationModalQuestion && (
        <div
          className="exam-explanation-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setExplanationModalQuestion(null)}
        >
          <div
            className="exam-explanation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="exam-explanation-close"
              onClick={() => setExplanationModalQuestion(null)}
              aria-label="Close"
            >
              <HiX size={20} />
            </button>
            <h2 className="exam-explanation-title">
              {language === "en" ? "Explanation" : "ব্যাখ্যা"}
            </h2>
            <div className="exam-explanation-question-preview">
              <strong className="exam-explanation-q-label">
                {language === "en" ? "Question: " : "প্রশ্ন: "}
              </strong>
              <div
                className="exam-explanation-q-text"
                dangerouslySetInnerHTML={renderMath(
                  explanationModalQuestion.questionText,
                )}
              />
            </div>

            <div className="exam-explanation-tabs">
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === "manual" ? "exam-explanation-tab-btn--active" : ""}`}
                onClick={() => setExplanationTab("manual")}
              >
                {language === "en"
                  ? "Manual Explanation"
                  : "ম্যানুয়াল ব্যাখ্যা"}
              </button>
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === "ai" ? "exam-explanation-tab-btn--active" : ""}`}
                onClick={() => setExplanationTab("ai")}
              >
                {language === "en" ? "AI Explanation" : "এআই ব্যাখ্যা"}
              </button>
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === "video" ? "exam-explanation-tab-btn--active" : ""}`}
                onClick={() => setExplanationTab("video")}
              >
                {language === "en" ? "Video Solution" : "ভিডিও সমাধান"}
              </button>
            </div>

            <div className="exam-explanation-content">
              {explanationTab === "manual" &&
                (() => {
                  let isCqSolution = false;
                  let parsedSolutions = [];
                  const solutionStr = explanationModalQuestion.solution;
                  try {
                    if (
                      solutionStr &&
                      (solutionStr.trim().startsWith("[") ||
                        solutionStr.trim().startsWith("{"))
                    ) {
                      const parsed = JSON.parse(solutionStr);
                      if (Array.isArray(parsed)) {
                        isCqSolution = true;
                        parsedSolutions = parsed;
                      }
                    }
                  } catch (e) {
                    // Not JSON
                  }

                  if (isCqSolution) {
                    return (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        {parsedSolutions.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              borderBottom:
                                idx < parsedSolutions.length - 1
                                  ? "1px solid #E2E8F0"
                                  : "none",
                              paddingBottom:
                                idx < parsedSolutions.length - 1 ? "12px" : "0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "flex-start",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: "700",
                                  color: "#4F46E5",
                                  minWidth: "24px",
                                }}
                              >
                                ({item.label.toLowerCase()})
                              </span>
                              <span
                                dangerouslySetInnerHTML={renderMath(item.text)}
                              />
                            </div>
                            {item.imageUrl && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  maxWidth: "100%",
                                  overflow: "hidden",
                                }}
                              >
                                <img
                                  src={item.imageUrl}
                                  alt={`Solution Part ${item.label.toUpperCase()}`}
                                  style={{
                                    maxWidth: "300px",
                                    maxHeight: "200px",
                                    objectFit: "contain",
                                    borderRadius: "6px",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div
                        className="exam-explanation-body-text"
                        dangerouslySetInnerHTML={renderMath(
                          solutionStr ||
                            (language === "en"
                              ? "No explanation added yet."
                              : "এখনও ব্যাখ্যা যোগ করা হয়নি।"),
                        )}
                      />
                      {explanationModalQuestion.solutionImageUrl && (
                        <div
                          style={{
                            marginTop: "8px",
                            maxWidth: "100%",
                            overflow: "hidden",
                          }}
                        >
                          <img
                            src={explanationModalQuestion.solutionImageUrl}
                            alt="Solution Figure"
                            style={{
                              maxWidth: "300px",
                              maxHeight: "200px",
                              objectFit: "contain",
                              borderRadius: "6px",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
              {explanationTab === "ai" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Action buttons */}
                  {!aiExplanations[explanationModalQuestion?._id] && !aiExplainLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '32px 16px' }}>
                      <p style={{ margin: '0 0 8px', color: '#64748B', fontSize: '15px', textAlign: 'center', lineHeight: '1.6' }}>
                        {language === "en" 
                          ? "Get a detailed step-by-step solution from the AI Tutor. You can ask follow-up questions and upload images in the chat." 
                          : "এআই টিউটরের কাছ থেকে এই প্রশ্নটির একটি বিস্তারিত সমাধান তৈরি করো। তুমি চ্যাটের মাধ্যমে পরবর্তী প্রশ্ন জিজ্ঞাসা করতে এবং ছবি আপলোড করতে পারবে।"}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!explanationModalQuestion) return;
                          setAiExplainLoading(true);
                          try {
                            const backendBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                            const res = await fetch(`${backendBaseUrl}/evaluate/explain`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${localStorage.getItem("topkorbo_token") || localStorage.getItem("token")}`,
                              },
                              body: JSON.stringify({
                                questionId: explanationModalQuestion._id,
                              }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setAiExplanations(prev => ({ ...prev, [explanationModalQuestion._id]: data.explanation }));
                              
                              const initialThread = [
                                {
                                  role: "user",
                                  content: language === "en" ? "Generate a detailed solution for this question." : "এই প্রশ্নের একটি বিস্তারিত সমাধান তৈরি করো।"
                                },
                                {
                                  role: "assistant",
                                  content: data.explanation
                                }
                              ];
                              
                              setAiChatThreads(prev => ({
                                ...prev,
                                [explanationModalQuestion._id]: initialThread
                              }));
                            } else {
                              const errData = await res.json().catch(() => ({}));
                              setAiExplanations(prev => ({ ...prev, [explanationModalQuestion._id]: `Error: ${errData.msg || 'Failed to generate explanation.'}` }));
                            }
                          } catch (err) {
                            setAiExplanations(prev => ({ ...prev, [explanationModalQuestion._id]: `Network Error: ${err.message}` }));
                          } finally {
                            setAiExplainLoading(false);
                          }
                        }}
                        style={{
                          padding: '12px 24px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                          color: '#FFF',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.45)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.35)'; }}
                      >
                        <HiSparkles size={18} />
                        {language === "en" ? "Generate Detailed Solution" : "বিস্তারিত সমাধান তৈরি করো"}
                      </button>
                    </div>
                  )}

                  {/* Loading state */}
                  {aiExplainLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px 16px' }}>
                      <div style={{
                        width: '40px', height: '40px',
                        border: '3px solid #E2E8F0',
                        borderTopColor: '#6366F1',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      <p style={{ color: '#6366F1', fontWeight: '500', fontSize: '15px', margin: 0 }}>
                        {language === "en" ? "AI is thinking..." : "AI চিন্তা করছে..."}
                      </p>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}

                  {/* Explanation output & Tutoring Chat */}
                  {aiExplanations[explanationModalQuestion?._id] && !aiExplainLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Messages Thread */}
                      <div 
                        className="ai-chat-thread-container"
                        style={{ 
                          maxHeight: '400px', 
                          overflowY: 'auto', 
                          padding: '12px',
                          border: '1px solid #F1F5F9',
                          borderRadius: '12px',
                          backgroundColor: '#FAF9F6',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px'
                        }}
                      >
                        {(aiChatThreads[explanationModalQuestion._id] || [
                          { role: "assistant", content: aiExplanations[explanationModalQuestion._id] }
                        ]).map((msg, index) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div 
                              key={index}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isUser ? 'flex-end' : 'flex-start',
                                alignSelf: isUser ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                gap: '4px'
                              }}
                            >
                              {/* Avatar / Name label */}
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', margin: isUser ? '0 8px 0 0' : '0 0 0 8px' }}>
                                {isUser 
                                  ? (language === "en" ? "You" : "তুমি") 
                                  : (language === "en" ? "AI Tutor" : "এআই টিউটর")}
                              </span>

                              {/* Message bubble */}
                              <div
                                style={{
                                  background: isUser 
                                    ? 'linear-gradient(135deg, #6366F1, #4F46E5)' 
                                    : '#FFFFFF',
                                  color: isUser ? '#FFFFFF' : '#1E293B',
                                  border: isUser ? 'none' : '1px solid #E2E8F0',
                                  borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                  padding: '12px 16px',
                                  boxShadow: isUser ? '0 3px 10px rgba(99, 102, 241, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.03)',
                                  fontSize: '14px',
                                  lineHeight: '1.6',
                                }}
                              >
                                {/* Thumbnail attachment if present */}
                                {msg.image && (
                                  <div style={{ marginBottom: '8px' }}>
                                    <img 
                                      src={msg.image} 
                                      alt="Attachment" 
                                      style={{ 
                                        maxWidth: '180px', 
                                        maxHeight: '130px', 
                                        objectFit: 'contain', 
                                        borderRadius: '8px', 
                                        border: '1px solid rgba(255, 255, 255, 0.2)' 
                                      }} 
                                    />
                                  </div>
                                )}
                                <div 
                                  className="chat-bubble-text"
                                  dangerouslySetInnerHTML={
                                    isUser 
                                      ? { __html: msg.content.replace(/\n/g, '<br/>') } 
                                      : renderMarkdownWithMath(msg.content)
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}

                        {/* Typing / Sending indicator */}
                        {isSendingFollowUp && (
                          <div 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              alignSelf: 'flex-start',
                              background: '#F1F5F9',
                              borderRadius: '12px 12px 12px 2px',
                              padding: '10px 14px',
                              color: '#64748B',
                              fontSize: '13px'
                            }}
                          >
                            <div style={{
                              width: '6px', height: '6px',
                              backgroundColor: '#94A3B8',
                              borderRadius: '50%',
                              animation: 'bounce 1.4s infinite ease-in-out both'
                            }} />
                            <div style={{
                              width: '6px', height: '6px',
                              backgroundColor: '#94A3B8',
                              borderRadius: '50%',
                              animation: 'bounce 1.4s infinite ease-in-out both 0.2s'
                            }} />
                            <div style={{
                              width: '6px', height: '6px',
                              backgroundColor: '#94A3B8',
                              borderRadius: '50%',
                              animation: 'bounce 1.4s infinite ease-in-out both 0.4s'
                            }} />
                            <span style={{ marginLeft: '4px' }}>
                              {language === "en" ? "AI is replying..." : "AI উত্তর দিচ্ছে..."}
                            </span>
                            <style>{`
                              @keyframes bounce {
                                0%, 80%, 100% { transform: scale(0); }
                                40% { transform: scale(1.0); }
                              }
                            `}</style>
                          </div>
                        )}
                      </div>

                      {/* Chat Input & File upload Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Hidden follow-up image file input */}
                        <input
                          ref={followUpFileRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            processImageFile(file, (dataUrl) => {
                              setFollowUpImage(dataUrl);
                            });
                          }}
                        />

                        {/* Image Preview attachment */}
                        {followUpImage && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', position: 'relative' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img 
                                src={followUpImage} 
                                alt="Attachment preview" 
                                style={{ maxWidth: '100px', maxHeight: '80px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                              />
                              <button
                                type="button"
                                onClick={() => setFollowUpImage(null)}
                                style={{
                                  position: 'absolute',
                                  top: '-6px',
                                  right: '-6px',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: '#EF4444',
                                  color: '#FFF',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px'
                                }}
                              >
                                <HiX size={12} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Input bar */}
                        <div 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            border: '1.5px solid #CBD5E1', 
                            borderRadius: '10px', 
                            padding: '4px 8px', 
                            backgroundColor: '#FFF' 
                          }}
                        >
                          {/* Image Attach Button */}
                          <button
                            type="button"
                            onClick={() => followUpFileRef.current?.click()}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#64748B',
                              cursor: 'pointer',
                              padding: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title={language === "en" ? "Attach image" : "ছবি যুক্ত করুন"}
                          >
                            <HiPaperClip size={20} />
                          </button>

                          {/* Chat Input Textarea */}
                          <textarea
                            value={followUpText}
                            onChange={(e) => setFollowUpText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendFollowUp();
                              }
                            }}
                            placeholder={language === "en" ? "Ask a follow-up question..." : "এই প্রশ্নটি সম্পর্কে কোনো কনফিউশন থাকলে জিজ্ঞাসা করো..."}
                            style={{
                              flex: 1,
                              border: 'none',
                              outline: 'none',
                              resize: 'none',
                              height: '40px',
                              maxHeight: '100px',
                              fontFamily: 'inherit',
                              fontSize: '14px',
                              color: '#1E293B',
                              padding: '8px 4px',
                            }}
                          />

                          {/* Send Button */}
                          <button
                            type="button"
                            onClick={handleSendFollowUp}
                            disabled={isSendingFollowUp || (!followUpText.trim() && !followUpImage)}
                            style={{
                              backgroundColor: (followUpText.trim() || followUpImage) && !isSendingFollowUp ? '#6366F1' : '#E2E8F0',
                              color: (followUpText.trim() || followUpImage) && !isSendingFollowUp ? '#FFF' : '#94A3B8',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px',
                              cursor: (followUpText.trim() || followUpImage) && !isSendingFollowUp ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            <HiPaperAirplane size={16} style={{ transform: 'rotate(90deg)' }} />
                          </button>
                        </div>
                      </div>

                      {/* Reset / Regenerate solution */}
                      <button
                        type="button"
                        onClick={() => {
                          setAiExplanations(prev => {
                            const copy = { ...prev };
                            delete copy[explanationModalQuestion._id];
                            return copy;
                          });
                          setAiChatThreads(prev => {
                            const copy = { ...prev };
                            delete copy[explanationModalQuestion._id];
                            return copy;
                          });
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFF',
                          color: '#64748B',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          marginTop: '4px'
                        }}
                      >
                        {language === "en" ? "↻ Reset Conversation" : "↻ নতুন করে শুরু করো"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {explanationTab === "video" && (
                <div className="exam-explanation-placeholder">
                  <div className="exam-explanation-placeholder-badge">
                    {language === "en" ? "Coming Soon" : "শীঘ্রই আসছে"}
                  </div>
                  <p>
                    {language === "en"
                      ? "Video solution is being prepared and will be added in a future update."
                      : "ভিডিও সমাধান তৈরি করা হচ্ছে এবং শীঘ্রই যুক্ত করা হবে।"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
