import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiCheckCircle, HiArrowRight, HiArrowLeft, HiCheck, HiClock, HiAcademicCap, HiBeaker, HiBookOpen, HiCollection, HiPencil, HiDocumentText, HiPhotograph, HiChevronDown, HiChevronUp, HiX, HiTag } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './MockTest.css';

// ─── Thematic Mock Test Subjects Data (Matches MockTest.jsx) ────────────────
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

// ─── HSC & Admission Standard Chapters Database (Matches MockTest.jsx) ─────
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

// Maps Create Contest subject names → MOCK_SUBJECTS IDs
const CONTEST_TO_MOCK_MAP = {
  'Physics': 'physics',
  'Chemistry': 'chemistry',
  'Higher Math': 'highermath',
  'Biology': 'biology',
  'ICT': 'ict',
  'English': 'english',
  'Bangla': 'bangla',
  'GK': 'gk',
  'IBA': 'iba',
};

export default function MakeContestQuestionChooseQBank() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const contestData = location.state?.contestData || (() => {
    const saved = sessionStorage.getItem('cc_contestData');
    return saved ? JSON.parse(saved) : null;
  })();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  // Step state: 1 = Subjects, 2 = Chapters, 3 = Settings
  const [step, setStep] = useState(() => {
    const saved = sessionStorage.getItem('cc_qbank_step');
    return saved ? parseInt(saved) : 1;
  });

  // Selections (restored from sessionStorage)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(() => {
    const saved = sessionStorage.getItem('cc_qbank_selectedSubjectIds');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedChapters, setSelectedChapters] = useState(() => {
    const saved = sessionStorage.getItem('cc_qbank_selectedChapters');
    return saved ? JSON.parse(saved) : {};
  });
  const [topicsMap, setTopicsMap] = useState(() => {
    const saved = sessionStorage.getItem('cc_qbank_topicsMap');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedTopics, setSelectedTopics] = useState(() => {
    const saved = sessionStorage.getItem('cc_qbank_selectedTopics');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist qbank selections to sessionStorage
  useEffect(() => { sessionStorage.setItem('cc_qbank_step', String(step)); }, [step]);
  useEffect(() => { sessionStorage.setItem('cc_qbank_selectedSubjectIds', JSON.stringify(selectedSubjectIds)); }, [selectedSubjectIds]);
  useEffect(() => { sessionStorage.setItem('cc_qbank_selectedChapters', JSON.stringify(selectedChapters)); }, [selectedChapters]);
  useEffect(() => { sessionStorage.setItem('cc_qbank_topicsMap', JSON.stringify(topicsMap)); }, [topicsMap]);
  useEffect(() => { sessionStorage.setItem('cc_qbank_selectedTopics', JSON.stringify(selectedTopics)); }, [selectedTopics]);

  // Filter subjects based on what was selected on the Create Contest page
  const filteredSubjects = (() => {
    if (!contestData) return MOCK_SUBJECTS;

    if (contestData.level === 'hsc' && contestData.subjects) {
      const allowedIds = contestData.subjects.map(s => CONTEST_TO_MOCK_MAP[s]).filter(Boolean);
      return MOCK_SUBJECTS.filter(s => allowedIds.includes(s.id));
    }

    if (contestData.level === 'admission') {
      if (contestData.admissionType === 'medical') {
        const medicalIds = ['biology', 'chemistry', 'physics', 'english', 'gk'];
        return MOCK_SUBJECTS.filter(s => medicalIds.includes(s.id));
      }
      if (contestData.admissionType === 'engineering') {
        const engineeringIds = ['highermath', 'physics', 'chemistry', 'english'];
        return MOCK_SUBJECTS.filter(s => engineeringIds.includes(s.id));
      }
    }

    return MOCK_SUBJECTS;
  })();

  // Auth Guard
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { navigate('/'); return; }
    const role = localStorage.getItem('topkorbo_role');
    if (role !== 'teacher') { navigate('/dashboard'); return; }
    if (!contestData) { navigate('/make-contest-question'); return; }
  }, [navigate, contestData]);

  // Fetch topics from database for a selected chapter (matching MockTest.jsx)
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

  // Toggle subject selection
  const toggleSubjectSelection = (id) => {
    setSelectedSubjectIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Toggle chapter selection
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

  // Pre-fetch topics when entering step 2
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

  // Sync selected subjects with chapter structure
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

  // Build selections payload
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

  const handleSaveAndReturn = () => {
    const qbankSelections = buildSelections();
    if (qbankSelections.length === 0) {
      toast.error(language === 'en' ? 'Please select at least one chapter.' : 'দয়া করে কমপক্ষে একটি অধ্যায় নির্বাচন করুন।');
      return;
    }

    // Save qbank selections to sessionStorage
    sessionStorage.setItem('cc_qbankSelections', JSON.stringify(qbankSelections));

    navigate('/make-contest-question/next-two', {
      state: {
        contestData,
        qbankSelections
      }
    });
  };

  const STEP_LABELS = [
    { num: 1, labelEn: 'Subjects', labelBn: 'বিষয়' },
    { num: 2, labelEn: 'Chapters', labelBn: 'অধ্যায়' },
    { num: 3, labelEn: 'Settings', labelBn: 'সেটিংস' },
  ];

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="make-contest-question" user={user} />

      <main className="dashboard-main">
        {/* Header Section */}
        <header className="dashboard-header">
          <div className="dashboard-header__welcome">
            <h2>{language === 'en' ? 'Choose from Question Bank' : 'প্রশ্ন ব্যাংক থেকে বেছে নিন'}</h2>
            <p>
              {language === 'en'
                ? 'Select subjects and chapters to add questions to your contest.'
                : 'আপনার কনটেস্টে প্রশ্ন যোগ করতে বিষয় এবং অধ্যায় নির্বাচন করুন।'}
            </p>
          </div>
          <div className="mock-header__actions">
            <span className="dashboard-header__badge">
              {language === 'en' ? 'Teacher Studio' : 'শিক্ষক স্টুডিও'}
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
                <h3>{language === 'en' ? 'Select Subject(s)' : 'বিষয় নির্বাচন করুন'}</h3>
              </div>

              <div className="mock-subjects-grid">
                {filteredSubjects.map((subject) => {
                  const isSelected = selectedSubjectIds.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      onClick={() => toggleSubjectSelection(subject.id)}
                      className={`mock-subject-card ${isSelected ? 'mock-subject-card--selected' : ''}`}
                      style={{ '--hover-color': subject.color }}
                    >
                      <div className="mock-card-glow"></div>
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

              <div className="mock-selection-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => navigate('/make-contest-question/next-two', { state: { contestData, showOptions: true } })}
                  className="mock-back-btn"
                  style={{ marginBottom: 0 }}
                >
                  <HiArrowLeft size={16} />
                  <span>{language === 'en' ? 'Back' : 'ফিরে যান'}</span>
                </button>

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
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="mock-back-btn"
              >
                <HiArrowLeft size={16} />
                <span>{language === 'en' ? 'Back to subjects' : 'পেছনে ফিরে যাও'}</span>
              </button>

              <div className="mock-selection-info">
                <h3>{language === 'en' ? 'Configure Papers & Chapters' : 'পত্র ও অধ্যায় নির্বাচন করুন'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                  {language === 'en' ? 'Choose the chapters you want to add questions from.' : 'যে অধ্যায়গুলো থেকে প্রশ্ন যোগ করতে চান তা নির্বাচন করুন।'}
                </p>
              </div>

              <div className="mock-config-cards-container">
                {selectedSubjectIds.map(subId => {
                  const subject = MOCK_SUBJECTS.find(s => s.id === subId);
                  if (!subject) return null;

                  const all1stChapters = MOCK_CHAPTERS[subId]?.['1st'] || [];
                  const selected1st = selectedChapters[subId]?.['1st'] || [];
                  const is1stAllChecked = all1stChapters.length > 0 && selected1st.length === all1stChapters.length;

                  const all2ndChapters = MOCK_CHAPTERS[subId]?.['2nd'] || [];
                  const selected2nd = selectedChapters[subId]?.['2nd'] || [];
                  const is2ndAllChecked = all2ndChapters.length > 0 && selected2nd.length === all2ndChapters.length;

                  return (
                    <div 
                      key={subId} 
                      className="mock-config-card animate-scale-up"
                      style={{ '--hover-color': subject.color }}
                    >
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
            /* ──────────────── STEP 3: SETTINGS VIEW PLACEHOLDER ──────────────── */
            <div className="mock-exam-config animate-fade-in" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <button 
                type="button" 
                onClick={() => setStep(2)}
                className="mock-back-btn"
                style={{ alignSelf: 'flex-start', marginBottom: '1.5rem' }}
              >
                <HiArrowLeft size={16} />
                <span>{language === 'en' ? 'Back to chapters' : 'অধ্যায়ে ফিরে যাও'}</span>
              </button>

              <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>⚙️</div>
              
              <h2 className="cc-section__title" style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                {language === 'en' ? 'Question Bank Settings' : 'প্রশ্ন ব্যাংক সেটিংস'}
              </h2>
              
              <p className="cc-section__desc" style={{ maxWidth: '500px', margin: '0 auto 2rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
                {language === 'en'
                  ? 'Settings configuration will be implemented here.'
                  : 'সেটিংসের কনফিগারেশন এখানে যুক্ত করা হবে।'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={handleSaveAndReturn}
                  className="cc-submit-btn"
                  style={{ padding: '0.9rem 3rem' }}
                >
                  📝 {language === 'en' ? 'Save & Add to Contest' : 'সংরক্ষণ করুন এবং কনটেস্টে যোগ করুন'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
