import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiArrowLeft, HiBookmark, HiCheckCircle, HiChevronDown, HiX, HiClock, HiEye } from 'react-icons/hi';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import Confetti from 'react-confetti';
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

const UNIV_ABBRS = {
  'Dhaka University': 'DU',
  'Chittagong University': 'CU',
  'Rajshahi University': 'RU',
  'Jahangirnagar University': 'JU',
  'Agriculture (Cluster)': 'AGRI',
  'GST (Cluster)': 'GST',
  'CKRUET (Cluster)': 'CKRUET',
  'IBA (DU)': 'IBA'
};

const getTagAbbreviation = (tag) => {
  if (!tag) return '';
  const yearStr = tag.year ? String(tag.year).slice(-2) : '';
  
  if (tag.category === 'board') {
    const boardAbbr = BOARD_ABBRS[tag.board] || (tag.board ? `${tag.board.charAt(0).toUpperCase()}B` : '');
    return yearStr ? `${boardAbbr}-${yearStr}` : boardAbbr;
  } else {
    const univ = tag.university || '';
    const univAbbr = UNIV_ABBRS[univ] || univ;
    return yearStr ? `${univAbbr}-${yearStr}` : univAbbr;
  }
};

const getTagTitle = (tag) => {
  if (!tag) return '';
  if (tag.category === 'board') {
    return `${tag.board} Board ${tag.year ? `- ${tag.year}` : ''}`;
  } else {
    return `${tag.university} ${tag.unit ? `(${tag.unit})` : ''} ${tag.year ? `- ${tag.year}` : ''}`;
  }
};

