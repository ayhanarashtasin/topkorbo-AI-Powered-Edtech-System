import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiFire, HiCheckCircle, HiArrowRight, HiArrowLeft, HiCheck, HiClock, HiMinusCircle, HiAcademicCap, HiBeaker, HiBookOpen, HiCollection, HiPencil, HiDocumentText, HiPhotograph, HiLightningBolt, HiChevronDown, HiChevronUp, HiX } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './MockTest.css';

// ─── Thematic Mock Test Subjects Data ──────────────────────────────────────
const MOCK_SUBJECTS = [
  { id: 'bangla', labelEn: 'Bangla', labelBn: 'বাংলা', letter: 'অ', color: '#C08552', bg: 'rgba(192, 133, 82, 0.08)', prefixType: 'letter' },
  { id: 'english', labelEn: 'English', labelBn: 'English', letter: 'Aa', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)', prefixType: 'letter' },
  { id: 'gk', labelEn: 'GK', labelBn: 'GK', icon: '🧠', color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)', prefixType: 'icon' },
  { id: 'ict', labelEn: 'ICT', labelBn: 'ICT', icon: '💻', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.08)', prefixType: 'icon' },
  { id: 'physics', labelEn: 'Physics', labelBn: 'Physics', icon: '🧲', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)', prefixType: 'icon' },
  { id: 'chemistry', labelEn: 'Chemistry', labelBn: 'Chemistry', icon: '🧪', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.08)', prefixType: 'icon' },
  { id: 'highermath', labelEn: 'Higher Math', labelBn: 'Higher Math', letter: 'π', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.08)', prefixType: 'letter' },
  { id: 'biology', labelEn: 'Biology', labelBn: 'Biology', icon: '🧬', color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.08)', prefixType: 'icon' },
  { id: 'iba', labelEn: 'IBA', labelBn: 'IBA', icon: '🏢', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.08)', prefixType: 'icon' },
];

// ─── University Tag Constants ──────────────────────────────────────────────
const ENGINEERING_UNIVERSITIES = [
  'BUET', 'CUET', 'KUET', 'RUET', 'MIST', 'IUT', 'BUTEX'
];
const GENERAL_UNIVERSITIES = [
  'DU', 'CU', 'RU', 'JU', 'GST', 'BUP', 'IBA'
];
const BOARDS = [
  'Dhaka', 'Comilla', 'Rajshahi', 'Jessore', 'Chittagong',
  'Sylhet', 'Barishal', 'Dinajpur', 'Mymensingh', 'Madrasa', 'Technical'
];
const COLLEGES = [
  'Notre Dame College', 'Dhaka College', 'Rajuk Uttara Model College',
  'Viqarunnisa Noon College', 'Holy Cross College', 'Adamjee Cantonment College',
  'Ideal College', 'Dhaka City College', 'Government Science College',
  'Shaheed Bir Uttam Lt. Anwar Girls College', 'Milestone College',
  'BIRDEM Nursing College', 'Begum Rokeya University, Rangpur',
  'Chittagong College', 'Rajshahi College', 'Jahangirnagar University School & College',
  'Comilla Victoria College', 'Barishal Cadet College', 'Mymensingh Girls Cadet College',
  'Sylhet Cadet College', 'Faujdarhat Cadet College'
];

// ─── HSC & Admission Standard Chapters Database ─────────────────────────────
const MOCK_CHAPTERS = {
  bangla: {
    '1st': [
      'গদ্য', 'পদ্য', 'নাটক', 'উপন্যাস',
      'ছোটগল্প', 'প্রবন্ধ', 'ভাষা ও ব্যাকরণ'
    ],
    '2nd': [
      'বাংলা ব্যাকরণ', 'ভাব-সম্প্রসারণ', 'পত্র লিখন',
      'প্রবন্ধ রচনা', 'সারমর্ম/সারাংশ', 'অনুবাদ',
      'বাংলা বানানের নিয়ম'
    ]
  },
  english: {
    '1st': [
      'Comprehension', 'Vocabulary', 'Grammar',
      'Reading Skills', 'Prose', 'Poetry',
      'Short Stories', 'Composition'
    ],
    '2nd': [
      'Grammar — Tenses', 'Grammar — Modifiers', 'Grammar — Connectors',
      'Grammar — Sentence Patterns', 'Formal Letter/Application',
      'Paragraph Writing', 'Essay Writing', 'Report Writing',
      'Completing Story', 'Email Writing'
    ]
  },
  gk: {
    '1st': [
      'Chapter 1: বাংলাদেশ বিষয়াবলি', 'Chapter 2: মুক্তিযুদ্ধ ও স্বাধীনতা',
      'Chapter 3: ভৌগোলিক অবস্থান ও সীমানা', 'Chapter 4: জাতীয় অর্জন ও অর্থনীতি'
    ],
    '2nd': [
      'Chapter 1: আন্তর্জাতিক বিষয়াবলি', 'Chapter 2: জাতিসংঘ ও বিশ্ব সংস্থা',
      'Chapter 3: বিশ্ব রাজনীতি ও যুদ্ধবিগ্রহ', 'Chapter 4: সাম্প্রতিক সাধারণ জ্ঞান'
    ]
  },
  ict: {
    '1st': [
      'World and ICT', 'Communication System', 'Number System & Digital Devices',
      'Web Design — HTML', 'Programming Basics', 'Database Management'
    ],
    '2nd': []
  },
  physics: {
    '1st': [
      'Physical World and Measurement', 'Vector', 'Dynamics', 'Newtonian Mechanics',
      'Work, Energy & Power', 'Gravitation & Gravity', 'Stress & Strain',
      'Periodic Motion', 'Waves', 'Ideal Gas & Kinetic Theory'
    ],
    '2nd': [
      'Heat & Thermodynamics', 'Electrostatics', 'Current Electricity', 'Magnetic Effect of Current',
      'Electromagnetic Induction', 'Alternating Current', 'Geometric Optics',
      'Physical Optics', 'Modern Physics & Atom Model', 'Nuclear Physics & Radioactivity',
      'Semiconductor & Electronics'
    ]
  },
  chemistry: {
    '1st': [
      'Environmental Chemistry',
      'Qualitative Chemistry',
      'Mole',
      'Atomic Structure',
      'Chemical Bond'
    ],
    '2nd': [
      'Chemical Changes',
      'Industrial Chemistry',
      'Electrochemistry',
      'Organic Chemistry',
      'Biochemistry'
    ]
  },
  highermath: {
    '1st': [
      'Matrix and Determinant',
      'Vector',
      'Straight Line',
      'Circle',
      'Permutation and Combination',
      'Trigonometric Ratios',
      'Trigonometric Ratios of Associated Angles',
      'Functions and Graphs',
      'Differentiation',
      'Integration'
    ],
    '2nd': [
      'Real Numbers and Inequalities',
      'Linear Programming',
      'Complex Numbers',
      'Polynomial and Polynomial Equations',
      'Binomial Expansion',
      'Conic Sections',
      'Inverse Trigonometric Functions and Trigonometric Equations',
      'Statics',
      'Motion in a Plane',
      'Probability'
    ]
  },
  biology: {
    '1st': [
      'Cell and Its Structure',
      'Cell Division',
      'Cell Chemistry',
      'Microorganism',
      'Algae and Fungi',
      'Bryophyta and Pteridophyta',
      'Gymsomperm and Angiosperm',
      'Tissue and Tissue System',
      'Plant Physiology',
      'Plant Reproduction',
      'Biotechnology',
      'Environment, Distribution and Conservation of Organisms'
    ],
    '2nd': [
      'Animal Diversity and Classification',
      'Introduction to Animals',
      'Human Physiology: Digestion and Absorption',
      'Human Physiology: Blood and Circulation',
      'Human Physiology: Breathing and Respiration',
      'Human Physiology: Waste and Excretion',
      'Human Physiology: Locomotion and Movement',
      'Human Physiology: Coordination and Control',
      'Continuation of Human Life',
      'Defense of Human Body',
      'Genetics and Evolution',
      'Animal Behavior'
    ]
  },
  iba: {
    '1st': ["Section 1: Analytical Ability", "Section 2: Sentence Correction", "Section 3: Reading Comprehension"],
    '2nd': ["Section 1: Mathematics & Quantitative Aptitude", "Section 2: Critical Reasoning", "Section 3: Business GK & General Awareness"]
  }
};

