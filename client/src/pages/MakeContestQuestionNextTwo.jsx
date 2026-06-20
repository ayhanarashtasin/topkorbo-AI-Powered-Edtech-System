import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { 
  HiArrowLeft, HiPlusCircle, HiBookOpen, HiPencilAlt, HiPhotograph, HiX, HiSearch, HiCheckCircle,
  HiUpload, HiPlus, HiTrash, HiDocumentText, HiClipboardList, HiLightBulb
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './MakeContestQuestion.css';
import './MakeContestQuestionNextTwo.css';
import './UploadQuestion.css';

// ─── Static Data: Subjects, Papers, Chapters ──────────────────────────────────

const HSC_SUBJECTS = [
  { id: 'Physics', labelEn: 'Physics', labelBn: 'পদার্থবিজ্ঞান', papers: ['1st', '2nd'] },
  { id: 'Chemistry', labelEn: 'Chemistry', labelBn: 'রসায়ন', papers: ['1st', '2nd'] },
  { id: 'Higher Math', labelEn: 'Higher Math', labelBn: 'উচ্চতর গণিত', papers: ['1st', '2nd'] },
  { id: 'Biology', labelEn: 'Biology', labelBn: 'জীববিজ্ঞান', papers: ['1st', '2nd'] },
  { id: 'Bangla', labelEn: 'Bangla', labelBn: 'বাংলা', papers: ['1st', '2nd'] },
  { id: 'English', labelEn: 'English', labelBn: 'ইংরেজি', papers: ['1st', '2nd'] },
  { id: 'ICT', labelEn: 'ICT', labelBn: 'তথ্য ও যোগাযোগ প্রযুক্তি', papers: ['1st'] },
  { id: 'Statistics', labelEn: 'Statistics', labelBn: 'পরিসংখ্যান', papers: ['1st', '2nd'] },
  { id: 'Accounting', labelEn: 'Accounting', labelBn: 'হিসাববিজ্ঞান', papers: ['1st', '2nd'] },
  { id: 'Finance', labelEn: 'Finance', labelBn: 'ফিন্যান্স ও ব্যাংকিং', papers: ['1st', '2nd'] },
  { id: 'Economics', labelEn: 'Economics', labelBn: 'অর্থনীতি', papers: ['1st', '2nd'] },
  { id: 'Management', labelEn: 'Management', labelBn: 'ব্যবসায় সংগঠন ও ব্যবস্থাপনা', papers: ['1st', '2nd'] },
];

const CHAPTERS_MAP = {
  'Physics__1st': [
    'Physical World and Measurement', 'Vector', 'Dynamics', 'Newtonian Mechanics',
    'Work, Energy & Power', 'Gravitation & Gravity', 'Stress & Strain',
    'Periodic Motion', 'Waves', 'Ideal Gas & Kinetic Theory'
  ],
  'Physics__2nd': [
    'Heat & Thermodynamics', 'Electrostatics', 'Current Electricity', 'Magnetic Effect of Current',
    'Electromagnetic Induction', 'Alternating Current', 'Geometric Optics',
    'Physical Optics', 'Modern Physics & Atom Model', 'Nuclear Physics & Radioactivity',
    'Semiconductor & Electronics'
  ],
  'Chemistry__1st': [
    'Environmental Chemistry',
    'Qualitative Chemistry',
    'Mole',
    'Atomic Structure',
    'Chemical Bond'
  ],
  'Chemistry__2nd': [
    'Chemical Changes',
    'Industrial Chemistry',
    'Electrochemistry',
    'Organic Chemistry',
    'Biochemistry'
  ],
  'Higher Math__1st': [
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
  'Higher Math__2nd': [
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
  ],
  'Biology__1st': [
    'Cell and Its Structure',
    'Cell Division',
    'Cell Chemistry',
    'Microorganism',
    'Algae and Fungi',
    'Bryophyta and Pteridophyta',
    'Gymnosperm and Angiosperm',
    'Tissue and Tissue System',
    'Plant Physiology',
    'Plant Reproduction',
    'Biotechnology',
    'Environment, Distribution and Conservation of Organisms'
  ],
  'Biology__2nd': [
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
  ],
  'Bangla__1st': [
    'গদ্য', 'পদ্য', 'নাটক', 'উপন্যাস',
    'ছোটগল্প', 'প্রবন্ধ', 'ভাষা ও ব্যাকরণ'
  ],
  'Bangla__2nd': [
    'বাংলা ব্যাকরণ', 'ভাব-সম্প্রসারণ', 'পত্র লিখন',
    'প্রবন্ধ রচনা', 'সারমর্ম/সারাংশ', 'অনুবাদ',
    'বাংলা বানানের নিয়ম'
  ],
  'English__1st': [
    'Comprehension', 'Vocabulary', 'Grammar',
    'Reading Skills', 'Prose', 'Poetry',
    'Short Stories', 'Composition'
  ],
  'English__2nd': [
    'Grammar — Tenses', 'Grammar — Modifiers', 'Grammar — Connectors',
    'Grammar — Sentence Patterns', 'Formal Letter/Application',
    'Paragraph Writing', 'Essay Writing', 'Report Writing',
    'Completing Story', 'Email Writing'
  ],
  'ICT__1st': [
    'World and ICT', 'Communication System', 'Number System & Digital Devices',
    'Web Design — HTML', 'Programming Basics', 'Database Management'
  ],
};

const BOARDS = [
  'Dhaka', 'Comilla', 'Rajshahi', 'Jessore', 'Chittagong',
  'Sylhet', 'Barishal', 'Dinajpur', 'Mymensingh', 'Madrasa', 'Technical'
];

const UNIVERSITIES = [
  { id: 'DU', name: 'Dhaka University', units: ['Unit A (Science)', 'Unit B (Arts)', 'Unit C (Commerce)', 'Unit D (Change)'] },
  { id: 'BUET', name: 'BUET', units: ['Engineering'] },
  { id: 'CU', name: 'Chittagong University', units: ['Unit A', 'Unit B', 'Unit C', 'Unit D'] },
  { id: 'RU', name: 'Rajshahi University', units: ['Unit A', 'Unit B', 'Unit C', 'Unit D', 'Unit E'] },
  { id: 'JU', name: 'Jahangirnagar University', units: ['Unit A', 'Unit B', 'Unit C', 'Unit D', 'Unit E'] },
  { id: 'CUET', name: 'CUET', units: ['Engineering'] },
  { id: 'KUET', name: 'KUET', units: ['Engineering'] },
  { id: 'RUET', name: 'RUET', units: ['Engineering'] },
  { id: 'MIST', name: 'MIST', units: ['Engineering'] },
  { id: 'IBA', name: 'IBA (DU)', units: ['BBA'] },
  { id: 'Medical', name: 'Medical', units: ['MBBS'] },
  { id: 'Dental', name: 'Dental', units: ['BDS'] },
  { id: 'GST', name: 'GST (Cluster)', units: ['Unit A', 'Unit B', 'Unit C', 'Unit D'] },
  { id: 'CKRUET', name: 'CKRUET (Cluster)', units: ['Engineering'] },
  { id: 'BUP', name: 'BUP', units: ['Unit A', 'Unit B'] },
  { id: 'IUT', name: 'IUT', units: ['Engineering'] },
  { id: 'BUTEX', name: 'BUTEX', units: ['Engineering'] },
  { id: 'AGRI', name: 'Agriculture (Cluster)', units: ['Agriculture'] },
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

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2014 }, (_, i) => String(currentYear + 1 - i));

const SESSIONS = Array.from(
  { length: currentYear - 2014 },
  (_, i) => {
    const start = String(currentYear + 1 - i);
    const endShort = String((currentYear + 1 - i + 1) % 100).padStart(2, '0');
    return `${start.slice(-2)}-${endShort}`;
  }
);

const KEYBOARD_TABS = {
  essentials: {
    labelEn: 'Delim & Power',
    labelBn: 'চিহ্ন ও সূচক',
    symbols: [
      { label: 'Inline Math ($x$)', latex: '\\$ x \\$', code: '$x$' },
      { label: 'Display Math ($$\\Sigma$$)', latex: '\\$\\$ \\Sigma \\$\\$', code: '$$\n\\Sigma\n$$' },
      { label: 'Alt Inline (\\(x\\))', latex: '\\backslash ( x \\backslash )', code: '\\( x \\)' },
      { label: 'Alt Display (\\[\\Sigma\\])', latex: '\\backslash [ \\Sigma \\backslash ]', code: '\\[ \\Sigma \\]' },
      { label: 'Fraction', latex: '\\frac{a}{b}', code: '\\frac{a}{b}' },
      { label: 'Square Root', latex: '\\sqrt{x}', code: '\\sqrt{x}' },
      { label: 'nth Root', latex: '\\sqrt[n]{x}', code: '\\sqrt[n]{x}' },
      { label: 'Power', latex: 'x^2', code: '^{2}' },
      { label: 'Complex Power', latex: 'x^{10}', code: '^{10}' },
      { label: 'Subscript', latex: 'a_n', code: '_{n}' },
      { label: 'Subscript Expression', latex: 'a_{n+1}', code: '_{n+1}' },
      { label: 'Brackets ()', latex: '()', code: '()' },
      { label: 'Brackets []', latex: '[]', code: '[]' },
      { label: 'Brackets {}', latex: '\\{ \\}', code: '\\{ \\}' },
      { label: 'Angle Brackets', latex: '\\langle \\rangle', code: '\\langle \\rangle' },
    ]
  },
  hsc: {
    labelEn: 'Matrix & Sets (HSC)',
    labelBn: 'ম্যাট্রিক্স ও সেট (HSC)',
    symbols: [
      { label: 'Matrix', latex: '\\begin{bmatrix}1 & 2\\\\3 & 4\\end{bmatrix}', code: '\\begin{bmatrix}1 & 2\\\\3 & 4\\end{bmatrix}' },
      { label: 'Column Separator (&)', latex: '\\&', code: ' & ' },
      { label: 'Row Break (\\\\)', latex: '\\backslash\\backslash', code: ' \\\\\n' },
      { label: 'Determinant', latex: '\\left|\\begin{matrix}1 & 2\\\\3 & 4\\end{matrix}\\right|', code: '\\left|\\begin{matrix}1 & 2\\\\3 & 4\\end{matrix}\\right|' },
      { label: 'Inverse Matrix', latex: 'A^{-1}', code: 'A^{-1}' },
      { label: 'Set Union', latex: 'A \\cup B', code: '\\cup' },
      { label: 'Set Intersection', latex: 'A \\cap B', code: '\\cap' },
      { label: 'Conditional Prob', latex: 'P(A|B)', code: 'P(A|B)' },
    ]
  },
  greek: {
    labelEn: 'Greek Letters',
    labelBn: 'গ্রীক অক্ষর',
    symbols: [
      { label: 'Alpha', latex: '\\alpha', code: '\\alpha' },
      { label: 'Beta', latex: '\\beta', code: '\\beta' },
      { label: 'Gamma', latex: '\\gamma', code: '\\gamma' },
      { label: 'Theta', latex: '\\theta', code: '\\theta' },
      { label: 'Lambda', latex: '\\lambda', code: '\\lambda' },
      { label: 'Pi', latex: '\\pi', code: '\\pi' },
      { label: 'Sigma', latex: '\\sigma', code: '\\sigma' },
      { label: 'Delta', latex: '\\delta', code: '\\delta' },
      { label: 'Omega', latex: '\\omega', code: '\\omega' },
      { label: 'Cap Delta', latex: '\\Delta', code: '\\Delta' },
      { label: 'Cap Sigma', latex: '\\Sigma', code: '\\Sigma' },
      { label: 'Cap Omega', latex: '\\Omega', code: '\\Omega' },
    ]
  },
  relations: {
    labelEn: 'Relations & Arithmetic',
    labelBn: 'সম্পর্ক ও পাটিগণিত',
    symbols: [
      { label: 'Equal', latex: '=', code: '=' },
      { label: 'Not Equal', latex: '\\neq', code: '\\neq' },
      { label: 'Less Than', latex: '<', code: '<' },
      { label: 'Greater Than', latex: '>', code: '>' },
      { label: 'Less or Equal', latex: '\\leq', code: '\\leq' },
      { label: 'Greater or Equal', latex: '\\geq', code: '\\geq' },
      { label: 'Approx', latex: '\\approx', code: '\\approx' },
      { label: 'Plus', latex: '+', code: '+' },
      { label: 'Minus', latex: '-', code: '-' },
      { label: 'Multiply', latex: '\\times', code: '\\times' },
      { label: 'Divide', latex: '\\div', code: '\\div' },
      { label: 'Dot Product', latex: '\\cdot', code: '\\cdot' },
    ]
  },
  calculus: {
    labelEn: 'Calculus & Stats',
    labelBn: 'ক্যালকুলাস ও পরিসংখ্যান',
    symbols: [
      { label: 'Summation', latex: '\\sum_{i=1}^{n} i', code: '\\sum_{i=1}^{n} ' },
      { label: 'Product', latex: '\\prod_{i=1}^{n} i', code: '\\prod_{i=1}^{n} ' },
      { label: 'Integral', latex: '\\int_a^b f(x)\\,dx', code: '\\int_{a}^{b} f(x)\\,dx' },
      { label: 'Double Integral', latex: '\\iint', code: '\\iint' },
      { label: 'Limit', latex: '\\lim_{x \\to 0}', code: '\\lim_{x \\to 0} ' },
      { label: 'Partial Deriv', latex: '\\partial', code: '\\partial' },
      { label: 'Infinity', latex: '\\infty', code: '\\infty' },
      { label: 'Wavelength', latex: '\\lambda', code: '\\lambda' },
      { label: 'Vector Arrow', latex: '\\vec{v}', code: '\\vec{v}' },
      { label: 'Unit Vector', latex: '\\hat{i}', code: '\\hat{i}' },
    ]
  }
};

function renderLatex(text) {
  if (!text || !text.trim()) return '';
  try {
    const rendered = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    }).replace(/\$(.*?)\$/g, (_, math) => {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    });
    return rendered;
  } catch {
    return text;
  }
}

