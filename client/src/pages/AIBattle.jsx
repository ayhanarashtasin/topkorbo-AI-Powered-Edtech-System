import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { notifyPaywall } from '../utils/paywall';
import katex from 'katex';
import { sanitizeHtml } from '../utils/safeHtml';
import 'katex/dist/katex.min.css';
import {
  HiAcademicCap,
  HiArrowLeft,
  HiArrowRight,
  HiBeaker,
  HiBookOpen,
  HiCheck,
  HiCheckCircle,
  HiClock,
  HiCollection,
  HiFire,
  HiLightningBolt,
  HiRefresh
} from 'react-icons/hi';
import { useLanguage } from '../hooks/useLanguage';
import Sidebar from '../components/layout/Sidebar';
import { aiApi } from '../services/aiApi';
import './MockTest.css';
import './Battle.css';
import './AIBattle.css';

// ---------------------------------------------------------------------------
// Static config (self-contained — intentionally a local copy so this feature
// never depends on or refactors Battle.jsx).
// ---------------------------------------------------------------------------

const SUBJECTS = [
  { id: 'bangla', labelEn: 'Bangla', labelBn: 'বাংলা', letter: 'অ', color: '#C08552', bg: 'rgba(192, 133, 82, 0.08)', prefixType: 'letter' },
  { id: 'english', labelEn: 'English', labelBn: 'English', letter: 'Aa', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)', prefixType: 'letter' },
  { id: 'gk', labelEn: 'GK', labelBn: 'GK', icon: 'GK', color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)', prefixType: 'icon' },
  { id: 'ict', labelEn: 'ICT', labelBn: 'ICT', icon: 'ICT', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.08)', prefixType: 'icon' },
  { id: 'physics', labelEn: 'Physics', labelBn: 'Physics', icon: 'P', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)', prefixType: 'icon' },
  { id: 'chemistry', labelEn: 'Chemistry', labelBn: 'Chemistry', icon: 'C', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.08)', prefixType: 'icon' },
  { id: 'highermath', labelEn: 'Higher Math', labelBn: 'Higher Math', letter: 'pi', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.08)', prefixType: 'letter' },
  { id: 'biology', labelEn: 'Biology', labelBn: 'Biology', icon: 'Bio', color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.08)', prefixType: 'icon' },
  { id: 'iba', labelEn: 'IBA', labelBn: 'IBA', icon: 'IBA', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.08)', prefixType: 'icon' }
];

const SUBJECT_DB_MAP = {
  bangla: 'Bangla',
  english: 'English',
  gk: 'GK',
  ict: 'ICT',
  physics: 'Physics',
  chemistry: 'Chemistry',
  highermath: 'Higher Math',
  biology: 'Biology',
  iba: 'IBA'
};

const CHAPTERS = {
  bangla: {
    '1st': ['গদ্য', 'পদ্য', 'নাটক', 'উপন্যাস', 'ছোটগল্প', 'প্রবন্ধ', 'ভাষা ও ব্যাকরণ'],
    '2nd': ['বাংলা ব্যাকরণ', 'ভাব-সম্প্রসারণ', 'পত্র লিখন', 'প্রবন্ধ রচনা', 'সারমর্ম/সারাংশ', 'অনুবাদ', 'বাংলা বানানের নিয়ম']
  },
  english: {
    '1st': ['Comprehension', 'Vocabulary', 'Grammar', 'Reading Skills', 'Prose', 'Poetry', 'Short Stories', 'Composition'],
    '2nd': ['Grammar - Tenses', 'Grammar - Modifiers', 'Grammar - Connectors', 'Grammar - Sentence Patterns', 'Formal Letter/Application', 'Paragraph Writing', 'Essay Writing', 'Report Writing', 'Completing Story', 'Email Writing']
  },
  gk: {
    '1st': ['Bangladesh Affairs', 'Liberation War', 'Geography and Borders', 'Economy and National Achievements'],
    '2nd': ['International Affairs', 'United Nations', 'World Politics', 'Recent General Knowledge']
  },
  ict: {
    '1st': ['World and ICT', 'Communication System', 'Number System & Digital Devices', 'Web Design - HTML', 'Programming Basics', 'Database Management'],
    '2nd': []
  },
  physics: {
    '1st': ['Physical World and Measurement', 'Vector', 'Dynamics', 'Newtonian Mechanics', 'Work, Energy & Power', 'Gravitation & Gravity', 'Stress & Strain', 'Periodic Motion', 'Waves', 'Ideal Gas & Kinetic Theory'],
    '2nd': ['Heat & Thermodynamics', 'Electrostatics', 'Current Electricity', 'Magnetic Effect of Current', 'Electromagnetic Induction', 'Alternating Current', 'Geometric Optics', 'Physical Optics', 'Modern Physics & Atom Model', 'Nuclear Physics & Radioactivity', 'Semiconductor & Electronics']
  },
  chemistry: {
    '1st': ['Environmental Chemistry', 'Qualitative Chemistry', 'Mole', 'Atomic Structure', 'Chemical Bond'],
    '2nd': ['Chemical Changes', 'Industrial Chemistry', 'Electrochemistry', 'Organic Chemistry', 'Biochemistry']
  },
  highermath: {
    '1st': ['Matrix and Determinant', 'Vector', 'Straight Line', 'Circle', 'Permutation and Combination', 'Trigonometric Ratios', 'Functions and Graphs', 'Differentiation', 'Integration'],
    '2nd': ['Real Numbers and Inequalities', 'Linear Programming', 'Complex Numbers', 'Polynomial and Polynomial Equations', 'Binomial Expansion', 'Conic Sections', 'Statics', 'Motion in a Plane', 'Probability']
  },
  biology: {
    '1st': ['Cell and Its Structure', 'Cell Division', 'Cell Chemistry', 'Microorganism', 'Algae and Fungi', 'Plant Physiology', 'Biotechnology'],
    '2nd': ['Animal Diversity and Classification', 'Human Physiology: Digestion and Absorption', 'Blood and Circulation', 'Breathing and Respiration', 'Genetics and Evolution']
  },
  iba: {
    '1st': ['Analytical Ability', 'Sentence Correction', 'Reading Comprehension'],
    '2nd': ['Mathematics & Quantitative Aptitude', 'Critical Reasoning', 'Business GK & General Awareness']
  }
};