export default function MockTest() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student Topper',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
    streak: parseInt(localStorage.getItem('topkorbo_streak')) || 5 // Premium default streak
  });

  // Step state: 1 = Subject Selection, 2 = Paper & Chapter Config, 3 = Exam Settings
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = searchParams.get('step');
  const step = stepParam ? parseInt(stepParam) : 1;

  const setStep = (nextStep) => {
    setSearchParams({ step: String(nextStep) });
  };

  // Restore step from sessionStorage on load if searchParam is not present
  useEffect(() => {
    const savedStep = sessionStorage.getItem('mock_test_step');
    if (!stepParam && savedStep && savedStep !== '1') {
      setSearchParams({ step: savedStep }, { replace: true });
    }
  }, [stepParam, setSearchParams]);

  // Step 3: Exam configuration states
  const [selectedStandards, setSelectedStandards] = useState(() => {
    const saved = sessionStorage.getItem('mock_selected_standards');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedEngineeringUnis, setSelectedEngineeringUnis] = useState(() => {
    const saved = sessionStorage.getItem('mock_selected_engineering_unis');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedGeneralUnis, setSelectedGeneralUnis] = useState(() => {
    const saved = sessionStorage.getItem('mock_selected_general_unis');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedAcademicTypes, setSelectedAcademicTypes] = useState(() => {
    const saved = sessionStorage.getItem('mock_selected_academic_types');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedBoards, setSelectedBoards] = useState(() => {
    const saved = sessionStorage.getItem('mock_selected_boards');
    return saved ? JSON.parse(saved) : [];
  });

  const [examStandard, setExamStandard] = useState(() => sessionStorage.getItem('mock_exam_standard') || '');
  const [questionType, setQuestionType] = useState(() => sessionStorage.getItem('mock_question_type') || '');
  const [totalQuestions, setTotalQuestions] = useState(() => parseInt(sessionStorage.getItem('mock_total_questions')) || 0);
  const [examDuration, setExamDuration] = useState(() => parseInt(sessionStorage.getItem('mock_exam_duration')) || 0);
  const [negativeMarking, setNegativeMarking] = useState(() => sessionStorage.getItem('mock_negative_marking') === 'true');
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [isStartingExam, setIsStartingExam] = useState(false);
  const [showSelectedTopics, setShowSelectedTopics] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });

  // Selections
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(() => {
    const saved = sessionStorage.getItem('mock_test_subject_ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedChapters, setSelectedChapters] = useState(() => {
    const saved = sessionStorage.getItem('mock_test_chapters');
    return saved ? JSON.parse(saved) : {};
  });

  // Topic-level state
  const [topicsMap, setTopicsMap] = useState({});
  const [selectedTopics, setSelectedTopics] = useState(() => {
    const saved = sessionStorage.getItem('mock_test_selected_topics');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist states to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('mock_test_step', String(step));
  }, [step]);

  useEffect(() => {
    sessionStorage.setItem('mock_test_subject_ids', JSON.stringify(selectedSubjectIds));
  }, [selectedSubjectIds]);

  useEffect(() => {
    sessionStorage.setItem('mock_test_chapters', JSON.stringify(selectedChapters));
  }, [selectedChapters]);

  useEffect(() => {
    sessionStorage.setItem('mock_test_selected_topics', JSON.stringify(selectedTopics));
  }, [selectedTopics]);

  // Persist Step 3 states
  useEffect(() => {
    sessionStorage.setItem('mock_selected_standards', JSON.stringify(selectedStandards));
    // Synchronize legacy examStandard with the first selection to preserve validation & backwards-compatibility logic
    const primaryStd = selectedStandards[0] || '';
    sessionStorage.setItem('mock_exam_standard', primaryStd);
    setExamStandard(primaryStd);
  }, [selectedStandards]);

  useEffect(() => {
    sessionStorage.setItem('mock_selected_engineering_unis', JSON.stringify(selectedEngineeringUnis));
  }, [selectedEngineeringUnis]);

  useEffect(() => {
    sessionStorage.setItem('mock_selected_general_unis', JSON.stringify(selectedGeneralUnis));
  }, [selectedGeneralUnis]);

  useEffect(() => {
    sessionStorage.setItem('mock_selected_academic_types', JSON.stringify(selectedAcademicTypes));
  }, [selectedAcademicTypes]);

  useEffect(() => {
    sessionStorage.setItem('mock_selected_boards', JSON.stringify(selectedBoards));
  }, [selectedBoards]);

  useEffect(() => { sessionStorage.setItem('mock_question_type', questionType); }, [questionType]);
  useEffect(() => { sessionStorage.setItem('mock_total_questions', String(totalQuestions)); }, [totalQuestions]);
  useEffect(() => { sessionStorage.setItem('mock_exam_duration', String(examDuration)); }, [examDuration]);
  useEffect(() => { sessionStorage.setItem('mock_negative_marking', String(negativeMarking)); }, [negativeMarking]);

  // Handle browser back button from active exam
  useEffect(() => {
    if (sessionStorage.getItem('mock_exam_questions')) {
      [
        'mock_test_step',
        'mock_test_subject_ids',
        'mock_test_chapters',
        'mock_test_selected_topics',
        'mock_exam_standard',
        'mock_selected_standards',
        'mock_selected_engineering_unis',
        'mock_selected_general_unis',
        'mock_selected_academic_types',
        'mock_selected_boards',
        'mock_question_type',
        'mock_total_questions',
        'mock_exam_duration',
        'mock_negative_marking',
        'mock_exam_questions',
        'mock_exam_config',
        'mock_exam_from_qbank'
      ].forEach((key) => sessionStorage.removeItem(key));

      setStep(1);
      setSelectedSubjectIds([]);
      setSelectedChapters({});
      setSelectedTopics({});
      setSelectedStandards([]);
      setSelectedEngineeringUnis([]);
      setSelectedGeneralUnis([]);
      setSelectedAcademicTypes([]);
      setSelectedBoards([]);
      setExamStandard('');
      setQuestionType('');
      setTotalQuestions(0);
      setExamDuration(0);
      setNegativeMarking(false);
    }
  }, []);

  const activeTab = 'mock-test';

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

  // Fetch topics from database for a selected chapter
  const fetchTopicsForChapter = async (subId, paper, chapter) => {
    const key = `${subId}__${paper}__${chapter}`;
    if (topicsMap[key]) return; // already fetched

    try {
      const token = localStorage.getItem('topkorbo_token');
      const dbSubject = SUBJECT_DB_MAP[subId] || subId;
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      const res = await fetch(`${base}/questions/topics?subject=${encodeURIComponent(dbSubject)}&paper=${paper}&chapter=${encodeURIComponent(chapter)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTopicsMap(prev => ({
          ...prev,
          [key]: data.data
        }));
        // Select all fetched topics by default if not already initialized
        setSelectedTopics(prev => {
          if (key in prev) return prev;
          return {
            ...prev,
            [key]: data.data.map(t => t.name)
          };
        });
      }
    } catch (err) {
      console.error('Error fetching topics:', err);
    }
  };

  // Toggle selection handler for multiple subject selection
  const toggleSubjectSelection = (id) => {
    setSelectedSubjectIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Toggle chapter configuration selection
  const toggleChapterSelection = (subId, paper, chapter) => {
    setSelectedChapters(prev => {
      const subMap = prev[subId] || { '1st': [], '2nd': [] };
      const list = subMap[paper] || [];
      const isSelecting = !list.includes(chapter);

      const newList = isSelecting
        ? [...list, chapter]
        : list.filter(c => c !== chapter);

      if (isSelecting) {
        fetchTopicsForChapter(subId, paper, chapter);
      } else {
        const key = `${subId}__${paper}__${chapter}`;
        setSelectedTopics(prevT => {
          const copy = { ...prevT };
          delete copy[key];
          return copy;
        });
      }

      return {
        ...prev,
        [subId]: {
          ...subMap,
          [paper]: newList
        }
      };
    });
  };

  // Toggle "Select All / Deselect All" chapters for a subject's active paper
  const toggleAllChaptersForPaper = (subId, paper) => {
    const allChapters = MOCK_CHAPTERS[subId]?.[paper] || [];
    setSelectedChapters(prev => {
      const subMap = prev[subId] || { '1st': [], '2nd': [] };
      const list = subMap[paper] || [];
      const isAllChecked = list.length === allChapters.length;

      const nextList = isAllChecked ? [] : allChapters;

      if (!isAllChecked) {
        allChapters.forEach(chapter => {
          fetchTopicsForChapter(subId, paper, chapter);
        });
      } else {
        setSelectedTopics(prevT => {
          const copy = { ...prevT };
          allChapters.forEach(chapter => {
            delete copy[`${subId}__${paper}__${chapter}`];
          });
          return copy;
        });
      }

      return {
        ...prev,
        [subId]: {
          ...subMap,
          [paper]: nextList
        }
      };
    });
  };

  // Pre-fetch topics for all selected chapters when entering Step 2
  useEffect(() => {
    if (step === 2) {
      selectedSubjectIds.forEach(subId => {
        const subMap = selectedChapters[subId] || { '1st': [], '2nd': [] };
        ['1st', '2nd'].forEach(paper => {
          (subMap[paper] || []).forEach(chapter => {
            fetchTopicsForChapter(subId, paper, chapter);
          });
        });
      });
    }
  }, [step]);

  // Sync selected subjects with empty initial paper/chapter selections
  useEffect(() => {
    const updatedChapters = { ...selectedChapters };
    let changed = false;

    selectedSubjectIds.forEach(subId => {
      if (!updatedChapters[subId]) {
        updatedChapters[subId] = {
          '1st': [],
          '2nd': []
        };
        changed = true;
      }
    });

    // Cleanup unselected subjects
    Object.keys(updatedChapters).forEach(subId => {
      if (!selectedSubjectIds.includes(subId)) {
        delete updatedChapters[subId];
        changed = true;
      }
    });

    if (changed) {
      setSelectedChapters(updatedChapters);
    }
  }, [selectedSubjectIds]);

  // Session guard and fetch latest user info
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    const fetchUser = async () => {
      try {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          localStorage.removeItem('topkorbo_token');
          window.location.href = '/';
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setUser({
            name: data.data.name,
            avatar: data.data.avatar || '',
            email: data.data.email,
            role: data.data.role,
            streak: data.data.streak || 5
          });
          localStorage.setItem('topkorbo_name', data.data.name);
          localStorage.setItem('topkorbo_avatar', data.data.avatar || '');
          localStorage.setItem('topkorbo_email', data.data.email);
          localStorage.setItem('topkorbo_role', data.data.role);
          if (data.data.streak !== undefined) {
            localStorage.setItem('topkorbo_streak', String(data.data.streak));
          }
        }
      } catch (err) {
        console.error('Error fetching profile in MockTest:', err);
      }
    };
    fetchUser();
  }, []);

  // Build selections payload for the API
  const buildSelections = () => {
    const selections = [];
    selectedSubjectIds.forEach(subId => {
      const dbSubject = SUBJECT_DB_MAP[subId] || subId;
      const subMap = selectedChapters[subId] || { '1st': [], '2nd': [] };
      ['1st', '2nd'].forEach(paper => {
        const chapters = subMap[paper] || [];
        if (chapters.length === 0) return;
        const chapterData = chapters.map(ch => {
          const key = `${subId}__${paper}__${ch}`;
          return { name: ch, topics: selectedTopics[key] || [] };
        });
        selections.push({ subject: dbSubject, paper, chapters: chapterData });
      });
    });
    return selections;
  };

  // Get total selection summary counts
  const getSelectionSummary = () => {
    let subjectCount = selectedSubjectIds.length;
    let chapterCount = 0;
    let topicCount = 0;
    Object.values(selectedChapters).forEach(subMap => {
      Object.values(subMap).forEach(arr => { chapterCount += arr.length; });
    });
    Object.values(selectedTopics).forEach(arr => { topicCount += arr.length; });
    return { subjectCount, chapterCount, topicCount };
  };

  // Handle Start Exam
  const handleStartExam = async () => {
    if (isStartingExam) return;

    if (selectedStandards.length === 0) {
      toast.error(language === 'en' ? 'Please select at least one Question Standard.' : 'দয়া করে অন্তত একটি প্রশ্ন স্ট্যান্ডার্ড নির্বাচন করুন।');
      return;
    }
    if (selectedStandards.includes('engineering') && selectedEngineeringUnis.length === 0) {
      toast.error(language === 'en' ? 'Please select at least one Engineering university.' : 'দয়া করে অন্তত একটি ইঞ্জিনিয়ারিং বিশ্ববিদ্যালয় নির্বাচন করুন।');
      return;
    }
    if (selectedStandards.includes('university') && selectedGeneralUnis.length === 0) {
      toast.error(language === 'en' ? 'Please select at least one Varsity university.' : 'দয়া করে অন্তত একটি সাধারণ বিশ্ববিদ্যালয় নির্বাচন করুন।');
      return;
    }
    if (selectedStandards.includes('academic')) {
      if (selectedAcademicTypes.length === 0) {
        toast.error(language === 'en' ? 'Please select at least one Academic question type.' : 'দয়া করে অন্তত একটি একাডেমিক প্রশ্ন টাইপ নির্বাচন করুন।');
        return;
      }
      if (selectedAcademicTypes.includes('board') && selectedBoards.length === 0) {
        toast.error(language === 'en' ? 'Please select at least one Board.' : 'দয়া করে অন্তত একটি বোর্ড নির্বাচন করুন।');
        return;
      }
    }
    if (!questionType) {
      toast.error(language === 'en' ? 'Please select a Question Type.' : 'দয়া করে একটি প্রশ্নের ধরন নির্বাচন করুন।');
      return;
    }
    if (!totalQuestions || totalQuestions <= 0) {
      toast.error(language === 'en' ? 'Please select Total Questions.' : 'দয়া করে মোট প্রশ্ন সংখ্যা নির্বাচন করুন।');
      return;
    }
    if (!examDuration || examDuration <= 0) {
      toast.error(language === 'en' ? 'Please select Time Duration.' : 'দয়া করে সময়কাল নির্বাচন করুন।');
      return;
    }

    setIsStartingExam(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const body = {
        selections: buildSelections(),
        standard: selectedStandards[0] || '', // keep first standard for legacy/logging
        standards: selectedStandards,
        selectedEngineeringUnis,
        selectedGeneralUnis,
        selectedAcademicTypes,
        selectedBoards,
        questionType,
        totalQuestions
      };
      const res = await fetch(`${base}/questions/mock-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success && data.data) {
        const requestedCount = Number(totalQuestions);
        const returnedCount = data.data.total;
        const availableCount = data.data.available !== undefined ? data.data.available : returnedCount;

        if (availableCount === 0) {
          setErrorModal({
            show: true,
            message: language === 'en'
              ? 'No questions found matching your exact criteria. Please adjust your selected chapters, standards, or question type.'
              : 'আপনার নির্বাচিত মানদণ্ডের সাথে মিলে যাওয়া কোনো প্রশ্ন পাওয়া যায়নি। দয়া করে আপনার অধ্যায়, স্ট্যান্ডার্ড, বা প্রশ্নের ধরন পরিবর্তন করুন।'
          });
          setIsStartingExam(false);
          return;
        }

        if (returnedCount < requestedCount) {
          setErrorModal({
            show: true,
            message: language === 'en'
              ? `We don't have enough questions matching your criteria. You requested ${requestedCount} but we only found ${availableCount} questions. Please reduce the Total Questions or adjust your filters.`
              : `আপনার মানদণ্ডের সাথে মিলে যাওয়া পর্যাপ্ত প্রশ্ন আমাদের কাছে নেই। আপনি ${requestedCount}টি প্রশ্ন চেয়েছেন কিন্তু আমরা মাত্র ${availableCount}টি প্রশ্ন পেয়েছি। দয়া করে মোট প্রশ্ন সংখ্যা কমান অথবা আপনার ফিল্টার পরিবর্তন করুন।`
          });
          setIsStartingExam(false);
          return;
        }

        console.log('Mock test questions:', data.data);

        // Derive standard string for config display
        const displayStds = selectedStandards.map(id => {
          const matched = QUESTION_STANDARDS.find(s => s.id === id);
          return matched ? (language === 'en' ? matched.labelEn : matched.labelBn) : id;
        }).join(', ');

        // Store exam config for future exam page
        sessionStorage.setItem('mock_exam_questions', JSON.stringify(data.data.questions));
        sessionStorage.setItem('mock_exam_config', JSON.stringify({
          duration: examDuration,
          negativeMarking,
          questionType,
          standard: displayStds,
          totalQuestions: data.data.total
        }));
        sessionStorage.removeItem('mock_exam_from_qbank');

        navigate('/mock-test/exam');
      } else {
        toast.error(data.message || 'Failed to fetch questions');
      }
    } catch (err) {
      console.error('Error starting exam:', err);
      toast.error(language === 'en' ? 'Network error. Please try again.' : 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।');
    } finally {
      setIsStartingExam(false);
    }
  };

  // Step 3 data
  const QUESTION_STANDARDS = [
    { id: 'engineering', labelEn: 'Engineering', labelBn: 'ইঞ্জিনিয়ারিং', icon: <HiLightningBolt size={28} />, desc: language === 'en' ? 'BUET, CUET, KUET, RUET...' : 'বুয়েট, চুয়েট, কুয়েট...', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)' },
    { id: 'university', labelEn: 'University', labelBn: 'বিশ্ববিদ্যালয়', icon: <HiAcademicCap size={28} />, desc: language === 'en' ? 'DU, CU, RU, JU, GST...' : 'ঢাবি, চবি, রাবি, জাবি...', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)' },
    { id: 'academic', labelEn: 'Academic', labelBn: 'একাডেমিক (HSC)', icon: <HiBookOpen size={28} />, desc: language === 'en' ? 'HSC Board Questions' : 'এইচএসসি বোর্ড প্রশ্ন', color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)' },
    { id: 'medical', labelEn: 'Medical', labelBn: 'মেডিকেল', icon: <HiBeaker size={28} />, desc: language === 'en' ? 'Medical & Dental' : 'মেডিকেল ও ডেন্টাল', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.08)' },
  ];

  const QUESTION_TYPES = [
    { id: 'mcq', labelEn: 'MCQ', labelBn: 'MCQ', icon: <HiCollection size={18} /> },
    { id: 'cq', labelEn: 'CQ', labelBn: 'CQ', icon: <HiPencil size={18} /> },
    { id: 'written', labelEn: 'Written', labelBn: 'লিখিত', icon: <HiDocumentText size={18} /> },
  ];

  const QUESTION_PRESETS = [10, 20, 30, 50, 100];
  const TIME_PRESETS = [15, 30, 45, 60, 90, 120];

  const summary = getSelectionSummary();

  // Step labels for progress indicator
  const STEP_LABELS = [
    { num: 1, labelEn: 'Subjects', labelBn: 'বিষয়' },
    { num: 2, labelEn: 'Chapters', labelBn: 'অধ্যায়' },
    { num: 3, labelEn: 'Settings', labelBn: 'সেটিংস' },
  ];

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />

      <main className="dashboard-main">
        {/* Header Section */}
        <header className="dashboard-header">
          <div className="dashboard-header__welcome">
            <h2>{t('mock.title')}</h2>
            <p>{t('mock.subtitle')}</p>
          </div>
          <div className="mock-header__actions">
            <div className="mock-streak-widget animate-pulse-slow">
              <HiFire size={20} className="mock-streak-icon" />
              <span className="mock-streak-count">{user.streak}</span>
            </div>
            <span className="dashboard-header__badge">
              {user.role === 'teacher' ? t('db.workspace.teacher') : t('db.workspace')}
            </span>
          </div>
        </header>

        <div className="mock-workspace animate-fade-in">
          {/* ──── Step Progress Indicator ──── */}
          <div className="mock-step-indicator">
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
                <span className={`mock-step-label ${step >= s.num ? 'mock-step-label--active' : ''}`}>
                  {language === 'en' ? s.labelEn : s.labelBn}
                </span>
                {idx < STEP_LABELS.length - 1 && (
                  <div className={`mock-step-connector ${step > s.num ? 'mock-step-connector--done' : ''}`} />
                )}
              </div>
            ))}
          </div>
          {step === 1 ? (
            /* ──────────────── STEP 1: SUBJECT LIST SELECTION VIEW ──────────────── */
            <div className="mock-subject-selection">
              <div className="mock-selection-info">
                <h3>{t('mock.select_subject')}</h3>
              </div>

              <div className="mock-subjects-grid">
                {MOCK_SUBJECTS.map((subject) => {
                  const isSelected = selectedSubjectIds.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      onClick={() => toggleSubjectSelection(subject.id)}
                      className={`mock-subject-card ${isSelected ? 'mock-subject-card--selected' : ''}`}
                      style={{ '--hover-color': subject.color }}
                    >
                      <div className="mock-card-glow"></div>
                      {/* Selected Check Badge */}
                      <div className="mock-card-select-badge">
                        <HiCheckCircle size={22} />
                      </div>
                      <div className="mock-card-content">
                        <div
                          className="mock-card-prefix"
                          style={{ backgroundColor: subject.bg, color: subject.color }}
                        >
                          {subject.prefixType === 'letter' ? (
                            <span className="mock-prefix-letter">{subject.letter}</span>
                          ) : (
                            <span className="mock-prefix-icon">{subject.icon}</span>
                          )}
                        </div>
                        <span className="mock-card-label">
                          {language === 'en' ? subject.labelEn : subject.labelBn}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selection actions footer with Next Step button */}
              <div className="mock-selection-actions">
                <button
                  type="button"
                  className="btn btn-primary mock-next-btn animate-fade-in"
                  disabled={selectedSubjectIds.length === 0}
                  onClick={() => setStep(2)}
                >
                  <span>{language === 'en' ? 'Next Step' : 'পরবর্তী ধাপ'}</span>
                  <HiArrowRight size={18} />
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            /* ──────────────── STEP 2: PAPER & CHAPTER SELECTION VIEW ──────────────── */
            <div className="mock-config-selection animate-fade-in">
              {/* Back Button */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mock-back-btn"
              >
                <HiArrowLeft size={16} />
                <span>{language === 'en' ? 'Back to subjects' : 'পেছনে ফিরে যাও'}</span>
              </button>

              <div className="mock-selection-info">
                <h3>{language === 'en' ? 'Configure Exam Papers & Chapters' : 'পত্র ও অধ্যায় নির্বাচন করুন'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                  {language === 'en' ? 'Customize your practice target for each selected subject.' : 'প্রতিটি নির্বাচিত বিষয়ের জন্য আপনার অনুশীলনী লক্ষ্য কাস্টমাইজ করুন।'}
                </p>
              </div>

              <div className="mock-config-cards-container">
                {selectedSubjectIds.map(subId => {
                  const subject = MOCK_SUBJECTS.find(s => s.id === subId);
                  if (!subject) return null;

                  // 1st Paper selection status
                  const all1stChapters = MOCK_CHAPTERS[subId]?.['1st'] || [];
                  const selected1st = selectedChapters[subId]?.['1st'] || [];
                  const is1stAllChecked = all1stChapters.length > 0 && selected1st.length === all1stChapters.length;

                  // 2nd Paper selection status
                  const all2ndChapters = MOCK_CHAPTERS[subId]?.['2nd'] || [];
                  const selected2nd = selectedChapters[subId]?.['2nd'] || [];
                  const is2ndAllChecked = all2ndChapters.length > 0 && selected2nd.length === all2ndChapters.length;

                  return (
                    <div
                      key={subId}
                      className="mock-config-card animate-scale-up"
                      style={{ '--hover-color': subject.color }}
                    >
                      {/* Card Subject Header */}
                      <div className="mock-config-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                        <div className="mock-config-subject-info">
                          <div
                            className="mock-card-prefix"
                            style={{ backgroundColor: subject.bg, color: subject.color }}
                          >
                            {subject.prefixType === 'letter' ? subject.letter : subject.icon}
                          </div>
                          <span className="mock-config-subject-title">
                            {language === 'en' ? subject.labelEn : subject.labelBn}
                          </span>
                        </div>
                      </div>

                      {/* Side-by-Side Dual Column Grids */}
                      <div className="mock-papers-side-by-side-grid">

                        {/* 1st Paper Column */}
                        <div className="mock-paper-column">
                          <button
                            type="button"
                            onClick={() => toggleAllChaptersForPaper(subId, '1st')}
                            className={`mock-paper-column-header ${is1stAllChecked ? 'mock-paper-column-header--checked' : ''}`}
                            style={{ '--hover-color': subject.color }}
                          >
                            <div className="mock-paper-header-check">
                              {is1stAllChecked && <HiCheckCircle size={20} />}
                            </div>
                            <span className="mock-paper-header-label">
                              {language === 'en' ? '1st paper' : '১ম পত্র'}
                            </span>
                          </button>

                          <div className="mock-paper-chapters-list">
                            {all1stChapters.map(chapter => {
                              const isSelected = selected1st.includes(chapter);
                              const key = `${subId}__1st__${chapter}`;
                              const topics = topicsMap[key] || [];
                              const selectedList = selectedTopics[key] || [];

                              return (
                                <div key={chapter} className="mock-chapter-pill-wrapper">
                                  <button
                                    type="button"
                                    className={`mock-chapter-pill-item ${isSelected ? 'mock-chapter-pill-item--selected' : ''}`}
                                    onClick={() => toggleChapterSelection(subId, '1st', chapter)}
                                    style={{ '--hover-color': subject.color }}
                                  >
                                    <div className="mock-chapter-pill-check">
                                      {isSelected && <HiCheckCircle size={18} />}
                                    </div>
                                    <span className="mock-chapter-pill-name">{chapter}</span>
                                  </button>

                                  {/* Sub-topics list (expanded when chapter is selected) */}
                                  {isSelected && topics.length > 0 && (
                                    <div className="mock-chapter-topics-sublist animate-slide-down">
                                      <span className="mock-topics-label">
                                        {language === 'en' ? 'Topics:' : 'টপিকসমূহ:'}
                                      </span>
                                      <div className="mock-topics-tags-grid">
                                        {topics.map(topic => {
                                          const isTopicSelected = selectedList.includes(topic.name);
                                          return (
                                            <button
                                              key={topic.name}
                                              type="button"
                                              className={`mock-topic-tag ${isTopicSelected ? 'mock-topic-tag--selected' : ''}`}
                                              onClick={() => {
                                                setSelectedTopics(prev => {
                                                  const current = prev[key] || [];
                                                  const updated = current.includes(topic.name)
                                                    ? current.filter(t => t !== topic.name)
                                                    : [...current, topic.name];
                                                  return { ...prev, [key]: updated };
                                                });
                                              }}
                                              style={{ '--theme-color': subject.color }}
                                            >
                                              {isTopicSelected ? (
                                                <HiCheck size={12} className="mock-topic-tag-icon" />
                                              ) : (
                                                <span className="mock-topic-tag-checkbox"></span>
                                              )}
                                              <span className="mock-topic-tag-name">{topic.name}</span>
                                              <span className="mock-topic-tag-count">{topic.count}</span>
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

                        {/* 2nd Paper Column */}
                        <div className="mock-paper-column">
                          {all2ndChapters.length === 0 ? (
                            /* Symmetrical notice for single-paper subjects like ICT */
                            <div className="mock-empty-paper-notice animate-fade-in">
                              <span style={{ fontSize: '1.25rem', marginBottom: '8px' }}>ℹ️</span>
                              <span>
                                {language === 'en'
                                  ? 'This subject does not have a 2nd paper syllabus.'
                                  : 'এই বিষয়টির জন্য ২য় পত্রের সিলেবাস নেই।'}
                              </span>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleAllChaptersForPaper(subId, '2nd')}
                                className={`mock-paper-column-header ${is2ndAllChecked ? 'mock-paper-column-header--checked' : ''}`}
                                style={{ '--hover-color': subject.color }}
                              >
                                <div className="mock-paper-header-check">
                                  {is2ndAllChecked && <HiCheckCircle size={20} />}
                                </div>
                                <span className="mock-paper-header-label">
                                  {language === 'en' ? '2nd paper' : '২য় পত্র'}
                                </span>
                              </button>

                              <div className="mock-paper-chapters-list">
                                {all2ndChapters.map(chapter => {
                                  const isSelected = selected2nd.includes(chapter);
                                  const key = `${subId}__2nd__${chapter}`;
                                  const topics = topicsMap[key] || [];
                                  const selectedList = selectedTopics[key] || [];

                                  return (
                                    <div key={chapter} className="mock-chapter-pill-wrapper">
                                      <button
                                        type="button"
                                        className={`mock-chapter-pill-item ${isSelected ? 'mock-chapter-pill-item--selected' : ''}`}
                                        onClick={() => toggleChapterSelection(subId, '2nd', chapter)}
                                        style={{ '--hover-color': subject.color }}
                                      >
                                        <div className="mock-chapter-pill-check">
                                          {isSelected && <HiCheckCircle size={18} />}
                                        </div>
                                        <span className="mock-chapter-pill-name">{chapter}</span>
                                      </button>

                                      {/* Sub-topics list (expanded when chapter is selected) */}
                                      {isSelected && topics.length > 0 && (
                                        <div className="mock-chapter-topics-sublist animate-slide-down">
                                          <span className="mock-topics-label">
                                            {language === 'en' ? 'Topics:' : 'টপিকসমূহ:'}
                                          </span>
                                          <div className="mock-topics-tags-grid">
                                            {topics.map(topic => {
                                              const isTopicSelected = selectedList.includes(topic.name);
                                              return (
                                                <button
                                                  key={topic.name}
                                                  type="button"
                                                  className={`mock-topic-tag ${isTopicSelected ? 'mock-topic-tag--selected' : ''}`}
                                                  onClick={() => {
                                                    setSelectedTopics(prev => {
                                                      const current = prev[key] || [];
                                                      const updated = current.includes(topic.name)
                                                        ? current.filter(t => t !== topic.name)
                                                        : [...current, topic.name];
                                                      return { ...prev, [key]: updated };
                                                    });
                                                  }}
                                                  style={{ '--theme-color': subject.color }}
                                                >
                                                  {isTopicSelected ? (
                                                    <HiCheck size={12} className="mock-topic-tag-icon" />
                                                  ) : (
                                                    <span className="mock-topic-tag-checkbox"></span>
                                                  )}
                                                  <span className="mock-topic-tag-name">{topic.name}</span>
                                                  <span className="mock-topic-tag-count">{topic.count}</span>
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
                            </>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Footer for Step 2 */}
              <div className="mock-selection-actions">
                <button
                  type="button"
                  className="btn btn-primary mock-next-btn animate-fade-in"
                  disabled={Object.values(selectedChapters).every(subObj =>
                    Object.values(subObj).every(arr => arr.length === 0)
                  )}
                  onClick={() => setStep(3)}
                >
                  <span>{language === 'en' ? 'Next Step' : 'পরবর্তী ধাপ'}</span>
                  <HiArrowRight size={18} />
                </button>
              </div>
            </div>
          ) : step === 3 ? (
            /* ──────────────── STEP 3: EXAM CONFIGURATION ──────────────── */
            <div className="mock-exam-config animate-fade-in">
              {/* Back Button */}
              <button
                type="button"
                onClick={() => setStep(2)}
                className="mock-back-btn"
              >
                <HiArrowLeft size={16} />
                <span>{language === 'en' ? 'Back to chapters' : 'অধ্যায়ে ফিরে যাও'}</span>
              </button>

              <div className="mock-selection-info">
                <h3>{language === 'en' ? 'Exam Settings' : 'পরীক্ষার সেটিংস'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                  {language === 'en' ? 'Configure your exam preferences before starting.' : 'শুরু করার আগে আপনার পরীক্ষার পছন্দ সেট করুন।'}
                </p>
              </div>

              {/* ── Selected Topics Accordion ── */}
              <div className="mock-topics-accordion">
                <button
                  type="button"
                  className="mock-topics-accordion-btn"
                  onClick={() => setShowSelectedTopics(!showSelectedTopics)}
                >
                  <span>{language === 'en' ? 'Tap here to see selected topics' : 'সিলেক্টেড টপিকস দেখতে এখানে ট্যাপ করো'}</span>
                  {showSelectedTopics ? <HiChevronUp size={20} /> : <HiChevronDown size={20} />}
                </button>
                {showSelectedTopics && (
                  <div className="mock-topics-tree animate-slide-down">
                    {selectedSubjectIds.map(subId => {
                      const subject = MOCK_SUBJECTS.find(s => s.id === subId) || { labelEn: subId, labelBn: subId, color: '#3B82F6' };
                      const subMap = selectedChapters[subId] || {};
                      const has1st = subMap['1st'] && subMap['1st'].length > 0;
                      const has2nd = subMap['2nd'] && subMap['2nd'].length > 0;
                      if (!has1st && !has2nd) return null;

                      return (
                        <div key={subId} className="mock-tree-subject">
                          <div className="mock-tree-subject-name" style={{ color: subject.color }}>
                            {language === 'en' ? subject.labelEn : subject.labelBn}
                          </div>
                          <div className="mock-tree-papers">
                            {['1st', '2nd'].map(paper => {
                              const chapters = subMap[paper] || [];
                              if (chapters.length === 0) return null;
                              return (
                                <div key={paper} className="mock-tree-paper">
                                  <div className="mock-tree-paper-name" style={{ color: subject.color }}>
                                    {paper} paper
                                  </div>
                                  <div className="mock-tree-chapters">
                                    {chapters.map(ch => {
                                      const key = `${subId}__${paper}__${ch}`;
                                      const topics = selectedTopics[key] || [];
                                      return (
                                        <div key={ch} className="mock-tree-chapter">
                                          <div className="mock-tree-chapter-name">{ch}</div>
                                          {topics.length > 0 && (
                                            <div className="mock-tree-topics">
                                              {topics.map(t => (
                                                <div key={t} className="mock-tree-topic-name">- {t}</div>
                                              ))}
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Section 1: Question Standard ── */}
              <div className="mock-config-section">
                <div className="mock-config-section-header">
                  <HiAcademicCap size={20} className="mock-config-section-icon" />
                  <h4>{language === 'en' ? 'Question Standard' : 'প্রশ্নের মান'}</h4>
                </div>
                <p className="mock-config-section-desc">
                  {language === 'en' ? 'Choose the exam categories to filter questions. You can select multiple standards.' : 'প্রশ্ন ফিল্টার করতে পরীক্ষার ক্যাটাগরি বেছে নিন। আপনি একাধিক অপশন নির্বাচন করতে পারেন।'}
                </p>
                <div className="mock-standard-grid">
                  {QUESTION_STANDARDS.map(std => {
                    const isActive = selectedStandards.includes(std.id);
                    return (
                      <button
                        key={std.id}
                        type="button"
                        className={`mock-standard-card ${isActive ? 'mock-standard-card--selected' : ''}`}
                        style={{ '--std-color': std.color, '--std-bg': std.bg }}
                        onClick={() => {
                          setSelectedStandards(prev => {
                            const isSelecting = !prev.includes(std.id);
                            const next = isSelecting
                              ? [...prev, std.id]
                              : prev.filter(id => id !== std.id);

                            if (std.id === 'engineering') {
                              setSelectedEngineeringUnis(isSelecting ? [...ENGINEERING_UNIVERSITIES] : []);
                            } else if (std.id === 'university') {
                              setSelectedGeneralUnis(isSelecting ? [...GENERAL_UNIVERSITIES] : []);
                            } else if (std.id === 'academic') {
                              setSelectedAcademicTypes(isSelecting ? ['board', 'college'] : []);
                              setSelectedBoards(isSelecting ? [...BOARDS] : []);
                            }
                            return next;
                          });
                        }}
                      >
                        <div className="mock-standard-card-glow" />
                        <div className="mock-standard-icon" style={{ color: std.color, background: std.bg }}>
                          {std.icon}
                        </div>
                        <span className="mock-standard-label">{language === 'en' ? std.labelEn : std.labelBn}</span>
                        <span className="mock-standard-desc">{std.desc}</span>
                        {isActive && <div className="mock-standard-check"><HiCheckCircle size={20} /></div>}
                      </button>
                    );
                  })}
                </div>

                {/* Engineering Sub-selection */}
                {selectedStandards.includes('engineering') && (
                  <div className="mock-sub-selection-container animate-slide-down">
                    <div className="mock-sub-selection-title">
                      {language === 'en' ? 'Select Engineering Universities' : 'ইঞ্জিনিয়ারিং বিশ্ববিদ্যালয়সমূহ নির্বাচন করুন'}
                    </div>
                    <div className="mock-sub-selection-pills">
                      {ENGINEERING_UNIVERSITIES.map(uni => {
                        const isSelected = selectedEngineeringUnis.includes(uni);
                        return (
                          <button
                            key={uni}
                            type="button"
                            className={`mock-uni-pill ${isSelected ? 'mock-uni-pill--selected' : ''}`}
                            style={{ '--theme-color': '#F59E0B', '--theme-bg': 'rgba(245, 158, 11, 0.08)' }}
                            onClick={() => {
                              setSelectedEngineeringUnis(prev =>
                                prev.includes(uni) ? prev.filter(u => u !== uni) : [...prev, uni]
                              );
                            }}
                          >
                            {isSelected && <HiCheck size={14} style={{ marginRight: '4px' }} />}
                            <span>{uni}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Varsity Sub-selection */}
                {selectedStandards.includes('university') && (
                  <div className="mock-sub-selection-container animate-slide-down">
                    <div className="mock-sub-selection-title">
                      {language === 'en' ? 'Select General Universities' : 'সাধারণ বিশ্ববিদ্যালয়সমূহ নির্বাচন করুন'}
                    </div>
                    <div className="mock-sub-selection-pills">
                      {GENERAL_UNIVERSITIES.map(uni => {
                        const isSelected = selectedGeneralUnis.includes(uni);
                        return (
                          <button
                            key={uni}
                            type="button"
                            className={`mock-uni-pill ${isSelected ? 'mock-uni-pill--selected' : ''}`}
                            style={{ '--theme-color': '#3B82F6', '--theme-bg': 'rgba(59, 130, 246, 0.08)' }}
                            onClick={() => {
                              setSelectedGeneralUnis(prev =>
                                prev.includes(uni) ? prev.filter(u => u !== uni) : [...prev, uni]
                              );
                            }}
                          >
                            {isSelected && <HiCheck size={14} style={{ marginRight: '4px' }} />}
                            <span>{uni}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Academic Sub-selection */}
                {selectedStandards.includes('academic') && (
                  <div className="mock-sub-selection-container animate-slide-down">
                    <div className="mock-sub-selection-title">
                      {language === 'en' ? 'Select Academic Type' : 'একাডেমিক ধরন নির্বাচন করুন'}
                    </div>
                    <div className="mock-sub-selection-pills">
                      {[
                        { id: 'board', labelEn: 'Board Questions', labelBn: 'বোর্ড প্রশ্ন' },
                        { id: 'college', labelEn: 'College Questions', labelBn: 'কলেজ প্রশ্ন' }
                      ].map(type => {
                        const isSelected = selectedAcademicTypes.includes(type.id);
                        return (
                          <button
                            key={type.id}
                            type="button"
                            className={`mock-uni-pill ${isSelected ? 'mock-uni-pill--selected' : ''}`}
                            style={{ '--theme-color': '#10B981', '--theme-bg': 'rgba(16, 185, 129, 0.08)' }}
                            onClick={() => {
                              setSelectedAcademicTypes(prev => {
                                const isSel = !prev.includes(type.id);
                                const next = isSel ? [...prev, type.id] : prev.filter(t => t !== type.id);
                                if (type.id === 'board') {
                                  setSelectedBoards(isSel ? [...BOARDS] : []);
                                }
                                return next;
                              });
                            }}
                          >
                            {isSelected && <HiCheck size={14} style={{ marginRight: '4px' }} />}
                            <span>{language === 'en' ? type.labelEn : type.labelBn}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Nested Board Selection */}
                    {selectedAcademicTypes.includes('board') && (
                      <div className="mock-sub-selection-container animate-slide-down" style={{ borderTop: '1px dashed rgba(75, 46, 43, 0.05)', marginTop: '12px', paddingTop: '12px' }}>
                        <div className="mock-sub-selection-title" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {language === 'en' ? 'Select Boards' : 'বোর্ডসমূহ নির্বাচন করুন'}
                        </div>
                        <div className="mock-sub-selection-pills">
                          {BOARDS.map(board => {
                            const isSelected = selectedBoards.includes(board);
                            return (
                              <button
                                key={board}
                                type="button"
                                className={`mock-uni-pill ${isSelected ? 'mock-uni-pill--selected' : ''}`}
                                style={{ '--theme-color': '#10B981', '--theme-bg': 'rgba(16, 185, 129, 0.08)' }}
                                onClick={() => {
                                  setSelectedBoards(prev =>
                                    prev.includes(board) ? prev.filter(b => b !== board) : [...prev, board]
                                  );
                                }}
                              >
                                {isSelected && <HiCheck size={14} style={{ marginRight: '4px' }} />}
                                <span>{board}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Section 2: Question Type ── */}
              <div className="mock-config-section">
                <div className="mock-config-section-header">
                  <HiCollection size={20} className="mock-config-section-icon" />
                  <h4>{language === 'en' ? 'Question Type' : 'প্রশ্নের ধরন'}</h4>
                </div>
                <div className="mock-type-pills">
                  {QUESTION_TYPES.map(qt => {
                    const isActive = questionType === qt.id;
                    return (
                      <button
                        key={qt.id}
                        type="button"
                        className={`mock-type-pill ${isActive ? 'mock-type-pill--selected' : ''}`}
                        onClick={() => setQuestionType(isActive ? '' : qt.id)}
                      >
                        {qt.icon}
                        <span>{language === 'en' ? qt.labelEn : qt.labelBn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Section 3: Total Questions ── */}
              <div className="mock-config-section">
                <div className="mock-config-section-header">
                  <HiDocumentText size={20} className="mock-config-section-icon" />
                  <h4>{language === 'en' ? 'Total Questions' : 'মোট প্রশ্ন সংখ্যা'}</h4>
                </div>
                <div className="mock-presets-row">
                  {QUESTION_PRESETS.map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`mock-preset-chip ${totalQuestions === n && !customQuestionInput ? 'mock-preset-chip--selected' : ''}`}
                      onClick={() => { setTotalQuestions(n); setCustomQuestionInput(''); }}
                    >
                      {n}
                    </button>
                  ))}
                  <div className="mock-preset-custom">
                    <input
                      type="number"
                      min="1"
                      max="200"
                      placeholder={language === 'en' ? 'Custom' : 'কাস্টম'}
                      value={customQuestionInput}
                      onChange={e => {
                        setCustomQuestionInput(e.target.value);
                        const v = parseInt(e.target.value);
                        if (v > 0 && v <= 200) setTotalQuestions(v);
                      }}
                      className="mock-custom-input"
                    />
                  </div>
                </div>
                <span className="mock-preset-current">
                  {language === 'en' ? `Selected: ${totalQuestions} questions` : `নির্বাচিত: ${totalQuestions}টি প্রশ্ন`}
                </span>
              </div>

              {/* ── Section 4: Time Duration ── */}
              <div className="mock-config-section">
                <div className="mock-config-section-header">
                  <HiClock size={20} className="mock-config-section-icon" />
                  <h4>{language === 'en' ? 'Time Duration' : 'সময়কাল'}</h4>
                </div>
                <div className="mock-presets-row">
                  {TIME_PRESETS.map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`mock-preset-chip ${examDuration === m && !customTimeInput ? 'mock-preset-chip--selected' : ''}`}
                      onClick={() => { setExamDuration(m); setCustomTimeInput(''); }}
                    >
                      {m}{language === 'en' ? 'm' : 'মি'}
                    </button>
                  ))}
                  <div className="mock-preset-custom">
                    <input
                      type="number"
                      min="1"
                      max="300"
                      placeholder={language === 'en' ? 'Custom' : 'কাস্টম'}
                      value={customTimeInput}
                      onChange={e => {
                        setCustomTimeInput(e.target.value);
                        const v = parseInt(e.target.value);
                        if (v > 0 && v <= 300) setExamDuration(v);
                      }}
                      className="mock-custom-input"
                    />
                  </div>
                </div>
                <span className="mock-preset-current">
                  {language === 'en' ? `Selected: ${examDuration} minutes` : `নির্বাচিত: ${examDuration} মিনিট`}
                </span>
              </div>

              {/* ── Section 5: Negative Marking Toggle ── */}
              <div className="mock-config-section">
                <div className="mock-config-section-header">
                  <HiMinusCircle size={20} className="mock-config-section-icon" />
                  <h4>{language === 'en' ? 'Negative Marking' : 'নেগেটিভ মার্কিং'}</h4>
                </div>
                <div className="mock-toggle-row">
                  <span className="mock-toggle-label">
                    {language === 'en'
                      ? (negativeMarking ? 'Enabled — wrong answers will deduct marks' : 'Disabled — no penalty for wrong answers')
                      : (negativeMarking ? 'চালু — ভুল উত্তরে নম্বর কাটা যাবে' : 'বন্ধ — ভুল উত্তরে নম্বর কাটা যাবে না')}
                  </span>
                  <button
                    type="button"
                    className={`mock-toggle-switch ${negativeMarking ? 'mock-toggle-switch--on' : ''}`}
                    onClick={() => setNegativeMarking(prev => !prev)}
                    aria-label="Toggle negative marking"
                  >
                    <span className="mock-toggle-knob" />
                  </button>
                </div>
              </div>

              {/* ── Selection Summary ── */}
              <div className="mock-config-section mock-summary-section">
                <div className="mock-config-section-header">
                  <HiPhotograph size={20} className="mock-config-section-icon" />
                  <h4>{language === 'en' ? 'Selection Summary' : 'নির্বাচনের সারাংশ'}</h4>
                </div>
                <div className="mock-summary-grid">
                  <div className="mock-summary-stat">
                    <span className="mock-summary-stat-value">{summary.subjectCount}</span>
                    <span className="mock-summary-stat-label">{language === 'en' ? 'Subjects' : 'বিষয়'}</span>
                  </div>
                  <div className="mock-summary-stat">
                    <span className="mock-summary-stat-value">{summary.chapterCount}</span>
                    <span className="mock-summary-stat-label">{language === 'en' ? 'Chapters' : 'অধ্যায়'}</span>
                  </div>
                  <div className="mock-summary-stat">
                    <span className="mock-summary-stat-value">{summary.topicCount}</span>
                    <span className="mock-summary-stat-label">{language === 'en' ? 'Topics' : 'টপিক'}</span>
                  </div>
                  <div className="mock-summary-stat">
                    <span className="mock-summary-stat-value">{totalQuestions}</span>
                    <span className="mock-summary-stat-label">{language === 'en' ? 'Questions' : 'প্রশ্ন'}</span>
                  </div>
                  <div className="mock-summary-stat">
                    <span className="mock-summary-stat-value">{examDuration}<small>m</small></span>
                    <span className="mock-summary-stat-label">{language === 'en' ? 'Duration' : 'সময়'}</span>
                  </div>
                  <div className="mock-summary-stat">
                    <span className={`mock-summary-stat-value ${negativeMarking ? 'mock-summary-neg-on' : 'mock-summary-neg-off'}`}>
                      {negativeMarking ? '✓' : '✗'}
                    </span>
                    <span className="mock-summary-stat-label">{language === 'en' ? 'Neg. Mark' : 'নেগ. মার্ক'}</span>
                  </div>
                </div>
              </div>

              {/* ── Start Exam Button ── */}
              <div className="mock-selection-actions">
                <button
                  type="button"
                  className={`btn btn-primary mock-start-exam-btn animate-fade-in ${(selectedStandards.length === 0 || !questionType || totalQuestions <= 0 || examDuration <= 0) ? 'mock-start-exam-btn--disabled' : ''}`}
                  disabled={isStartingExam || selectedStandards.length === 0 || !questionType || totalQuestions <= 0 || examDuration <= 0}
                  onClick={handleStartExam}
                  style={{
                    opacity: (selectedStandards.length === 0 || !questionType || totalQuestions <= 0 || examDuration <= 0) ? 0.6 : 1,
                    cursor: (selectedStandards.length === 0 || !questionType || totalQuestions <= 0 || examDuration <= 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isStartingExam ? (
                    <span className="mock-btn-loading">
                      <span className="mock-spinner" />
                      {language === 'en' ? 'Loading...' : 'লোড হচ্ছে...'}
                    </span>
                  ) : (
                    <>
                      <span>{language === 'en' ? 'Start Exam' : 'পরীক্ষা শুরু করুন'}</span>
                      <HiArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* --- Beautiful Error Modal --- */}
      {errorModal.show && (
        <div className="mock-error-modal-overlay">
          <div className="mock-error-modal-card animate-scale-up">
            <button className="mock-error-close-btn" onClick={() => setErrorModal({ show: false, message: '' })}>
              <HiX size={20} />
            </button>
            <div className="mock-error-modal-header">
              <div className="mock-error-modal-icon">
                <HiMinusCircle size={40} />
              </div>
              <h3>{language === 'en' ? 'Questions Not Found' : 'প্রশ্ন পাওয়া যায়নি'}</h3>
            </div>
            <div className="mock-error-modal-body">
              <p>{errorModal.message}</p>
            </div>
            <div className="mock-error-modal-footer">
              <button
                type="button"
                className="mock-error-modal-btn"
                onClick={() => setErrorModal({ show: false, message: '' })}
              >
                {language === 'en' ? 'Adjust Settings' : 'সেটিংস পরিবর্তন করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
