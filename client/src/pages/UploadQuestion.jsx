import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { HiUpload, HiPencilAlt, HiCheckCircle, HiX, HiPlus, HiTrash, HiDocumentText, HiClipboardList, HiLightBulb } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import katex from 'katex';
import 'katex/dist/katex.min.css';
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

// Generate year options (2015..current+1)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2014 }, (_, i) => String(currentYear + 1 - i));

// Session options (e.g. 19-20, 20-21, 22-23) — Bangladesh varsity admission
// sessions. Sessions start in 2015-16 so the first year part is "15". Most
// recent session first.
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

// ─── KaTeX Render Helper ──────────────────────────────────────────────────────


function renderLatex(text) {
  if (!text || !text.trim()) return '';
  try {
    // Replace $...$ delimiters with rendered HTML
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UploadQuestion() {
  const { t, language } = useLanguage();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  // Form state
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
  // CQ (Creative Question) — HSC Bangladesh format: stem + 4 sub-questions a-d
  const [cqDescription, setCqDescription] = useState('');
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
  const [toast, setToast] = useState(null);
  const [recentQuestions, setRecentQuestions] = useState([]);

  // Math Keyboard state
  const [focusedInput, setFocusedInput] = useState({ type: 'question', index: null });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [activeKeyboardTab, setActiveKeyboardTab] = useState('essentials');

  const activeTab = 'upload-question';

  // Auth guard + fetch user data
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
          setUser({ name: data.data.name, avatar: data.data.avatar || '', email: data.data.email, role: data.data.role });
          localStorage.setItem('topkorbo_name', data.data.name);
          localStorage.setItem('topkorbo_avatar', data.data.avatar || '');
          localStorage.setItem('topkorbo_email', data.data.email);
          localStorage.setItem('topkorbo_role', data.data.role);
        }
      } catch (err) { console.error('Error fetching user:', err); }
    };
    fetchUser();
  }, []);

  // Fetch recent questions from backend
  const fetchRecentQuestions = useCallback(async () => {
    try {
      const token = localStorage.getItem('topkorbo_token');
      if (!token) return;
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${base}/questions/mine?limit=5`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success && data.data?.questions) {
        setRecentQuestions(data.data.questions);
      }
    } catch (err) { console.error('Error fetching recent questions:', err); }
  }, []);

  useEffect(() => {
    if (user.role === 'teacher') fetchRecentQuestions();
  }, [user.role, fetchRecentQuestions]);

  // Derived: available papers/chapters
  const selectedSubjectData = HSC_SUBJECTS.find(s => s.id === subject);
  const availablePapers = selectedSubjectData?.papers || [];
  const chapterKey = `${subject}__${paper}`;
  const availableChapters = CHAPTERS_MAP[chapterKey] || [];

  // Reset dependent fields on subject change
  useEffect(() => { setPaper(''); setChapter(''); setTopic(''); }, [subject]);
  useEffect(() => { setChapter(''); setTopic(''); }, [paper]);

  // ── Image Upload Helpers ──
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('error', language === 'en' ? 'Image must be under 2MB' : 'ছবি ২ মেগাবাইটের কম হতে হবে');
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
      showToast('error', language === 'en' ? 'Image must be under 2MB' : 'ছবি ২ মেগাবাইটের কম হতে হবে');
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
      showToast('error', language === 'en' ? 'Image must be under 2MB' : 'ছবি ২ মেগাবাইটের কম হতে হবে');
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
    } else if (focusedInput.type === 'cq-desc') {
      textarea = document.getElementById('uq-cq-description-textarea');
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
    } else if (focusedInput.type === 'cq-desc') {
      setCqDescription(newText);
    } else if (focusedInput.type === 'cq-part') {
      setCqParts(prev => prev.map((p, i) => i === focusedInput.index ? { ...p, text: newText } : p));
    } else if (focusedInput.type === 'cq-solution') {
      setCqSolutions(prev => prev.map((item, i) => i === focusedInput.index ? { ...item, text: newText } : item));
    }

    // Refocus and place cursor appropriately
    setTimeout(() => {
      textarea.focus();
      if (symbol === '$x$') {
        textarea.selectionStart = startPos + 1;
        textarea.selectionEnd = startPos + 2; // select 'x'
      } else if (symbol === '$$\n\\Sigma\n$$') {
        textarea.selectionStart = startPos + 3;
        textarea.selectionEnd = startPos + 9; // select '\Sigma'
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
      // Reset unit when university changes
      if (field === 'university') updated.unit = '';
      return updated;
    }));
  };

  const removeTag = (idx) => {
    setTags(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ──

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validation
    if (!questionText.trim()) { showToast('error', t('uq.error.question_required')); return; }
    if (!subject) { showToast('error', t('uq.error.subject_required')); return; }
    if (!paper) { showToast('error', t('uq.error.paper_required')); return; }
    if (!chapter) { showToast('error', t('uq.error.chapter_required')); return; }
    if (!topic.trim()) { showToast('error', t('uq.error.topic_required')); return; }

    if (questionType === 'mcq' || (questionType === 'written' && showWrittenOptions)) {
      const validOpts = options.filter(o => o.text.trim());
      if (validOpts.length < 2) { showToast('error', t('uq.error.min_options')); return; }
      if (!validOpts.some(o => o.isCorrect)) { showToast('error', t('uq.error.correct_required')); return; }
    }

    if (questionType === 'cq') {
      const filledParts = cqParts.filter(p => p.text.trim());
      if (filledParts.length < 4) { showToast('error', t('uq.cq.error.parts_required')); return; }
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const body = {
        questionText: questionText.trim(),
        imageUrl: imageUrl,
        type: questionType,
        options: (questionType === 'mcq' || (questionType === 'written' && showWrittenOptions)) ? options.filter(o => o.text.trim()) : [],
        subject,
        paper,
        chapter,
        topic: topic.trim(),
        solution: questionType === 'cq' ? JSON.stringify(cqSolutions) : solution.trim(),
        solutionImageUrl: questionType === 'cq' ? '' : solutionImageUrl,
        tags: tags.filter(t => {
          if (t.category === 'board') return t.board && t.year;
          if (t.category === 'college') return t.college && t.year;
          return t.university && t.year;
        })
      };

      if (questionType === 'cq') {
        body.cq = {
          description: questionText.trim(),
          parts: cqParts.map(p => ({ label: p.label, text: p.text.trim() }))
        };
      }

      const res = await fetch(`${base}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', t('uq.success'));
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
        setCqDescription('');
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
        fetchRecentQuestions();
      } else {
        showToast('error', data.message || t('uq.error.generic'));
      }
    } catch (err) {
      console.error(err);
      showToast('error', t('uq.error.network'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ──────────────────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header__welcome">
            <h2>{t('uq.title')}</h2>
            <p>{t('uq.subtitle')}</p>
          </div>
          <div className="dashboard-header__actions">
            <span className="dashboard-header__badge">{t('uq.badge')}</span>
          </div>
        </header>

        <div className="uq-workspace">
          {/* ── Toast ── */}
          {toast && (
            <div className={`uq-toast uq-toast--${toast.type}`}>
              {toast.type === 'success' ? <HiCheckCircle size={18} /> : <HiX size={18} />}
              {toast.msg}
            </div>
          )}

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
                        : focusedInput.type === 'cq-desc'
                          ? 'Active Input: CQ Description'
                          : focusedInput.type === 'cq-part'
                            ? 'Active Input: CQ Sub-question'
                            : focusedInput.type === 'cq-solution'
                              ? 'Active Input: CQ Solution'
                              : 'Active Input: MCQ Option')
                  : (focusedInput.type === 'question'
                      ? 'সক্রিয় ইনপুট: প্রশ্নের টেক্সট'
                      : focusedInput.type === 'solution'
                        ? 'সক্রিয় ইনপুট: সমাধান ব্যাখ্যা'
                        : focusedInput.type === 'cq-desc'
                          ? 'সক্রিয় ইনপুট: CQ বর্ণনা'
                          : focusedInput.type === 'cq-part'
                            ? 'সক্রিয় ইনপুট: CQ উপ-প্রশ্ন'
                            : focusedInput.type === 'cq-solution'
                              ? 'সক্রিয় ইনপুট: CQ সমাধান ব্যাখ্যা'
                              : 'সক্রিয় ইনপুট: MCQ অপশন')}</span>
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
            <p className="uq-section__desc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {language === 'en'
                ? 'Add at least one tag so the question can be matched when students select a standard, board, or college in mock tests and the question bank.'
                : 'মক টেস্ট ও প্রশ্ন ব্যাঙ্কে শিক্ষার্থীরা স্ট্যান্ডার্ড, বোর্ড বা কলেজ নির্বাচন করলে প্রশ্নটি মিলে যাওয়ার জন্য অন্তত একটি ট্যাগ যোগ করুন।'}
            </p>
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

          {/* ── Submit Bar ── */}
          <div className="uq-section">
            <div className="uq-submit-bar">
              <button
                type="button"
                className="uq-submit-btn"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <HiUpload size={18} />
                {isSubmitting ? t('uq.submitting') : t('uq.submit')}
              </button>
            </div>
          </div>

          {/* ── Recent Uploads ── */}
          {recentQuestions.length > 0 && (
            <div className="uq-section">
              <div className="uq-section__title">
                <span className="uq-section__title-icon"><HiDocumentText size={18} /></span>
                {t('uq.recent.title')}
              </div>
              <p className="uq-section__desc">{t('uq.recent.desc')}</p>
              <div className="uq-recent-list">
                {recentQuestions.map(q => (
                  <div key={q._id} className="uq-recent-card">
                    {q.imageUrl && (
                      <div className="uq-recent-card__diagram">
                        <img src={q.imageUrl} alt="Diagram" />
                      </div>
                    )}
                    <span className={`uq-recent-card__type-badge uq-recent-card__type-badge--${q.type}`}>
                      {q.type.toUpperCase()}
                    </span>
                    <div className="uq-recent-card__body">
                      <div
                        className="uq-recent-card__question"
                        dangerouslySetInnerHTML={{ __html: renderLatex(q.questionText.length > 120 ? q.questionText.slice(0, 120) + '…' : q.questionText) }}
                      />
                      {q.type === 'cq' && q.cq && q.cq.parts && (
                        <div className="uq-recent-card__cq-parts">
                          {q.cq.parts.map((p, idx) => (
                            <div key={idx} className="uq-recent-card__cq-part">
                              <span className="uq-recent-card__cq-part-label">{p.label.toUpperCase()}: </span>
                              <span
                                className="uq-recent-card__cq-part-text"
                                dangerouslySetInnerHTML={{ __html: renderLatex(p.text) }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <span className="uq-recent-card__meta">
                        {q.subject} · {q.paper} Paper · {q.chapter}
                      </span>
                      {q.tags && q.tags.length > 0 && (
                        <div className="uq-recent-card__tags">
                          {q.tags.map((tag, i) => (
                            <span key={i} className="uq-recent-card__tag">
                              {tag.category === 'board'
                                ? `${tag.board} ${tag.year}`
                                : tag.category === 'college'
                                  ? `${tag.college} ${tag.year}`
                                  : `${tag.university} ${tag.unit ? '· ' + tag.unit : ''} ${tag.year}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Docked Mathematical Keyboard ── */}
      {isKeyboardOpen && (
        <div className="uq-keyboard-dock">
          <div className="uq-keyboard-dock__header">
            <div className="uq-keyboard-dock__title">
              <HiClipboardList size={16} />
              <span>
                {language === 'en'
                  ? (focusedInput.type === 'question'
                      ? 'Active Input: Question Text'
                      : focusedInput.type === 'cq-desc'
                        ? 'Active Input: CQ Description'
                        : focusedInput.type === 'cq-part'
                          ? `Active Input: CQ Sub-question ${focusedInput.index + 1}`
                          : focusedInput.type === 'cq-solution'
                            ? `Active Input: CQ Solution Explanation ${String.fromCharCode(65 + focusedInput.index)}`
                            : `Active Input: MCQ Option ${String.fromCharCode(65 + focusedInput.index)}`)
                  : (focusedInput.type === 'question'
                      ? 'সক্রিয় ইনপুট: প্রশ্নের টেক্সট'
                      : focusedInput.type === 'cq-desc'
                        ? 'সক্রিয় ইনপুট: CQ বর্ণনা'
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
      {!isKeyboardOpen && (
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
