import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HiArrowLeft, HiAcademicCap, HiCalendar } from 'react-icons/hi';
import { useLanguage } from '../hooks/useLanguage';
import './VarsityWrittenView.css';

// Map a subject id (e.g. "math_1") to the stored subject key used in the DB.
const SUBJECT_KEY_MAP = {
  physics_1: 'Physics', physics_2: 'Physics 2nd Paper',
  chemistry_1: 'Chemistry', chemistry_2: 'Chemistry 2nd Paper',
  math_1: 'Higher Math', math_2: 'Higher Math 2nd Paper',
  biology_1: 'Biology', biology_2: 'Biology 2nd Paper',
  botany_1: 'Botany', botany_2: 'Botany 2nd Paper',
  zoology_1: 'Zoology', zoology_2: 'Zoology 2nd Paper',
  hmath_1: 'Higher Math', hmath_2: 'Higher Math 2nd Paper',
  ict: 'ICT', english: 'English'
};

const PAPER_MAP = { 1: '1st', 2: '2nd' };

const VarsityWrittenView = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language, t } = useLanguage();

  const subjectParam = searchParams.get('subject') || '';
  const paperParam = searchParams.get('paper') || '1';

  const subjectKey = SUBJECT_KEY_MAP[subjectParam] || 'Higher Math';
  const paperLabel = PAPER_MAP[paperParam] || '1st';

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChapter, setActiveChapter] = useState('all');
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchWritten = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('topkorbo_token');
        const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const params = new URLSearchParams({ subject: subjectKey, paper: paperLabel });
        const response = await fetch(`${backendBaseUrl}/questions/varsity-written?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await response.json();
        if (cancelled) return;
        if (resData.success) {
          setQuestions(resData.data || []);
        } else {
          setError(resData.message || 'Failed to load questions');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWritten();
    return () => { cancelled = true; };
  }, [subjectKey, paperLabel]);

  const chapters = useMemo(() => {
    const set = new Set();
    questions.forEach((q) => {
      if (q.chapter) set.add(q.chapter);
    });
    return ['all', ...Array.from(set)];
  }, [questions]);

  const visibleQuestions = useMemo(() => {
    if (activeChapter === 'all') return questions;
    return questions.filter((q) => q.chapter === activeChapter);
  }, [questions, activeChapter]);

  const totalCount = questions.length;
  const chapterCount = chapters.length - 1;

  return (
    <div className="varsity-written-page animate-fade-in">
      <header className="dashboard-header qbank-header varsity-written-header">
        <button
          type="button"
          className="qbank-back-btn"
          onClick={() => navigate(`/qbank?subject=${subjectParam}&stream=varsity`)}
        >
          <HiArrowLeft size={16} />
          <span>{language === 'en' ? 'Back to Formats' : 'ফরম্যাটে ফিরে যান'}</span>
        </button>
        <div className="qbank-options-header-info">
          <h2>
            {language === 'en'
              ? `${subjectKey} - Varsity Written`
              : `${subjectKey} - বিশ্ববিদ্যালয় লিখিত`}
          </h2>
          <p>
            {language === 'en'
              ? `Read all written admission questions (${paperLabel} Paper) from past varsity exams.`
              : `অতীতের বিশ্ববিদ্যালয় ভর্তি পরীক্ষার সকল লিখিত প্রশ্ন পড়ুন (${paperLabel} পত্র)।`}
          </p>
        </div>
      </header>

      <div className="varsity-written-stats">
        <div className="varsity-written-stat">
          <span className="varsity-written-stat__label">
            {language === 'en' ? 'Total Questions' : 'মোট প্রশ্ন'}
          </span>
          <span className="varsity-written-stat__value">{totalCount}</span>
        </div>
        <div className="varsity-written-stat">
          <span className="varsity-written-stat__label">
            {language === 'en' ? 'Chapters Covered' : 'অধ্যায় সংখ্যা'}
          </span>
          <span className="varsity-written-stat__value">{chapterCount}</span>
        </div>
        <div className="varsity-written-stat">
          <span className="varsity-written-stat__label">
            {language === 'en' ? 'Source' : 'উৎস'}
          </span>
          <span className="varsity-written-stat__value">
            {language === 'en' ? 'University Admission' : 'বিশ্ববিদ্যালয় ভর্তি'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="varsity-written-loading">
          <div className="varsity-written-spinner" />
          <p>{language === 'en' ? 'Loading written questions…' : 'লিখিত প্রশ্ন লোড হচ্ছে…'}</p>
        </div>
      ) : error ? (
        <div className="varsity-written-empty">
          <h3>{language === 'en' ? 'Could not load questions' : 'প্রশ্ন লোড করা যায়নি'}</h3>
          <p>{error}</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="varsity-written-empty">
          <h3>
            {language === 'en'
              ? 'No written questions yet'
              : 'এখনও কোনো লিখিত প্রশ্ন নেই'}
          </h3>
          <p>
            {language === 'en'
              ? 'Our team is curating written admission archives. Please check back soon.'
              : 'আমাদের দল লিখিত ভর্তি আর্কাইভ তৈরি করছে। শীঘ্রই দেখুন।'}
          </p>
        </div>
      ) : (
        <div className="varsity-written-body">
          <aside className="varsity-written-sidebar">
            <h4>{language === 'en' ? 'Chapters' : 'অধ্যায়সমূহ'}</h4>
            <ul>
              {chapters.map((chap) => (
                <li key={chap}>
                  <button
                    type="button"
                    className={`varsity-written-chap-btn ${activeChapter === chap ? 'is-active' : ''}`}
                    onClick={() => setActiveChapter(chap)}
                  >
                    {chap === 'all'
                      ? (language === 'en' ? 'All Chapters' : 'সকল অধ্যায়')
                      : chap}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="varsity-written-list">
            {visibleQuestions.map((q, idx) => (
              <article
                key={q._id || `${q.year}-${idx}`}
                className="varsity-written-card"
                onClick={() => setSelectedQuestion(q)}
              >
                <div className="varsity-written-card__head">
                  <div className="varsity-written-card__chip">
                    <HiAcademicCap size={14} />
                    <span>{q.chapter || (language === 'en' ? 'General' : 'সাধারণ')}</span>
                  </div>
                  {q.year && (
                    <div className="varsity-written-card__chip varsity-written-card__chip--year">
                      <HiCalendar size={14} />
                      <span>{q.year}</span>
                    </div>
                  )}
                </div>
                <div className="varsity-written-card__body">
                  <div
                    className="varsity-written-card__stem"
                    dangerouslySetInnerHTML={{ __html: q.stem || q.question || '' }}
                  />
                </div>
                <div className="varsity-written-card__meta">
                  <span className="varsity-written-card__src">
                    {q.university || (language === 'en' ? 'University Archive' : 'বিশ্ববিদ্যালয় আর্কাইভ')}
                  </span>
                  <span className="varsity-written-card__cta">
                    {language === 'en' ? 'Read more' : 'বিস্তারিত'} →
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {selectedQuestion && (
        <div className="varsity-written-modal" onClick={() => setSelectedQuestion(null)}>
          <div
            className="varsity-written-modal__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h3>
                {selectedQuestion.chapter || (language === 'en' ? 'Written Question' : 'লিখিত প্রশ্ন')}
              </h3>
              <button
                type="button"
                className="varsity-written-modal__close"
                onClick={() => setSelectedQuestion(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="varsity-written-modal__body">
              <div className="varsity-written-modal__meta">
                {selectedQuestion.university && (
                  <span><HiAcademicCap size={14} /> {selectedQuestion.university}</span>
                )}
                {selectedQuestion.year && (
                  <span><HiCalendar size={14} /> {selectedQuestion.year}</span>
                )}
              </div>
              {selectedQuestion.stem && (
                <section>
                  <h4>{language === 'en' ? 'Question Stem' : 'উদ্দীপক'}</h4>
                  <div
                    className="varsity-written-modal__html"
                    dangerouslySetInnerHTML={{ __html: selectedQuestion.stem }}
                  />
                </section>
              )}
              {selectedQuestion.parts && selectedQuestion.parts.length > 0 && (
                <section>
                  <h4>{language === 'en' ? 'Parts' : 'অংশসমূহ'}</h4>
                  <ol className="varsity-written-modal__parts">
                    {selectedQuestion.parts.map((part, i) => (
                      <li key={i}>
                        <strong>{part.label || (i + 1)}.</strong>{' '}
                        <span dangerouslySetInnerHTML={{ __html: part.text || '' }} />
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {selectedQuestion.explanation && (
                <section>
                  <h4>{language === 'en' ? 'Answer / Explanation' : 'উত্তর / ব্যাখ্যা'}</h4>
                  <div
                    className="varsity-written-modal__html"
                    dangerouslySetInnerHTML={{ __html: selectedQuestion.explanation }}
                  />
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VarsityWrittenView;