export default function MockTestExam() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [config, setConfig] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [explanationModalQuestion, setExplanationModalQuestion] = useState(null);
  const [explanationTab, setExplanationTab] = useState('manual'); // 'manual' | 'ai' | 'video'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'correct' | 'skipped' | 'wrong'
  const [fromQbank, setFromQbank] = useState(false);

  useEffect(() => {
    const storedQuestions = sessionStorage.getItem('mock_exam_questions');
    const storedConfig = sessionStorage.getItem('mock_exam_config');
    const storedFromQbank = sessionStorage.getItem('mock_exam_from_qbank') === 'true';

    if (!storedQuestions || !storedConfig) {
      navigate(storedFromQbank ? '/qbank' : '/mock-test');
      return;
    }

    try {
      const parsedQuestions = JSON.parse(storedQuestions);
      const parsedConfig = JSON.parse(storedConfig);
      setQuestions(parsedQuestions);
      setConfig(parsedConfig);
      setTimeLeft(parsedConfig.duration * 60);
      setFromQbank(storedFromQbank);
    } catch (e) {
      console.error('Failed to parse exam data', e);
      navigate(storedFromQbank ? '/qbank' : '/mock-test');
    }
  }, [navigate]);

  const getQuestionKey = (question, index) => question._id || `question-${index}`;

  const getCorrectOptionIndex = (question) => {
    if (!Array.isArray(question.options)) return -1;
    return question.options.findIndex((option) => option.isCorrect);
  };

  const resultStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let score = 0;

    questions.forEach((question, index) => {
      const key = getQuestionKey(question, index);
      const selectedIndex = answers[key];
      const correctIndex = getCorrectOptionIndex(question);

      if (selectedIndex === undefined || selectedIndex === null) {
        skipped += 1;
        return;
      }

      if (selectedIndex === correctIndex) {
        correct += 1;
        score += 1;
      } else {
        wrong += 1;
        if (config?.negativeMarking) score -= 0.25;
      }
    });

    return {
      correct,
      wrong,
      skipped,
      score: Math.max(0, score),
      total: questions.length,
      timeTakenSeconds: Math.max(0, (config?.duration || 0) * 60 - timeLeft)
    };
  }, [answers, config, questions, timeLeft]);

  useEffect(() => {
    if (isSubmitted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted, timeLeft]);

  const handleSubmit = () => {
    if (isSubmitted) return;
    setIsSubmitted(true);
    setShowResultModal(true);
  };

  const handleContinueToReview = () => {
    setShowResultModal(false);
    setIsReviewMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartAgain = () => {
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
      'mock_exam_from_qbank'
    ].forEach((key) => sessionStorage.removeItem(key));
    navigate(fromQbank ? '/qbank' : '/mock-test');
  };

  const handleOptionSelect = (questionId, optionIndex) => {
    if (isSubmitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toBnNum = (numStr) => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(numStr).replace(/\d/g, d => bnDigits[d]);
  };

  const formatDisplayNumber = (value) => {
    const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
    return language === 'en' ? normalized : toBnNum(normalized);
  };

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

  const getOptionState = (question, questionIndex, optionIndex) => {
    if (!isReviewMode) return '';
    const key = getQuestionKey(question, questionIndex);
    const selectedIndex = answers[key];
    const correctIndex = getCorrectOptionIndex(question);

    if (optionIndex === correctIndex) return 'correct';
    if (optionIndex === selectedIndex && selectedIndex !== correctIndex) return 'wrong';
    return '';
  };

  if (questions.length === 0 || !config) {
    return <div className="exam-loading">Loading...</div>;
  }

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const timeLabel = language === 'en'
    ? `${Math.ceil(resultStats.timeTakenSeconds / 60)} min`
    : `${toBnNum(Math.ceil(resultStats.timeTakenSeconds / 60))} মিনিট`;

  return (
    <div className={`exam-room-container ${showResultModal ? 'exam-room-container--dimmed' : ''}`}>
      <header className={`exam-header-card ${isReviewMode ? 'exam-header-card--review' : ''}`}>
        {isReviewMode && (
          <button type="button" className="exam-back-btn" onClick={() => navigate(fromQbank ? '/qbank' : '/mock-test')}>
            <HiArrowLeft size={22} />
          </button>
        )}
        <h1 className="exam-title">
          {fromQbank
            ? (language === 'en' ? 'Question Bank Exam' : 'প্রশ্নব্যাংক পরীক্ষা')
            : (language === 'en' ? 'Mock Test' : 'মক পরীক্ষা')}
        </h1>

        {isReviewMode ? (
          <>
            <div className="exam-report-cards">
              <div className="exam-report-card exam-report-card--score">
                <span>{language === 'en' ? 'Points earned' : 'পয়েন্ট পেয়েছো'}</span>
                <strong>★ {formatDisplayNumber(resultStats.score)}</strong>
              </div>
              <div className="exam-report-card exam-report-card--marks">
                <span>{language === 'en' ? 'Marks' : 'মার্কস'}</span>
                <strong>● {formatDisplayNumber(resultStats.correct)} / {formatDisplayNumber(resultStats.total)}</strong>
              </div>
              <div className="exam-report-card exam-report-card--time">
                <span>{language === 'en' ? 'Time taken' : 'সময় নিয়েছো'}</span>
                <strong>◉ {timeLabel}</strong>
              </div>
            </div>
            <div className="exam-result-chips">
              <button 
                type="button"
                className={`exam-result-chip exam-result-chip--correct ${filterType === 'correct' ? 'exam-result-chip--active' : ''}`}
                onClick={() => setFilterType(prev => prev === 'correct' ? 'all' : 'correct')}
              >
                <i /> {formatDisplayNumber(resultStats.correct)} {language === 'en' ? 'Correct' : 'সঠিক'}
              </button>
              <button 
                type="button"
                className={`exam-result-chip exam-result-chip--skipped ${filterType === 'skipped' ? 'exam-result-chip--active' : ''}`}
                onClick={() => setFilterType(prev => prev === 'skipped' ? 'all' : 'skipped')}
              >
                <i /> {formatDisplayNumber(resultStats.skipped)} {language === 'en' ? 'Skipped' : 'স্কিপ'}
              </button>
              <button 
                type="button"
                className={`exam-result-chip exam-result-chip--wrong ${filterType === 'wrong' ? 'exam-result-chip--active' : ''}`}
                onClick={() => setFilterType(prev => prev === 'wrong' ? 'all' : 'wrong')}
              >
                <i /> {formatDisplayNumber(resultStats.wrong)} {language === 'en' ? 'Wrong' : 'ভুল'}
              </button>
            </div>
            <button type="button" className="exam-start-again-btn" onClick={handleStartAgain}>
              {fromQbank
                ? (language === 'en' ? 'Back to Question Bank' : 'প্রশ্নব্যাংকে ফিরে যাও')
                : (language === 'en' ? 'Back to Mock Test' : 'মক টেস্টে ফিরে যাও')}
            </button>
          </>
        ) : (
          <>
            <p className="exam-timer-text">
              {language === 'en' ? 'Time: ' : 'সময়: '}
              {language === 'en' ? `${config.duration} Minutes` : `${toBnNum(config.duration)} মিনিট`}
            </p>
            <p className="exam-rules-text">
              {language === 'en'
                ? `Full marks per question is 1 ${config.negativeMarking ? 'and 25% marks will be deducted for wrong answer' : ''}`
                : `প্রতি প্রশ্নের পূর্ণমান ১ ${config.negativeMarking ? 'এবং ভুল উত্তরে ২৫% মার্কস কাটা যাবে' : ''}`}
            </p>
          </>
        )}
      </header>

      <div className="exam-questions-list">
        {questions.filter((q, qIndex) => {
          if (!isReviewMode || filterType === 'all') return true;
          const questionKey = getQuestionKey(q, qIndex);
          const selectedIndex = answers[questionKey];
          const correctIndex = getCorrectOptionIndex(q);
          
          if (filterType === 'correct') {
            return selectedIndex === correctIndex && selectedIndex !== undefined;
          }
          if (filterType === 'wrong') {
            return selectedIndex !== undefined && selectedIndex !== correctIndex;
          }
          if (filterType === 'skipped') {
            return selectedIndex === undefined;
          }
          return true;
        }).map((q, qIndex) => {
          // Note: we use the original index to display the correct question number 
          // So we need to find its actual index in the `questions` array.
          const actualIndex = questions.findIndex(origQ => origQ._id === q._id || origQ === q);
          const questionKey = getQuestionKey(q, actualIndex);

          return (
            <div key={questionKey} className="exam-question-card">
              {isReviewMode && (
                <div className="exam-question-actions-top">
                  {q.tags && q.tags.length > 0 && (
                    <div className="exam-question-tags-wrapper">
                      {q.tags.map((tag, tIdx) => {
                        const abbr = getTagAbbreviation(tag);
                        if (!abbr) return null;
                        return (
                          <span
                            key={tIdx}
                            className={`exam-question-tag exam-question-tag--${tag.category}`}
                            title={getTagTitle(tag)}
                          >
                            {abbr}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    className="exam-explanation-btn"
                    onClick={() => {
                      setExplanationModalQuestion(q);
                      setExplanationTab('manual');
                    }}
                    title={language === 'en' ? 'Show Explanation' : 'ব্যাখ্যা দেখুন'}
                  >
                    <HiEye size={20} />
                  </button>
                </div>
              )}

              <div className="exam-question-top">
                <div className="exam-question-text-wrapper">
                  <span className="exam-question-number">
                    {language === 'en' ? `${actualIndex + 1}. ` : `${toBnNum(actualIndex + 1)}. `}
                  </span>
                  <span
                    className="exam-question-text"
                    dangerouslySetInnerHTML={renderMath(q.questionText)}
                  />
                </div>
              </div>

              {q.imageUrl && (
                <div className="exam-question-image">
                  <img src={q.imageUrl} alt="Question figure" />
                </div>
              )}

              {q.type === 'mcq' && q.options && (
                <div className="exam-options-grid">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = answers[questionKey] === optIdx;
                    const optionState = getOptionState(q, actualIndex, optIdx);
                    return (
                      <button
                        key={optIdx}
                        className={`exam-option-btn ${isSelected ? 'exam-option-btn--selected' : ''} ${optionState ? `exam-option-btn--${optionState}` : ''}`}
                        onClick={() => handleOptionSelect(questionKey, optIdx)}
                        type="button"
                      >
                        <div className={`exam-option-prefix ${isSelected ? 'exam-option-prefix--selected' : ''} ${optionState ? `exam-option-prefix--${optionState}` : ''}`}>
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

            </div>
          );
        })}
      </div>

      {!isReviewMode && (
        <div className="exam-floating-status-box">
          <div className="exam-status-item">
            <HiClock size={20} className="exam-status-icon" />
            <span>{language === 'en' ? formatTime(timeLeft) : toBnNum(formatTime(timeLeft))}</span>
          </div>
          <div className="exam-status-divider" />
          <div className="exam-status-item">
            <HiCheckCircle size={20} className="exam-status-icon" />
            <span>
              {language === 'en'
                ? `${answeredCount} / ${totalCount}`
                : `${toBnNum(answeredCount)} / ${toBnNum(totalCount)}`}
            </span>
          </div>
          <button className="exam-submit-btn-floating" onClick={handleSubmit} type="button">
            {language === 'en' ? 'Submit' : 'সাবমিট'}
          </button>
        </div>
      )}

      {showResultModal && (
        <div className="exam-result-overlay" role="dialog" aria-modal="true">
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={400}
            gravity={0.15}
          />
          <div className="exam-result-modal">
            <button type="button" className="exam-result-close" onClick={handleContinueToReview} aria-label="Close">
              <HiX size={20} />
            </button>
            <div className="exam-result-illustration" aria-hidden="true">
              <img src="/assets/exam_result_mascot.png" alt="Mascot Celebrating" className="exam-result-mascot-img" />
            </div>
            <h2>{language === 'en' ? 'Result is ready' : 'দুঃখ ভরা জীবন আমার'}</h2>
            <p>
              {language === 'en'
                ? 'Review your score and see every answer.'
                : 'তোমার ভালো পয়েন্ট এর দেখা পাই না'}
            </p>
            <div className="exam-result-modal-cards">
              <div className="exam-report-card exam-report-card--score">
                <span>{language === 'en' ? 'Points' : 'পয়েন্ট'}</span>
                <strong>★ {formatDisplayNumber(resultStats.score)}</strong>
              </div>
              <div className="exam-report-card exam-report-card--marks">
                <span>{language === 'en' ? 'Marks' : 'মার্কস'}</span>
                <strong>● {formatDisplayNumber(resultStats.correct)} / {formatDisplayNumber(resultStats.total)}</strong>
              </div>
              <div className="exam-report-card exam-report-card--time">
                <span>{language === 'en' ? 'Time' : 'সময়'}</span>
                <strong>◉ {timeLabel}</strong>
              </div>
            </div>
            <button type="button" className="exam-result-continue" onClick={handleContinueToReview}>
              {language === 'en' ? 'Continue' : 'এগিয়ে যাও'}
            </button>
          </div>
        </div>
      )}

      {explanationModalQuestion && (
        <div className="exam-explanation-overlay" role="dialog" aria-modal="true" onClick={() => setExplanationModalQuestion(null)}>
          <div className="exam-explanation-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="exam-explanation-close"
              onClick={() => setExplanationModalQuestion(null)}
              aria-label="Close"
            >
              <HiX size={20} />
            </button>
            <h2 className="exam-explanation-title">
              {language === 'en' ? 'Explanation' : 'ব্যাখ্যা'}
            </h2>
            <div className="exam-explanation-question-preview">
              <strong className="exam-explanation-q-label">
                {language === 'en' ? 'Question: ' : 'প্রশ্ন: '}
              </strong>
              <div className="exam-explanation-q-text" dangerouslySetInnerHTML={renderMath(explanationModalQuestion.questionText)} />
            </div>
            
            <div className="exam-explanation-tabs">
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === 'manual' ? 'exam-explanation-tab-btn--active' : ''}`}
                onClick={() => setExplanationTab('manual')}
              >
                {language === 'en' ? 'Manual Explanation' : 'ম্যানুয়াল ব্যাখ্যা'}
              </button>
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === 'ai' ? 'exam-explanation-tab-btn--active' : ''}`}
                onClick={() => setExplanationTab('ai')}
              >
                {language === 'en' ? 'AI Explanation' : 'এআই ব্যাখ্যা'}
              </button>
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === 'video' ? 'exam-explanation-tab-btn--active' : ''}`}
                onClick={() => setExplanationTab('video')}
              >
                {language === 'en' ? 'Video Solution' : 'ভিডিও সমাধান'}
              </button>
            </div>

            <div className="exam-explanation-content">
              {explanationTab === 'manual' && (() => {
                let isCqSolution = false;
                let parsedSolutions = [];
                const solutionStr = explanationModalQuestion.solution;
                try {
                  if (solutionStr && (solutionStr.trim().startsWith('[') || solutionStr.trim().startsWith('{'))) {
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {parsedSolutions.map((item, idx) => (
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
                      ))}
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      className="exam-explanation-body-text"
                      dangerouslySetInnerHTML={renderMath(
                        solutionStr || 
                        (language === 'en' ? 'No explanation added yet.' : 'এখনও ব্যাখ্যা যোগ করা হয়নি।')
                      )}
                    />
                    {explanationModalQuestion.solutionImageUrl && (
                      <div style={{ marginTop: '8px', maxWidth: '100%', overflow: 'hidden' }}>
                        <img src={explanationModalQuestion.solutionImageUrl} alt="Solution Figure" style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain', borderRadius: '6px' }} />
                      </div>
                    )}
                  </div>
                );
              })()}
              {explanationTab === 'ai' && (
                <div className="exam-explanation-placeholder">
                  <div className="exam-explanation-placeholder-badge">
                    {language === 'en' ? 'Coming Soon' : 'শীঘ্রই আসছে'}
                  </div>
                  <p>
                    {language === 'en'
                      ? 'AI Explanation feature is under development and will be available soon!'
                      : 'এআই ব্যাখ্যা সুবিধাটি তৈরি করা হচ্ছে এবং শীঘ্রই চালু হবে!'}
                  </p>
                </div>
              )}
              {explanationTab === 'video' && (
                <div className="exam-explanation-placeholder">
                  <div className="exam-explanation-placeholder-badge">
                    {language === 'en' ? 'Coming Soon' : 'শীঘ্রই আসছে'}
                  </div>
                  <p>
                    {language === 'en'
                      ? 'Video solution is being prepared and will be added in a future update.'
                      : 'ভিডিও সমাধান তৈরি করা হচ্ছে এবং শীঘ্রই যুক্ত করা হবে।'}
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
