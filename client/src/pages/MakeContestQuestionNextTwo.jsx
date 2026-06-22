import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiArrowLeft, HiPlusCircle, HiBookOpen, HiPencilAlt, HiPhotograph, HiX, HiSearch, HiCheckCircle,
  HiUpload, HiPlus, HiTrash, HiDocumentText, HiClipboardList, HiLightBulb, HiTag,
  HiOutlineSparkles, HiOutlineDocumentText, HiOutlinePhotograph, HiOutlineClipboardCopy,
  HiOutlineRefresh, HiOutlineCheck, HiOutlineExclamationCircle, HiOutlineUpload,
  HiOutlineEye, HiOutlinePencilAlt, HiOutlineTrash, HiOutlineLightBulb
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import { aiApi } from '../services/aiApi';
import { getTagAbbreviation, getTagTitle, buildSelectionsFromQuestions } from '../utils/questionTags';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './MakeContestQuestion.css';
import './MakeContestQuestionNextTwo.css';
import './MakeContestQuestionChooseQBank.css';
import './UploadQuestion.css';
import './AiQuestionHelper.css';

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

// ─── AI Question Helper Utilities ─────────────────────────────────────────────

const AIH_MAX_IMAGE_BYTES_RAW = 5 * 1024 * 1024;

const AIH_PLACEHOLDER_LATEX =
  'e.g. Find the value of $\\displaystyle\\int_0^1 \\frac{x^2+1}{x^4+1}\\,dx$.';

function aihReadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function aihSplitDataUrl(dataUrl) {
  const match = typeof dataUrl === 'string'
    ? dataUrl.match(/^data:([^;]+);base64,(.*)$/)
    : null;
  return {
    mimeType: match ? match[1] : 'image/png',
    base64: match ? match[2] : ''
  };
}

function aihSafeKatexHtml(latex) {
  if (!latex || typeof latex !== 'string') return '';
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      output: 'html'
    });
  } catch (_) {
    return '';
  }
}

function aihBuildFullLatex(data) {
  if (!data) return '';
  const parts = [data.questionText || ''];
  if (Array.isArray(data.options) && data.options.length > 0) {
    parts.push('');
    data.options.forEach((opt) => {
      parts.push(`${opt.label}) ${opt.text}`);
    });
  }
  if (data.solution && data.solution.trim().length > 0) {
    parts.push('');
    parts.push('Solution:');
    parts.push(data.solution);
  }
  return parts.join('\n');
}