const ENGINEERING_UNIVERSITIES = ['BUET', 'CUET', 'KUET', 'RUET', 'MIST', 'IUT', 'BUTEX'];
const GENERAL_UNIVERSITIES = ['DU', 'CU', 'RU', 'JU', 'GST', 'BUP', 'IBA'];
const BOARDS = ['Dhaka', 'Comilla', 'Rajshahi', 'Jessore', 'Chittagong', 'Sylhet', 'Barishal', 'Dinajpur', 'Mymensingh', 'Madrasa', 'Technical'];

const FALLBACK_QUESTIONS = [
  {
    questionText: 'Which option best matches the core idea of Newton’s second law?',
    options: [{ text: 'F = ma', isCorrect: true }, { text: 'E = mc^2' }, { text: 'V = IR' }, { text: 'P = IV' }],
    subject: 'Physics',
    chapter: 'Dynamics',
    type: 'mcq'
  },
  {
    questionText: 'What is the chemical symbol for Sodium?',
    options: [{ text: 'Na', isCorrect: true }, { text: 'So' }, { text: 'S' }, { text: 'Sn' }],
    subject: 'Chemistry',
    chapter: 'Qualitative Chemistry',
    type: 'mcq'
  },
  {
    questionText: 'The capital of Bangladesh is?',
    options: [{ text: 'Dhaka', isCorrect: true }, { text: 'Chittagong' }, { text: 'Khulna' }, { text: 'Sylhet' }],
    subject: 'GK',
    chapter: 'Bangladesh Affairs',
    type: 'mcq'
  },
  {
    questionText: 'Which value of $x$ satisfies $2x + 4 = 10$?',
    options: [{ text: '3', isCorrect: true }, { text: '2' }, { text: '5' }, { text: '7' }],
    subject: 'Higher Math',
    chapter: 'Polynomial and Polynomial Equations',
    type: 'mcq'
  }
];

const TIME_PRESETS = [5, 10, 15, 30, 60];
const COUNT_PRESETS = [5, 10, 15, 20, 30];

const getOptions = (question) => {
  const options = Array.isArray(question?.options) ? question.options.filter((option) => option.text) : [];
  if (options.length >= 2) return options;
  return [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }];
};

const getCorrectIndex = (question) => {
  const options = getOptions(question);
  const idx = options.findIndex((option) => option.isCorrect);
  return idx; // -1 if none flagged
};

const renderMath = (text) => {
  if (!text) return { __html: '' };
  const rendered = String(text)
    .replace(/\$\$([\s\S]+?)\$\$/g, (match, value) => {
      try { return katex.renderToString(value.trim(), { displayMode: true, throwOnError: false }); }
      catch { return match; }
    })
    .replace(/\$([^$]+)\$/g, (match, value) => {
      try { return katex.renderToString(value.trim(), { displayMode: false, throwOnError: false }); }
      catch { return match; }
    })
    .replace(/\n/g, '<br />');
  return { __html: sanitizeHtml(rendered) };
};

