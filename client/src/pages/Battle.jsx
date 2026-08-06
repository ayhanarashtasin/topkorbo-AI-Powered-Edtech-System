import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  HiChevronDown,
  HiChevronUp,
  HiClock,
  HiCollection,
  HiDocumentText,
  HiFire,
  HiLightningBolt,
  HiMinusCircle,
  HiPencil,
  HiRefresh
} from 'react-icons/hi';
import { useLanguage } from '../hooks/useLanguage';
import Sidebar from '../components/layout/Sidebar';
import './Battle.css';

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
  bangla: 'Bangla', english: 'English', gk: 'GK', ict: 'ICT',
  physics: 'Physics', chemistry: 'Chemistry', highermath: 'Higher Math',
  biology: 'Biology', iba: 'IBA'
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

const BATTLE_MODES = [
  { id: 'duel', label: '1v1', players: 2, accent: '#C08552' },
  { id: 'custom-squad', label: 'Squad', players: 10, accent: '#10B981' },
  { id: 'raid', label: 'Raid', players: 30, accent: '#F97316' }
];

const BATTLE_MODE_META = {
  duel: { title: 'Head-to-Head Duel', desc: 'Fast 1v1. Solve under pressure, instant score swings.', icon: <HiLightningBolt size={20} />, badge: 'Fastest' },
  'custom-squad': { title: 'Custom Squad', desc: 'Team battles with flexible squad sizes.', icon: <HiCollection size={20} />, badge: 'Team' },
  raid: { title: 'Grand Raid', desc: 'Open leaderboard. Everyone fights for rank one.', icon: <HiFire size={20} />, badge: 'Large' }
};

const FALLBACK_QUESTIONS = [
  { questionText: 'Which option best matches the core idea of Newtons second law?', options: [{ text: 'F = ma', isCorrect: true }, { text: 'E = mc2' }, { text: 'V = IR' }, { text: 'P = IV' }], subject: 'Physics', chapter: 'Dynamics', type: 'mcq' },
  { questionText: 'For admission MCQ speed rounds, what matters after correctness?', options: [{ text: 'Submission speed', isCorrect: true }, { text: 'Question length' }, { text: 'Option color' }, { text: 'Chapter order' }], subject: 'GK', chapter: 'Battle Rules', type: 'mcq' },
  { questionText: 'If player A answers in 5 seconds and player B answers in 7 seconds, player B gets how many delta points?', options: [{ text: '2', isCorrect: true }, { text: '5' }, { text: '7' }, { text: '0' }], subject: 'Higher Math', chapter: 'Scoring', type: 'mcq' }
];

const makePlayers = (mode, currentName) => {
  const names = ['Tasnim A.', 'Rafiq H.', 'Nusrat J.', 'Mahin R.', 'Farhan S.', 'Rodela K.', 'Araf T.', 'Samia N.', 'Ayon D.', 'Mim F.', 'Shuvo P.', 'Sadia L.', 'Nabil Q.', 'Jarin M.', 'Rifat Z.', 'Tania C.', 'Arif B.', 'Mehrab I.', 'Tuba W.', 'Samin V.'];
  return Array.from({ length: mode.players }, (_, index) => ({
    id: index === 0 ? 'you' : `bot-${index}`, name: index === 0 ? currentName : names[index - 1] || `Player ${index + 1}`,
    team: index % 2 === 0 ? 'A' : 'B', score: 0, lastDelta: 0, answeredAt: null, isCorrect: null
  }));
};

const getQuestionOptions = (question) => {
  const options = Array.isArray(question?.options) ? question.options.filter((option) => option.text) : [];
  if (options.length >= 2) return options;
  return [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }];
};

const calculateBattlePoints = (seconds, isCorrect, hasNegativeMarking = false) => {
  if (!isCorrect) return hasNegativeMarking ? -1 : 0;
  if (seconds <= 5) return 5;
  return Math.max(0, Math.round(seconds - 5));
};

const renderMath = (text) => {
  if (!text) return { __html: '' };
  const renderedText = String(text)
    .replace(/\$\$([\s\S]+?)\$\$/g, (match, value) => {
      try { return katex.renderToString(value.trim(), { displayMode: true, throwOnError: false }); } catch { return match; }
    })
    .replace(/\$([^$]+)\$/g, (match, value) => {
      try { return katex.renderToString(value.trim(), { displayMode: false, throwOnError: false }); } catch { return match; }
    })
    .replace(/\n/g, '<br />');
  return { __html: sanitizeHtml(renderedText) };
};