function AihResultBlock({ label, latex, previewHtml, fieldKey, copiedField, onCopy }) {
  return (
    <div className="aih-result-block">
      <div className="aih-result-block__header">
        <span className="aih-result-block__label">{label}</span>
        <button
          type="button"
          className="aih-copy-mini"
          onClick={() => onCopy(latex, fieldKey)}
          title={`Copy ${label} LaTeX`}
        >
          {copiedField === fieldKey ? <HiOutlineCheck /> : <HiOutlineClipboardCopy />}
          <span>{copiedField === fieldKey ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div
        className="aih-katex aih-katex--block"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
      <details className="aih-source">
        <summary>Show LaTeX source</summary>
        <pre>
          <code>{latex}</code>
        </pre>
      </details>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  const [qbankSelections, setQbankSelections] = useState(() => {
    if (location.state?.qbankSelections) return location.state.qbankSelections;
    const saved = sessionStorage.getItem('cc_qbankSelections');
    return saved ? JSON.parse(saved) : null;
  });

  // Full question objects for the picked qbank questions (for display + removal)
  const [qbankQuestions, setQbankQuestions] = useState(() => {
    if (location.state?.qbankQuestions) return location.state.qbankQuestions;
    const saved = sessionStorage.getItem('cc_qbankQuestions');
    return saved ? JSON.parse(saved) : [];
  });

  // Persist qbank selections/questions when received via router state
  useEffect(() => {
    if (location.state?.qbankSelections) {
      setQbankSelections(location.state.qbankSelections);
      sessionStorage.setItem('cc_qbankSelections', JSON.stringify(location.state.qbankSelections));
    }
    if (location.state?.qbankQuestions) {
      setQbankQuestions(location.state.qbankQuestions);
      sessionStorage.setItem('cc_qbankQuestions', JSON.stringify(location.state.qbankQuestions));
    }
  }, [location.state?.qbankSelections, location.state?.qbankQuestions]);

  // Sync selected question IDs for QBank page to support Edit Selection
  useEffect(() => {
    if (qbankQuestions && qbankQuestions.length > 0) {
      const ids = qbankQuestions.map(q => q._id);
      sessionStorage.setItem('cc_qbank_selectedQuestionIds', JSON.stringify(ids));
    } else {
      sessionStorage.removeItem('cc_qbank_selectedQuestionIds');
    }
  }, [qbankQuestions]);

  // Remove a picked question from this contest draft (NOT from the database).
  const handleRemoveQbankQuestion = (qid) => {
    const updatedQuestions = qbankQuestions.filter(q => q._id !== qid);
    setQbankQuestions(updatedQuestions);
    sessionStorage.setItem('cc_qbankQuestions', JSON.stringify(updatedQuestions));

    // Rebuild the backend payload from what remains so they stay in sync.
    const rebuilt = buildSelectionsFromQuestions(updatedQuestions);

    // Carry over any "leftover" ids (no metadata) that are still selected.
    const remainingIds = new Set(updatedQuestions.map(q => q._id));
    const knownIds = new Set(qbankQuestions.map(q => q._id));
    (qbankSelections || []).forEach(sel => {
      (sel.questionIds || []).forEach(id => {
        if (!knownIds.has(id) && id !== qid && !remainingIds.has(id)) {
          remainingIds.add(id);
          rebuilt.push({ questionIds: [id], numberOfQuestions: 1, chapters: [] });
        }
      });
    });

    const finalSelections = rebuilt.length > 0 ? rebuilt : null;
    setQbankSelections(finalSelections);
    if (finalSelections) {
      sessionStorage.setItem('cc_qbankSelections', JSON.stringify(finalSelections));
    } else {
      sessionStorage.removeItem('cc_qbankSelections');
    }

    toast.success(language === 'en' ? 'Question removed from this contest.' : 'প্রশ্নটি এই কনটেস্ট থেকে সরানো হয়েছে।');
  };

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

  // ── AI Question Helper state ──
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [aiInputText, setAiInputText] = useState('');
  const [aiImage, setAiImage] = useState(null);
  const [aiIsDragging, setAiIsDragging] = useState(false);
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiExtracted, setAiExtracted] = useState(null);
  const [aiErrorMsg, setAiErrorMsg] = useState('');
  const [aiCopiedField, setAiCopiedField] = useState('');
  const aiFileInputRef = useRef(null);
  const aiCopyResetTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (aiCopyResetTimerRef.current) clearTimeout(aiCopyResetTimerRef.current);
    };
  }, []);

  const aiImagePreviewSrc = useMemo(
    () => (aiImage ? `data:${aiImage.mimeType};base64,${aiImage.base64}` : ''),
    [aiImage]
  );
  const aiHasInput = aiInputText.trim().length > 0 || !!aiImage;
  const aiCanSubmit = aiHasInput && !aiIsLoading;

  const handleAiImageFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file (PNG, JPG, etc.)'); return; }
    if (file.size > AIH_MAX_IMAGE_BYTES_RAW) { toast.error('Image is too large. Please use a file under ~5 MB.'); return; }
    try {
      const dataUrl = await aihReadFileAsDataUrl(file);
      const { mimeType, base64 } = aihSplitDataUrl(dataUrl);
      setAiImage({ mimeType, base64, name: file.name });
      setAiErrorMsg('');
    } catch (err) {
      console.error('[AiHelper] failed to read file', err);
      toast.error('Could not read the selected image.');
    }
  }, []);

  const onAiFileInputChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) handleAiImageFile(file);
    event.target.value = '';
  };

  const onAiDrop = (event) => { event.preventDefault(); setAiIsDragging(false); const file = event.dataTransfer.files && event.dataTransfer.files[0]; if (file) handleAiImageFile(file); };
  const onAiDragOver = (event) => { event.preventDefault(); setAiIsDragging(true); };
  const onAiDragLeave = (event) => { event.preventDefault(); setAiIsDragging(false); };
  const clearAiImage = () => { setAiImage(null); if (aiFileInputRef.current) aiFileInputRef.current.value = ''; };

  const handleAiExtract = async () => {
    if (!aiCanSubmit) return;
    setAiIsLoading(true); setAiErrorMsg(''); setAiExtracted(null);
    const payload = {};
    const trimmed = aiInputText.trim();
    if (trimmed) payload.text = trimmed;
    if (aiImage) { payload.imageBase64 = aiImage.base64; payload.mimeType = aiImage.mimeType; }
    try {
      const result = await aiApi.extract(payload);
      if (!result || !result.extracted) throw new Error('AI returned an empty result.');
      setAiExtracted(result.extracted);
      toast.success('Question extracted. Review the LaTeX below and copy.');
    } catch (err) {
      const message = err?.message || 'Could not extract the question.';
      setAiErrorMsg(message); toast.error(message);
    } finally {
      setAiIsLoading(false);
    }
  };

  const handleAiReset = () => {
    setAiInputText(''); setAiImage(null); setAiExtracted(null); setAiErrorMsg('');
    if (aiFileInputRef.current) aiFileInputRef.current.value = '';
    setQuestionText('');
    setOptions([
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ]);
  };

  const aiCopyToClipboard = async (value, fieldKey) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setAiCopiedField(fieldKey); toast.success('Copied to clipboard');
      if (aiCopyResetTimerRef.current) clearTimeout(aiCopyResetTimerRef.current);
      aiCopyResetTimerRef.current = setTimeout(() => setAiCopiedField(''), 1500);
    } catch (err) {
      console.error('[AiHelper] clipboard copy failed', err);
      toast.error('Copy failed — please select and copy manually.');
    }
  };

  const handleApplyToForm = () => {
    if (!aiExtracted) return;
    if (aiExtracted.questionText) setQuestionText(aiExtracted.questionText);
    if (aiExtracted.solution) setSolution(aiExtracted.solution);
    if (Array.isArray(aiExtracted.options) && aiExtracted.options.length > 0) {
      const mappedOpts = aiExtracted.options.map((opt) => {
        const isCorrect = aiExtracted.correctOption
          ? opt.label.toUpperCase() === aiExtracted.correctOption.toUpperCase()
          : false;
        return { text: opt.text, isCorrect };
      });
      while (mappedOpts.length < 2) mappedOpts.push({ text: '', isCorrect: false });
      setOptions(mappedOpts.slice(0, 4));
      setQuestionType('mcq');
    }
    toast.success('Applied to form — review and fill in the remaining fields.');
  };

  const aiRendered = useMemo(() => {
    if (!aiExtracted) return null;
    const fullSource = aihBuildFullLatex(aiExtracted);
    return {
      question: aihSafeKatexHtml(aiExtracted.questionText),
      solution: aihSafeKatexHtml(aiExtracted.solution || ''),
      fullSource,
      fullHtml: aihSafeKatexHtml(fullSource),
      options: (aiExtracted.options || []).map((opt) => ({
        ...opt, html: aihSafeKatexHtml(opt.text)
      }))
    };
  }, [aiExtracted]);

  // ── AI Solution Helper state ──
  const [showAiSolHelper, setShowAiSolHelper] = useState(false);
  const [aiSolInputText, setAiSolInputText] = useState('');
  const [aiSolImage, setAiSolImage] = useState(null);
  const [aiSolIsDragging, setAiSolIsDragging] = useState(false);
  const [aiSolIsLoading, setAiSolIsLoading] = useState(false);
  const [aiSolExtracted, setAiSolExtracted] = useState(null);
  const [aiSolErrorMsg, setAiSolErrorMsg] = useState('');
  const aiSolFileInputRef = useRef(null);

  const aiSolImagePreviewSrc = useMemo(
    () => (aiSolImage ? `data:${aiSolImage.mimeType};base64,${aiSolImage.base64}` : ''),
    [aiSolImage]
  );
  const aiSolHasInput = aiSolInputText.trim().length > 0 || !!aiSolImage;
  const aiSolCanSubmit = aiSolHasInput && !aiSolIsLoading;

  const handleAiSolImageFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file (PNG, JPG, etc.)'); return; }
    if (file.size > AIH_MAX_IMAGE_BYTES_RAW) { toast.error('Image is too large. Please use a file under ~5 MB.'); return; }
    try {
      const dataUrl = await aihReadFileAsDataUrl(file);
      const { mimeType, base64 } = aihSplitDataUrl(dataUrl);
      setAiSolImage({ mimeType, base64, name: file.name });
      setAiSolErrorMsg('');
    } catch (err) {
      console.error('[AiSolHelper] failed to read file', err);
      toast.error('Could not read the selected image.');
    }
  }, []);

  const onAiSolFileInputChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) handleAiSolImageFile(file);
    event.target.value = '';
  };
  const onAiSolDrop = (event) => { event.preventDefault(); setAiSolIsDragging(false); const file = event.dataTransfer.files && event.dataTransfer.files[0]; if (file) handleAiSolImageFile(file); };
  const onAiSolDragOver = (event) => { event.preventDefault(); setAiSolIsDragging(true); };
  const onAiSolDragLeave = (event) => { event.preventDefault(); setAiSolIsDragging(false); };
  const clearAiSolImage = () => { setAiSolImage(null); if (aiSolFileInputRef.current) aiSolFileInputRef.current.value = ''; };

  const handleAiSolExtract = async () => {
    if (!aiSolCanSubmit) return;
    setAiSolIsLoading(true); setAiSolErrorMsg(''); setAiSolExtracted(null);
    const payload = {};
    const trimmed = aiSolInputText.trim();
    if (trimmed) payload.text = trimmed;
    if (aiSolImage) { payload.imageBase64 = aiSolImage.base64; payload.mimeType = aiSolImage.mimeType; }
    try {
      const result = await aiApi.extract(payload);
      if (!result || !result.extracted) throw new Error('AI returned an empty result.');
      setAiSolExtracted(result.extracted);
      toast.success('Solution extracted! Review below and apply.');
    } catch (err) {
      const message = err?.message || 'Could not extract the solution.';
      setAiSolErrorMsg(message); toast.error(message);
    } finally {
      setAiSolIsLoading(false);
    }
  };

  const handleAiSolReset = () => {
    setAiSolInputText(''); setAiSolImage(null); setAiSolExtracted(null); setAiSolErrorMsg('');
    if (aiSolFileInputRef.current) aiSolFileInputRef.current.value = '';
    setSolution('');
  };

  const handleApplySolToForm = () => {
    if (!aiSolExtracted) return;
    const parts = [];
    if (aiSolExtracted.questionText) parts.push(aiSolExtracted.questionText);
    if (aiSolExtracted.solution) parts.push(aiSolExtracted.solution);
    const combined = parts.join('\n\n');
    if (combined) setSolution(combined);
    toast.success('Solution applied to form!');
  };

  const aiSolRenderedPreview = useMemo(() => {
    if (!aiSolExtracted) return '';
    const parts = [];
    if (aiSolExtracted.questionText) parts.push(aiSolExtracted.questionText);
    if (aiSolExtracted.solution) parts.push(aiSolExtracted.solution);
    return aihSafeKatexHtml(parts.join('\n\n'));
  }, [aiSolExtracted]);

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
    // Clear qbank session storage when adding fresh
    sessionStorage.removeItem('cc_qbank_step');
    sessionStorage.removeItem('cc_qbank_selectedSubjectIds');
    sessionStorage.removeItem('cc_qbank_selectedChapters');
    sessionStorage.removeItem('cc_qbank_topicsMap');
    sessionStorage.removeItem('cc_qbank_selectedTopics');
    sessionStorage.removeItem('cc_qbank_selectedQuestionIds');
    navigate('/make-contest-question/choose-qbank', { state: { contestData, qbankSelections, qbankQuestions, mode: 'add' } });
  };

  const handleEditQBank = () => {
    navigate('/make-contest-question/choose-qbank', { state: { contestData, qbankSelections, qbankQuestions, mode: 'edit' } });
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
          {((qbankQuestions && qbankQuestions.length > 0) || (qbankSelections && qbankSelections.length > 0)) && (
            <section className="cc-section cq-selection-summary-card">
              <div className="cq-section-top-bar" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="cc-section__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  📚 {language === 'en' ? `Selected Questions (${qbankQuestions.length})` : 'নির্বাচিত অধ্যায়সমূহ'}
                </h3>
                <button
                  type="button"
                  className="cq-back-btn"
                  onClick={handleEditQBank}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1.5px solid rgba(192, 133, 82, 0.25)', borderRadius: '8px', background: '#FFFBF7', color: '#8C5A3C' }}
                >
                  ✏️ {language === 'en' ? 'Edit Selection' : 'পরিবর্তন করুন'}
                </button>
              </div>

              {qbankQuestions && qbankQuestions.length > 0 ? (
                <div className="qsel-review-list">
                  {qbankQuestions.map((q, idx) => {
                    const paperLabel = q.paper === '1st'
                      ? (language === 'en' ? '1st Paper' : '১ম পত্র')
                      : (language === 'en' ? '2nd Paper' : '২য় পত্র');
                    return (
                      <div key={q._id || idx} className="qsel-review-card">
                        <button
                          type="button"
                          className="qsel-remove-btn"
                          onClick={() => handleRemoveQbankQuestion(q._id)}
                          title={language === 'en' ? 'Remove from contest' : 'কনটেস্ট থেকে সরান'}
                        >
                          <HiTrash size={14} />
                          {language === 'en' ? 'Remove' : 'সরান'}
                        </button>

                        <div className="qsel-meta">
                          <span className="qsel-meta-tag qsel-meta-tag--subject">{q.subject}</span>
                          <span className="qsel-meta-tag qsel-meta-tag--paper">{paperLabel}</span>
                          {q.chapter && (
                            <span className="qsel-meta-tag qsel-meta-tag--chapter">
                              <span className="qsel-meta-tag__label">{language === 'en' ? 'Ch' : 'অধ্যায়'}</span>
                              {q.chapter}
                            </span>
                          )}
                          {q.topic && (
                            <span className="qsel-meta-tag qsel-meta-tag--topic">
                              <span className="qsel-meta-tag__label">{language === 'en' ? 'Topic' : 'টপিক'}</span>
                              {q.topic}
                            </span>
                          )}
                          <span className="qsel-type-badge">{q.type?.toUpperCase()}</span>
                        </div>

                        <div className="qsel-qtext">
                          <span dangerouslySetInnerHTML={{ __html: renderLatex(`${idx + 1}. ${q.questionText}`) }}></span>
                        </div>

                        {q.imageUrl && (
                          <img src={q.imageUrl} alt="Question" className="qsel-img" />
                        )}

                        {q.type === 'mcq' && q.options && (
                          <div className="qsel-options">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className={`qsel-option ${opt.isCorrect ? 'qsel-option--correct' : ''}`}>
                                <span className="qsel-option__letter">{String.fromCharCode(65 + oIdx)}.</span>
                                <span dangerouslySetInnerHTML={{ __html: renderLatex(opt.text) }}></span>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.tags && q.tags.length > 0 && (
                          <div className="qsel-tags">
                            <HiTag size={14} className="qsel-tags__icon" />
                            {q.tags.map((tag, tIdx) => {
                              const abbr = getTagAbbreviation(tag);
                              if (!abbr) return null;
                              return (
                                <span
                                  key={tIdx}
                                  className={`qsel-tag qsel-tag--${tag.category || 'admission'}`}
                                  title={getTagTitle(tag)}
                                >
                                  {abbr}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="cq-selected-chapters-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(qbankSelections || []).map((sel, idx) => (
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
                      {(sel.chapters || []).map((ch, cidx) => (
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
              )}
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

              {/* ── AI Question Helper ── */}
              <div className="uq-section" style={{ borderLeft: '4px solid var(--sky-blue)' }}>
                <div
                  className="uq-section__title"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setShowAiHelper(prev => !prev)}
                >
                  <span className="uq-section__title-icon" style={{ background: 'linear-gradient(135deg, rgba(192,133,82,0.15), rgba(140,90,60,0.15))' }}>
                    <HiOutlineSparkles size={18} />
                  </span>
                  {language === 'en' ? 'AI Question Helper' : 'এআই প্রশ্ন সহকারী'}
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {showAiHelper ? (language === 'en' ? '▲ Collapse' : '▲ সংকুচিত করুন') : (language === 'en' ? '▼ Expand' : '▼ বিস্তারিত')}
                  </span>
                </div>
                <p className="uq-section__desc">
                  {language === 'en'
                    ? 'Paste a question or upload an image — get a clean LaTeX version you can apply to the form below.'
                    : 'একটি প্রশ্ন পেস্ট করুন বা একটি ছবি আপলোড করুন — নিচের ফর্মে প্রয়োগ করার জন্য একটি পরিষ্কার LaTeX সংস্করণ পান।'}
                </p>

                {showAiHelper && (
                  <div className="aih-page" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.05fr)', maxWidth: '100%', padding: '8px 0 0' }}>
                    {/* ── Input Card ── */}
                    <section className="aih-card aih-card--input">
                      <div className="aih-card__header">
                        <div className="aih-card__title">
                          <HiOutlineDocumentText />
                          <h3>{language === 'en' ? 'Source Question' : 'উৎস প্রশ্ন'}</h3>
                        </div>
                        <p className="aih-card__desc">
                          {language === 'en'
                            ? 'Provide either a typed question, an image of a question, or both. The AI will return a structured LaTeX representation.'
                            : 'একটি টাইপ করা প্রশ্ন, প্রশ্নের ছবি, বা উভয়ই দিন। AI একটি কাঠামোগত LaTeX উপস্থাপনা প্রদান করবে।'}
                        </p>
                      </div>
                      <div className="aih-card__body">
                        <label className="aih-field-label" htmlFor="aih-text-input-uq">
                          {language === 'en' ? 'Type or paste the question' : 'প্রশ্নটি টাইপ করুন বা পেস্ট করুন'}
                        </label>
                        <textarea
                          id="aih-text-input-uq"
                          className="aih-textarea"
                          rows={5}
                          value={aiInputText}
                          onChange={(e) => setAiInputText(e.target.value)}
                          placeholder={AIH_PLACEHOLDER_LATEX}
                          disabled={aiIsLoading}
                        />
                        <div className="aih-divider"><span>{language === 'en' ? 'or' : 'অথবা'}</span></div>
                        <div
                          className={`aih-dropzone ${aiIsDragging ? 'aih-dropzone--active' : ''}`}
                          onDrop={onAiDrop}
                          onDragOver={onAiDragOver}
                          onDragLeave={onAiDragLeave}
                          onClick={() => aiFileInputRef.current && aiFileInputRef.current.click()}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aiFileInputRef.current && aiFileInputRef.current.click(); } }}
                        >
                          <input
                            ref={aiFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={onAiFileInputChange}
                            style={{ display: 'none' }}
                          />
                          {aiImagePreviewSrc ? (
                            <div className="aih-dropzone__preview">
                              <img src={aiImagePreviewSrc} alt="Uploaded question" />
                              <div className="aih-dropzone__meta">
                                <span className="aih-dropzone__name">
                                  <HiOutlinePhotograph />
                                  {aiImage?.name || 'image'}
                                </span>
                                <button type="button" className="aih-dropzone__remove" onClick={(e) => { e.stopPropagation(); clearAiImage(); }} aria-label="Remove image">
                                  <HiX />
                                  {language === 'en' ? 'Remove' : 'মুছুন'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="aih-dropzone__empty">
                              <HiOutlineUpload size={28} />
                              <p><strong>{language === 'en' ? 'Click to upload' : 'আপলোড করতে ক্লিক করুন'}</strong> {language === 'en' ? 'or drag & drop an image of the question' : 'অথবা প্রশ্নের একটি ছবি টেনে আনুন'}</p>
                              <span className="aih-dropzone__hint">{language === 'en' ? 'PNG, JPG, or handwritten photo — up to ~5 MB' : 'PNG, JPG, বা হাতে লেখা ছবি — সর্বোচ্চ ~৫ MB'}</span>
                            </div>
                          )}
                        </div>
                        {aiErrorMsg && (
                          <div className="aih-error">
                            <HiOutlineExclamationCircle />
                            <span>{aiErrorMsg}</span>
                          </div>
                        )}
                        <div className="aih-actions">
                          <button type="button" className="aih-btn aih-btn--ghost" onClick={handleAiReset} disabled={aiIsLoading || (!aiInputText && !aiImage)}>
                            <HiOutlineRefresh />
                            {language === 'en' ? 'Clear' : 'মুছুন'}
                          </button>
                          <button type="button" className="aih-btn aih-btn--primary" onClick={handleAiExtract} disabled={!aiCanSubmit}>
                            {aiIsLoading ? (<><span className="aih-spinner" />{language === 'en' ? 'Extracting…' : 'এক্সট্র্যাক্ট হচ্ছে…'}</>) : (<><HiOutlineSparkles />{language === 'en' ? 'Extract Question' : 'প্রশ্ন এক্সট্র্যাক্ট করুন'}</>)}
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* ── Output Card ── */}
                    <section className="aih-card aih-card--output">
                      <div className="aih-card__header">
                        <div className="aih-card__title">
                          <HiOutlineSparkles />
                          <h3>{language === 'en' ? 'Extracted LaTeX' : 'এক্সট্র্যাক্ট করা LaTeX'}</h3>
                        </div>
                        <p className="aih-card__desc">
                          {language === 'en'
                            ? 'Copy the LaTeX below and paste it into the form, or use "Apply to Form" to auto-fill.'
                            : 'নিচের LaTeX কপি করুন এবং ফর্মে পেস্ট করুন, অথবা স্বয়ংক্রিয়ভাবে পূরণ করতে "ফর্মে প্রয়োগ করুন" ব্যবহার করুন।'}
                        </p>
                      </div>
                      <div className="aih-card__body">
                        {!aiExtracted && !aiIsLoading && (
                          <div className="aih-empty">
                            <HiOutlineSparkles size={32} />
                            <p>{language === 'en' ? 'Submit a question to see its LaTeX version here. Each part (stem, options, solution) can be copied individually, or copy the whole thing at once.' : 'এখানে LaTeX সংস্করণ দেখতে একটি প্রশ্ন জমা দিন।'}</p>
                          </div>
                        )}
                        {aiIsLoading && (
                          <div className="aih-loading">
                            <span className="aih-spinner aih-spinner--lg" />
                            <p>{language === 'en' ? 'Reading the question and converting it to LaTeX…' : 'প্রশ্ন পড়া হচ্ছে এবং LaTeX-এ রূপান্তর করা হচ্ছে…'}</p>
                          </div>
                        )}
                        {aiExtracted && !aiIsLoading && aiRendered && (
                          <div className="aih-result">
                            <AihResultBlock label={language === 'en' ? 'Question' : 'প্রশ্ন'} latex={aiExtracted.questionText} previewHtml={aiRendered.question} fieldKey="questionText" copiedField={aiCopiedField} onCopy={aiCopyToClipboard} />
                            {Array.isArray(aiExtracted.options) && aiExtracted.options.length > 0 && (
                              <div className="aih-options">
                                <div className="aih-options__title">
                                  {language === 'en' ? 'Options' : 'অপশন'} ({aiExtracted.options.length})
                                  {aiExtracted.correctOption && (
                                    <span className="aih-options__correct">{language === 'en' ? 'Correct' : 'সঠিক'}: {aiExtracted.correctOption}</span>
                                  )}
                                </div>
                                <ul className="aih-options__list">
                                  {aiRendered.options.map((opt) => {
                                    const isCorrect = aiExtracted.correctOption && opt.label.toUpperCase() === aiExtracted.correctOption.toUpperCase();
                                    return (
                                      <li key={opt.label} className={`aih-option ${isCorrect ? 'aih-option--correct' : ''}`}>
                                        <div className="aih-option__label">{opt.label}</div>
                                        <div className="aih-option__body">
                                          <div className="aih-katex" dangerouslySetInnerHTML={{ __html: opt.html }} />
                                          <button type="button" className="aih-copy-mini" onClick={() => aiCopyToClipboard(`${opt.label}) ${opt.text}`, `opt-${opt.label}`)} title={`Copy option ${opt.label}`}>
                                            {aiCopiedField === `opt-${opt.label}` ? <HiOutlineCheck /> : <HiOutlineClipboardCopy />}
                                          </button>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {aiExtracted.solution && aiExtracted.solution.trim().length > 0 && (
                              <AihResultBlock label={language === 'en' ? 'Solution' : 'সমাধান'} latex={aiExtracted.solution} previewHtml={aiRendered.solution} fieldKey="solution" copiedField={aiCopiedField} onCopy={aiCopyToClipboard} />
                            )}
                            <div className="aih-copy-all">
                              <button type="button" className="aih-btn aih-btn--secondary" onClick={() => aiCopyToClipboard(aiRendered.fullSource, 'all')}>
                                {aiCopiedField === 'all' ? (<><HiOutlineCheck /> {language === 'en' ? 'Copied' : 'কপি হয়েছে'}</>) : (<><HiOutlineClipboardCopy /> {language === 'en' ? 'Copy full LaTeX' : 'সম্পূর্ণ LaTeX কপি করুন'}</>)}
                              </button>
                              <button type="button" className="aih-btn aih-btn--primary" onClick={handleApplyToForm} style={{ marginLeft: 8 }}>
                                <HiOutlineSparkles />
                                {language === 'en' ? 'Apply to Form' : 'ফর্মে প্রয়োগ করুন'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}
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

                {/* ── Mini AI Solution Helper ── */}
                {questionType !== 'cq' && (
                  <div style={{ marginBottom: '18px', border: '1.5px dashed rgba(192,133,82,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 18px', background: 'rgba(192,133,82,0.03)' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setShowAiSolHelper(prev => !prev)}
                    >
                      <HiOutlineSparkles size={16} style={{ color: 'var(--sky-blue)' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {language === 'en' ? 'AI Solution Extractor' : 'এআই সমাধান এক্সট্র্যাক্টর'}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {showAiSolHelper ? (language === 'en' ? '▲ Collapse' : '▲ সংকুচিত') : (language === 'en' ? '▼ Expand' : '▼ বিস্তারিত')}
                      </span>
                    </div>
                    {showAiSolHelper && (
                      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                          {language === 'en'
                            ? 'Upload an image of the worked solution or paste it as text — AI will extract the LaTeX.'
                            : 'সমাধানের ছবি আপলোড করুন বা টেক্সট হিসেবে পেস্ট করুন — AI LaTeX এক্সট্র্যাক্ট করবে।'}
                        </p>
                        <textarea
                          className="aih-textarea"
                          rows={3}
                          value={aiSolInputText}
                          onChange={(e) => setAiSolInputText(e.target.value)}
                          placeholder={language === 'en' ? 'Paste worked solution text here…' : 'সমাধানের টেক্সট এখানে পেস্ট করুন…'}
                          disabled={aiSolIsLoading}
                          style={{ minHeight: '80px' }}
                        />
                        <div className="aih-divider"><span>{language === 'en' ? 'or' : 'অথবা'}</span></div>
                        <div
                          className={`aih-dropzone ${aiSolIsDragging ? 'aih-dropzone--active' : ''}`}
                          onDrop={onAiSolDrop}
                          onDragOver={onAiSolDragOver}
                          onDragLeave={onAiSolDragLeave}
                          onClick={() => aiSolFileInputRef.current && aiSolFileInputRef.current.click()}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aiSolFileInputRef.current && aiSolFileInputRef.current.click(); } }}
                          style={{ padding: '16px 14px' }}
                        >
                          <input ref={aiSolFileInputRef} type="file" accept="image/*" onChange={onAiSolFileInputChange} style={{ display: 'none' }} />
                          {aiSolImagePreviewSrc ? (
                            <div className="aih-dropzone__preview">
                              <img src={aiSolImagePreviewSrc} alt="Solution upload" style={{ maxHeight: '180px' }} />
                              <div className="aih-dropzone__meta">
                                <span className="aih-dropzone__name"><HiOutlinePhotograph /> {aiSolImage?.name || 'image'}</span>
                                <button type="button" className="aih-dropzone__remove" onClick={(e) => { e.stopPropagation(); clearAiSolImage(); }}><HiX /> {language === 'en' ? 'Remove' : 'মুছুন'}</button>
                              </div>
                            </div>
                          ) : (
                            <div className="aih-dropzone__empty">
                              <HiOutlineUpload size={24} />
                              <p style={{ fontSize: '0.85rem' }}><strong>{language === 'en' ? 'Click to upload' : 'আপলোড করুন'}</strong> {language === 'en' ? 'solution image' : 'সমাধানের ছবি'}</p>
                              <span className="aih-dropzone__hint">{language === 'en' ? 'PNG, JPG — up to ~5 MB' : 'PNG, JPG — সর্বোচ্চ ~৫ MB'}</span>
                            </div>
                          )}
                        </div>
                        {aiSolErrorMsg && (
                          <div className="aih-error"><HiOutlineExclamationCircle /><span>{aiSolErrorMsg}</span></div>
                        )}
                        <div className="aih-actions">
                          <button type="button" className="aih-btn aih-btn--ghost" onClick={handleAiSolReset} disabled={aiSolIsLoading || (!aiSolInputText && !aiSolImage)}>
                            <HiOutlineRefresh /> {language === 'en' ? 'Clear' : 'মুছুন'}
                          </button>
                          <button type="button" className="aih-btn aih-btn--primary" onClick={handleAiSolExtract} disabled={!aiSolCanSubmit}>
                            {aiSolIsLoading ? (<><span className="aih-spinner" /> {language === 'en' ? 'Extracting…' : 'এক্সট্র্যাক্ট হচ্ছে…'}</>) : (<><HiOutlineSparkles /> {language === 'en' ? 'Extract Solution' : 'সমাধান এক্সট্র্যাক্ট করুন'}</>)}
                          </button>
                        </div>
                        {aiSolIsLoading && (
                          <div className="aih-loading" style={{ padding: '18px 10px' }}>
                            <span className="aih-spinner aih-spinner--lg" />
                            <p>{language === 'en' ? 'Extracting solution…' : 'সমাধান এক্সট্র্যাক্ট হচ্ছে…'}</p>
                          </div>
                        )}
                        {aiSolExtracted && !aiSolIsLoading && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <span className="aih-result-block__label">{language === 'en' ? 'EXTRACTED SOLUTION' : 'এক্সট্র্যাক্ট করা সমাধান'}</span>
                            <div
                              className="aih-katex aih-katex--block"
                              style={{ border: '1px solid rgba(75,46,43,0.1)', borderRadius: 'var(--radius-md)', padding: '12px 14px', background: 'var(--bg-primary)' }}
                              dangerouslySetInnerHTML={{ __html: aiSolRenderedPreview }}
                            />
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button type="button" className="aih-btn aih-btn--primary" onClick={handleApplySolToForm}>
                                <HiOutlineSparkles /> {language === 'en' ? 'Apply to Solution' : 'সমাধানে প্রয়োগ করুন'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