export default function AIBattle() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const [user, setUser] = useState({
    id: localStorage.getItem('topkorbo_user_id') || '',
    name: localStorage.getItem('topkorbo_name') || 'Student Topper',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
    streak: parseInt(localStorage.getItem('topkorbo_streak')) || 5
  });

  // ----- setup wizard state -----
  const [step, setStep] = useState(1);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState({});
  const [selectedStandards, setSelectedStandards] = useState([]);
  const [selectedEngineeringUnis, setSelectedEngineeringUnis] = useState([]);
  const [selectedGeneralUnis, setSelectedGeneralUnis] = useState([]);
  const [selectedAcademicTypes, setSelectedAcademicTypes] = useState([]);
  const [selectedBoards, setSelectedBoards] = useState([]);
  const [questionTimeSeconds, setQuestionTimeSeconds] = useState(10);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [isStarting, setIsStarting] = useState(false);

  // ----- battle runtime state -----
  const [battle, setBattle] = useState(null); // { questions, settings }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [youWins, setYouWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [draws, setDraws] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [humanAnsweredAt, setHumanAnsweredAt] = useState(null); // ms timestamp of the click
  const [aiAnswerIndex, setAiAnswerIndex] = useState(null);
  const [aiResponded, setAiResponded] = useState(false);
  const [aiAnsweredAt, setAiAnsweredAt] = useState(null); // ms timestamp the LLM answer arrived
  const [aiError, setAiError] = useState(false); // the AI call failed / returned no answer
  const [resolution, setResolution] = useState(null); // { winner, correctIndex }
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [finished, setFinished] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const advanceTimerRef = useRef(null);

  const QUESTION_STANDARDS = [
    { id: 'engineering', labelEn: 'Engineering', labelBn: 'ইঞ্জিনিয়ারিং', icon: <HiLightningBolt size={28} />, desc: 'BUET, CUET, KUET, RUET', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)' },
    { id: 'university', labelEn: 'University', labelBn: 'বিশ্ববিদ্যালয়', icon: <HiAcademicCap size={28} />, desc: 'DU, CU, RU, JU, GST', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)' },
    { id: 'academic', labelEn: 'Academic', labelBn: 'একাডেমিক', icon: <HiBookOpen size={28} />, desc: 'Board and college questions', color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)' },
    { id: 'medical', labelEn: 'Medical', labelBn: 'মেডিকেল', icon: <HiBeaker size={28} />, desc: 'Medical and dental', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.08)' }
  ];

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
      return;
    }
    const fetchUser = async () => {
      try {
        const res = await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          localStorage.removeItem('topkorbo_token');
          window.location.href = '/';
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setUser({
            id: data.data._id,
            name: data.data.name,
            avatar: data.data.avatar || '',
            email: data.data.email,
            role: data.data.role,
            streak: data.data.streak || 5
          });
          localStorage.setItem('topkorbo_user_id', data.data._id);
        }
      } catch (err) {
        console.error('Error fetching profile in AIBattle:', err);
      }
    };
    fetchUser();
  }, [apiBase]);

  // ----- selection helpers -----
  const toggleSubjectSelection = (id) => {
    setSelectedSubjectIds((prev) => {
      const isRemoving = prev.includes(id);
      setSelectedChapters((current) => {
        const next = { ...current };
        if (isRemoving) delete next[id];
        else if (!next[id]) next[id] = { '1st': [], '2nd': [] };
        return next;
      });
      return isRemoving ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  const toggleChapterSelection = (subId, paper, chapter) => {
    setSelectedChapters((prev) => {
      const subMap = prev[subId] || { '1st': [], '2nd': [] };
      const list = subMap[paper] || [];
      return {
        ...prev,
        [subId]: {
          ...subMap,
          [paper]: list.includes(chapter) ? list.filter((item) => item !== chapter) : [...list, chapter]
        }
      };
    });
  };

  const toggleAllChaptersForPaper = (subId, paper) => {
    const allChapters = CHAPTERS[subId]?.[paper] || [];
    setSelectedChapters((prev) => {
      const subMap = prev[subId] || { '1st': [], '2nd': [] };
      const selected = subMap[paper] || [];
      return {
        ...prev,
        [subId]: {
          ...subMap,
          [paper]: selected.length === allChapters.length ? [] : allChapters
        }
      };
    });
  };

  const buildSelections = () => {
    const selections = [];
    selectedSubjectIds.forEach((subId) => {
      const subMap = selectedChapters[subId] || { '1st': [], '2nd': [] };
      ['1st', '2nd'].forEach((paper) => {
        const chapters = subMap[paper] || [];
        if (chapters.length === 0) return;
        selections.push({
          subject: SUBJECT_DB_MAP[subId] || subId,
          paper,
          chapters: chapters.map((name) => ({ name, topics: [] }))
        });
      });
    });
    return selections;
  };

  const summary = useMemo(() => {
    let chapterCount = 0;
    Object.values(selectedChapters).forEach((subMap) => {
      Object.values(subMap).forEach((chapters) => { chapterCount += chapters.length; });
    });
    return { subjectCount: selectedSubjectIds.length, chapterCount };
  }, [selectedChapters, selectedSubjectIds.length]);

  const validateSettings = () => {
    if (selectedStandards.length === 0) return 'Please select at least one question standard.';
    if (selectedStandards.includes('engineering') && selectedEngineeringUnis.length === 0) return 'Please select at least one Engineering university.';
    if (selectedStandards.includes('university') && selectedGeneralUnis.length === 0) return 'Please select at least one University.';
    if (selectedStandards.includes('academic') && selectedAcademicTypes.length === 0) return 'Please select an Academic question source.';
    if (selectedStandards.includes('academic') && selectedAcademicTypes.includes('board') && selectedBoards.length === 0) return 'Please select at least one board.';
    if (!totalQuestions || totalQuestions <= 0) return 'Please select total questions.';
    if (!questionTimeSeconds || questionTimeSeconds < 5 || questionTimeSeconds > 120) return 'Time per question must be between 5 and 120 seconds.';
    return '';
  };

  const fetchQuestions = async (token) => {
    const requestQuestions = async (count) => {
      const res = await fetch(`${apiBase}/questions/mock-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          selections: buildSelections(),
          standard: selectedStandards[0] || '',
          standards: selectedStandards,
          selectedEngineeringUnis,
          selectedGeneralUnis,
          selectedAcademicTypes,
          selectedBoards,
          questionType: 'mcq',
          totalQuestions: count,
          context: 'ai-battle' // metered against the battle-room limit (no server room)
        })
      });
      return res.json();
    };

    const data = await requestQuestions(totalQuestions);
    // Over the free battle limit → show paywall and abort (no demo fallback).
    if (!data.success && notifyPaywall(data)) {
      const e = new Error('PAYWALL');
      e.isPaywall = true;
      throw e;
    }
    if (data.success && data.data?.questions?.length) return data.data.questions;

    const availableCount = Number(data.data?.available || 0);
    if (data.success && availableCount > 0 && availableCount < totalQuestions) {
      const retryData = await requestQuestions(availableCount);
      if (retryData.success && retryData.data?.questions?.length) {
        toast(`Only ${availableCount} matching questions are available. Starting with those.`);
        return retryData.data.questions;
      }
    }

    toast('No matching live questions found yet. Starting a demo battle.');
    return FALLBACK_QUESTIONS;
  };

  // ----- battle lifecycle -----
  const resetPerQuestion = useCallback(() => {
    setSelectedAnswer(null);
    setHumanAnsweredAt(null);
    setAiAnswerIndex(null);
    setAiResponded(false);
    setAiAnsweredAt(null);
    setAiError(false);
    setResolution(null);
  }, []);

  const startBattle = async () => {
    const validationError = validateSettings();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsStarting(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const fetched = await fetchQuestions(token);
      const questions = fetched.slice(0, Math.min(fetched.length, totalQuestions));
      setBattle({ questions, settings: { questionTimeSeconds } });
      setCurrentIndex(0);
      setYouWins(0);
      setAiWins(0);
      setDraws(0);
      setFinished(false);
      resetPerQuestion();
      setQuestionStartedAt(Date.now());
      setNowMs(Date.now());
    } catch (err) {
      if (err?.isPaywall) { setIsStarting(false); return; }
      console.error('Error starting AI battle:', err);
      toast('Network issue. Starting a demo battle.');
      setBattle({ questions: FALLBACK_QUESTIONS, settings: { questionTimeSeconds } });
      setCurrentIndex(0);
      setYouWins(0);
      setAiWins(0);
      setDraws(0);
      setFinished(false);
      resetPerQuestion();
      setQuestionStartedAt(Date.now());
      setNowMs(Date.now());
    } finally {
      setIsStarting(false);
    }
  };

  const advance = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    const total = battle?.questions?.length || 0;
    if (currentIndex + 1 >= total) {
      setFinished(true);
      return;
    }
    resetPerQuestion();
    setCurrentIndex(currentIndex + 1);
    const ts = Date.now();
    setQuestionStartedAt(ts);
    setNowMs(ts);
  }, [battle, currentIndex, resetPerQuestion]);

  const resolveWith = useCallback((winner, correctIndex) => {
    setResolution((prev) => {
      if (prev) return prev; // already resolved this question
      setYouWins((w) => (winner === 'you' ? w + 1 : w));
      setAiWins((w) => (winner === 'ai' ? w + 1 : w));
      setDraws((d) => (winner === 'draw' ? d + 1 : d));
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(advance, 2000);
      return { winner, correctIndex };
    });
  }, [advance]);

  const settingsTime = battle?.settings?.questionTimeSeconds || questionTimeSeconds;
  const inBattle = Boolean(battle) && !finished;
  const currentQuestion = battle?.questions?.[currentIndex] || null;

  // 1s-ish ticker while a question is live.
  useEffect(() => {
    if (!inBattle) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [inBattle, currentIndex]);

  // The AI "answers" the moment the LLM responds — that real latency is the
  // AI's answer time in the race (no artificial delay). We record both the
  // chosen index and when it arrived so the first correct answer can win.
  useEffect(() => {
    if (!inBattle || !currentQuestion) return undefined;
    let cancelled = false;
    const options = getOptions(currentQuestion).map((opt) => ({ text: opt.text }));
    aiApi
      .answerMcq({ questionText: currentQuestion.questionText, options })
      .then((data) => {
        if (cancelled) return;
        // NOTE: Number(null) === 0, so guard explicitly against null/undefined —
        // otherwise a "no answer" from the server would look like "AI picked A".
        const raw = data?.answerIndex;
        const idx = raw === null || raw === undefined ? NaN : Number(raw);
        const valid = Number.isInteger(idx);
        setAiAnswerIndex(valid ? idx : null);
        setAiError(!valid);
        setAiAnsweredAt(Date.now());
        setAiResponded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[AIBattle] answer-mcq request failed:', err);
        toast.error('AI could not answer — is the server running and restarted?');
        setAiAnswerIndex(null);
        setAiError(true);
        setAiAnsweredAt(Date.now());
        setAiResponded(true);
      });
    return () => { cancelled = true; };
  }, [inBattle, currentIndex, currentQuestion]);

  // Resolution watcher: a pure race — whoever produces a CORRECT answer first
  // wins the question. There is no fixed AI delay; the AI's answer time is the
  // real LLM latency. `settingsTime` is only a safety cap so an idle question
  // (nobody answers correctly) still ends.
  useEffect(() => {
    if (!inBattle || !currentQuestion || resolution || !questionStartedAt) return;

    const correctIndex = getCorrectIndex(currentQuestion);
    const humanAnswered = selectedAnswer != null;
    const humanCorrect = humanAnswered && selectedAnswer === correctIndex;
    const aiCorrect = aiResponded && aiAnswerIndex != null && aiAnswerIndex === correctIndex;
    const elapsed = (nowMs - questionStartedAt) / 1000;
    const timedOut = elapsed >= settingsTime;

    if (humanCorrect && aiCorrect) {
      // Both correct — earliest timestamp takes it.
      resolveWith((humanAnsweredAt ?? Infinity) <= (aiAnsweredAt ?? Infinity) ? 'you' : 'ai', correctIndex);
    } else if (humanCorrect) {
      resolveWith('you', correctIndex);
    } else if (aiCorrect) {
      resolveWith('ai', correctIndex);
    } else if (timedOut || (humanAnswered && aiResponded)) {
      // Neither produced a correct answer and either time is up or both have
      // committed — nobody scores.
      resolveWith('draw', correctIndex);
    }
  }, [nowMs, inBattle, currentQuestion, resolution, questionStartedAt, settingsTime, selectedAnswer, humanAnsweredAt, aiAnswerIndex, aiResponded, aiAnsweredAt, resolveWith]);

  // Clear any pending advance timer on unmount.
  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  const handleSelect = (optionIndex) => {
    if (!inBattle || resolution || selectedAnswer != null || !currentQuestion) return;
    setSelectedAnswer(optionIndex);
    // eslint-disable-next-line react-hooks/purity -- click timing must sample the clock at click time.
    setHumanAnsweredAt(Date.now());
    // Your first click is your submission. The resolution watcher decides the
    // winner: a correct answer that lands before the AI's correct answer wins.
  };

  const exitToSetup = () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    setBattle(null);
    setFinished(false);
    setCurrentIndex(0);
    resetPerQuestion();
    setStep(1);
  };

  const STEP_LABELS = [
    { num: 1, labelEn: 'Subjects', labelBn: 'বিষয়' },
    { num: 2, labelEn: 'Chapters', labelBn: 'অধ্যায়' },
    { num: 3, labelEn: 'Settings', labelBn: 'সেটিংস' }
  ];

  // ===========================================================================
  // Finish screen
  // ===========================================================================
  if (battle && finished) {
    const didWin = youWins > aiWins;
    const isDraw = youWins === aiWins;
    return (
      <div className="dashboard-container">
        <Sidebar activeTab="battle" user={user} />
        <main className="dashboard-main">

          <div className="battle-room">
            <section className="battle-room__stage">
              <div className="battle-finish-card">
                {didWin && (
                  <div className="battle-result-confetti" aria-hidden="true">
                    {Array.from({ length: 18 }).map((_, index) => <span key={index} />)}
                  </div>
                )}
                <div className={`battle-result-badge ${didWin ? 'battle-result-badge--win' : 'battle-result-badge--loss'}`}>
                  {didWin ? 'WIN' : isDraw ? 'TIE' : 'LOSS'}
                </div>
                <h3>{didWin ? 'Congratulations Champ!' : isDraw ? 'It’s a tie!' : 'The AI edged it'}</h3>
                <p>{didWin ? 'You beat the AI opponent.' : isDraw ? 'Dead heat against the AI. Run it back.' : 'Close one. Warm up and take the rematch.'}</p>
                <div className="aibattle-final-score">
                  <div className="aibattle-final-side">
                    <span>You</span>
                    <strong>{youWins}</strong>
                  </div>
                  <div className="aibattle-final-dash">–</div>
                  <div className="aibattle-final-side aibattle-final-side--ai">
                    <span>AI</span>
                    <strong>{aiWins}</strong>
                  </div>
                </div>
                <div className="battle-result-stats">
                  <div><span>Questions</span><strong>{battle.questions.length}</strong></div>
                  <div><span>Draws</span><strong>{draws}</strong></div>
                  <div><span>Win rate</span><strong>{battle.questions.length ? Math.round((youWins / battle.questions.length) * 100) : 0}%</strong></div>
                </div>
                <button className="btn btn-primary mock-next-btn" type="button" onClick={exitToSetup}>
                  <HiRefresh size={18} />
                  <span>Play Again</span>
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  // ===========================================================================
  // Battle runtime screen
  // ===========================================================================
  if (battle && currentQuestion) {
    const options = getOptions(currentQuestion);
    const correctIndex = resolution ? resolution.correctIndex : getCorrectIndex(currentQuestion);
    const elapsedSeconds = (nowMs - questionStartedAt) / 1000;
    const remainingSeconds = Math.max(0, Math.ceil(settingsTime - elapsedSeconds));
    const locked = Boolean(resolution) || selectedAnswer != null;

    let bannerText = '';
    let bannerClass = '';
    if (resolution) {
      if (resolution.winner === 'you') { bannerText = 'You won this question!'; bannerClass = 'aibattle-banner--you'; }
      else if (resolution.winner === 'ai') { bannerText = 'AI won this question.'; bannerClass = 'aibattle-banner--ai'; }
      else { bannerText = 'Draw — nobody scored.'; bannerClass = 'aibattle-banner--draw'; }
    }

    return (
      <div className="dashboard-container">
        <Sidebar activeTab="battle" user={user} />
        <main className="dashboard-main">

          <div className="battle-room">
            <section className="battle-room__stage">
              <div className="battle-score-strip">
                <div><span>{user.name}</span><strong>{youWins}</strong></div>
                <div className="battle-vs-core">VS</div>
                <div><span>AI Opponent</span><strong>{aiWins}</strong></div>
              </div>

              <div className="battle-question-card">
                <div className="battle-question-meta">
                  <span>Question {currentIndex + 1} / {battle.questions.length}</span>
                  <span className={remainingSeconds <= 3 ? 'aibattle-clock--urgent' : ''}><HiClock size={16} /> {remainingSeconds}s left</span>
                  <span>{aiError ? 'AI unavailable' : resolution && aiAnswerIndex != null ? `AI chose ${String.fromCharCode(65 + aiAnswerIndex)}` : aiResponded ? 'AI has answered' : 'AI is thinking…'}</span>
                </div>
                <div className="battle-question-text" dangerouslySetInnerHTML={renderMath(currentQuestion.questionText)} />
                <div className="battle-options-grid">
                  {options.map((option, index) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrect = correctIndex === index;
                    const showCorrect = resolution && isCorrect;
                    const showWrongPick = resolution && isSelected && !isCorrect;
                    const showAiPick = resolution && aiAnswerIndex === index;
                    return (
                      <button
                        key={`${option.text}-${index}`}
                        type="button"
                        className={`battle-option ${isSelected ? 'battle-option--selected' : ''} ${showCorrect ? 'battle-option--correct' : ''} ${showWrongPick ? 'battle-option--wrong' : ''}`}
                        onClick={() => handleSelect(index)}
                        disabled={locked}
                      >
                        <span className="battle-option-prefix">{String.fromCharCode(65 + index)}</span>
                        <strong dangerouslySetInnerHTML={renderMath(option.text)} />
                        {showAiPick && <span className="aibattle-pick-tag">AI</span>}
                      </button>
                    );
                  })}
                </div>

                {resolution ? (
                  <div className={`aibattle-banner ${bannerClass}`}>
                    <strong>{bannerText}</strong>
                    <span>Correct answer highlighted. Next question in 2s…</span>
                  </div>
                ) : (
                  <div className="aibattle-banner aibattle-banner--waiting">
                    <strong>{selectedAnswer != null ? 'Your answer is locked in.' : 'Answer fast — first correct wins!'}</strong>
                    <span>{aiResponded ? 'The AI has committed its answer.' : 'The AI is still working on it…'}</span>
                  </div>
                )}
              </div>
            </section>

            <aside className="battle-leaderboard">
              <h3>Scoreboard</h3>
              <div className="battle-rank-list">
                <div className="battle-rank-row battle-rank-row--you">
                  <span>You</span><strong>{user.name}</strong><em>{youWins}</em>
                </div>
                <div className="battle-rank-row">
                  <span>AI</span><strong>AI Opponent</strong><em>{aiWins}</em>
                </div>
              </div>
              <div className="aibattle-rules-box">
                <strong>How to win a question</strong>
                <span>It’s a race: the first correct answer wins the point. Pick the right option before the AI does and it’s yours; if the AI’s answer lands first and is correct, the point is the AI’s. If neither answers correctly within {settingsTime}s, it’s a draw.</span>
              </div>
              <button type="button" className="battle-outline-btn" onClick={exitToSetup}>Quit Battle</button>
            </aside>
          </div>
        </main>
      </div>
    );
  }

  // ===========================================================================
  // Setup wizard
  // ===========================================================================
  return (
    <div className="dashboard-container">
      <Sidebar activeTab="battle" user={user} />
      <main className="dashboard-main">

        <div className="mock-workspace battle-workspace animate-fade-in">
          <div className="mock-step-indicator battle-step-indicator">
            {STEP_LABELS.map((s, idx) => (
              <div key={s.num} className="mock-step-indicator-item">
                <button
                  type="button"
                  className={`mock-step-dot ${step >= s.num ? 'mock-step-dot--active' : ''} ${step === s.num ? 'mock-step-dot--current' : ''}`}
                  onClick={() => { if (s.num < step) setStep(s.num); }}
                  disabled={s.num > step}
                >
                  {step > s.num ? <HiCheck size={14} /> : s.num}
                </button>
                <span className={`mock-step-label ${step >= s.num ? 'mock-step-label--active' : ''}`}>{language === 'en' ? s.labelEn : s.labelBn}</span>
                {idx < STEP_LABELS.length - 1 && <div className={`mock-step-connector ${step > s.num ? 'mock-step-connector--done' : ''}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="mock-subject-selection">
              <div className="mock-selection-info battle-selection-title">
                <div>
                  <h3>Select Subjects</h3>
                  <p>Choose one or more subjects for your AI duel.</p>
                </div>
              </div>
              <div className="mock-subjects-grid">
                {SUBJECTS.map((subject) => {
                  const isSelected = selectedSubjectIds.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      onClick={() => toggleSubjectSelection(subject.id)}
                      className={`mock-subject-card ${isSelected ? 'mock-subject-card--selected' : ''}`}
                      style={{ '--hover-color': subject.color }}
                    >
                      <div className="mock-card-glow"></div>
                      <div className="mock-card-select-badge"><HiCheckCircle size={22} /></div>
                      <div className="mock-card-content">
                        <div className="mock-card-prefix" style={{ backgroundColor: subject.bg, color: subject.color }}>
                          <span>{subject.prefixType === 'letter' ? subject.letter : subject.icon}</span>
                        </div>
                        <span className="mock-card-label">{language === 'en' ? subject.labelEn : subject.labelBn}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mock-selection-actions">
                <button type="button" className="btn btn-primary mock-next-btn" disabled={selectedSubjectIds.length === 0} onClick={() => setStep(2)}>
                  <span>Next Step</span>
                  <HiArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mock-config-selection animate-fade-in">
              <button type="button" onClick={() => setStep(1)} className="mock-back-btn">
                <HiArrowLeft size={16} />
                <span>Back to subjects</span>
              </button>
              <div className="mock-selection-info">
                <h3>Configure Papers & Chapters</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Select the exact syllabus range for the duel.</p>
              </div>
              <div className="mock-config-cards-container">
                {selectedSubjectIds.map((subId) => {
                  const subject = SUBJECTS.find((item) => item.id === subId);
                  const all1st = CHAPTERS[subId]?.['1st'] || [];
                  const all2nd = CHAPTERS[subId]?.['2nd'] || [];
                  const selected1st = selectedChapters[subId]?.['1st'] || [];
                  const selected2nd = selectedChapters[subId]?.['2nd'] || [];
                  return (
                    <div key={subId} className="mock-config-card animate-scale-up" style={{ '--hover-color': subject.color }}>
                      <div className="mock-config-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                        <div className="mock-config-subject-info">
                          <div className="mock-card-prefix" style={{ backgroundColor: subject.bg, color: subject.color }}>{subject.prefixType === 'letter' ? subject.letter : subject.icon}</div>
                          <span className="mock-config-subject-title">{language === 'en' ? subject.labelEn : subject.labelBn}</span>
                        </div>
                      </div>
                      <div className="mock-papers-side-by-side-grid">
                        {['1st', '2nd'].map((paper) => {
                          const allChapters = paper === '1st' ? all1st : all2nd;
                          const selectedList = paper === '1st' ? selected1st : selected2nd;
                          if (allChapters.length === 0) {
                            return <div key={paper} className="mock-empty-paper-notice">No {paper} paper syllabus.</div>;
                          }
                          return (
                            <div key={paper} className="mock-paper-column">
                              <button
                                type="button"
                                onClick={() => toggleAllChaptersForPaper(subId, paper)}
                                className={`mock-paper-column-header ${selectedList.length === allChapters.length ? 'mock-paper-column-header--checked' : ''}`}
                                style={{ '--hover-color': subject.color }}
                              >
                                <div className="mock-paper-header-check">{selectedList.length === allChapters.length && <HiCheckCircle size={20} />}</div>
                                <span className="mock-paper-header-label">{paper} paper</span>
                              </button>
                              <div className="mock-paper-chapters-list">
                                {allChapters.map((chapter) => {
                                  const isSelected = selectedList.includes(chapter);
                                  return (
                                    <button
                                      key={chapter}
                                      type="button"
                                      className={`mock-chapter-pill-item ${isSelected ? 'mock-chapter-pill-item--selected' : ''}`}
                                      onClick={() => toggleChapterSelection(subId, paper, chapter)}
                                      style={{ '--hover-color': subject.color }}
                                    >
                                      <div className="mock-chapter-pill-check">{isSelected && <HiCheckCircle size={18} />}</div>
                                      <span className="mock-chapter-pill-name">{chapter}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mock-selection-actions">
                <button type="button" className="btn btn-primary mock-next-btn" disabled={summary.chapterCount === 0} onClick={() => setStep(3)}>
                  <span>Next Step</span>
                  <HiArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mock-exam-config animate-fade-in battle-settings">
              <button type="button" onClick={() => setStep(2)} className="mock-back-btn">
                <HiArrowLeft size={16} />
                <span>Back to chapters</span>
              </button>
              <div className="mock-selection-info">
                <h3>Duel Settings</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Pick the question standard, per-question time, and how many questions.</p>
              </div>

              <div className="mock-config-section">
                <div className="mock-config-section-header">
                  <HiAcademicCap size={20} className="mock-config-section-icon" />
                  <h4>Question Standard</h4>
                </div>
                <p className="mock-config-section-desc">Choose multiple standards if the duel should mix exam sources.</p>
                <div className="mock-standard-grid">
                  {QUESTION_STANDARDS.map((std) => {
                    const isActive = selectedStandards.includes(std.id);
                    return (
                      <button
                        key={std.id}
                        type="button"
                        className={`mock-standard-card ${isActive ? 'mock-standard-card--selected' : ''}`}
                        style={{ '--std-color': std.color, '--std-bg': std.bg }}
                        onClick={() => {
                          setSelectedStandards((prev) => {
                            const isSelecting = !prev.includes(std.id);
                            const next = isSelecting ? [...prev, std.id] : prev.filter((id) => id !== std.id);
                            if (std.id === 'engineering') setSelectedEngineeringUnis(isSelecting ? ENGINEERING_UNIVERSITIES : []);
                            if (std.id === 'university') setSelectedGeneralUnis(isSelecting ? GENERAL_UNIVERSITIES : []);
                            if (std.id === 'academic') {
                              setSelectedAcademicTypes(isSelecting ? ['board', 'college'] : []);
                              setSelectedBoards(isSelecting ? BOARDS : []);
                            }
                            return next;
                          });
                        }}
                      >
                        <div className="mock-standard-card-glow" />
                        <div className="mock-standard-icon" style={{ color: std.color, background: std.bg }}>{std.icon}</div>
                        <span className="mock-standard-label">{language === 'en' ? std.labelEn : std.labelBn}</span>
                        <span className="mock-standard-desc">{std.desc}</span>
                        {isActive && <div className="mock-standard-check"><HiCheckCircle size={20} /></div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="battle-settings-grid">
                <div className="mock-config-section">
                  <div className="mock-config-section-header">
                    <HiCollection size={20} className="mock-config-section-icon" />
                    <h4>Total Questions</h4>
                  </div>
                  <div className="battle-preset-row">
                    {COUNT_PRESETS.map((count) => (
                      <button key={count} type="button" className={`battle-preset-chip ${totalQuestions === count ? 'battle-preset-chip--selected' : ''}`} onClick={() => setTotalQuestions(count)}>{count}</button>
                    ))}
                  </div>
                </div>
                <div className="mock-config-section">
                  <div className="mock-config-section-header">
                    <HiClock size={20} className="mock-config-section-icon" />
                    <h4>Time Per Question</h4>
                  </div>
                  <div className="battle-preset-row">
                    {TIME_PRESETS.map((seconds) => (
                      <button key={seconds} type="button" className={`battle-preset-chip ${questionTimeSeconds === seconds ? 'battle-preset-chip--selected' : ''}`} onClick={() => setQuestionTimeSeconds(seconds)}>{seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="battle-rule-card">
                <strong>How the AI duel works</strong>
                <span>It’s a head-to-head race. The AI reads each MCQ and answers as soon as it works out the solution — there’s no artificial delay. The first side to lock in the correct answer wins the point. If neither is correct within the {questionTimeSeconds}s cap it’s a draw. After each question there’s a 2s gap, then the next one starts automatically.</span>
              </div>

              <div className="mock-selection-actions">
                <button type="button" className="btn btn-primary mock-next-btn" disabled={isStarting} onClick={startBattle}>
                  <span>{isStarting ? 'Loading questions…' : 'Start AI Battle'}</span>
                  <HiArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