export default function Battle() {
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = searchParams.get('step');
  const roomIdParam = searchParams.get('room');
  const step = stepParam ? parseInt(stepParam) : 1;

  const [user, setUser] = useState({
    id: localStorage.getItem('topkorbo_user_id') || '', name: localStorage.getItem('topkorbo_name') || 'Student Topper',
    avatar: localStorage.getItem('topkorbo_avatar') || '', email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student', streak: parseInt(localStorage.getItem('topkorbo_streak')) || 5
  });
  const [selectedMode, setSelectedMode] = useState(() => sessionStorage.getItem('battle_mode') || 'duel');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(() => JSON.parse(sessionStorage.getItem('battle_subject_ids') || '[]'));
  const [selectedChapters, setSelectedChapters] = useState(() => JSON.parse(sessionStorage.getItem('battle_chapters') || '{}'));
  const [topicsMap, setTopicsMap] = useState({});
  const [selectedTopics, setSelectedTopics] = useState(() => JSON.parse(sessionStorage.getItem('battle_selected_topics') || '{}'));
  const [selectedStandards, setSelectedStandards] = useState(() => JSON.parse(sessionStorage.getItem('battle_standards') || '[]'));
  const [selectedEngineeringUnis, setSelectedEngineeringUnis] = useState(() => JSON.parse(sessionStorage.getItem('battle_engineering_unis') || '[]'));
  const [selectedGeneralUnis, setSelectedGeneralUnis] = useState(() => JSON.parse(sessionStorage.getItem('battle_general_unis') || '[]'));
  const [selectedAcademicTypes, setSelectedAcademicTypes] = useState(() => JSON.parse(sessionStorage.getItem('battle_academic_types') || '[]'));
  const [selectedBoards, setSelectedBoards] = useState(() => JSON.parse(sessionStorage.getItem('battle_boards') || '[]'));
  const [questionType, setQuestionType] = useState(() => sessionStorage.getItem('battle_question_type') || 'mcq');
  const [totalQuestions, setTotalQuestions] = useState(() => parseInt(sessionStorage.getItem('battle_total_questions')) || 10);
  const [questionTimeSeconds, setQuestionTimeSeconds] = useState(() => parseInt(sessionStorage.getItem('battle_question_time_seconds')) || 15);
  const [negativeMarking, setNegativeMarking] = useState(() => sessionStorage.getItem('battle_negative_marking') === 'true');
  const [customSquadSize, setCustomSquadSize] = useState(() => parseInt(sessionStorage.getItem('battle_custom_squad_size')) || 5);
  const [raidMaxPlayers, setRaidMaxPlayers] = useState(() => parseInt(sessionStorage.getItem('battle_raid_max_players')) || 20);
  const [showSelectedTopics, setShowSelectedTopics] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [battleState, setBattleState] = useState(null);
  const [inviteRoom, setInviteRoom] = useState(null);
  const [isRoomActionLoading, setIsRoomActionLoading] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [nowMs, setNowMs] = useState(0);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachReport, setCoachReport] = useState(null);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [lobbyTeamNameDrafts, setLobbyTeamNameDrafts] = useState({ A: 'Team A', B: 'Team B' });
  const [editingTeamName, setEditingTeamName] = useState('');
  const [teamNameSaving, setTeamNameSaving] = useState('');

  const activeMode = BATTLE_MODES.find((mode) => mode.id === selectedMode) || BATTLE_MODES[0];
  const activeTeamSize = activeMode.id === 'custom-squad' ? customSquadSize : 5;

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { window.location.href = '/'; return; }
    const fetchUser = async () => {
      try {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { localStorage.removeItem('topkorbo_token'); window.location.href = '/'; return; }
        const data = await res.json();
        if (data.success && data.data) {
          setUser({ id: data.data._id, name: data.data.name, avatar: data.data.avatar || '', email: data.data.email, role: data.data.role, streak: data.data.streak || 5 });
          localStorage.setItem('topkorbo_user_id', data.data._id);
        }
      } catch (err) { console.error('Error fetching profile in Battle:', err); }
    };
    fetchUser();
  }, []);

  useEffect(() => { sessionStorage.setItem('battle_mode', selectedMode); }, [selectedMode]);
  useEffect(() => { sessionStorage.setItem('battle_subject_ids', JSON.stringify(selectedSubjectIds)); }, [selectedSubjectIds]);
  useEffect(() => { sessionStorage.setItem('battle_chapters', JSON.stringify(selectedChapters)); }, [selectedChapters]);
  useEffect(() => { sessionStorage.setItem('battle_selected_topics', JSON.stringify(selectedTopics)); }, [selectedTopics]);
  useEffect(() => { sessionStorage.setItem('battle_standards', JSON.stringify(selectedStandards)); }, [selectedStandards]);
  useEffect(() => { sessionStorage.setItem('battle_engineering_unis', JSON.stringify(selectedEngineeringUnis)); }, [selectedEngineeringUnis]);
  useEffect(() => { sessionStorage.setItem('battle_general_unis', JSON.stringify(selectedGeneralUnis)); }, [selectedGeneralUnis]);
  useEffect(() => { sessionStorage.setItem('battle_academic_types', JSON.stringify(selectedAcademicTypes)); }, [selectedAcademicTypes]);
  useEffect(() => { sessionStorage.setItem('battle_boards', JSON.stringify(selectedBoards)); }, [selectedBoards]);
  useEffect(() => { sessionStorage.setItem('battle_question_type', questionType); }, [questionType]);
  useEffect(() => { sessionStorage.setItem('battle_total_questions', String(totalQuestions)); }, [totalQuestions]);
  useEffect(() => { sessionStorage.setItem('battle_question_time_seconds', String(questionTimeSeconds)); }, [questionTimeSeconds]);
  useEffect(() => { sessionStorage.setItem('battle_negative_marking', String(negativeMarking)); }, [negativeMarking]);
  useEffect(() => { sessionStorage.setItem('battle_custom_squad_size', String(customSquadSize)); }, [customSquadSize]);
  useEffect(() => { sessionStorage.setItem('battle_raid_max_players', String(raidMaxPlayers)); }, [raidMaxPlayers]);

  const QUESTION_STANDARDS = [
    { id: 'engineering', labelEn: 'Engineering', labelBn: 'ইঞ্জিনিয়ারিং', icon: <HiLightningBolt size={24} />, desc: 'BUET, CUET, KUET', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)' },
    { id: 'university', labelEn: 'University', labelBn: 'বিশ্ববিদ্যালয়', icon: <HiAcademicCap size={24} />, desc: 'DU, CU, RU, JU', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)' },
    { id: 'academic', labelEn: 'Academic', labelBn: 'একাডেমিক', icon: <HiBookOpen size={24} />, desc: 'Board & college', color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)' },
    { id: 'medical', labelEn: 'Medical', labelBn: 'মেডিকেল', icon: <HiBeaker size={24} />, desc: 'Medical & dental', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.08)' }
  ];
  const QUESTION_TYPES = [
    { id: 'mcq', labelEn: 'MCQ', labelBn: 'MCQ', icon: <HiCollection size={16} /> },
    { id: 'cq', labelEn: 'CQ', labelBn: 'CQ', icon: <HiPencil size={16} /> },
    { id: 'written', labelEn: 'Written', labelBn: 'লিখিত', icon: <HiDocumentText size={16} /> }
  ];

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const setStep = (nextStep) => {
    const nextParams = { step: String(nextStep) };
    if (roomIdParam) nextParams.room = roomIdParam;
    setSearchParams(nextParams);
  };

  const roomToBattleState = useCallback((room) => ({
    mode: { ...(BATTLE_MODES.find((mode) => mode.id === room.settings?.mode) || BATTLE_MODES[0]), label: room.settings?.modeLabel || (BATTLE_MODES.find((mode) => mode.id === room.settings?.mode) || BATTLE_MODES[0]).label },
    roomId: room.id, isRemote: true, status: room.status, settings: room.settings, questions: room.questions,
    currentIndex: room.currentIndex,
    players: room.players.map((player, index) => ({ ...player, team: player.team || (index === 0 ? 'A' : 'B'), isYou: player.id === user.id })),
    selectedAnswer: room.questions?.[room.currentIndex]?.viewerAnswer ?? null,
    locked: Boolean(room.players.find((player) => player.id === user.id)?.hasAnsweredCurrent),
    questionStartedAt: room.questionStartedAt, finished: room.status === 'finished', log: room.log || []
  }), [user.id]);

  const syncRoom = useCallback(async (roomId, { join = false } = {}) => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token || !roomId) return null;
    const res = await fetch(`${apiBase}/battles/rooms/${roomId}${join ? '/join' : ''}`, { method: join ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) { toast.error(data.message || 'Could not open battle room.'); return null; }
    setInviteRoom(data.data);
    if (data.data.status === 'active' || data.data.status === 'finished') setBattleState(roomToBattleState(data.data));
    return data.data;
  }, [apiBase, roomToBattleState]);

  useEffect(() => {
    if (!roomIdParam || !user.id) return undefined;
    if (inviteRoom?.id === roomIdParam || battleState?.roomId === roomIdParam) return undefined;
    const timeoutId = window.setTimeout(() => { syncRoom(roomIdParam, { join: true }); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [roomIdParam, syncRoom, user.id, inviteRoom?.id, battleState?.roomId]);

  useEffect(() => {
    if (!inviteRoom?.id || inviteRoom.status === 'finished') return undefined;
    const intervalId = window.setInterval(() => { syncRoom(inviteRoom.id); }, inviteRoom.status === 'active' ? 1000 : 2000);
    return () => window.clearInterval(intervalId);
  }, [inviteRoom?.id, inviteRoom?.status, syncRoom]);

  useEffect(() => {
    if (!battleState?.isRemote || battleState.finished) return undefined;
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [battleState?.isRemote, battleState?.finished]);

  const toggleSubjectSelection = (id) => {
    setSelectedSubjectIds((prev) => {
      const isRemoving = prev.includes(id);
      setSelectedChapters((current) => {
        const next = { ...current };
        if (isRemoving) delete next[id]; else if (!next[id]) next[id] = { '1st': [], '2nd': [] };
        return next;
      });
      if (isRemoving) {
        setSelectedTopics((prevTopics) => {
          const copy = { ...prevTopics };
          Object.keys(copy).forEach((key) => { if (key.startsWith(`${id}__`)) delete copy[key]; });
          return copy;
        });
      }
      return isRemoving ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  const toggleAllSubjects = () => {
    setSelectedSubjectIds((prev) => {
      const shouldClear = prev.length === SUBJECTS.length;
      if (shouldClear) setSelectedTopics({});
      setSelectedChapters((current) => {
        if (shouldClear) return {};
        return SUBJECTS.reduce((next, subject) => ({ ...next, [subject.id]: current[subject.id] || { '1st': [], '2nd': [] } }), {});
      });
      return shouldClear ? [] : SUBJECTS.map((subject) => subject.id);
    });
  };

  const fetchTopicsForChapter = async (subId, paper, chapter) => {
    const key = `${subId}__${paper}__${chapter}`;
    if (topicsMap[key]) return;
    try {
      const token = localStorage.getItem('topkorbo_token');
      const dbSubject = SUBJECT_DB_MAP[subId] || subId;
      const res = await fetch(`${apiBase}/questions/topics?subject=${encodeURIComponent(dbSubject)}&paper=${paper}&chapter=${encodeURIComponent(chapter)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success && data.data) {
        setTopicsMap((prev) => ({ ...prev, [key]: data.data }));
        setSelectedTopics((prev) => { if (key in prev) return prev; return { ...prev, [key]: data.data.map((t) => t.name) }; });
      }
    } catch (err) { console.error('Error fetching battle topics:', err); }
  };

  const clearTopicsForChapter = (subId, paper, chapter) => {
    const key = `${subId}__${paper}__${chapter}`;
    setSelectedTopics((prev) => { if (!(key in prev)) return prev; const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const toggleChapterSelection = (subId, paper, chapter) => {
    setSelectedChapters((prev) => {
      const subMap = prev[subId] || { '1st': [], '2nd': [] };
      const list = subMap[paper] || [];
      const isSelecting = !list.includes(chapter);
      if (isSelecting) fetchTopicsForChapter(subId, paper, chapter); else clearTopicsForChapter(subId, paper, chapter);
      return { ...prev, [subId]: { ...subMap, [paper]: isSelecting ? [...list, chapter] : list.filter((item) => item !== chapter) } };
    });
  };

  const toggleAllChaptersForPaper = (subId, paper) => {
    const allChapters = CHAPTERS[subId]?.[paper] || [];
    setSelectedChapters((prev) => {
      const subMap = prev[subId] || { '1st': [], '2nd': [] };
      const selected = subMap[paper] || [];
      const isAllChecked = selected.length === allChapters.length;
      if (isAllChecked) allChapters.forEach((chapter) => clearTopicsForChapter(subId, paper, chapter));
      else allChapters.forEach((chapter) => fetchTopicsForChapter(subId, paper, chapter));
      return { ...prev, [subId]: { ...subMap, [paper]: isAllChecked ? [] : allChapters } };
    });
  };

  const buildSelections = () => {
    const selections = [];
    selectedSubjectIds.forEach((subId) => {
      const subMap = selectedChapters[subId] || { '1st': [], '2nd': [] };
      ['1st', '2nd'].forEach((paper) => {
        const chapters = subMap[paper] || [];
        if (chapters.length === 0) return;
        selections.push({ subject: SUBJECT_DB_MAP[subId] || subId, paper, chapters: chapters.map((name) => ({ name, topics: selectedTopics[`${subId}__${paper}__${name}`] || [] })) });
      });
    });
    return selections;
  };

  useEffect(() => {
    if (step !== 3) return;
    selectedSubjectIds.forEach((subId) => {
      const subMap = selectedChapters[subId] || { '1st': [], '2nd': [] };
      ['1st', '2nd'].forEach((paper) => { (subMap[paper] || []).forEach((chapter) => fetchTopicsForChapter(subId, paper, chapter)); });
    });
  }, [step]);

  const summary = useMemo(() => {
    let chapterCount = 0;
    Object.values(selectedChapters).forEach((subMap) => { Object.values(subMap).forEach((chapters) => { chapterCount += chapters.length; }); });
    let topicCount = 0;
    Object.values(selectedTopics).forEach((topics) => { topicCount += topics.length; });
    return { subjectCount: selectedSubjectIds.length, chapterCount, topicCount };
  }, [selectedChapters, selectedTopics, selectedSubjectIds.length]);

  const validateSettings = () => {
    if (selectedStandards.length === 0) return 'Select at least one question standard.';
    if (selectedStandards.includes('engineering') && selectedEngineeringUnis.length === 0) return 'Select at least one Engineering university.';
    if (selectedStandards.includes('university') && selectedGeneralUnis.length === 0) return 'Select at least one University.';
    if (selectedStandards.includes('academic') && selectedAcademicTypes.length === 0) return 'Select an Academic question source.';
    if (selectedStandards.includes('academic') && selectedAcademicTypes.includes('board') && selectedBoards.length === 0) return 'Select at least one board.';
    if (!questionType) return 'Select a question type.';
    if (!totalQuestions || totalQuestions <= 0) return 'Select total questions.';
    if (!questionTimeSeconds || questionTimeSeconds < 5 || questionTimeSeconds > 120) return 'Time per question must be 5-120 seconds.';
    return '';
  };

  const fetchBattleQuestions = async (token) => {
    const requestQuestions = async (count) => {
      const res = await fetch(`${apiBase}/questions/mock-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selections: buildSelections(), standard: selectedStandards[0] || '', standards: selectedStandards, selectedEngineeringUnis, selectedGeneralUnis, selectedAcademicTypes, selectedBoards, questionType, totalQuestions: count, context: 'battle' })
      });
      return res.json();
    };
    const data = await requestQuestions(totalQuestions);
    if (data.success && data.data?.questions?.length) return data.data.questions;
    const availableCount = Number(data.data?.available || 0);
    if (data.success && availableCount > 0 && availableCount < totalQuestions) {
      const retryData = await requestQuestions(availableCount);
      if (retryData.success && retryData.data?.questions?.length) { toast(`Only ${availableCount} matching questions available. Starting with those.`); return retryData.data.questions; }
    }
    toast('No matching live questions found yet. Starting a demo battle.');
    return FALLBACK_QUESTIONS;
  };

  const startBattle = async () => {
    const validationError = validateSettings();
    if (validationError) { toast.error(validationError); return; }
    setCoachReport(null); setCoachError(''); setCoachLoading(false); setRematchLoading(false);
    setIsStarting(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const questions = await fetchBattleQuestions(token);
      const battleQuestionCount = Math.min(questions.length, totalQuestions);
      if (activeMode.id === 'duel' || activeMode.id === 'squad' || activeMode.id === 'custom-squad' || activeMode.id === 'raid') {
        const createRes = await fetch(`${apiBase}/battles/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ questions: questions.slice(0, battleQuestionCount), settings: { mode: activeMode.id, questionTimeSeconds, totalQuestions: battleQuestionCount, questionType, negativeMarking, teamNames: { A: 'Team A', B: 'Team B' }, teamSize: activeTeamSize, maxPlayers: activeMode.id === 'raid' ? raidMaxPlayers : undefined } })
        });
        const createData = await createRes.json();
        if (!createData.success) { if (!notifyPaywall(createData)) toast.error(createData.message || 'Could not create battle room.'); return; }
        setInviteRoom(createData.data); setSearchParams({ room: createData.data.id, step: '4' });
        toast.success(`${activeMode.label} room created. Share the invite code.`);
        return;
      }
      const players = makePlayers(activeMode, user.name);
      setBattleState({ mode: activeMode, settings: { questionTimeSeconds, negativeMarking }, questions: questions.slice(0, battleQuestionCount), currentIndex: 0, players, selectedAnswer: null, locked: false, questionStartedAt: Date.now(), finished: false, answerHistory: {}, log: [] });
    } catch (err) {
      console.error('Error starting battle:', err);
      toast('Network issue. Starting a demo battle.');
      setBattleState({ mode: activeMode, settings: { questionTimeSeconds, negativeMarking }, questions: FALLBACK_QUESTIONS.slice(0, totalQuestions), currentIndex: 0, players: makePlayers(activeMode, user.name), selectedAnswer: null, locked: false, questionStartedAt: Date.now(), finished: false, answerHistory: {}, log: [] });
    } finally { setIsStarting(false); }
  };

  const submitAnswer = async (optionIndex) => {
    if (!battleState || battleState.locked) return;
    if (battleState.isRemote) {
      const token = localStorage.getItem('topkorbo_token');
      try {
        const res = await fetch(`${apiBase}/battles/rooms/${battleState.roomId}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ optionIndex }) });
        const data = await res.json();
        if (!data.success) { toast.error(data.message || 'Could not submit answer.'); return; }
        setInviteRoom(data.data); setBattleState(roomToBattleState(data.data));
      } catch (err) { console.error('Error submitting battle answer:', err); toast.error('Network error while submitting answer.'); }
      return;
    }
    const question = battleState.questions[battleState.currentIndex];
    const options = getQuestionOptions(question);
    const submittedAt = Math.max(1, Math.round((Date.now() - battleState.questionStartedAt) / 1000));
    const isCorrect = Boolean(options[optionIndex]?.isCorrect);
    const yourPoints = calculateBattlePoints(submittedAt, isCorrect, negativeMarking);
    const botUpdates = battleState.players.slice(1).map((player, index) => {
      const botSecond = Math.min(15, 4 + ((index * 3 + battleState.currentIndex * 2) % 8));
      const botCorrect = ((index + battleState.currentIndex) % 4) !== 0;
      return { ...player, answeredAt: botSecond, isCorrect: botCorrect, lastDelta: calculateBattlePoints(botSecond, botCorrect, negativeMarking), score: Math.max(0, player.score + calculateBattlePoints(botSecond, botCorrect, negativeMarking)) };
    });
    const you = { ...battleState.players[0], answeredAt: submittedAt, isCorrect, lastDelta: yourPoints, score: Math.max(0, battleState.players[0].score + yourPoints) };
    setBattleState({ ...battleState, selectedAnswer: optionIndex, locked: true, answerHistory: { ...(battleState.answerHistory || {}), [battleState.currentIndex]: { selectedAnswer: optionIndex, answeredAtSeconds: submittedAt, points: yourPoints, isCorrect } }, players: [you, ...botUpdates], log: [`${you.name}: ${yourPoints > 0 ? '+' : ''}${yourPoints} pts at ${submittedAt}s`, ...battleState.log].slice(0, 5) });
  };

  const nextQuestion = () => {
    if (!battleState) return;
    if (battleState.currentIndex + 1 >= battleState.questions.length) { setBattleState({ ...battleState, finished: true }); return; }
    setBattleState({ ...battleState, currentIndex: battleState.currentIndex + 1, selectedAnswer: null, locked: false, questionStartedAt: Date.now(), players: battleState.players.map((player) => ({ ...player, answeredAt: null, isCorrect: null, lastDelta: 0 })) });
  };

  const resetBattle = () => { setBattleState(null); setInviteRoom(null); setCoachReport(null); setCoachError(''); setCoachLoading(false); setRematchLoading(false); setSearchParams({ step: '1' }); };

  const buildCoachPayload = (state) => {
    if (!state) return null;
    const players = state.players || [];
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const player = players.find((item) => item.isYou || item.id === 'you') || players[0] || {};
    const rank = Math.max(1, sorted.findIndex((item) => item.id === player.id) + 1);
    const isTeamMode = state.settings?.mode === 'squad' || state.settings?.mode === 'custom-squad';
    const teamScore = isTeamMode ? players.filter((item) => item.team === player.team).reduce((sum, item) => sum + (Number(item.score) || 0), 0) : null;
    return {
      mode: state.settings?.mode || state.mode?.id || state.mode?.label || 'battle', questionCount: state.questions?.length || 0, negativeMarking: Boolean(state.settings?.negativeMarking),
      player: { score: Number(player.score) || 0, rank, team: isTeamMode ? (player.team || null) : null, teamScore },
      questions: (state.questions || []).map((item, index) => {
        const options = getQuestionOptions(item);
        const localHistory = state.answerHistory?.[index] || {};
        const selectedIndex = item.viewerAnswer ?? localHistory.selectedAnswer ?? null;
        const correctIndex = item.correctOptionIndex ?? options.findIndex((option) => option.isCorrect);
        const selectedOption = selectedIndex === null ? null : options[selectedIndex];
        const correctOption = correctIndex >= 0 ? options[correctIndex] : null;
        const isCorrect = item.viewerIsCorrect ?? localHistory.isCorrect ?? (selectedIndex !== null && correctIndex >= 0 ? selectedIndex === correctIndex : false);
        return { subject: item.subject || '', chapter: item.chapter || '', type: item.type || 'mcq', questionText: String(item.questionText || '').slice(0, 280), selectedAnswer: selectedOption?.text || '', correctAnswer: correctOption?.text || '', isCorrect: Boolean(isCorrect), answeredAtSeconds: item.viewerAnsweredAtSeconds ?? localHistory.answeredAtSeconds ?? null, points: item.viewerPoints ?? localHistory.points ?? 0 };
      })
    };
  };

  const requestBattleCoach = async () => {
    if (!battleState?.finished || coachLoading) return;
    setCoachLoading(true); setCoachError('');
    try {
      const token = localStorage.getItem('topkorbo_token');
      const payload = buildCoachPayload(battleState);
      const res = await fetch(`${apiBase}/battles/coach`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not generate battle coach.');
      setCoachReport(data.data?.report || null);
      if (data.data?.fallback) setCoachError('AI coach used a fallback report this time.');
    } catch (err) { console.error('Error generating battle coach:', err); setCoachError('AI coach unavailable right now. Your battle result is still safe.'); }
    finally { setCoachLoading(false); }
  };

  const createRematch = async () => {
    if (!battleState?.isRemote || !battleState.roomId || rematchLoading) return;
    const openRematchRoom = (room) => { setCoachReport(null); setCoachError(''); setCoachLoading(false); setInviteRoom(room); setBattleState(null); setSearchParams({ room: room.id, step: '4' }); toast.success('Rematch room created. Share the new code.'); };
    const createRoomFromCurrentBattle = async (token) => {
      const settings = battleState.settings || {};
      const questions = (battleState.questions || []).map((question) => ({ ...question, options: (question.options || []).map((option, index) => ({ ...option, isCorrect: question.correctOptionIndex === index })) }));
      const res = await fetch(`${apiBase}/battles/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ questions, settings: { ...settings, totalQuestions: questions.length } }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not create rematch.');
      return data.data;
    };
    setRematchLoading(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      let rematchRoom = null;
      try {
        const res = await fetch(`${apiBase}/battles/rooms/${battleState.roomId}/rematch`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await res.json() : null;
        if (data?.success) rematchRoom = data.data;
      } catch (endpointErr) { console.warn('Dedicated rematch endpoint failed, using room-create fallback:', endpointErr); }
      if (!rematchRoom) rematchRoom = await createRoomFromCurrentBattle(token);
      openRematchRoom(rematchRoom);
    } catch (err) { console.error('Error creating rematch:', err); toast.error(err.message || 'Network error while creating rematch.'); }
    finally { setRematchLoading(false); }
  };

  const copyRoomCode = async () => {
    if (!inviteRoom?.id) return;
    try { await navigator.clipboard.writeText(inviteRoom.id); setCopiedInvite(true); toast.success('Battle code copied.'); window.setTimeout(() => setCopiedInvite(false), 1600); }
    catch (err) { console.error('Could not copy battle code:', err); toast.error(inviteRoom.id); }
  };

  const joinRoomByCode = async () => {
    const normalizedCode = joinCode.trim().toLowerCase();
    if (!normalizedCode) { toast.error('Enter a battle code first.'); return; }
    if (!/^[0-9a-f]{8}$/.test(normalizedCode)) { toast.error('That does not look like a valid battle code.'); return; }
    setIsRoomActionLoading(true);
    try { const room = await syncRoom(normalizedCode, { join: true }); if (room) { setSearchParams({ room: room.id, step: '1' }); toast.success('Joined battle room.'); } }
    finally { setIsRoomActionLoading(false); }
  };

  const startRemoteRoom = async () => {
    if (!inviteRoom?.id || isRoomActionLoading) return;
    setIsRoomActionLoading(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const res = await fetch(`${apiBase}/battles/rooms/${inviteRoom.id}/start`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.success) { toast.error(data.message || 'Could not start room.'); return; }
      setInviteRoom(data.data);
      if (data.data.status === 'active' || data.data.status === 'finished') setBattleState(roomToBattleState(data.data)); else setBattleState(null);
    } catch (err) { console.error('Error starting battle room:', err); toast.error('Network error while starting room.'); }
    finally { setIsRoomActionLoading(false); }
  };

  const updateLobbyTeamName = async (team) => {
    if (!inviteRoom?.id || !team || teamNameSaving) return;
    const nextName = String(lobbyTeamNameDrafts[team] || '').trim().slice(0, 24) || `Team ${team}`;
    const currentName = inviteRoom.settings?.teamNames?.[team] || `Team ${team}`;
    setLobbyTeamNameDrafts((prev) => ({ ...prev, [team]: nextName })); setEditingTeamName('');
    if (nextName === currentName) return;
    setTeamNameSaving(team);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const res = await fetch(`${apiBase}/battles/rooms/${inviteRoom.id}/team-name`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ team, teamName: nextName }) });
      const data = await res.json();
      if (!data.success) { toast.error(data.message || 'Could not update team name.'); setLobbyTeamNameDrafts((prev) => ({ ...prev, [team]: currentName })); return; }
      setInviteRoom(data.data); toast.success(`${data.data.settings?.teamNames?.[team] || nextName} saved.`);
    } catch (err) { console.error('Error updating team name:', err); setLobbyTeamNameDrafts((prev) => ({ ...prev, [team]: currentName })); toast.error('Network error while updating team name.'); }
    finally { setTeamNameSaving(''); }
  };

  const STEPS = [
    { num: 1, labelEn: 'Mode', labelBn: 'মোড' },
    { num: 2, labelEn: 'Subjects', labelBn: 'বিষয়' },
    { num: 3, labelEn: 'Chapters', labelBn: 'অধ্যায়' },
    { num: 4, labelEn: 'Settings', labelBn: 'সেটিংস' }
  ];

  if (inviteRoom && inviteRoom.status === 'waiting') {
    const currentWaitingPlayer = inviteRoom.players.find((player) => player.id === user.id);
    const readyCount = inviteRoom.players.filter((player) => player.ready).length;
    const isCurrentReady = Boolean(currentWaitingPlayer?.ready);
    const mode = BATTLE_MODES.find((item) => item.id === inviteRoom.settings?.mode) || BATTLE_MODES[0];
    const requiredPlayers = inviteRoom.settings?.maxPlayers || mode.players || 2;
    const teamSize = inviteRoom.settings?.teamSize || 1;
    const waitingSlots = Math.max(0, requiredPlayers - inviteRoom.players.length);
    const teamAPlayers = inviteRoom.players.filter((player) => player.team === 'A');
    const teamBPlayers = inviteRoom.players.filter((player) => player.team === 'B');
    const roomTeamNames = inviteRoom.settings?.teamNames || { A: 'Team A', B: 'Team B' };
    const realPlayerCount = inviteRoom.players.filter((player) => !player.isTestPlayer).length;
    const isSquadRoom = mode.id === 'squad' || mode.id === 'custom-squad';
    const isRaidRoom = mode.id === 'raid';
    const requiredRealPlayers = isSquadRoom ? 2 : requiredPlayers;
    const realPlayersReady = realPlayerCount >= requiredRealPlayers;
    const readyDenominator = requiredPlayers;
    const canReady = inviteRoom.players.length === requiredPlayers && realPlayersReady && !isCurrentReady;
    const isLastPlayerToReady = canReady && readyCount === readyDenominator - 1;
    const waitingButtonLabel = inviteRoom.players.length < requiredPlayers
      ? `Waiting for ${waitingSlots} ${isRaidRoom ? 'raider' : 'player'}${waitingSlots === 1 ? '' : 's'}`
      : (!realPlayersReady ? 'Waiting for real player' : (isCurrentReady ? 'Waiting for everyone' : (isLastPlayerToReady ? (isRaidRoom ? 'Start Raid' : 'Start Battle') : 'I\'m Ready')));
    const renderWaitingPlayer = (player, slotLabel) => (
      <div key={player?.id || slotLabel} className={`ba-lobby__player ${!player ? 'ba-lobby__player--empty' : ''}`}>
        <div className="ba-lobby__player-avatar">{player ? (player.avatar ? <img src={player.avatar} alt="" /> : player.name.charAt(0)) : '?'}</div>
        <strong>{player?.name || 'Waiting'}</strong>
        <span>{player ? (player.ready ? 'Ready' : (player.id === inviteRoom.hostId ? 'Host' : roomTeamNames[player.team])) : slotLabel}</span>
      </div>
    );

    return (
      <div className="dashboard-container">
        <Sidebar activeTab="battle" user={user} />
        <main className="dashboard-main ba-main">
          <div className="ba-lobby">
            <section className="ba-lobby__card">
              <span className="ba-lobby__code">Room #{inviteRoom.id}</span>
              <h3>{isSquadRoom ? `Build your ${teamSize}v${teamSize} squad` : (isRaidRoom ? 'Open the Grand Raid' : 'Invite one real student')}</h3>
              <p>{isRaidRoom ? 'Share this battle code with anyone. Every joined student competes solo on one leaderboard.' : 'Share this battle code with logged-in students. The match starts only when every player is inside and ready.'}</p>
              <div className="ba-lobby__code-row">
                <span>{inviteRoom.id}</span>
                <button type="button" className="ba-btn ba-btn--primary" onClick={copyRoomCode}>{copiedInvite ? 'Copied!' : 'Copy Code'}</button>
              </div>
              <div className="ba-lobby__ready">
                <div>
                  <strong>{isRaidRoom ? `${inviteRoom.players.length}/${requiredPlayers} joined` : `${readyCount}/${readyDenominator} ready`}</strong>
                  <span>{isRaidRoom ? (inviteRoom.players.length < requiredPlayers ? `${waitingSlots} more raider${waitingSlots === 1 ? '' : 's'} must join.` : (isCurrentReady ? 'Waiting for every raider.' : 'Click ready when set.')) : inviteRoom.players.length < requiredPlayers ? `${waitingSlots} more player${waitingSlots === 1 ? '' : 's'} needed.` : (!realPlayersReady ? 'One more real student needed.' : (isCurrentReady ? 'Waiting for the other player.' : 'Click ready when set.'))}</span>
                </div>
                <button type="button" className="ba-btn ba-btn--primary" disabled={!canReady || isRoomActionLoading} onClick={startRemoteRoom}>
                  <span>{waitingButtonLabel}</span><HiArrowRight size={16} />
                </button>
              </div>
              {isSquadRoom ? (
                <div className="ba-lobby__teams">
                  {[{ team: 'A', players: teamAPlayers }, { team: 'B', players: teamBPlayers }].map((group) => (
                    <div key={group.team} className="ba-lobby__team">
                      <h4>
                        {currentWaitingPlayer?.team === group.team ? (
                          <input className="ba-lobby__team-input" type="text" value={editingTeamName === group.team ? (lobbyTeamNameDrafts[group.team] ?? roomTeamNames[group.team]) : roomTeamNames[group.team]} maxLength={24} aria-label={`Rename Team ${group.team}`} disabled={teamNameSaving === group.team} onFocus={() => { setEditingTeamName(group.team); setLobbyTeamNameDrafts((prev) => ({ ...prev, [group.team]: roomTeamNames[group.team] })); }} onChange={(event) => setLobbyTeamNameDrafts((prev) => ({ ...prev, [group.team]: event.target.value }))} onBlur={() => updateLobbyTeamName(group.team)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setLobbyTeamNameDrafts((prev) => ({ ...prev, [group.team]: roomTeamNames[group.team] })); event.currentTarget.blur(); } }} />
                        ) : (<span>{roomTeamNames[group.team]}</span>)}
                        <em>{group.players.length}/{teamSize}</em>
                      </h4>
                      {Array.from({ length: teamSize }).map((_, index) => renderWaitingPlayer(group.players[index], `Slot ${index + 1}`))}
                    </div>
                  ))}
                </div>
              ) : isRaidRoom ? (
                <div className="ba-lobby__raid">
                  {Array.from({ length: requiredPlayers }).map((_, index) => {
                    const player = inviteRoom.players[index];
                    return (<div key={player?.id || `raid-slot-${index}`} className={`ba-lobby__player ${!player ? 'ba-lobby__player--empty' : ''}`}><div className="ba-lobby__player-avatar">{player ? (player.avatar ? <img src={player.avatar} alt="" /> : player.name.charAt(0)) : '?'}</div><strong>{player?.name || 'Waiting'}</strong><span>{player ? (player.ready ? 'Ready' : (index === 0 ? 'Host' : 'Raider')) : `Raider ${index + 1}`}</span></div>);
                  })}
                </div>
              ) : (
                <div className="ba-lobby__grid">
                  {Array.from({ length: requiredPlayers }).map((_, index) => renderWaitingPlayer(inviteRoom.players[index], index === 0 ? 'Host' : 'Opponent'))}
                </div>
              )}
              <div className="ba-lobby__meta">
                <span>{inviteRoom.settings.totalQuestions} questions</span>
                <span>{inviteRoom.settings.questionTimeSeconds}s / Q</span>
                <span>{inviteRoom.settings.negativeMarking ? 'Neg. marking' : 'No neg.'}</span>
              </div>
              <div className="ba-lobby__actions">
                <button type="button" className="ba-btn ba-btn--ghost" onClick={resetBattle}>Cancel</button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (battleState) {
    const question = battleState.questions[battleState.currentIndex];
    const options = getQuestionOptions(question);
    const sortedPlayers = [...battleState.players].sort((a, b) => b.score - a.score);
    const currentPlayer = battleState.players.find((player) => player.isYou || player.id === 'you') || battleState.players[0];
    const opponentPlayer = battleState.players.find((player) => player.id !== currentPlayer.id);
    const yourRank = sortedPlayers.findIndex((player) => player.id === currentPlayer.id) + 1;
    const teamA = battleState.players.filter((player) => player.team === 'A').reduce((sum, player) => sum + player.score, 0);
    const teamB = battleState.players.filter((player) => player.team === 'B').reduce((sum, player) => sum + player.score, 0);
    const teamAList = battleState.players.filter((player) => player.team === 'A').sort((a, b) => b.score - a.score);
    const teamBList = battleState.players.filter((player) => player.team === 'B').sort((a, b) => b.score - a.score);
    const isTeamBattle = battleState.settings?.mode === 'squad' || battleState.settings?.mode === 'custom-squad';
    const isRaidBattle = battleState.settings?.mode === 'raid';
    const currentTeam = currentPlayer.team || 'A';
    const battleTeamNames = battleState.settings?.teamNames || { A: 'Team A', B: 'Team B' };
    const yourTeamScore = currentTeam === 'A' ? teamA : teamB;
    const opposingTeamScore = currentTeam === 'A' ? teamB : teamA;
    const didWin = isTeamBattle ? yourTeamScore >= opposingTeamScore : (isRaidBattle ? yourRank === 1 : (!opponentPlayer || currentPlayer.score >= opponentPlayer.score));
    const mvp = sortedPlayers[0];
    const questionTimeLimit = battleState.settings?.questionTimeSeconds || questionTimeSeconds;
    const remainingSeconds = battleState.isRemote && battleState.questionStartedAt && nowMs
      ? Math.max(0, questionTimeLimit - Math.floor((nowMs - battleState.questionStartedAt) / 1000)) : questionTimeLimit;

    return (
      <div className="dashboard-container">
        <Sidebar activeTab="battle" user={user} />
        <main className="dashboard-main ba-main">
          <div className={`ba-arena ${battleState.finished ? 'ba-arena--finished' : ''}`}>
            <section className="ba-arena__stage">
              {isRaidBattle ? (
                <div className="ba-score-strip ba-score-strip--raid">
                  <div><span>Your Score</span><strong>{currentPlayer.score}</strong></div>
                  <div className="ba-vs-core">#{yourRank}</div>
                  <div><span>Raiders</span><strong>{battleState.players.length}</strong></div>
                </div>
              ) : (
                <div className="ba-score-strip">
                  <div><span>{isTeamBattle ? battleTeamNames.A : (battleState.players[0]?.name || 'P1')}</span><strong>{teamA}</strong></div>
                  <div className="ba-vs-core">VS</div>
                  <div><span>{isTeamBattle ? battleTeamNames.B : (opponentPlayer?.name || 'P2')}</span><strong>{teamB}</strong></div>
                </div>
              )}
              {battleState.finished ? (
                <div className="ba-finish">
                  {didWin && (
                    <div className="ba-confetti" aria-hidden="true">
                      {Array.from({ length: 18 }).map((_, index) => <span key={index} />)}
                    </div>
                  )}
                  <div className={`ba-finish__badge ${didWin ? 'ba-finish__badge--win' : 'ba-finish__badge--loss'}`}>
                    {didWin ? 'WIN' : 'RUN'}
                  </div>
                  <h3>{didWin ? (isTeamBattle ? 'Squad Victory!' : (isRaidBattle ? 'Raid Champion!' : 'Congrats Champ!')) : 'Next time champ'}</h3>
                  <p>{didWin ? (isTeamBattle ? `${battleTeamNames[currentTeam]} won.` : (isRaidBattle ? 'You topped the Grand Raid.' : 'You won the 1v1.')) : 'You fought well. Take the next one.'}</p>
                  <div className="ba-finish__stats">
                    <div><span>{isTeamBattle ? 'Team' : 'Score'}</span><strong>{isTeamBattle ? yourTeamScore : currentPlayer.score}</strong></div>
                    <div><span>Rank</span><strong>#{yourRank}</strong></div>
                    <div><span>{isTeamBattle ? 'MVP' : (isRaidBattle ? 'Raiders' : 'Qs')}</span><strong>{isTeamBattle ? (mvp?.name || '-') : (isRaidBattle ? battleState.players.length : battleState.questions.length)}</strong></div>
                  </div>
                  <div className="ba-finish__coach-actions">
                    <button className="ba-btn ba-btn--ghost" type="button" onClick={requestBattleCoach} disabled={coachLoading}>
                      {coachLoading ? 'Coaching...' : 'AI Battle Coach'}
                    </button>
                    {coachError && <span>{coachError}</span>}
                  </div>
                  {coachReport && (
                    <div className="ba-coach">
                      <div><span>AI Coach</span><h4>Battle Review</h4><p>{coachReport.summary}</p></div>
                      <div className="ba-coach__grid">
                        <section><h5>Strengths</h5><ul>{(coachReport.strengths || []).map((item, i) => <li key={`s-${i}`}>{item}</li>)}</ul></section>
                        <section><h5>Weak Spots</h5><ul>{(coachReport.weaknesses || []).map((item, i) => <li key={`w-${i}`}>{item}</li>)}</ul></section>
                        <section><h5>Mistakes</h5><ul>{(coachReport.mistakePatterns || []).map((item, i) => <li key={`m-${i}`}>{item}</li>)}</ul></section>
                        <section><h5>Actions</h5><ul>{(coachReport.practiceActions || []).map((item, i) => <li key={`a-${i}`}>{item}</li>)}</ul></section>
                      </div>
                      <div className="ba-coach__note"><strong>Speed vs Accuracy</strong><p>{coachReport.speedAccuracy}</p></div>
                      <p className="ba-coach__motivation">{coachReport.motivation}</p>
                    </div>
                  )}
                  <div className="ba-finish__actions">
                    {battleState.isRemote && (
                      <button className="ba-btn ba-btn--primary" type="button" onClick={createRematch} disabled={rematchLoading}>
                        <HiRefresh size={16} /><span>{rematchLoading ? 'Creating...' : 'Rematch'}</span>
                      </button>
                    )}
                    <button className="ba-btn ba-btn--ghost" type="button" onClick={resetBattle}>
                      <HiRefresh size={16} /><span>New Battle</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ba-question">
                  <div className="ba-question__meta">
                    <span>Q{battleState.currentIndex + 1}/{battleState.questions.length}</span>
                    <span><HiClock size={14} /> {remainingSeconds}s</span>
                    <span>5 pts at 5s</span>
                  </div>
                  <div className="ba-question__text" dangerouslySetInnerHTML={renderMath(question.questionText)} />
                  <div className="ba-options">
                    {options.map((option, index) => {
                      const isSelected = battleState.selectedAnswer === index;
                      const correctIndex = question.correctOptionIndex ?? options.findIndex((item) => item.isCorrect);
                      const isCorrect = correctIndex === index;
                      const isCorrectSelected = battleState.locked && isSelected && isCorrect;
                      const isWrongSelected = battleState.locked && isSelected && !isCorrect;
                      return (
                        <button key={`${option.text}-${index}`} type="button" className={`ba-option ${isSelected ? 'ba-option--selected' : ''} ${isCorrectSelected ? 'ba-option--correct' : ''} ${isWrongSelected ? 'ba-option--wrong' : ''}`} onClick={() => submitAnswer(index)} disabled={battleState.locked}>
                          <span className="ba-option__prefix">{String.fromCharCode(65 + index)}</span>
                          <strong dangerouslySetInnerHTML={renderMath(option.text)} />
                        </button>
                      );
                    })}
                  </div>
                  {battleState.locked && (
                    <div className="ba-question__footer">
                      <div>
                        <strong>{currentPlayer.lastDelta > 0 ? '+' : ''}{currentPlayer.lastDelta} pts</strong>
                        <span>{currentPlayer.isCorrect ? 'Correct!' : `Wrong. ${battleState.settings?.negativeMarking ? 'Neg applied.' : 'No penalty.'}`}</span>
                      </div>
                      {battleState.isRemote ? (
                        <span className="ba-question__auto">Auto-advancing...</span>
                      ) : (
                        <button type="button" className="ba-btn ba-btn--primary" onClick={nextQuestion}>
                          <span>{battleState.currentIndex + 1 === battleState.questions.length ? 'Finish' : 'Next'}</span>
                          <HiArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
            <aside className="ba-leaderboard">
              <h3>Leaderboard</h3>
              {isTeamBattle ? (
                <div className="ba-leaderboard__teams">
                  {[{ id: 'A', name: battleTeamNames.A, score: teamA, players: teamAList }, { id: 'B', name: battleTeamNames.B, score: teamB, players: teamBList }].sort((a, b) => b.score - a.score).map((team, index) => (
                    <div key={team.id} className={`ba-team-card ${team.id === currentTeam ? 'ba-team-card--you' : ''}`}>
                      <div className="ba-team-card__top">
                        <span>#{index + 1}</span><strong>{team.name}</strong><em>{team.score}</em>
                      </div>
                      <div className="ba-team-card__members">
                        {team.players.slice(0, 5).map((player) => (<span key={player.id}>{player.name} {player.score}</span>))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ba-leaderboard__list">
                  {sortedPlayers.slice(0, isRaidBattle ? battleState.players.length : 8).map((player, index) => (
                    <div key={player.id} className={`ba-rank ${player.id === 'you' || player.id === currentPlayer.id ? 'ba-rank--you' : ''}`}>
                      <span>#{index + 1}</span><strong>{player.name}</strong><em>{player.score}</em>
                    </div>
                  ))}
                </div>
              )}
              <div className="ba-log">
                {battleState.log.map((item) => <span key={item}>{item}</span>)}
              </div>
            </aside>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="battle" user={user} />
      <main className="dashboard-main ba-main">
        <div className="ba-workspace">
          <div className="ba-stepper">
            {STEPS.map((s, idx) => (
              <div key={s.num} className="ba-stepper__item">
                <button type="button" className={`ba-stepper__dot ${step >= s.num ? 'ba-stepper__dot--done' : ''} ${step === s.num ? 'ba-stepper__dot--current' : ''}`} onClick={() => { if (s.num < step) setStep(s.num); }} disabled={s.num > step}>
                  {step > s.num ? <HiCheck size={12} /> : s.num}
                </button>
                <span className={`ba-stepper__label ${step >= s.num ? 'ba-stepper__label--active' : ''}`}>{language === 'en' ? s.labelEn : s.labelBn}</span>
                {idx < STEPS.length - 1 && <div className={`ba-stepper__line ${step > s.num ? 'ba-stepper__line--done' : ''}`} />}
              </div>
            ))}
          </div>

          <div className="ba-content">
            {step === 1 && (
              <div className="ba-step ba-step--mode">
                <div className="ba-step__header">
                  <span className="ba-step__kicker">Step 1 — Choose Format</span>
                  <h3>Battle Mode</h3>
                  <p>Pick the room style that matches your practice plan.</p>
                </div>
                <div className="ba-modes">
                  {BATTLE_MODES.map((mode) => {
                    const meta = BATTLE_MODE_META[mode.id];
                    const modeCount = mode.id === 'custom-squad' ? `${customSquadSize}v${customSquadSize}` : mode.id === 'raid' ? `Up to ${raidMaxPlayers}` : `${mode.players} players`;
                    return (
                      <button key={mode.id} type="button" className={`ba-mode-card ${selectedMode === mode.id ? 'ba-mode-card--selected' : ''}`} style={{ '--accent': mode.accent }} onClick={() => { sessionStorage.setItem('battle_mode', mode.id); setSelectedMode(mode.id); setStep(2); }}>
                        <span className="ba-mode-card__glow" />
                        <span className="ba-mode-card__icon">{meta.icon}</span>
                        <span className="ba-mode-card__label">{mode.label}</span>
                        <strong className="ba-mode-card__title">{meta.title}</strong>
                        <em className="ba-mode-card__desc">{meta.desc}</em>
                        <span className="ba-mode-card__footer">
                          <span className="ba-mode-card__badge">{meta.badge}</span>
                          <span className="ba-mode-card__count">{modeCount}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="ba-join">
                  <div>
                    <span className="ba-step__kicker">Have a code?</span>
                    <h4>Join Battle Room</h4>
                  </div>
                  <div className="ba-join__controls">
                    <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !isRoomActionLoading) joinRoomByCode(); }} placeholder="Enter battle code" aria-label="Battle code" />
                    <button type="button" className="ba-btn ba-btn--ghost" onClick={joinRoomByCode} disabled={isRoomActionLoading}>Join</button>
                  </div>
                </div>
                <div className="ba-step__actions">
                  <button type="button" className="ba-btn ba-btn--primary" onClick={() => setStep(2)}>
                    <span>Continue with {activeMode.label}</span><HiArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="ba-step ba-step--subjects">
                <button type="button" className="ba-back" onClick={() => setStep(1)}><HiArrowLeft size={14} /><span>Back to modes</span></button>
                <div className="ba-step__header">
                  <h3>Select Subjects</h3>
                  <p>Choose one, multiple, or all subjects for the live room.</p>
                </div>
                <div className="ba-subjects">
                  {SUBJECTS.map((subject) => {
                    const isSelected = selectedSubjectIds.includes(subject.id);
                    return (
                      <button key={subject.id} onClick={() => toggleSubjectSelection(subject.id)} className={`ba-subject ${isSelected ? 'ba-subject--selected' : ''}`} style={{ '--clr': subject.color }}>
                        <span className="ba-subject__prefix" style={{ backgroundColor: subject.bg, color: subject.color }}>{subject.prefixType === 'letter' ? subject.letter : subject.icon}</span>
                        <span className="ba-subject__name">{language === 'en' ? subject.labelEn : subject.labelBn}</span>
                        {isSelected && <HiCheckCircle size={18} className="ba-subject__check" />}
                      </button>
                    );
                  })}
                </div>
                <div className="ba-step__actions">
                  <button type="button" className="ba-btn ba-btn--ghost" onClick={toggleAllSubjects}>
                    {selectedSubjectIds.length === SUBJECTS.length ? 'Clear All' : 'Select All'}
                  </button>
                  <button type="button" className="ba-btn ba-btn--primary" disabled={selectedSubjectIds.length === 0} onClick={() => setStep(3)}>
                    <span>Next</span><HiArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="ba-step ba-step--chapters">
                <button type="button" className="ba-back" onClick={() => setStep(2)}><HiArrowLeft size={14} /><span>Back to subjects</span></button>
                <div className="ba-step__header">
                  <h3>Configure Papers & Chapters</h3>
                  <p>Select the exact syllabus range for the battle.</p>
                </div>
                <div className="ba-chapters">
                  {selectedSubjectIds.map((subId) => {
                    const subject = SUBJECTS.find((item) => item.id === subId);
                    const all1st = CHAPTERS[subId]?.['1st'] || [];
                    const all2nd = CHAPTERS[subId]?.['2nd'] || [];
                    const selected1st = selectedChapters[subId]?.['1st'] || [];
                    const selected2nd = selectedChapters[subId]?.['2nd'] || [];
                    return (
                      <div key={subId} className="ba-chapter-group" style={{ '--clr': subject.color }}>
                        <div className="ba-chapter-group__header">
                          <span className="ba-chapter-group__prefix" style={{ backgroundColor: subject.bg, color: subject.color }}>{subject.prefixType === 'letter' ? subject.letter : subject.icon}</span>
                          <strong>{language === 'en' ? subject.labelEn : subject.labelBn}</strong>
                        </div>
                        {['1st', '2nd'].map((paper) => {
                          const allChapters = paper === '1st' ? all1st : all2nd;
                          const selectedList = paper === '1st' ? selected1st : selected2nd;
                          if (allChapters.length === 0) return null;
                          return (
                            <div key={paper} className="ba-paper">
                              <button type="button" className={`ba-paper__header ${selectedList.length === allChapters.length ? 'ba-paper__header--checked' : ''}`} onClick={() => toggleAllChaptersForPaper(subId, paper)}>
                                <div className="ba-paper__check">{selectedList.length === allChapters.length && <HiCheckCircle size={16} />}</div>
                                <span>{paper} paper</span>
                              </button>
                              <div className="ba-paper__chapters">
                                {allChapters.map((chapter) => {
                                  const isSelected = selectedList.includes(chapter);
                                  const topicKey = `${subId}__${paper}__${chapter}`;
                                  const topics = topicsMap[topicKey] || [];
                                  const selectedTopicList = selectedTopics[topicKey] || [];
                                  return (
                                    <div key={chapter} className="ba-chapter-wrapper">
                                      <button type="button" className={`ba-chapter ${isSelected ? 'ba-chapter--selected' : ''}`} onClick={() => toggleChapterSelection(subId, paper, chapter)}>
                                        <div className="ba-chapter__check">{isSelected && <HiCheckCircle size={14} />}</div>
                                        <span>{chapter}</span>
                                      </button>
                                      {isSelected && topics.length > 0 && (
                                        <div className="ba-topics">
                                          <span className="ba-topics__label">Topics:</span>
                                          <div className="ba-topics__list">
                                            {topics.map((topic) => {
                                              const isTopicSelected = selectedTopicList.includes(topic.name);
                                              return (
                                                <button key={topic.name} type="button" className={`ba-topic ${isTopicSelected ? 'ba-topic--selected' : ''}`} onClick={() => {
                                                  setSelectedTopics((prev) => {
                                                    const current = prev[topicKey] || [];
                                                    const updated = current.includes(topic.name) ? current.filter((t) => t !== topic.name) : [...current, topic.name];
                                                    return { ...prev, [topicKey]: updated };
                                                  });
                                                }}>
                                                  {isTopicSelected && <HiCheck size={10} />}
                                                  <span>{topic.name}</span>
                                                  <em>{topic.count}</em>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div className="ba-step__actions">
                  <button type="button" className="ba-btn ba-btn--primary" disabled={summary.chapterCount === 0} onClick={() => setStep(4)}>
                    <span>Next</span><HiArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="ba-step ba-step--settings">
                <button type="button" className="ba-back" onClick={() => setStep(3)}><HiArrowLeft size={14} /><span>Back to chapters</span></button>
                <div className="ba-step__header">
                  <h3>Battle Settings</h3>
                  <p>Configure standard, question type, timing, and scoring.</p>
                </div>
                <button type="button" className="ba-summary-toggle" onClick={() => setShowSelectedTopics(!showSelectedTopics)}>
                  <span>Tap to see selected battle syllabus</span>
                  {showSelectedTopics ? <HiChevronUp size={16} /> : <HiChevronDown size={16} />}
                </button>
                {showSelectedTopics && (
                  <div className="ba-summary">
                    <span>{activeMode.id === 'custom-squad' ? `${customSquadSize}v${customSquadSize} Custom Squad` : activeMode.label}</span>
                    <span>{summary.subjectCount} subjects</span>
                    <span>{summary.chapterCount} chapters</span>
                    <span>{summary.topicCount} topics</span>
                    <span>{questionTimeSeconds}s per question</span>
                  </div>
                )}
                <div className="ba-settings-section">
                  <div className="ba-settings-section__header">
                    <HiAcademicCap size={18} />
                    <h4>Question Standard</h4>
                  </div>
                  <p className="ba-settings-section__desc">Choose multiple standards if the battle should mix exam sources.</p>
                  <div className="ba-standards">
                    {QUESTION_STANDARDS.map((std) => {
                      const isActive = selectedStandards.includes(std.id);
                      return (
                        <button key={std.id} type="button" className={`ba-standard ${isActive ? 'ba-standard--selected' : ''}`} style={{ '--clr': std.color, '--clr-bg': std.bg }} onClick={() => {
                          setSelectedStandards((prev) => {
                            const isSelecting = !prev.includes(std.id);
                            const next = isSelecting ? [...prev, std.id] : prev.filter((id) => id !== std.id);
                            if (std.id === 'engineering') setSelectedEngineeringUnis(isSelecting ? ENGINEERING_UNIVERSITIES : []);
                            if (std.id === 'university') setSelectedGeneralUnis(isSelecting ? GENERAL_UNIVERSITIES : []);
                            if (std.id === 'academic') { setSelectedAcademicTypes(isSelecting ? ['board', 'college'] : []); setSelectedBoards(isSelecting ? BOARDS : []); }
                            return next;
                          });
                        }}>
                          <span className="ba-standard__icon" style={{ color: std.color, background: std.bg }}>{std.icon}</span>
                          <span className="ba-standard__label">{language === 'en' ? std.labelEn : std.labelBn}</span>
                          <span className="ba-standard__desc">{std.desc}</span>
                          {isActive && <HiCheckCircle size={16} className="ba-standard__check" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="ba-settings-section">
                  <div className="ba-settings-section__header">
                    <HiCollection size={18} />
                    <h4>Question Type</h4>
                  </div>
                  <div className="ba-type-pills">
                    {QUESTION_TYPES.map((type) => (
                      <button key={type.id} type="button" className={`ba-type-pill ${questionType === type.id ? 'ba-type-pill--selected' : ''}`} onClick={() => setQuestionType(type.id)}>
                        {type.icon}<span>{language === 'en' ? type.labelEn : type.labelBn}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {activeMode.id === 'custom-squad' && (
                  <div className="ba-settings-section">
                    <div className="ba-settings-section__header"><HiCollection size={18} /><h4>Squad Size</h4></div>
                    <p className="ba-settings-section__desc">Choose how many players each team should have.</p>
                    <div className="ba-number-input">
                      <button type="button" onClick={() => setCustomSquadSize(Math.max(2, (Number(customSquadSize) || 2) - 1))}>-</button>
                      <input type="number" min="2" max="50" value={customSquadSize} onChange={(e) => setCustomSquadSize(e.target.value === '' ? '' : Math.min(50, Math.max(2, parseInt(e.target.value) || 2)))} onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 2) setCustomSquadSize(2); }} />
                      <button type="button" onClick={() => setCustomSquadSize(Math.min(50, (Number(customSquadSize) || 2) + 1))}>+</button>
                    </div>
                  </div>
                )}
                {activeMode.id === 'raid' && (
                  <div className="ba-settings-section">
                    <div className="ba-settings-section__header"><HiCollection size={18} /><h4>Raid Room Limit</h4></div>
                    <p className="ba-settings-section__desc">Choose how many students can join this solo leaderboard room.</p>
                    <div className="ba-number-input">
                      <button type="button" onClick={() => setRaidMaxPlayers(Math.max(3, (Number(raidMaxPlayers) || 3) - 1))}>-</button>
                      <input type="number" min="3" max="200" value={raidMaxPlayers} onChange={(e) => setRaidMaxPlayers(e.target.value === '' ? '' : Math.min(200, Math.max(3, parseInt(e.target.value) || 3)))} onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 3) setRaidMaxPlayers(3); }} />
                      <button type="button" onClick={() => setRaidMaxPlayers(Math.min(200, (Number(raidMaxPlayers) || 3) + 1))}>+</button>
                    </div>
                  </div>
                )}
                <div className="ba-settings-row">
                  <div className="ba-settings-section">
                    <div className="ba-settings-section__header"><HiDocumentText size={18} /><h4>Total Questions</h4></div>
                    <div className="ba-preset-row">
                      {[4, 5, 10, 20, 30, 50].map((count) => (
                        <button key={count} type="button" className={`ba-preset ${totalQuestions === count ? 'ba-preset--selected' : ''}`} onClick={() => setTotalQuestions(count)}>{count}</button>
                      ))}
                    </div>
                  </div>
                  <div className="ba-settings-section">
                    <div className="ba-settings-section__header"><HiClock size={18} /><h4>Time Per Question</h4></div>
                    <div className="ba-preset-row">
                      {[5, 10, 15, 30, 60, 120].map((seconds) => (
                        <button key={seconds} type="button" className={`ba-preset ${questionTimeSeconds === seconds ? 'ba-preset--selected' : ''}`} onClick={() => setQuestionTimeSeconds(seconds)}>{seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="ba-settings-section">
                  <div className="ba-settings-section__header"><HiMinusCircle size={18} /><h4>Negative Marking</h4></div>
                  <div className="ba-toggle-row">
                    <div>
                      <strong>{negativeMarking ? 'Enabled' : 'Disabled'}</strong>
                      <p>{negativeMarking ? 'Wrong answers subtract 1 point.' : 'Wrong answers do not affect score.'}</p>
                    </div>
                    <button type="button" className={`ba-toggle ${negativeMarking ? 'ba-toggle--on' : ''}`} onClick={() => setNegativeMarking((prev) => !prev)} aria-label="Toggle negative marking" aria-pressed={negativeMarking}>
                      <span className="ba-toggle__knob" />
                    </button>
                  </div>
                </div>
                <div className="ba-rule">
                  <strong>Initial live scoring</strong>
                  <span>Correct MCQ answers inside 5 seconds get 5 points. After 5 seconds the delta rule starts, so a 7 second answer gets 2 points. Wrong answers get {negativeMarking ? '-1' : '0'}.</span>
                </div>
                <div className="ba-step__actions">
                  <button type="button" className="ba-btn ba-btn--primary ba-btn--lg" disabled={isStarting} onClick={startBattle}>
                    <span>{isStarting ? 'Creating Room...' : 'Start Live Battle'}</span>
                    <HiArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