export default function MakeContestQuestionNextTwo() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const contestData = location.state?.contestData || (() => {
    const saved = sessionStorage.getItem('cc_contestData');
    return saved ? JSON.parse(saved) : null;
  })();

  const qbankSelections = location.state?.qbankSelections || (() => {
    const saved = sessionStorage.getItem('cc_qbankSelections');
    return saved ? JSON.parse(saved) : null;
  })();

  // Persist qbankSelections when received via router state
  useEffect(() => {
    if (location.state?.qbankSelections) {
      sessionStorage.setItem('cc_qbankSelections', JSON.stringify(location.state.qbankSelections));
    }
  }, [location.state?.qbankSelections]);

  // ── UI / Confirmed State ──
  const [confirmedQuestions, setConfirmedQuestions] = useState(() => {
    const saved = sessionStorage.getItem('cc_confirmedQuestions');
    return saved ? JSON.parse(saved) : [];
  });

  const [showOptions, setShowOptions] = useState(false);

  const [activeOption, setActiveOption] = useState('');          // 'new'

  // ── Form State (Duplicated from UploadQuestion) ──
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [solutionImageUrl, setSolutionImageUrl] = useState('');
  const [questionType, setQuestionType] = useState('mcq');
  const [options, setOptions] = useState([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [showWrittenOptions, setShowWrittenOptions] = useState(false);
  const [cqParts, setCqParts] = useState([
    { label: 'a', text: '' },
    { label: 'b', text: '' },
    { label: 'c', text: '' },
    { label: 'd', text: '' },
  ]);
  const [subject, setSubject] = useState('');
  const [paper, setPaper] = useState('');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [tags, setTags] = useState([]);
  const [solution, setSolution] = useState('');
  const [cqSolutions, setCqSolutions] = useState([
    { label: 'a', text: '', imageUrl: '' },
    { label: 'b', text: '', imageUrl: '' },
    { label: 'c', text: '', imageUrl: '' },
    { label: 'd', text: '', imageUrl: '' }
  ]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Math Keyboard state
  const [focusedInput, setFocusedInput] = useState({ type: 'question', index: null });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [activeKeyboardTab, setActiveKeyboardTab] = useState('essentials');

  // ── Auth Guard ──
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { navigate('/'); return; }
    const role = localStorage.getItem('topkorbo_role');
    if (role !== 'teacher') { navigate('/dashboard'); return; }
    if (!contestData) { navigate('/make-contest-question'); return; }
  }, [navigate, contestData]);

  // Derived: available papers/chapters
  const selectedSubjectData = HSC_SUBJECTS.find(s => s.id === subject);
  const availablePapers = selectedSubjectData?.papers || [];
  const chapterKey = `${subject}__${paper}`;
  const availableChapters = CHAPTERS_MAP[chapterKey] || [];

  // Reset dependent fields on subject change
  useEffect(() => { setPaper(''); setChapter(''); setTopic(''); }, [subject]);
  useEffect(() => { setChapter(''); setTopic(''); }, [paper]);

  // ── Handlers ──
  const handleAddQuestion = () => {
    setShowOptions(prev => !prev);
  };

  const handleChooseQBank = () => {
    navigate('/make-contest-question/choose-qbank', { state: { contestData, qbankSelections } });
  };

  const handleAddNew = () => {
    setActiveOption('new');
  };

  const handleBackToOptions = () => {
    setActiveOption('');
  };

  // ── Image Upload Helpers ──
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'en' ? 'Image must be under 2MB' : 'ছবি ২ মেগাবাইটের কম হতে হবে');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageUrl('');
  };

  const handleSolutionImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'en' ? 'Image must be under 2MB' : 'ছবি ২ মেগাবাইটের কম হতে হবে');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSolutionImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeSolutionImage = () => {
    setSolutionImageUrl('');
  };

  const handleCqSolutionImageUpload = (idx, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'en' ? 'Image must be under 2MB' : 'ছবি ২ মেগাবাইটের কম হতে হবে');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCqSolutions(prev => prev.map((item, i) => i === idx ? { ...item, imageUrl: reader.result } : item));
    };
    reader.readAsDataURL(file);
  };

  const removeCqSolutionImage = (idx) => {
    setCqSolutions(prev => prev.map((item, i) => i === idx ? { ...item, imageUrl: '' } : item));
  };

  // ── LaTeX helper ──
  const insertLatexSymbol = (symbol) => {
    let textarea;
    if (focusedInput.type === 'question') {
      textarea = document.getElementById('uq-question-textarea');
    } else if (focusedInput.type === 'solution') {
      textarea = document.getElementById('uq-solution-textarea');
    } else if (focusedInput.type === 'option' && focusedInput.index !== null) {
      textarea = document.getElementById(`uq-option-input-${focusedInput.index}`);
    } else if (focusedInput.type === 'cq-part' && focusedInput.index !== null) {
      textarea = document.getElementById(`uq-cq-part-input-${focusedInput.index}`);
    } else if (focusedInput.type === 'cq-solution' && focusedInput.index !== null) {
      textarea = document.getElementById(`uq-cq-solution-textarea-${focusedInput.index}`);
    }

    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentText = textarea.value;

    const newText = currentText.substring(0, startPos) + symbol + currentText.substring(endPos);

    if (focusedInput.type === 'question') {
      setQuestionText(newText);
    } else if (focusedInput.type === 'solution') {
      setSolution(newText);
    } else if (focusedInput.type === 'option') {
      updateOption(focusedInput.index, 'text', newText);
    } else if (focusedInput.type === 'cq-part') {
      setCqParts(prev => prev.map((p, i) => i === focusedInput.index ? { ...p, text: newText } : p));
    } else if (focusedInput.type === 'cq-solution') {
      setCqSolutions(prev => prev.map((item, i) => i === focusedInput.index ? { ...item, text: newText } : item));
    }

    setTimeout(() => {
      textarea.focus();
      if (symbol === '$x$') {
        textarea.selectionStart = startPos + 1;
        textarea.selectionEnd = startPos + 2;
      } else if (symbol === '$$\n\\Sigma\n$$') {
        textarea.selectionStart = startPos + 3;
        textarea.selectionEnd = startPos + 9;
      } else {
        textarea.selectionStart = startPos + symbol.length;
        textarea.selectionEnd = startPos + symbol.length;
      }
    }, 0);
  };

  // ── MCQ option helpers ──
  const updateOption = (idx, field, value) => {
    setOptions(prev => prev.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  };

  const setCorrectOption = (idx) => {
    setOptions(prev => prev.map((o, i) => ({ ...o, isCorrect: i === idx })));
  };

  const addOption = () => {
    if (options.length < 4) setOptions(prev => [...prev, { text: '', isCorrect: false }]);
  };

  const removeOption = (idx) => {
    if (options.length <= 2) return;
    setOptions(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      if (!updated.some(o => o.isCorrect)) updated[0].isCorrect = true;
      return updated;
    });
  };

  // ── Tag helpers ──
  const addTag = (category) => {
    if (category === 'board') {
      setTags(prev => [...prev, { category: 'board', board: '', year: '' }]);
    } else if (category === 'college') {
      setTags(prev => [...prev, { category: 'college', college: '', year: '' }]);
    } else {
      setTags(prev => [...prev, { category: 'admission', university: '', unit: '', year: '', shift: '' }]);
    }
  };

  const updateTag = (idx, field, value) => {
    setTags(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      const updated = { ...t, [field]: value };
      if (field === 'university') updated.unit = '';
      return updated;
    }));
  };

  const removeTag = (idx) => {
    setTags(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Confirm / Upload Question ──
  const handleConfirmQuestion = async () => {
    // Validation
    if (!questionText.trim()) { toast.error(language === 'en' ? 'Question text is required' : 'প্রশ্নের টেক্সট আবশ্যক'); return; }
    if (!subject) { toast.error(language === 'en' ? 'Subject is required' : 'বিষয় আবশ্যক'); return; }
    if (!paper) { toast.error(language === 'en' ? 'Paper is required' : 'পত্র আবশ্যক'); return; }
    if (!chapter) { toast.error(language === 'en' ? 'Chapter is required' : 'অধ্যায় আবশ্যক'); return; }
    if (!topic.trim()) { toast.error(language === 'en' ? 'Topic is required' : 'টপিক আবশ্যক'); return; }

    if (questionType === 'mcq' || (questionType === 'written' && showWrittenOptions)) {
      const validOpts = options.filter(o => o.text.trim());
      if (validOpts.length < 2) { toast.error(language === 'en' ? 'At least 2 options are required' : 'কমপক্ষে ২টি অপশন আবশ্যক'); return; }
      if (!validOpts.some(o => o.isCorrect)) { toast.error(language === 'en' ? 'At least one correct option is required' : 'কমপক্ষে একটি সঠিক অপশন আবশ্যক'); return; }
    }

    if (questionType === 'cq') {
      const filledParts = cqParts.filter(p => p.text.trim());
      if (filledParts.length < 4) { toast.error(language === 'en' ? 'All 4 parts are required' : 'সব ৪টি অংশ পূরণ করা আবশ্যক'); return; }
    }

    setIsSubmitting(true);
    try {
      // Create full question details locally for temporary saving
      const newQ = {
        id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        questionText: questionText.trim(),
        imageUrl: imageUrl || '',
        type: questionType,
        options: (questionType === 'mcq' || (questionType === 'written' && showWrittenOptions))
          ? options.filter(o => o.text.trim()).map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect }))
          : [],
        cq: questionType === 'cq' ? {
          description: questionText.trim(),
          parts: cqParts.map(p => ({ label: p.label, text: p.text.trim() }))
        } : undefined,
        subject,
        paper,
        chapter,
        topic: topic.trim(),
        solution: questionType === 'cq' ? JSON.stringify(cqSolutions) : solution.trim(),
        solutionImageUrl: questionType === 'cq' ? '' : (solutionImageUrl || ''),
        tags: tags.filter(t => {
          if (t.category === 'board') return t.board && t.year;
          if (t.category === 'college') return t.college && t.year;
          return t.university && t.year;
        })
      };

      const updated = [...confirmedQuestions, newQ];
      setConfirmedQuestions(updated);
      sessionStorage.setItem('cc_confirmedQuestions', JSON.stringify(updated));

      // Reset form
      setQuestionText('');
      setImageUrl('');
      setSolution('');
      setSolutionImageUrl('');
      setOptions([
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ]);
      setShowWrittenOptions(false);
      setCqParts([
        { label: 'a', text: '' },
        { label: 'b', text: '' },
        { label: 'c', text: '' },
        { label: 'd', text: '' },
      ]);
      setCqSolutions([
        { label: 'a', text: '', imageUrl: '' },
        { label: 'b', text: '', imageUrl: '' },
        { label: 'c', text: '', imageUrl: '' },
        { label: 'd', text: '', imageUrl: '' }
      ]);
      setSubject('');
      setPaper('');
      setChapter('');
      setTopic('');
      setTags([]);

      // Back to options
      setActiveOption('');
      setShowOptions(true);
      toast.success(language === 'en' ? 'Question saved temporarily!' : 'প্রশ্ন সাময়িক ড্রাফট হিসেবে সংরক্ষিত হয়েছে!');
    } catch (err) {
      console.error(err);
      toast.error(language === 'en' ? 'Error saving question.' : 'প্রশ্ন সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveConfirmedQuestion = (index) => {
    const updated = confirmedQuestions.filter((_, idx) => idx !== index);
    setConfirmedQuestions(updated);
    sessionStorage.setItem('cc_confirmedQuestions', JSON.stringify(updated));
    toast.success(language === 'en' ? 'Question removed.' : 'প্রশ্ন মুছে ফেলা হয়েছে।');
  };

  const handleConfirmContestQuestion = () => {
    navigate('/make-contest-question/confirm', {
      state: {
        contestData,
        confirmedQuestions,
        qbankSelections
      }
    });
  };

  return (
    <div className="cc-page">
      <Sidebar activeTab="make-contest-question" user={user} />

      <main className="cc-page__content">
        {/* ── Page Header ── */}
        <div className="cc-page__header">
          <div className="cc-page__badge">
            <span className="cc-page__badge-dot"></span>
            Step 2: Add Questions
          </div>
          <h1 className="cc-page__title">
            {language === 'en' ? 'Create Questions' : 'প্রশ্ন তৈরি করুন'}
          </h1>
          <p className="cc-page__subtitle">
            {language === 'en'
              ? 'Add questions to your contest from the question bank or create new ones.'
              : 'প্রশ্ন ব্যাংক থেকে অথবা নতুন প্রশ্ন তৈরি করে আপনার কনটেস্টে প্রশ্ন যোগ করুন।'}
          </p>
        </div>

        {/* ── Content ── */}
        <div className="cc-form">

          {/* ═══════ Confirmed Questions List ═══════ */}
          {confirmedQuestions.length > 0 && !activeOption && (
            <section className="cc-section cq-confirmed-list-section cq-section--animated">
              <div className="cq-options-header" style={{ marginBottom: '1.25rem' }}>
                <h3 className="cc-section__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  📝 {language === 'en' ? 'Uploaded Questions' : 'আপলোডকৃত প্রশ্নসমূহ'}
                </h3>
                <p className="cc-section__desc" style={{ marginTop: '0.25rem' }}>
                  {language === 'en'
                    ? 'Review the questions you have added to this contest so far.'
                    : 'আপনার কনটেস্টে এ পর্যন্ত যোগ করা প্রশ্নসমূহ দেখে নিন।'}
                </p>
              </div>

              <div className="cq-confirmed-questions-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {confirmedQuestions.map((q, idx) => (
                  <div key={q.id || idx} className="cq-confirmed-question-card" style={{
                    background: '#FFFBF7',
                    border: '1.5px solid rgba(192, 133, 82, 0.2)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    position: 'relative',
                    boxShadow: '0 4px 15px rgba(192, 133, 82, 0.04)'
                  }}>
                    {/* Header: Question Number & Delete Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{
                        background: 'rgba(192, 133, 82, 0.15)',
                        color: '#8C5A3C',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        padding: '0.3rem 0.8rem',
                        borderRadius: '20px',
                        letterSpacing: '0.5px'
                      }}>
                        {language === 'en' ? `Question ${idx + 1}` : `প্রশ্ন ${idx + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveConfirmedQuestion(idx)}
                        style={{
                          background: 'rgba(220, 50, 50, 0.08)',
                          color: '#DC3232',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 50, 50, 0.15)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220, 50, 50, 0.08)' }}
                      >
                        <HiX size={14} />
                        {language === 'en' ? 'Remove' : 'মুছে ফেলুন'}
                      </button>
                    </div>

                    {/* Question Text */}
                    {(q.questionText || q.text) && (
                      <p style={{
                        margin: '0 0 1rem 0',
                        fontSize: '0.95rem',
                        color: 'var(--text-primary)',
                        lineHeight: '1.6',
                        fontWeight: '500',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {q.questionText || q.text}
                      </p>
                    )}

                    {/* Question Images */}
                    {(q.imageUrl || (q.images && q.images.length > 0)) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {[q.imageUrl || q.images?.[0]].filter(Boolean).map((imgSrc, imgIdx) => (
                          <div key={imgIdx} style={{
                            width: '140px',
                            height: '100px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1.5px solid rgba(192, 133, 82, 0.15)',
                            background: '#fff'
                          }}>
                            <img src={imgSrc} alt={`Question ${idx + 1} Image ${imgIdx + 1}`} style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══════ Combined Add Question & Options Section (Always visible when not editing) ═══════ */}
          {!activeOption && (
            <section className="cc-section cq-add-section" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: showOptions ? '1.5rem' : '0',
              padding: showOptions ? '1.5rem' : '1rem 0.5rem',
              transition: 'all 0.3s ease'
            }}>
              {/* Trigger Header */}
              <div 
                className="cq-add-trigger" 
                onClick={handleAddQuestion} 
                style={{ cursor: 'pointer', padding: 0 }}
              >
                <div className="cq-add-trigger__icon">
                  <HiPlusCircle size={32} />
                </div>
                <div className="cq-add-trigger__text">
                  <h3>{language === 'en' ? 'Add Question' : 'প্রশ্ন যোগ করুন'}</h3>
                  <p>{language === 'en'
                    ? 'Click here to add a question to your contest'
                    : 'আপনার কনটেস্টে প্রশ্ন যোগ করতে এখানে ক্লিক করুন'}</p>
                </div>
              </div>

              {/* Collapsible Options Body */}
              {showOptions && (
                <div className="cq-options-combined-body" style={{
                  borderTop: '1.5px solid rgba(192, 133, 82, 0.15)',
                  paddingTop: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  animation: 'cqExpandIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
                }}>
                  <div className="cq-options-header" style={{ marginBottom: 0 }}>
                    <h3 className="cc-section__title" style={{ margin: 0, fontSize: '1.1rem' }}>
                      {language === 'en' ? 'How would you like to add a question?' : 'আপনি কিভাবে প্রশ্ন যোগ করতে চান?'}
                    </h3>
                    <p className="cc-section__desc" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                      {language === 'en'
                        ? 'Choose from existing questions or create a new one.'
                        : 'বিদ্যমান প্রশ্ন থেকে বেছে নিন অথবা একটি নতুন তৈরি করুন।'}
                    </p>
                  </div>

                  <div className="cq-options-grid">
                    {/* Option 1: Choose from Question Bank */}
                    <button type="button" className="cq-option-card" onClick={handleChooseQBank}>
                      <div className="cq-option-card__icon">
                        <HiBookOpen size={28} />
                      </div>
                      <h4 className="cq-option-card__title">
                        {language === 'en' ? 'Choose from Question Bank' : 'প্রশ্ন ব্যাংক থেকে বেছে নিন'}
                      </h4>
                      <p className="cq-option-card__desc">
                        {language === 'en'
                          ? 'Browse and select from your existing question library'
                          : 'আপনার বিদ্যমান প্রশ্ন লাইব্রেরি ব্রাউজ করুন এবং নির্বাচন করুন'}
                      </p>
                    </button>

                    {/* Option 2: Upload New Question */}
                    <button type="button" className="cq-option-card" onClick={handleAddNew}>
                      <div className="cq-option-card__icon cq-option-card__icon--new">
                        <HiPencilAlt size={28} />
                      </div>
                      <h4 className="cq-option-card__title">
                        {language === 'en' ? 'Upload New Question' : 'নতুন প্রশ্ন আপলোড করুন'}
                      </h4>
                      <p className="cq-option-card__desc">
                        {language === 'en'
                          ? 'Write a new question with options, solutions, and tags'
                          : 'অপশন, সমাধান এবং ট্যাগ সহ একটি নতুন প্রশ্ন তৈরি করুন'}
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ═══════ Selected Question Bank Chapters ═══════ */}
          {qbankSelections && qbankSelections.length > 0 && (
            <section className="cc-section cq-selection-summary-card">
              <div className="cq-section-top-bar" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="cc-section__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  📚 {language === 'en' ? 'Selected Chapters' : 'নির্বাচিত অধ্যায়সমূহ'}
                </h3>
                <button
                  type="button"
                  className="cq-back-btn"
                  onClick={handleChooseQBank}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1.5px solid rgba(192, 133, 82, 0.25)', borderRadius: '8px', background: '#FFFBF7', color: '#8C5A3C' }}
                >
                  ✏️ {language === 'en' ? 'Edit Selection' : 'পরিবর্তন করুন'}
                </button>
              </div>

              <div className="cq-selected-chapters-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {qbankSelections.map((sel, idx) => (
                  <div key={idx} style={{
                    background: '#FFFBF7',
                    border: '1.2px solid rgba(192, 133, 82, 0.15)',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 800, color: '#8C5A3C', fontSize: '0.95rem' }}>
                        {sel.subject} ({sel.paper === '1st' ? (language === 'en' ? '1st paper' : '১ম পত্র') : (language === 'en' ? '2nd paper' : '২য় পত্র')})
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {sel.chapters.map((ch, cidx) => (
                        <span key={cidx} style={{
                          background: 'rgba(192, 133, 82, 0.08)',
                          border: '1px solid rgba(192, 133, 82, 0.15)',
                          borderRadius: '999px',
                          padding: '0.3rem 0.8rem',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#8C5A3C',
                        }}>
                          {ch.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══════ Option 2 Expanded: Upload New Question ═══════ */}
          {activeOption === 'new' && (
            <div className="uq-workspace" style={{ padding: 0, border: 'none', background: 'transparent', width: '100%', boxSizing: 'border-box' }}>
              <div className="cq-section-top-bar" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button type="button" className="cq-back-btn" onClick={handleBackToOptions}>
                  <HiArrowLeft size={16} />
                  {language === 'en' ? 'Back' : 'ফিরে যান'}
                </button>
                <h3 className="cc-section__title" style={{ margin: 0 }}>
                  ✏️ {language === 'en' ? 'Upload New Question' : 'নতুন প্রশ্ন আপলোড করুন'}
                </h3>
              </div>

              {/* ── Section 1: Question Type ── */}
              <div className="uq-section">
                <div className="uq-section__title">
                  <span className="uq-section__title-icon"><HiClipboardList size={18} /></span>
                  {t('uq.section.type')}
                </div>
                <p className="uq-section__desc">{t('uq.section.type.desc')}</p>
                <div className="uq-type-toggle">
                  <button
                    type="button"
                    className={`uq-type-btn ${questionType === 'mcq' ? 'uq-type-btn--active' : ''}`}
                    onClick={() => setQuestionType('mcq')}
                  >
                    <HiClipboardList size={18} />
                    {t('uq.type.mcq')}
                  </button>
                  <button
                    type="button"
                    className={`uq-type-btn ${questionType === 'written' ? 'uq-type-btn--active' : ''}`}
                    onClick={() => setQuestionType('written')}
                  >
                    <HiPencilAlt size={18} />
                    {t('uq.type.written')}
                  </button>
                  <button
                    type="button"
                    className={`uq-type-btn ${questionType === 'cq' ? 'uq-type-btn--active' : ''}`}
                    onClick={() => setQuestionType('cq')}
                  >
                    <HiLightBulb size={18} />
                    {t('uq.type.cq')}
                  </button>
                </div>
              </div>

              {/* ── Section 2: Question Text (LaTeX Editor) ── */}
              <div className="uq-section">
                <div className="uq-section__title">
                  <span className="uq-section__title-icon"><HiDocumentText size={18} /></span>
                  {t('uq.section.question')}
                </div>
                <p className="uq-section__desc">{t('uq.section.question.desc')}</p>
                <div className="uq-latex-editor">
                  <div className="uq-editor-row">
                    <div className="uq-editor-row__textarea-col">
                      <textarea
                        id="uq-question-textarea"
                        className="uq-textarea"
                        value={questionText}
                        onChange={e => setQuestionText(e.target.value)}
                        onFocus={() => setFocusedInput({ type: 'question', index: null })}
                        placeholder={t('uq.question.placeholder')}
                        rows={6}
                      />
                    </div>
                    <div className="uq-editor-row__upload-col">
                      {imageUrl ? (
                        <div className="uq-diagram-preview-card animate-bounce-in">
                          <img src={imageUrl} alt="Uploaded Diagram" className="uq-diagram-preview-img" />
                          <button
                            type="button"
                            className="uq-diagram-remove-btn"
                            onClick={removeImage}
                            title={language === 'en' ? 'Remove Diagram' : 'ডায়াগ্রাম মুছুন'}
                          >
                            <HiTrash size={16} />
                            <span>{language === 'en' ? 'Remove' : 'মুছুন'}</span>
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="uq-diagram-upload" className="uq-diagram-upload-dropzone">
                          <input
                            type="file"
                            id="uq-diagram-upload"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                          />
                          <span className="uq-diagram-upload-icon"><HiUpload size={24} /></span>
                          <span className="uq-diagram-upload-text">
                            {language === 'en'
                              ? (focusedInput.type === 'question'
                                  ? 'Active Input: Question Text'
                                  : focusedInput.type === 'solution'
                                    ? 'Active Input: Solution'
                                    : focusedInput.type === 'cq-part'
                                      ? 'Active Input: CQ Sub-question'
                                      : focusedInput.type === 'cq-solution'
                                        ? 'Active Input: CQ Solution'
                                        : 'Active Input: MCQ Option')
                              : (focusedInput.type === 'question'
                                  ? 'সক্রিয় ইনপুট: প্রশ্নের টেক্সট'
                                  : focusedInput.type === 'solution'
                                    ? 'সক্রিয় ইনপুট: সমাধান ব্যাখ্যা'
                                    : focusedInput.type === 'cq-part'
                                      ? 'সক্রিয় ইনপুট: CQ উপ-প্রশ্ন'
                                      : focusedInput.type === 'cq-solution'
                                        ? 'সক্রিয় ইনপুট: CQ সমাধান ব্যাখ্যা'
                                        : 'সক্রিয় ইনপুট: MCQ অপশন')}
                          </span>
                          <span className="uq-diagram-upload-subtext">
                            {language === 'en' ? 'PNG, JPG up to 2MB' : 'সর্বোচ্চ ২ মেগাবাইট'}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>

                  <span className="uq-preview-label">{t('uq.preview')}</span>
                  <div
                    className={`uq-preview-box ${!questionText.trim() && !imageUrl ? 'uq-preview-box--empty' : ''}`}
                  >
                    {imageUrl && (
                      <div className="uq-preview-diagram-wrapper">
                        <img src={imageUrl} alt="Diagram" className="uq-preview-diagram" />
                      </div>
                    )}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: questionText.trim()
                          ? renderLatex(questionText)
                          : (language === 'en' ? 'LaTeX preview will appear here…' : 'LaTeX প্রিভিউ এখানে দেখা যাবে…')
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Section: Written Options Toggle (conditional) ── */}
              {questionType === 'written' && (
                <div className="uq-section">
                  <div className="uq-section__title">
                    <span className="uq-section__title-icon"><HiClipboardList size={18} /></span>
                    {language === 'en' ? 'Descriptive Options' : 'বর্ণনামূলক অপশন'}
                  </div>
                  <p className="uq-section__desc">
                    {language === 'en' 
                      ? 'Would you like to include multiple choice options for this descriptive/written question?' 
                      : 'আপনি কি এই বর্ণনামূলক/লিখিত প্রশ্নের সাথে বহুনির্বাচনী অপশন যুক্ত করতে চান?'}
                  </p>
                  <div style={{ marginTop: '12px' }}>
                    <label className="uq-correct-radio" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showWrittenOptions}
                        onChange={e => setShowWrittenOptions(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--sky-blue)', cursor: 'pointer' }}
                      />
                      <span>
                        {language === 'en' ? 'Add multiple choice options (MCQ)' : 'বহুনির্বাচনী অপশন (MCQ) যুক্ত করুন'}
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* ── Section 3: CQ Sub-questions (conditional) ── */}
              {questionType === 'cq' && (
                <div className="uq-section">
                  <div className="uq-section__title">
                    <span className="uq-section__title-icon"><HiLightBulb size={18} /></span>
                    {t('uq.section.cq')}
                  </div>
                  <p className="uq-section__desc">{t('uq.section.cq.desc')}</p>
                  <div className="uq-options-grid">
                    {cqParts.map((part, idx) => (
                      <div key={part.label} className="uq-option-row">
                        <span className="uq-option-letter">{part.label.toUpperCase()}</span>
                        <div className="uq-option-content">
                          <input
                            type="text"
                            id={`uq-cq-part-input-${idx}`}
                            className="uq-option-input"
                            value={part.text}
                            onChange={e => setCqParts(prev => prev.map((p, i) => i === idx ? { ...p, text: e.target.value } : p))}
                            onFocus={() => setFocusedInput({ type: 'cq-part', index: idx })}
                            placeholder={`${t('uq.cq.part.placeholder')} ${part.label.toUpperCase()}`}
                          />
                          {part.text.trim() && (
                            <div
                              className="uq-option-preview"
                              dangerouslySetInnerHTML={{ __html: renderLatex(part.text) }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Section 3: MCQ Options (conditional) ── */}
              {(questionType === 'mcq' || (questionType === 'written' && showWrittenOptions)) && (
                <div className="uq-section">
                  <div className="uq-section__title">
                    <span className="uq-section__title-icon"><HiCheckCircle size={18} /></span>
                    {t('uq.section.options')}
                  </div>
                  <p className="uq-section__desc">{t('uq.section.options.desc')}</p>
                  <div className="uq-options-grid">
                    {options.map((opt, idx) => (
                      <div key={idx} className={`uq-option-row ${opt.isCorrect ? 'uq-option-row--correct' : ''}`}>
                        <span className="uq-option-letter">{String.fromCharCode(65 + idx)}</span>
                        <div className="uq-option-content">
                          <input
                            type="text"
                            id={`uq-option-input-${idx}`}
                            className="uq-option-input"
                            value={opt.text}
                            onChange={e => updateOption(idx, 'text', e.target.value)}
                            onFocus={() => setFocusedInput({ type: 'option', index: idx })}
                            placeholder={`${t('uq.option.placeholder')} ${String.fromCharCode(65 + idx)}`}
                          />
                          {opt.text.trim() && (
                            <div
                              className="uq-option-preview"
                              dangerouslySetInnerHTML={{ __html: renderLatex(opt.text) }}
                            />
                          )}
                        </div>
                        <div className="uq-option-actions">
                          <label className="uq-correct-radio">
                            <input
                              type="radio"
                              name="correct-option"
                              checked={opt.isCorrect}
                              onChange={() => setCorrectOption(idx)}
                            />
                            {t('uq.option.correct')}
                          </label>
                          {options.length > 2 && (
                            <button
                              type="button"
                              className="uq-option-remove-btn"
                              onClick={() => removeOption(idx)}
                              title={t('uq.option.remove')}
                            >
                              <HiTrash size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {options.length < 4 && (
                      <button type="button" className="uq-add-option-btn" onClick={addOption}>
                        <HiPlus size={16} />
                        {t('uq.option.add')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Section: Solution Explanation (LaTeX Editor) ── */}
              <div className="uq-section animate-fade-in">
                <div className="uq-section__title">
                  <span className="uq-section__title-icon"><HiLightBulb size={18} /></span>
                  {language === 'en' ? 'Solution Explanation' : 'সমাধান ব্যাখ্যা'}
                </div>
                <p className="uq-section__desc">
                  {language === 'en'
                    ? 'Provide a step-by-step solution to help students. LaTeX formulas ($x$ and $$x$$) are fully supported. You may also attach an image of the worked solution.'
                    : 'শিক্ষার্থীদের বোঝার জন্য ধাপে ধাপে সমাধান ব্যাখ্যা প্রদান করুন। LaTeX ফর্মুলা ($x$ এবং $$x$$) সমর্থন করে। আপনি চাইলে সমাধানের একটি ছবিও সংযুক্ত করতে পারেন।'}
                </p>
                {questionType === 'cq' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {cqSolutions.map((item, idx) => (
                      <div key={item.label} className="uq-latex-editor" style={{ border: '1.5px dashed rgba(192, 133, 82, 0.25)', borderRadius: '12px', padding: '1.5rem', background: 'rgba(255, 251, 247, 0.5)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                          <span style={{
                            background: '#8C5A3C',
                            color: '#fff',
                            fontWeight: '800',
                            fontSize: '0.9rem',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textTransform: 'uppercase'
                          }}>{item.label}</span>
                          <span style={{ fontWeight: '700', color: '#8C5A3C' }}>
                            {language === 'en' ? `Solution for Sub-question ${item.label.toUpperCase()}` : `উপ-প্রশ্ন ${item.label.toUpperCase()} এর সমাধান`}
                          </span>
                        </div>
                        <div className="uq-editor-row">
                          <div className="uq-editor-row__textarea-col">
                            <textarea
                              id={`uq-cq-solution-textarea-${idx}`}
                              className="uq-textarea"
                              value={item.text}
                              onChange={e => setCqSolutions(prev => prev.map((sol, i) => i === idx ? { ...sol, text: e.target.value } : sol))}
                              onFocus={() => setFocusedInput({ type: 'cq-solution', index: idx })}
                              placeholder={language === 'en' ? `Type solution for part ${item.label.toUpperCase()}...` : `উপ-প্রশ্ন ${item.label.toUpperCase()} এর সমাধান এখানে টাইপ করুন...`}
                              rows={4}
                            />
                          </div>
                          <div className="uq-editor-row__upload-col">
                            {item.imageUrl ? (
                              <div className="uq-diagram-preview-card animate-bounce-in">
                                <img src={item.imageUrl} alt={`Solution Part ${item.label.toUpperCase()}`} className="uq-diagram-preview-img" />
                                <button
                                  type="button"
                                  className="uq-diagram-remove-btn"
                                  onClick={() => removeCqSolutionImage(idx)}
                                  title={language === 'en' ? 'Remove Image' : 'ছবি মুছুন'}
                                >
                                  <HiTrash size={16} />
                                  <span>{language === 'en' ? 'Remove' : 'মুছুন'}</span>
                                </button>
                              </div>
                            ) : (
                              <label htmlFor={`uq-cq-solution-image-upload-${idx}`} className="uq-diagram-upload-dropzone">
                                <input
                                  type="file"
                                  id={`uq-cq-solution-image-upload-${idx}`}
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  onChange={e => handleCqSolutionImageUpload(idx, e)}
                                />
                                <span className="uq-diagram-upload-icon"><HiUpload size={24} /></span>
                                <span className="uq-diagram-upload-text">
                                  {language === 'en'
                                    ? `Upload Solution Image (${item.label.toUpperCase()})`
                                    : `সমাধানের ছবি আপলোড করুন (${item.label.toUpperCase()})`}
                                </span>
                                <span className="uq-diagram-upload-subtext">
                                  {language === 'en' ? 'PNG, JPG up to 2MB' : 'সর্বোচ্চ ২ মেগাবাইট'}
                                </span>
                              </label>
                            )}
                          </div>
                        </div>

                        <span className="uq-preview-label">{t('uq.preview')}</span>
                        <div
                          className={`uq-preview-box ${!item.text.trim() && !item.imageUrl ? 'uq-preview-box--empty' : ''}`}
                        >
                          {item.imageUrl && (
                            <div className="uq-preview-diagram-wrapper">
                              <img src={item.imageUrl} alt={`Solution ${item.label.toUpperCase()}`} className="uq-preview-diagram" />
                            </div>
                          )}
                          <div
                            dangerouslySetInnerHTML={{
                              __html: item.text.trim()
                                ? renderLatex(item.text)
                                : (language === 'en' ? `LaTeX preview of solution ${item.label.toUpperCase()} will appear here…` : `সমাধান ${item.label.toUpperCase()} এর LaTeX প্রিভিউ এখানে দেখা যাবে…`)
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="uq-latex-editor">
                    <div className="uq-editor-row">
                      <div className="uq-editor-row__textarea-col">
                        <textarea
                          id="uq-solution-textarea"
                          className="uq-textarea"
                          value={solution}
                          onChange={e => setSolution(e.target.value)}
                          onFocus={() => setFocusedInput({ type: 'solution', index: null })}
                          placeholder={language === 'en' ? 'Type step-by-step solution explanation here...' : 'এখানে সমাধান ব্যাখ্যা টাইপ করুন...'}
                          rows={6}
                        />
                      </div>
                      <div className="uq-editor-row__upload-col">
                        {solutionImageUrl ? (
                          <div className="uq-diagram-preview-card animate-bounce-in">
                            <img src={solutionImageUrl} alt="Solution Image" className="uq-diagram-preview-img" />
                            <button
                              type="button"
                              className="uq-diagram-remove-btn"
                              onClick={removeSolutionImage}
                              title={language === 'en' ? 'Remove Solution Image' : 'সমাধানের ছবি মুছুন'}
                            >
                              <HiTrash size={16} />
                              <span>{language === 'en' ? 'Remove' : 'মুছুন'}</span>
                            </button>
                          </div>
                        ) : (
                          <label htmlFor="uq-solution-image-upload" className="uq-diagram-upload-dropzone">
                            <input
                              type="file"
                              id="uq-solution-image-upload"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handleSolutionImageUpload}
                            />
                            <span className="uq-diagram-upload-icon"><HiUpload size={24} /></span>
                            <span className="uq-diagram-upload-text">
                              {language === 'en'
                                ? 'Upload solution image (optional)'
                                : 'সমাধানের ছবি আপলোড করুন (ঐচ্ছিক)'}
                            </span>
                            <span className="uq-diagram-upload-subtext">
                              {language === 'en' ? 'PNG, JPG up to 2MB' : 'সর্বোচ্চ ২ মেগাবাইট'}
                            </span>
                          </label>
                        )}
                      </div>
                    </div>

                    <span className="uq-preview-label">{t('uq.preview')}</span>
                    <div
                      className={`uq-preview-box ${!solution.trim() && !solutionImageUrl ? 'uq-preview-box--empty' : ''}`}
                    >
                      {solutionImageUrl && (
                        <div className="uq-preview-diagram-wrapper">
                          <img src={solutionImageUrl} alt="Solution" className="uq-preview-diagram" />
                        </div>
                      )}
                      <div
                        dangerouslySetInnerHTML={{
                          __html: solution.trim()
                            ? renderLatex(solution)
                            : (language === 'en' ? 'LaTeX preview of the solution explanation will appear here…' : 'সমাধান ব্যাখ্যার LaTeX প্রিভিউ এখানে দেখা যাবে…')
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section 4: Subject / Paper / Chapter / Topic ── */}
              <div className="uq-section">
                <div className="uq-section__title">
                  <span className="uq-section__title-icon"><HiUpload size={18} /></span>
                  {t('uq.section.classification')}
                </div>
                <p className="uq-section__desc">{t('uq.section.classification.desc')}</p>
                <div className="uq-form-grid">
                  {/* Subject */}
                  <div className="uq-form-group">
                    <label className="uq-label">{t('uq.field.subject')}</label>
                    <select className="uq-select" value={subject} onChange={e => setSubject(e.target.value)}>
                      <option value="">{t('uq.field.subject.placeholder')}</option>
                      {HSC_SUBJECTS.map(s => (
                        <option key={s.id} value={s.id}>{language === 'en' ? s.labelEn : s.labelBn}</option>
                      ))}
                    </select>
                  </div>

                  {/* Paper */}
                  <div className="uq-form-group">
                    <label className="uq-label">{t('uq.field.paper')}</label>
                    <select
                      className="uq-select"
                      value={paper}
                      onChange={e => setPaper(e.target.value)}
                      disabled={!subject}
                    >
                      <option value="">{t('uq.field.paper.placeholder')}</option>
                      {availablePapers.map(p => (
                        <option key={p} value={p}>
                          {p === '1st' ? (language === 'en' ? '1st Paper' : '১ম পত্র') : (language === 'en' ? '2nd Paper' : '২য় পত্র')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Chapter */}
                  <div className="uq-form-group">
                    <label className="uq-label">{t('uq.field.chapter')}</label>
                    <select
                      className="uq-select"
                      value={chapter}
                      onChange={e => setChapter(e.target.value)}
                      disabled={!paper || availableChapters.length === 0}
                    >
                      <option value="">{t('uq.field.chapter.placeholder')}</option>
                      {availableChapters.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Topic */}
                  <div className="uq-form-group">
                    <label className="uq-label">{t('uq.field.topic')}</label>
                    <input
                      type="text"
                      className="uq-input"
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      placeholder={t('uq.field.topic.placeholder')}
                    />
                  </div>
                </div>
              </div>

              {/* ── Section 5: Tags ── */}
              <div className="uq-section">
                <div className="uq-section__title">
                  <span className="uq-section__title-icon"><HiPlus size={18} /></span>
                  {t('uq.section.tags')}
                </div>
                <p className="uq-section__desc">{t('uq.section.tags.desc')}</p>
                <div className="uq-tags-container">
                  {tags.map((tag, idx) => (
                    <div key={idx} className="uq-tag-card">
                      <span className={`uq-tag-badge uq-tag-badge--${tag.category}`}>
                        {tag.category === 'board'
                          ? (language === 'en' ? 'Board' : 'বোর্ড')
                          : tag.category === 'college'
                            ? (language === 'en' ? 'College' : 'কলেজ')
                            : (language === 'en' ? 'Admission' : 'ভর্তি')}
                      </span>
                      <div className="uq-tag-fields">
                        {tag.category === 'board' ? (
                          <>
                            <select className="uq-select" value={tag.board} onChange={e => updateTag(idx, 'board', e.target.value)}>
                              <option value="">{language === 'en' ? 'Select Board' : 'বোর্ড নির্বাচন করুন'}</option>
                              {BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <select className="uq-select" value={tag.year} onChange={e => updateTag(idx, 'year', e.target.value)}>
                              <option value="">{language === 'en' ? 'Year' : 'সাল'}</option>
                              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </>
                        ) : tag.category === 'college' ? (
                          <>
                            <select className="uq-select" value={tag.college} onChange={e => updateTag(idx, 'college', e.target.value)}>
                              <option value="">{language === 'en' ? 'Select College' : 'কলেজ নির্বাচন করুন'}</option>
                              {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select className="uq-select" value={tag.year} onChange={e => updateTag(idx, 'year', e.target.value)}>
                              <option value="">{language === 'en' ? 'Year' : 'সাল'}</option>
                              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </>
                        ) : (
                          <>
                            <select className="uq-select" value={tag.university} onChange={e => updateTag(idx, 'university', e.target.value)}>
                              <option value="">{language === 'en' ? 'University' : 'বিশ্ববিদ্যালয়'}</option>
                              {UNIVERSITIES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                            <select
                              className="uq-select"
                              value={tag.unit}
                              onChange={e => updateTag(idx, 'unit', e.target.value)}
                              disabled={!tag.university}
                            >
                              <option value="">{language === 'en' ? 'Unit' : 'ইউনিট'}</option>
                              {(UNIVERSITIES.find(u => u.id === tag.university)?.units || []).map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                            <select className="uq-select" value={tag.year} onChange={e => updateTag(idx, 'year', e.target.value)}>
                              <option value="">{language === 'en' ? 'Session' : 'সেশন'}</option>
                              {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input
                              type="text"
                              className="uq-select"
                              value={tag.shift || ''}
                              onChange={e => updateTag(idx, 'shift', e.target.value)}
                              placeholder={language === 'en' ? 'Shift / Group (optional)' : 'শিফট / গ্রুপ (ঐচ্ছিক)'}
                              style={{ minWidth: '140px' }}
                            />
                          </>
                        )}
                      </div>
                      <button type="button" className="uq-tag-remove-btn" onClick={() => removeTag(idx)} title="Remove tag">
                        <HiX size={16} />
                      </button>
                    </div>
                  ))}

                  {/* Add tag buttons */}
                  <div className="uq-add-tag-row">
                    <button type="button" className="uq-add-tag-btn uq-add-tag-btn--board" onClick={() => addTag('board')}>
                      <HiPlus size={14} />
                      {t('uq.tag.add_board')}
                    </button>
                    <button type="button" className="uq-add-tag-btn uq-add-tag-btn--college" onClick={() => addTag('college')}>
                      <HiPlus size={14} />
                      {t('uq.tag.add_college')}
                    </button>
                    <button type="button" className="uq-add-tag-btn uq-add-tag-btn--admission" onClick={() => addTag('admission')}>
                      <HiPlus size={14} />
                      {t('uq.tag.add_admission')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Submit/Back bar ── */}
          <div className="cc-submit-bar" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
            <button
              type="button"
              onClick={() => {
                if (activeOption === 'new') {
                  handleBackToOptions();
                } else {
                  navigate('/make-contest-question', { state: { contestData } });
                }
              }}
              className="cc-submit-btn"
              style={{
                background: 'transparent',
                border: '2px solid rgba(192, 133, 82, 0.4)',
                color: '#8C5A3C',
                boxShadow: 'none',
                padding: '0.8rem 2rem'
              }}
            >
              <HiArrowLeft size={18} />
              {language === 'en' ? 'Back' : 'ফিরে যান'}
            </button>

            {activeOption === 'new' && (
              <button
                type="button"
                onClick={handleConfirmQuestion}
                disabled={isSubmitting}
                className="cc-submit-btn cq-confirm-btn"
                style={{
                  background: '#C08552',
                  border: 'none',
                  color: '#fff',
                  padding: '0.8rem 2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(192, 133, 82, 0.2)'
                }}
              >
                <HiCheckCircle size={20} />
                {isSubmitting 
                  ? (language === 'en' ? 'Uploading...' : 'আপলোড হচ্ছে...')
                  : (language === 'en' ? 'Upload & Confirm Question' : 'আপলোড এবং প্রশ্ন নিশ্চিত করুন')}
              </button>
            )}

            {!activeOption && (confirmedQuestions.length > 0 || (qbankSelections && qbankSelections.length > 0)) && (
              <button
                type="button"
                onClick={handleConfirmContestQuestion}
                className="cc-submit-btn cq-create-contest-btn"
                style={{
                  background: '#8C5A3C',
                  border: 'none',
                  color: '#fff',
                  padding: '0.8rem 2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(140, 90, 60, 0.2)'
                }}
              >
                <HiCheckCircle size={20} />
                {language === 'en' ? 'Confirm Contest Question' : 'কনটেস্টের প্রশ্ন নিশ্চিত করুন'}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ── Docked Mathematical Keyboard ── */}
      {isKeyboardOpen && activeOption === 'new' && (
        <div className="uq-keyboard-dock">
          <div className="uq-keyboard-dock__header">
            <div className="uq-keyboard-dock__title">
              <HiClipboardList size={16} />
              <span>
                {language === 'en'
                  ? (focusedInput.type === 'question'
                      ? 'Active Input: Question Text'
                      : focusedInput.type === 'solution'
                        ? 'Active Input: Solution'
                        : focusedInput.type === 'cq-part'
                          ? `Active Input: CQ Sub-question ${focusedInput.index + 1}`
                          : focusedInput.type === 'cq-solution'
                            ? `Active Input: CQ Solution Explanation ${String.fromCharCode(65 + focusedInput.index)}`
                            : `Active Input: MCQ Option ${String.fromCharCode(65 + focusedInput.index)}`)
                  : (focusedInput.type === 'question'
                      ? 'সক্রিয় ইনপুট: প্রশ্নের টেক্সট'
                      : focusedInput.type === 'solution'
                        ? 'সক্রিয় ইনপুট: সমাধান ব্যাখ্যা'
                        : focusedInput.type === 'cq-part'
                          ? `সক্রিয় ইনপুট: CQ উপ-প্রশ্ন ${focusedInput.index + 1}`
                          : focusedInput.type === 'cq-solution'
                            ? `সক্রিয় ইনপুট: CQ সমাধান ব্যাখ্যা ${String.fromCharCode(65 + focusedInput.index)}`
                            : `সক্রিয় ইনপুট: MCQ অপশন ${String.fromCharCode(65 + focusedInput.index)}`)}
              </span>
            </div>
            <div className="uq-keyboard-dock__tabs">
              {Object.keys(KEYBOARD_TABS).map(tabKey => (
                <button
                  key={tabKey}
                  type="button"
                  className={`uq-keyboard-dock__tab-btn ${activeKeyboardTab === tabKey ? 'uq-keyboard-dock__tab-btn--active' : ''}`}
                  onClick={() => setActiveKeyboardTab(tabKey)}
                >
                  {language === 'en' ? KEYBOARD_TABS[tabKey].labelEn : KEYBOARD_TABS[tabKey].labelBn}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="uq-keyboard-dock__close-btn"
              onClick={() => setIsKeyboardOpen(false)}
              title={language === 'en' ? 'Hide Keyboard' : 'কিবোর্ড লুকান'}
            >
              <HiX size={18} />
            </button>
          </div>

          <div className="uq-keyboard-dock__body">
            {KEYBOARD_TABS[activeKeyboardTab].symbols.map((sym, idx) => (
              <button
                key={idx}
                type="button"
                className="uq-keyboard-dock__key"
                onClick={() => insertLatexSymbol(sym.code)}
                title={sym.label}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(sym.latex, { displayMode: false, throwOnError: false })
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Floating Toggle Button (if keyboard is closed) */}
      {!isKeyboardOpen && activeOption === 'new' && (
        <button
          type="button"
          className="uq-keyboard-toggle-btn"
          onClick={() => setIsKeyboardOpen(true)}
          title={language === 'en' ? 'Show Math Keyboard' : 'গণিত কিবোর্ড দেখান'}
        >
          <HiPlus size={16} />
          <span>{language === 'en' ? 'Math Keyboard' : 'গণিত কিবোর্ড'}</span>
        </button>
      )}
    </div>
  );
}
