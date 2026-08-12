import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiUpload,
  HiPencilAlt,
  HiEye,
  HiCheckCircle,
  HiX,
  HiTrash,
  HiDocumentText,
  HiClock,
  HiAcademicCap,
  HiCalculator,
  HiExclamationCircle,
  HiLightBulb,
  HiBookOpen,
  HiQuestionMarkCircle,
  HiPlus,
  HiClipboardList,
  HiOutlineEye,
  HiOutlinePencilAlt,
  HiOutlineTrash,
  HiOutlineLightBulb,
  HiOutlineSparkles,
  HiOutlineDocumentText,
  HiOutlinePhotograph,
  HiOutlineClipboardCopy,
  HiOutlineRefresh,
  HiOutlineCheck,
  HiOutlineExclamationCircle,
  HiOutlineUpload,
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import Sidebar from '../components/layout/Sidebar';
import { aiApi } from '../services/aiApi';
import katex from 'katex';
import 'katex/dist/katex.min.css';
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


function looksLikeRawLatex(text) {
  return /\\(?:frac|sqrt|sum|int|lim|alpha|beta|gamma|theta|lambda|Rightarrow|rightarrow|leftarrow|cos|sin|tan|therefore|because|times|div|cdot|leq|geq|neq|approx|infty|pi|vec|hat|begin|end)\b/.test(text)
    || /\b[A-Za-z0-9)}]\s*\^\s*[{(]?[A-Za-z0-9]/.test(text)
    || /\b[A-Za-z0-9)}]\s*_\s*[{(]?[A-Za-z0-9]/.test(text);
}

function renderLatexBlock(math, displayMode) {
  return katex.renderToString(math.trim(), { displayMode, throwOnError: false });
}

function renderLatex(text) {
  if (!text || !text.trim()) return '';
  try {
    const hasDelimitedLatex = /\$\$[\s\S]*?\$\$|\$[^$]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/.test(text);
    const isRubricStyle = /\[\s*\d+\s*(?:mark|marks?)\]|\d+\s*mark/i.test(text);
    if (!hasDelimitedLatex && looksLikeRawLatex(text) && !isRubricStyle) {
      return renderLatexBlock(text, true);
    }

    // Replace common LaTeX delimiters with rendered HTML.
    return latexifyCodeIdentifiers(text)
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => renderLatexBlock(math, true))
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => renderLatexBlock(math, false))
      .replace(/\\texttt\{([^}]*)\}/g, (_m, inner) => renderLatexBlock(`\\texttt{${inner}}`, false))
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => renderLatexBlock(math, true))
      .replace(/\$([^$]*?)\$/g, (_, math) => renderLatexBlock(math, false));
  } catch {
    return text;
  }
}

// ─── LaTeX-ify code identifiers (Java/Python/variables/operators) ────────────

const AIH_PROTECTED_LATEX =
  /(\$\$[\s\S]*?\$\$|\$[^$\n]*\$|\\texttt\{[^}]*\}|\\text\{[^}]*\}|\\operatorname\{[^}]*\}|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/;

function aihEscapeTt(code) {
  return (code || '')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\^/g, '\\^{}')
    .replace(/_/g, '\\_')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/&/g, '\\&')
    .replace(/~/g, '\\~{}')
    .trim();
}

function latexifyCodeIdentifiers(text) {
  if (!text || typeof text !== 'string') return text;
  const codeRe = new RegExp(
    '([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)*(?:\\s*(?:==|!=|<=|>=|\\+\\+|--|&&|\\|\\||->|::|[-+*/%=<>!&|^~])\\s*[A-Za-z_$0-9]+(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)*)+)' +
    '|(\\b[A-Za-z_$][\\w$]*\\s*\\([^()\\n]*\\))' +
    '|([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)+)' +
    '|(\\b(?:public|private|protected|static|final|void|int|double|float|long|short|byte|char|boolean|String|class|interface|enum|new|return|if|else|for|while|do|switch|case|break|continue|null|true|false|this|super|extends|implements|import|package|try|catch|finally|throw|throws)\\b)',
    'g'
  );
  return String(text)
    .split(AIH_PROTECTED_LATEX)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(codeRe, (m) => `\\texttt{${aihEscapeTt(m)}}`);
    })
    .join('');
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
    return katex.renderToString(latexifyCodeIdentifiers(latex), {
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

export default function UploadQuestion() {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
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
  const [rubricText, setRubricText] = useState('');
  const [cqSolutions, setCqSolutions] = useState([
    { label: 'a', text: '', imageUrl: '' },
    { label: 'b', text: '', imageUrl: '' },
    { label: 'c', text: '', imageUrl: '' },
    { label: 'd', text: '', imageUrl: '' }
  ]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uqToast, setUqToast] = useState(null);
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [taxonomyTree, setTaxonomyTree] = useState([]);

  // Edit / Delete / Solution modal state for Recently Uploaded cards
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewingSolutionFor, setViewingSolutionFor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, etc.)');
      return;
    }
    if (file.size > AIH_MAX_IMAGE_BYTES_RAW) {
      toast.error('Image is too large. Please use a file under ~5 MB.');
      return;
    }
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

  const onAiDrop = (event) => {
    event.preventDefault();
    setAiIsDragging(false);
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleAiImageFile(file);
  };

  const onAiDragOver = (event) => { event.preventDefault(); setAiIsDragging(true); };
  const onAiDragLeave = (event) => { event.preventDefault(); setAiIsDragging(false); };
  const clearAiImage = () => { setAiImage(null); if (aiFileInputRef.current) aiFileInputRef.current.value = ''; };

  const handleAiExtract = async () => {
    if (!aiCanSubmit) return;
    setAiIsLoading(true);
    setAiErrorMsg('');
    setAiExtracted(null);
    const payload = {};
    const trimmed = aiInputText.trim();
    if (trimmed) payload.text = trimmed;
    if (aiImage) {
      payload.imageBase64 = aiImage.base64;
      payload.mimeType = aiImage.mimeType;
    }
    try {
      const result = await aiApi.extract(payload);
      if (!result || !result.extracted) throw new Error('AI returned an empty result.');
      setAiExtracted(result.extracted);
      toast.success('Question extracted. Review the LaTeX below and copy.');
    } catch (err) {
      const message = err?.message || 'Could not extract the question.';
      setAiErrorMsg(message);
      toast.error(message);
    } finally {
      setAiIsLoading(false);
    }
  };

  const handleAiReset = () => {
    setAiInputText('');
    setAiImage(null);
    setAiExtracted(null);
    setAiErrorMsg('');
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
      setAiCopiedField(fieldKey);
      toast.success('Copied to clipboard');
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
        ...opt,
        html: aihSafeKatexHtml(opt.text)
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
    setAiSolIsLoading(true);
    setAiSolErrorMsg('');
    setAiSolExtracted(null);
    const payload = {};
    const trimmed = aiSolInputText.trim();
    payload.mode = 'solution';
    if (trimmed) payload.text = trimmed;
    if (aiSolImage) { payload.imageBase64 = aiSolImage.base64; payload.mimeType = aiSolImage.mimeType; }
    try {
      const result = await aiApi.extract(payload);
      if (!result || !result.extracted) throw new Error('AI returned an empty result.');
      setAiSolExtracted(result.extracted);
      toast.success('Solution extracted! Review below and apply.');
    } catch (err) {
      const message = err?.message || 'Could not extract the solution.';
      setAiSolErrorMsg(message);
      toast.error(message);
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
    // Combine questionText + solution from the extraction into the solution field
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

  // ── AI Rubric Helper state ──
  const [showAiRubricHelper, setShowAiRubricHelper] = useState(false);
  const [aiRubricQuestionText, setAiRubricQuestionText] = useState('');
  const [aiRubricAnswerText, setAiRubricAnswerText] = useState('');
  const [aiRubricMarks, setAiRubricMarks] = useState('');
  const [aiRubricQuestionImage, setAiRubricQuestionImage] = useState(null);
  const [aiRubricAnswerImage, setAiRubricAnswerImage] = useState(null);
  const [aiRubricDraggingSource, setAiRubricDraggingSource] = useState('');
  const [aiRubricIsLoading, setAiRubricIsLoading] = useState(false);
  const [aiRubricExtracted, setAiRubricExtracted] = useState(null);
  const [aiRubricErrorMsg, setAiRubricErrorMsg] = useState('');
  const aiRubricQuestionFileInputRef = useRef(null);
  const aiRubricAnswerFileInputRef = useRef(null);

  const aiRubricQuestionImagePreviewSrc = useMemo(
    () => (aiRubricQuestionImage ? `data:${aiRubricQuestionImage.mimeType};base64,${aiRubricQuestionImage.base64}` : ''),
    [aiRubricQuestionImage]
  );
  const aiRubricAnswerImagePreviewSrc = useMemo(
    () => (aiRubricAnswerImage ? `data:${aiRubricAnswerImage.mimeType};base64,${aiRubricAnswerImage.base64}` : ''),
    [aiRubricAnswerImage]
  );
  const aiRubricQuestionHasInput = aiRubricQuestionText.trim().length > 0 || !!aiRubricQuestionImage;
  const aiRubricAnswerHasInput = aiRubricAnswerText.trim().length > 0 || !!aiRubricAnswerImage;
  const aiRubricTotalMarks = Number(aiRubricMarks);
  const aiRubricCanSubmit = aiRubricQuestionHasInput && aiRubricAnswerHasInput
    && Number.isInteger(aiRubricTotalMarks) && aiRubricTotalMarks >= 1 && aiRubricTotalMarks <= 100
    && !aiRubricIsLoading;

  const handleAiRubricImageFile = useCallback(async (file, source) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file (PNG, JPG, etc.)'); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error('Image is too large. Please use a file under ~4 MB.'); return; }
    try {
      const dataUrl = await aihReadFileAsDataUrl(file);
      const { mimeType, base64 } = aihSplitDataUrl(dataUrl);
      const image = { mimeType, base64, name: file.name };
      if (source === 'question') setAiRubricQuestionImage(image);
      else setAiRubricAnswerImage(image);
      setAiRubricErrorMsg('');
    } catch (err) {
      console.error('[AiRubricHelper] failed to read file', err);
      toast.error('Could not read the selected image.');
    }
  }, []);

  const onAiRubricFileInputChange = (event, source) => {
    const file = event.target.files && event.target.files[0];
    if (file) handleAiRubricImageFile(file, source);
    event.target.value = '';
  };
  const onAiRubricDrop = (event, source) => {
    event.preventDefault();
    setAiRubricDraggingSource('');
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleAiRubricImageFile(file, source);
  };
  const onAiRubricDragOver = (event, source) => { event.preventDefault(); setAiRubricDraggingSource(source); };
  const onAiRubricDragLeave = (event) => { event.preventDefault(); setAiRubricDraggingSource(''); };
  const clearAiRubricImage = (source) => {
    if (source === 'question') {
      setAiRubricQuestionImage(null);
      if (aiRubricQuestionFileInputRef.current) aiRubricQuestionFileInputRef.current.value = '';
    } else {
      setAiRubricAnswerImage(null);
      if (aiRubricAnswerFileInputRef.current) aiRubricAnswerFileInputRef.current.value = '';
    }
  };

  const handleAiRubricExtract = async () => {
    if (!aiRubricCanSubmit) return;
    setAiRubricIsLoading(true);
    setAiRubricErrorMsg('');
    setAiRubricExtracted(null);
    const payload = {
      mode: 'rubric',
      questionText: aiRubricQuestionText.trim(),
      answerText: aiRubricAnswerText.trim(),
      totalMarks: aiRubricTotalMarks
    };
    if (aiRubricQuestionImage) {
      payload.questionImageBase64 = aiRubricQuestionImage.base64;
      payload.questionMimeType = aiRubricQuestionImage.mimeType;
    }
    if (aiRubricAnswerImage) {
      payload.answerImageBase64 = aiRubricAnswerImage.base64;
      payload.answerMimeType = aiRubricAnswerImage.mimeType;
    }
    try {
      const result = await aiApi.extract(payload);
      if (!result || !result.extracted) throw new Error('AI returned an empty result.');
      setAiRubricExtracted(result.extracted);
      toast.success('Rubric extracted! Review below and apply.');
    } catch (err) {
      const message = err?.message || 'Could not extract the rubric.';
      setAiRubricErrorMsg(message);
      toast.error(message);
    } finally {
      setAiRubricIsLoading(false);
    }
  };

  const handleAiRubricReset = () => {
    setAiRubricQuestionText('');
    setAiRubricAnswerText('');
    setAiRubricMarks('');
    setAiRubricQuestionImage(null);
    setAiRubricAnswerImage(null);
    setAiRubricExtracted(null);
    setAiRubricErrorMsg('');
    if (aiRubricQuestionFileInputRef.current) aiRubricQuestionFileInputRef.current.value = '';
    if (aiRubricAnswerFileInputRef.current) aiRubricAnswerFileInputRef.current.value = '';
    setRubricText('');
  };

  const handleApplyRubricToForm = () => {
    if (!aiRubricExtracted) return;
    if (aiRubricExtracted.questionText) setQuestionText(aiRubricExtracted.questionText);
    if (aiRubricExtracted.answerText) setSolution(aiRubricExtracted.answerText);
    if (aiRubricExtracted.totalMarks) setAiRubricMarks(String(aiRubricExtracted.totalMarks));
    const rubric = aiRubricExtracted.rubric || aiRubricExtracted.solution || '';
    if (rubric) setRubricText(rubric);
    toast.success('Rubric applied to form!');
  };

  const aiRubricRenderedPreview = useMemo(() => {
    if (!aiRubricExtracted) return '';
    const rubric = aiRubricExtracted.rubric || aiRubricExtracted.solution || '';
    return rubric ? renderLatex(rubric) : '';
  }, [aiRubricExtracted]);

  const openEditModal = (q) => {
    setEditingQuestion(q);
    setEditForm({
      questionText: q.questionText || '',
      subject: q.subject || '',
      paper: q.paper ?? '',
      chapter: q.chapter || '',
      topic: q.topic || '',
      type: q.type || 'mcq',
      options: Array.isArray(q.options) && q.options.length
        ? q.options.map((o) => ({ ...o }))
        : [
          { id: 'A', text: '', isCorrect: false },
          { id: 'B', text: '', isCorrect: false },
          { id: 'C', text: '', isCorrect: false },
          { id: 'D', text: '', isCorrect: false },
        ],
      cq: q.cq
        ? {
          description: q.cq.description || '',
          parts: (q.cq.parts || []).map((p) => ({ ...p })),
        }
        : { description: '', parts: [{ label: 'a', text: '' }] },
        solution: q.solution || '',
      rubricText: q.rubricText || '',
      totalMarks: q.totalMarks || '',
       imageUrl: q.imageUrl || '',
      solutionImageUrl: q.solutionImageUrl || '',
      tags: Array.isArray(q.tags) ? q.tags.map((t) => ({ ...t })) : [],
    });
  };

  const closeEditModal = () => {
    setEditingQuestion(null);
    setEditForm(null);
    setSavingEdit(false);
  };

  const updateEditOption = (idx, field, value) => {
    setEditForm((prev) => {
      const next = { ...prev, options: [...prev.options] };
      next.options[idx] = { ...next.options[idx], [field]: value };
      return next;
    });
  };

  const updateEditCqPart = (idx, value) => {
    setEditForm((prev) => {
      const next = { ...prev, cq: { ...prev.cq, parts: [...prev.cq.parts] } };
      next.cq.parts[idx] = { ...next.cq.parts[idx], text: value };
      return next;
    });
  };

  const addEditTag = (category) => {
    setEditForm((prev) => {
      const tags = [...(prev.tags || [])];
      if (category === 'board') tags.push({ category: 'board', board: '', year: '' });
      else if (category === 'college') tags.push({ category: 'college', college: '', year: '' });
      else tags.push({ category: 'admission', university: '', unit: '', year: '', shift: '' });
      return { ...prev, tags };
    });
  };

  const updateEditTag = (idx, field, value) => {
    setEditForm((prev) => {
      const tags = (prev.tags || []).map((t, i) => (i === idx ? { ...t, [field]: value } : t));
      return { ...prev, tags };
    });
  };

  const removeEditTag = (idx) => {
    setEditForm((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion || !editForm) return;
    setSavingEdit(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const payload = {
        questionText: editForm.questionText,
        subject: editForm.subject,
        paper: editForm.paper === '' ? undefined : editForm.paper,
        chapter: editForm.chapter,
        topic: editForm.topic,
        type: editForm.type,
        imageUrl: editForm.imageUrl,
        solutionImageUrl: editForm.solutionImageUrl,
        solution: editForm.solution,
        rubricText: editForm.rubricText,
        totalMarks: editForm.totalMarks === '' ? undefined : Number(editForm.totalMarks),
      };
      if (editForm.type === 'mcq' || editForm.type === 'written') {
        payload.options = editForm.options;
      } else if (editForm.type === 'cq') {
        payload.cq = editForm.cq;
      }
      payload.tags = editForm.tags || [];
      const res = await fetch(`${API_URL}/questions/${editingQuestion._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Update failed');
      }
      showToast('success', t('uq.recent.update_success'));
      closeEditModal();
      await fetchRecentQuestions();
    } catch (err) {
      showToast('error', err.message || t('uq.recent.update_error'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!id) {
      console.warn('[handleDeleteQuestion] called without id');
      return;
    }
    setDeletingId(id);
    // Snapshot for rollback in case the server call fails
    const snapshot = recentQuestions;
    // Optimistically remove from UI so the action feels instant
    setRecentQuestions((prev) => prev.filter((q) => q._id !== id));
    setConfirmDeleteId(null);
    try {
      const token = localStorage.getItem('topkorbo_token');
      if (!token) {
        throw new Error('You are not signed in. Please sign in again.');
      }
      const url = `${API_URL}/questions/${id}`;
      console.log('[handleDeleteQuestion] DELETE', url);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      let data = {};
      try { data = await res.json(); } catch { /* empty body is OK for DELETE */ }
      console.log('[handleDeleteQuestion] response', res.status, data);
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Delete failed (status ${res.status})`);
      }
      showToast('success', t('uq.recent.delete_success'));
      // Re-fetch to make sure the list is fully in sync with the server
      try { await fetchRecentQuestions(); } catch (e) { console.error('[handleDeleteQuestion] refetch failed', e); }
    } catch (err) {
      // Restore the question we just removed so the UI matches reality
      setRecentQuestions(snapshot);
      console.error('[handleDeleteQuestion]', err);
      showToast('error', err.message || t('uq.recent.delete_error'));
    } finally {
      setDeletingId(null);
    }
  };

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

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;

    const fetchTaxonomy = async () => {
      try {
        const res = await fetch(`${API_URL}/questions/taxonomy`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.tree)) {
          setTaxonomyTree(data.data.tree);
        }
      } catch (err) {
        console.error('Error fetching academic taxonomy:', err);
      }
    };

    fetchTaxonomy();
  }, [API_URL]);

  const taxonomySubjects = useMemo(() => (
    (taxonomyTree || []).map((subjectNode) => ({
      id: subjectNode.name,
      labelEn: subjectNode.name,
      labelBn: subjectNode.name,
      papers: (subjectNode.children || []).map((paperNode) => paperNode.name)
    }))
  ), [taxonomyTree]);

  const taxonomyChapterMap = useMemo(() => {
    const map = {};
    (taxonomyTree || []).forEach((subjectNode) => {
      (subjectNode.children || []).forEach((paperNode) => {
        map[`${subjectNode.name}__${paperNode.name}`] = (paperNode.children || []).map((chapterNode) => chapterNode.name);
      });
    });
    return map;
  }, [taxonomyTree]);

  const subjectOptions = taxonomySubjects.length ? taxonomySubjects : HSC_SUBJECTS;

  // Derived: available papers/chapters
  const selectedSubjectData = subjectOptions.find(s => s.id === subject);
  const availablePapers = selectedSubjectData?.papers || [];
  const chapterKey = `${subject}__${paper}`;
  const availableChapters = taxonomySubjects.length
    ? (taxonomyChapterMap[chapterKey] || [])
    : (CHAPTERS_MAP[chapterKey] || []);

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

  const handleSolutionImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (typeof showToast === 'function') {
         showToast('error', language === 'en' ? 'Image must be under 5MB' : 'ছবি ৫ মেগাবাইটের নিচে হতে হবে');
      } else {
         toast.error(language === 'en' ? 'Image must be under 5MB' : 'ছবি ৫ মেগাবাইটের নিচে হতে হবে');
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      setSolutionImageUrl(reader.result);

      try {
        const { mimeType, base64 } = aihSplitDataUrl(reader.result);
        toast.loading(language === 'en' ? 'Extracting text from image...' : 'ছবি থেকে টেক্সট এক্সট্র্যাক্ট করা হচ্ছে...', { id: 'sol-extract' });

        const result = await aiApi.extract({ mode: 'solution', imageBase64: base64, mimeType });
        if (result && result.extracted) {
          const parts = [];
          if (result.extracted.questionText) parts.push(result.extracted.questionText);
          if (result.extracted.solution) parts.push(result.extracted.solution);
          const combined = parts.join('\n\n');
          if (combined) {
            setSolution(prev => prev ? prev + '\n\n' + combined : combined);
            toast.success(language === 'en' ? 'Text extracted from image!' : 'ছবি থেকে টেক্সট এক্সট্র্যাক্ট হয়েছে!', { id: 'sol-extract' });
          } else {
             toast.dismiss('sol-extract');
          }
        } else {
          toast.dismiss('sol-extract');
        }
      } catch (err) {
        toast.error(err.message || 'Failed to extract text', { id: 'sol-extract' });
      }
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
        rubricText: questionType === 'cq' || questionType === 'written' ? rubricText.trim() : '',
        totalMarks: questionType === 'cq' || questionType === 'written'
          ? (aiRubricMarks ? Number(aiRubricMarks) : undefined)
          : undefined,
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
         setRubricText('');
         setAiRubricMarks('');
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
    setUqToast({ type, msg });
    setTimeout(() => setUqToast(null), 4000);
  };

  // ──────────────────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />

      <main className="dashboard-main">

        <div className="uq-workspace">
          {/* ── Toast ── */}
          {uqToast && (
            <div className={`uq-toast uq-toast--${uqToast.type}`}>
              {uqToast.type === 'success' ? <HiCheckCircle size={18} /> : <HiX size={18} />}
              {uqToast.msg}
            </div>
          )}

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

          {/* ── Section: Evaluation Rubric (CQ/Written Only) ── */}
          {(questionType === 'cq' || questionType === 'written') && (
            <div className="uq-section animate-fade-in" style={{ marginTop: '2rem' }}>
              <div className="uq-section__title">
                <span className="uq-section__title-icon"><HiClipboardList size={18} /></span>
                {language === 'en' ? 'Evaluation Rubric' : 'মূল্যায়ন রুব্রিক'}
              </div>
              <p className="uq-section__desc">
                {language === 'en'
                  ? 'Define the step-by-step criteria and marks for AI evaluation. Be as specific as possible (e.g. "Identify formula F=ma: 1 mark").'
                  : 'AI মূল্যায়নের জন্য ধাপে ধাপে মানদণ্ড এবং নম্বর নির্ধারণ করুন। যতটা সম্ভব সুনির্দিষ্ট হোন।'}
              </p>

              {/* ── Mini AI Rubric Helper ── */}
              <div style={{ marginBottom: '18px', border: '1.5px dashed rgba(192,133,82,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 18px', background: 'rgba(192,133,82,0.03)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setShowAiRubricHelper(prev => !prev)}
                >
                  <HiOutlineSparkles size={16} style={{ color: 'var(--sky-blue)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {language === 'en' ? 'AI Rubric Extractor' : 'এআই রুব্রিক এক্সট্র্যাক্টর'}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {showAiRubricHelper ? (language === 'en' ? '▲ Collapse' : '▲ সংকুচিত') : (language === 'en' ? '▼ Expand' : '▼ বিস্তারিত')}
                  </span>
                </div>
                {showAiRubricHelper && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                      {language === 'en'
                        ? 'Give AI the teacher-authored question, answer, and total marks. It will build a marking rubric from all three.'
                        : 'শিক্ষকের প্রশ্ন, উত্তর এবং মোট নম্বর দিন। AI এই তিনটি তথ্য থেকে মূল্যায়ন রুব্রিক তৈরি করবে।'}
                    </p>
                    {/* ── Marks Input ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <label htmlFor="uq-rubric-marks" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {language === 'en' ? 'Total marks' : 'মোট নম্বর'}
                      </label>
                      <input
                        id="uq-rubric-marks"
                        type="number"
                        min="1"
                        max="100"
                        value={aiRubricMarks}
                        onChange={(e) => setAiRubricMarks(e.target.value)}
                        placeholder={language === 'en' ? 'e.g. 5' : 'যেমন ৫'}
                        disabled={aiRubricIsLoading}
                        style={{
                          width: '90px',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1.5px solid rgba(192,133,82,0.3)',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          textAlign: 'center',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--sky-blue)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'rgba(192,133,82,0.3)'; }}
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {language === 'en' ? 'Rubric criteria will sum to this' : 'রুব্রিক মানদণ্ড এই নম্বরের সমান হবে'}
                      </span>
                    </div>
                    <div className="uq-rubric-source-grid">
                      {[
                        {
                          source: 'question',
                          label: language === 'en' ? 'Teacher question' : 'শিক্ষকের প্রশ্ন',
                          text: aiRubricQuestionText,
                          setText: setAiRubricQuestionText,
                          image: aiRubricQuestionImage,
                          previewSrc: aiRubricQuestionImagePreviewSrc,
                          fileRef: aiRubricQuestionFileInputRef,
                          placeholder: language === 'en' ? 'Type or paste the question…' : 'প্রশ্ন টাইপ বা পেস্ট করুন…',
                          imageLabel: language === 'en' ? 'question image' : 'প্রশ্নের ছবি'
                        },
                        {
                          source: 'answer',
                          label: language === 'en' ? 'Teacher answer / solution' : 'শিক্ষকের উত্তর / সমাধান',
                          text: aiRubricAnswerText,
                          setText: setAiRubricAnswerText,
                          image: aiRubricAnswerImage,
                          previewSrc: aiRubricAnswerImagePreviewSrc,
                          fileRef: aiRubricAnswerFileInputRef,
                          placeholder: language === 'en' ? 'Type or paste the answer…' : 'উত্তর টাইপ বা পেস্ট করুন…',
                          imageLabel: language === 'en' ? 'answer image' : 'উত্তরের ছবি'
                        }
                      ].map((source) => (
                        <div className="uq-rubric-source" key={source.source}>
                          <label className="uq-rubric-source__label" htmlFor={`uq-rubric-${source.source}-text`}>
                            {source.label}
                          </label>
                          <textarea
                            id={`uq-rubric-${source.source}-text`}
                            className="aih-textarea"
                            rows={4}
                            value={source.text}
                            onChange={(e) => source.setText(e.target.value)}
                            placeholder={source.placeholder}
                            disabled={aiRubricIsLoading}
                          />
                          <div className="aih-divider"><span>{language === 'en' ? 'or upload image' : 'অথবা ছবি আপলোড করুন'}</span></div>
                          <div
                            className={`aih-dropzone ${aiRubricDraggingSource === source.source ? 'aih-dropzone--active' : ''}`}
                            onDrop={(e) => onAiRubricDrop(e, source.source)}
                            onDragOver={(e) => onAiRubricDragOver(e, source.source)}
                            onDragLeave={onAiRubricDragLeave}
                            onClick={() => source.fileRef.current && source.fileRef.current.click()}
                            role="button"
                            tabIndex={0}
                            aria-label={`Upload ${source.imageLabel}`}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); source.fileRef.current && source.fileRef.current.click(); } }}
                            style={{ padding: '14px 12px' }}
                          >
                            <input ref={source.fileRef} type="file" accept="image/*" onChange={(e) => onAiRubricFileInputChange(e, source.source)} style={{ display: 'none' }} />
                            {source.previewSrc ? (
                              <div className="aih-dropzone__preview">
                                <img src={source.previewSrc} alt={`${source.label} upload`} style={{ maxHeight: '150px' }} />
                                <div className="aih-dropzone__meta">
                                  <span className="aih-dropzone__name"><HiOutlinePhotograph /> {source.image?.name || 'image'}</span>
                                  <button type="button" className="aih-dropzone__remove" onClick={(e) => { e.stopPropagation(); clearAiRubricImage(source.source); }}><HiX /> {language === 'en' ? 'Remove' : 'মুছুন'}</button>
                                </div>
                              </div>
                            ) : (
                              <div className="aih-dropzone__empty">
                                <HiOutlineUpload size={22} />
                                <p style={{ fontSize: '0.8rem' }}><strong>{language === 'en' ? 'Click to upload' : 'আপলোড করুন'}</strong> {source.imageLabel}</p>
                                <span className="aih-dropzone__hint">{language === 'en' ? 'PNG, JPG — up to ~4 MB' : 'PNG, JPG — সর্বোচ্চ ~৪ MB'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {aiRubricErrorMsg && (
                      <div className="aih-error"><HiOutlineExclamationCircle /><span>{aiRubricErrorMsg}</span></div>
                    )}
                    <div className="aih-actions">
                      <button
                        type="button"
                        className="aih-btn aih-btn--ghost"
                        onClick={handleAiRubricReset}
                        disabled={aiRubricIsLoading || (!aiRubricQuestionText && !aiRubricAnswerText && !aiRubricMarks && !aiRubricQuestionImage && !aiRubricAnswerImage)}
                      >
                        <HiOutlineRefresh /> {language === 'en' ? 'Clear' : 'মুছুন'}
                      </button>
                      <button type="button" className="aih-btn aih-btn--primary" onClick={handleAiRubricExtract} disabled={!aiRubricCanSubmit}>
                        {aiRubricIsLoading ? (<><span className="aih-spinner" /> {language === 'en' ? 'Building rubric…' : 'রুব্রিক তৈরি হচ্ছে…'}</>) : (<><HiOutlineSparkles /> {language === 'en' ? 'Build rubric' : 'রুব্রিক তৈরি করুন'}</>)}
                      </button>
                    </div>
                    {aiRubricIsLoading && (
                      <div className="aih-loading" style={{ padding: '18px 10px' }}>
                        <span className="aih-spinner aih-spinner--lg" />
                        <p>{language === 'en' ? 'Reading question, answer, and marks…' : 'প্রশ্ন, উত্তর এবং নম্বর পড়া হচ্ছে…'}</p>
                      </div>
                    )}
                    {aiRubricExtracted && !aiRubricIsLoading && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span className="aih-result-block__label">{language === 'en' ? 'AI RUBRIC' : 'এআই রুব্রিক'}</span>
                        <div className="uq-rubric-ai-summary">
                          <div><span>{language === 'en' ? 'Question' : 'প্রশ্ন'}</span><strong>{aiRubricExtracted.questionText || '—'}</strong></div>
                          <div><span>{language === 'en' ? 'Answer' : 'উত্তর'}</span><strong>{aiRubricExtracted.answerText || aiRubricExtracted.solution || '—'}</strong></div>
                          <div><span>{language === 'en' ? 'Marks' : 'নম্বর'}</span><strong>{aiRubricExtracted.totalMarks || aiRubricMarks}</strong></div>
                        </div>
                        <div
                          className="aih-katex aih-katex--block"
                          style={{
                            border: '1px solid rgba(75,46,43,0.1)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                            background: 'var(--bg-primary)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.6'
                          }}
                          dangerouslySetInnerHTML={{ __html: aiRubricRenderedPreview }}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button type="button" className="aih-btn aih-btn--primary" onClick={handleApplyRubricToForm}>
                            <HiOutlineSparkles /> {language === 'en' ? 'Apply to Rubric' : 'রুব্রিকে প্রয়োগ করুন'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="uq-latex-editor">
                <div className="uq-editor-row">
                  <div className="uq-editor-row__textarea-col" style={{ width: '100%' }}>
                    <textarea
                      id="uq-rubric-textarea"
                      className="uq-textarea"
                      value={rubricText}
                      onChange={e => setRubricText(e.target.value)}
                      onFocus={() => setFocusedInput({ type: 'rubric', index: null })}
                      placeholder={language === 'en' ? 'Type rubric here (e.g. 1. F=ma [1 mark]\n2. Answer=10N [1 mark])' : 'এখানে রুব্রিক টাইপ করুন...'}
                      rows={6}
                    />
                  </div>
                </div>
                <span className="uq-preview-label">{t('uq.preview')}</span>
                <div
                  className={`uq-preview-box ${!rubricText.trim() ? 'uq-preview-box--empty' : ''}`}
                  style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: rubricText.trim()
                        ? renderLatex(rubricText)
                        : (language === 'en' ? 'LaTeX preview of the rubric will appear here…' : 'রুব্রিকের LaTeX প্রিভিউ এখানে দেখা যাবে…')
                    }}
                  />
                </div>
              </div>
            </div>
          )}

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
                <select
                  className="uq-select"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setPaper('');
                    setChapter('');
                    setTopic('');
                  }}
                >
                  <option value="">{t('uq.field.subject.placeholder')}</option>
                  {subjectOptions.map(s => (
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
                  onChange={(e) => {
                    setPaper(e.target.value);
                    setChapter('');
                    setTopic('');
                  }}
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
                    <div className="uq-recent-card__actions">
                      <button
                        type="button"
                        className="uq-recent-card__action uq-recent-card__action--solution"
                        onClick={() => setViewingSolutionFor(q)}
                        title={t('uq.recent.view_solution')}
                      >
                        <HiOutlineLightBulb size={15} />
                        <span>{t('uq.recent.view_solution')}</span>
                      </button>
                      <button
                        type="button"
                        className="uq-recent-card__action uq-recent-card__action--edit"
                        onClick={() => openEditModal(q)}
                        title={t('uq.recent.edit')}
                      >
                        <HiOutlinePencilAlt size={15} />
                        <span>{t('uq.recent.edit')}</span>
                      </button>
                      <button
                        type="button"
                        className="uq-recent-card__action uq-recent-card__action--delete"
                        onClick={() => setConfirmDeleteId(q._id)}
                        title={t('uq.recent.delete')}
                      >
                        <HiOutlineTrash size={15} />
                        <span>{t('uq.recent.delete')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Delete Confirmation Dialog ── */}
          {confirmDeleteId && (
            <div className="uq-modal-backdrop" onClick={() => setConfirmDeleteId(null)}>
              <div className="uq-modal uq-modal--confirm" onClick={(e) => e.stopPropagation()}>
                <div className="uq-modal__icon uq-modal__icon--danger">
                  <HiOutlineTrash size={28} />
                </div>
                <h3 className="uq-modal__title">{t('uq.recent.delete_confirm_title')}</h3>
                <p className="uq-modal__desc">{t('uq.recent.delete_confirm')}</p>
                <div className="uq-modal__actions">
                  <button
                    type="button"
                    className="uq-modal__btn uq-modal__btn--ghost"
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deletingId === confirmDeleteId}
                  >
                    {t('uq.recent.confirm_no')}
                  </button>
                  <button
                    type="button"
                    className="uq-modal__btn uq-modal__btn--danger"
                    onClick={() => handleDeleteQuestion(confirmDeleteId)}
                    disabled={deletingId === confirmDeleteId}
                  >
                    {deletingId === confirmDeleteId ? t('uq.recent.saving') : t('uq.recent.confirm_yes')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Solution Viewer Modal ── */}
          {viewingSolutionFor && (
            <div className="uq-modal-backdrop" onClick={() => setViewingSolutionFor(null)}>
              <div className="uq-modal uq-modal--solution" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="uq-modal__close"
                  onClick={() => setViewingSolutionFor(null)}
                  aria-label="Close"
                >
                  <HiX size={18} />
                </button>
                <div className="uq-modal__icon uq-modal__icon--solution">
                  <HiOutlineLightBulb size={28} />
                </div>
                <h3 className="uq-modal__title">{t('uq.recent.solution_title')}</h3>
                <div className="uq-modal__meta">
                  {viewingSolutionFor.subject} · Paper {viewingSolutionFor.paper} · {viewingSolutionFor.chapter}
                </div>
                <div
                  className="uq-modal__question"
                  dangerouslySetInnerHTML={{ __html: renderLatex(viewingSolutionFor.questionText) }}
                />
                {viewingSolutionFor.solutionImageUrl && (
                  <div className="uq-modal__solution-image">
                    <img src={viewingSolutionFor.solutionImageUrl} alt="Solution diagram" />
                  </div>
                )}
                {viewingSolutionFor.solution ? (
                  <div
                    className="uq-modal__solution"
                    dangerouslySetInnerHTML={{ __html: renderLatex(viewingSolutionFor.solution) }}
                  />
                ) : (
                  <div className="uq-modal__solution uq-modal__solution--empty">
                    {t('uq.recent.empty_solution')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Edit Question Modal ── */}
          {editingQuestion && editForm && (() => {
            // Inline derivations for the edit modal's classification dropdowns
            const editSubjectData = subjectOptions.find(s => s.id === editForm.subject);
            const editPapers = editSubjectData?.papers || [];
            const editChapters = taxonomySubjects.length
              ? (taxonomyChapterMap[`${editForm.subject}__${editForm.paper}`] || [])
              : (CHAPTERS_MAP[`${editForm.subject}__${editForm.paper}`] || []);
            return (
              <div className="uq-modal-backdrop" onClick={closeEditModal}>
                <div className="uq-modal uq-modal--edit" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="uq-modal__close"
                    onClick={closeEditModal}
                    aria-label="Close"
                  >
                    <HiX size={18} />
                  </button>
                  <div className="uq-modal__icon uq-modal__icon--edit">
                    <HiOutlinePencilAlt size={28} />
                  </div>
                  <h3 className="uq-modal__title">{t('uq.recent.edit_modal_title')}</h3>

                  <div className="uq-modal__form">
                    {/* Question Type */}
                    <div className="uq-modal__section">
                      <div className="uq-modal__section-title">{t('uq.recent.field.type')}</div>
                      <div className="uq-modal__type-grid">
                        {[
                          { id: 'mcq', label: t('uq.type.mcq') },
                          { id: 'written', label: t('uq.type.written') },
                          { id: 'cq', label: t('uq.type.cq') },
                        ].map(tp => (
                          <button
                            key={tp.id}
                            type="button"
                            className={`uq-modal__type-btn ${editForm.type === tp.id ? 'uq-modal__type-btn--active' : ''}`}
                            onClick={() => setEditForm((p) => ({ ...p, type: tp.id }))}
                          >
                            {tp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question Body + Live Preview */}
                    <div className="uq-modal__section">
                      <div className="uq-modal__section-title">{t('uq.recent.field.question')}</div>
                      <textarea
                        className="uq-modal__input uq-modal__input--textarea"
                        value={editForm.questionText}
                        onChange={(e) => setEditForm((p) => ({ ...p, questionText: e.target.value }))}
                        rows={3}
                        placeholder={t('uq.question.placeholder')}
                      />
                      <div className="uq-modal__preview-label">{t('uq.recent.preview.question')}</div>
                      <div
                        className={`uq-modal__preview ${!editForm.questionText.trim() ? 'uq-modal__preview--empty' : ''}`}
                        dangerouslySetInnerHTML={{
                          __html: editForm.questionText.trim()
                            ? renderLatex(editForm.questionText)
                            : t('uq.recent.preview.empty')
                        }}
                      />
                    </div>

                    {/* MCQ Options + Preview */}
                    {editForm.type === 'mcq' && (
                      <div className="uq-modal__section">
                        <div className="uq-modal__section-title">{t('uq.recent.field.options')}</div>
                        <div className="uq-modal__options">
                          {editForm.options.map((opt, idx) => (
                            <div key={opt.id || idx} className="uq-modal__option">
                              <label className="uq-modal__option-correct">
                                <input
                                  type="radio"
                                  name="uq-edit-correct"
                                  checked={!!opt.isCorrect}
                                  onChange={() => {
                                    setEditForm((prev) => ({
                                      ...prev,
                                      options: prev.options.map((o, i) => ({
                                        ...o,
                                        isCorrect: i === idx,
                                      })),
                                    }));
                                  }}
                                />
                                <span>{opt.id}</span>
                              </label>
                              <input
                                className="uq-modal__input"
                                value={opt.text || ''}
                                placeholder={t('uq.option.placeholder')}
                                onChange={(e) => updateEditOption(idx, 'text', e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="uq-modal__preview-label">{t('uq.recent.preview.options')}</div>
                        <div className="uq-modal__preview">
                          {editForm.options.map((opt, idx) => (
                            <div key={idx} className={`uq-modal__preview-option ${opt.isCorrect ? 'uq-modal__preview-option--correct' : ''}`}>
                              <span className="uq-modal__preview-option-id">{opt.id}.</span>
                              <span
                                className="uq-modal__preview-option-text"
                                dangerouslySetInnerHTML={{
                                  __html: (opt.text || '').trim()
                                    ? renderLatex(opt.text)
                                    : `<em>${t('uq.recent.preview.empty')}</em>`
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Written: simple options editor (kept from previous behavior) */}
                    {editForm.type === 'written' && (
                      <div className="uq-modal__section">
                        <div className="uq-modal__section-title">{t('uq.recent.field.options')}</div>
                        <div className="uq-modal__options">
                          {editForm.options.map((opt, idx) => (
                            <div key={idx} className="uq-modal__option">
                              <input
                                className="uq-modal__input"
                                value={opt.text || ''}
                                placeholder={t('uq.option.placeholder')}
                                onChange={(e) => updateEditOption(idx, 'text', e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CQ Sub-questions */}
                    {editForm.type === 'cq' && (
                      <div className="uq-modal__section">
                        <div className="uq-modal__section-title">{t('uq.cq.description')}</div>
                        <textarea
                          className="uq-modal__input uq-modal__input--textarea"
                          value={editForm.cq.description}
                          onChange={(e) => setEditForm((p) => ({ ...p, cq: { ...p.cq, description: e.target.value } }))}
                          rows={2}
                          placeholder={t('uq.cq.description.placeholder')}
                        />
                        <div className="uq-modal__cq-parts">
                          {editForm.cq.parts.map((part, idx) => (
                            <div key={idx} className="uq-modal__cq-part">
                              <label className="uq-modal__label">
                                {t('uq.recent.cq_subquestion')} {String.fromCharCode(97 + idx)}
                                <input
                                  className="uq-modal__input"
                                  value={part.text || ''}
                                  placeholder={t('uq.cq.part.placeholder')}
                                  onChange={(e) => updateEditCqPart(idx, e.target.value)}
                                />
                              </label>
                              <div
                                className={`uq-modal__preview uq-modal__preview--mini ${!part.text ? 'uq-modal__preview--empty' : ''}`}
                                dangerouslySetInnerHTML={{
                                  __html: (part.text || '').trim()
                                    ? renderLatex(part.text)
                                    : t('uq.recent.preview.empty')
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Solution + Preview */}
                    <div className="uq-modal__section">
                      <div className="uq-modal__section-title">{t('uq.recent.field.solution')}</div>
                      <textarea
                        className="uq-modal__input uq-modal__input--textarea"
                        value={editForm.solution}
                        onChange={(e) => setEditForm((p) => ({ ...p, solution: e.target.value }))}
                        rows={3}
                        placeholder={t('uq.section.solution')}
                      />
                      <div className="uq-modal__preview-label">{t('uq.recent.preview.solution')}</div>
                      <div
                        className={`uq-modal__preview ${!editForm.solution.trim() ? 'uq-modal__preview--empty' : ''}`}
                        dangerouslySetInnerHTML={{
                          __html: editForm.solution.trim()
                            ? renderLatex(editForm.solution)
                            : t('uq.recent.preview.empty')
                        }}
                      />
                    </div>

                    {/* Subject / Paper / Chapter / Topic */}
                    <div className="uq-modal__section">
                      <div className="uq-modal__section-title">{t('uq.recent.field.classification')}</div>
                      <div className="uq-modal__row">
                        <label className="uq-modal__label">
                          {t('uq.field.subject')}
                          <select
                            className="uq-modal__input"
                            value={editForm.subject}
                            onChange={(e) => setEditForm((p) => ({
                              ...p,
                              subject: e.target.value,
                              paper: '',
                              chapter: '',
                              topic: '',
                            }))}
                          >
                            <option value="">{t('uq.field.subject.placeholder')}</option>
                            {subjectOptions.map(s => (
                              <option key={s.id} value={s.id}>
                                {language === 'en' ? s.labelEn : s.labelBn}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="uq-modal__label">
                          {t('uq.field.paper')}
                          <select
                            className="uq-modal__input"
                            value={editForm.paper}
                            disabled={!editForm.subject}
                            onChange={(e) => setEditForm((p) => ({
                              ...p,
                              paper: e.target.value,
                              chapter: '',
                              topic: '',
                            }))}
                          >
                            <option value="">{t('uq.field.paper.placeholder')}</option>
                            {editPapers.map(p => (
                              <option key={p} value={p}>
                                {p === '1st' ? (language === 'en' ? '1st Paper' : '১ম পত্র') : (language === 'en' ? '2nd Paper' : '২য় পত্র')}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="uq-modal__row">
                        <label className="uq-modal__label">
                          {t('uq.field.chapter')}
                          <select
                            className="uq-modal__input"
                            value={editForm.chapter}
                            disabled={!editForm.paper || editChapters.length === 0}
                            onChange={(e) => setEditForm((p) => ({ ...p, chapter: e.target.value }))}
                          >
                            <option value="">{t('uq.field.chapter.placeholder')}</option>
                            {editChapters.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        <label className="uq-modal__label">
                          {t('uq.field.topic')}
                          <input
                            className="uq-modal__input"
                            value={editForm.topic}
                            onChange={(e) => setEditForm((p) => ({ ...p, topic: e.target.value }))}
                            placeholder={t('uq.field.topic.placeholder')}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="uq-modal__section">
                      <div className="uq-modal__section-title">{t('uq.recent.field.tags')}</div>
                      <p className="uq-modal__section-desc">{t('uq.recent.field.tags.desc')}</p>
                      {(editForm.tags || []).length === 0 && (
                        <div className="uq-modal__tags-empty">{t('uq.recent.tag.empty')}</div>
                      )}
                      <div className="uq-modal__tags-list">
                        {(editForm.tags || []).map((tag, idx) => (
                          <div key={idx} className="uq-tag-card">
                            <span className={`uq-tag-badge uq-tag-badge--${tag.category}`}>
                              {tag.category === 'board' ? t('uq.recent.tag.board_label')
                                : tag.category === 'college' ? t('uq.recent.tag.college_label')
                                  : t('uq.recent.tag.admission_label')}
                            </span>
                            <div className="uq-tag-fields">
                              {tag.category === 'board' && (
                                <>
                                  <select
                                    className="uq-select"
                                    value={tag.board || ''}
                                    onChange={e => updateEditTag(idx, 'board', e.target.value)}
                                  >
                                    <option value="">Board</option>
                                    {BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
                                  </select>
                                  <select
                                    className="uq-select"
                                    value={tag.year || ''}
                                    onChange={e => updateEditTag(idx, 'year', e.target.value)}
                                  >
                                    <option value="">{t('uq.recent.tag.year_placeholder')}</option>
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                  </select>
                                </>
                              )}
                              {tag.category === 'college' && (
                                <>
                                  <select
                                    className="uq-select"
                                    value={tag.college || ''}
                                    onChange={e => updateEditTag(idx, 'college', e.target.value)}
                                  >
                                    <option value="">{t('uq.recent.tag.select_college')}</option>
                                    {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <select
                                    className="uq-select"
                                    value={tag.year || ''}
                                    onChange={e => updateEditTag(idx, 'year', e.target.value)}
                                  >
                                    <option value="">{t('uq.recent.tag.year_placeholder')}</option>
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                  </select>
                                </>
                              )}
                              {tag.category === 'admission' && (
                                <>
                                  <select
                                    className="uq-select"
                                    value={tag.university || ''}
                                    onChange={e => updateEditTag(idx, 'university', e.target.value)}
                                  >
                                    <option value="">{t('uq.recent.tag.select_university')}</option>
                                    {UNIVERSITIES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                  </select>
                                  <select
                                    className="uq-select"
                                    value={tag.unit || ''}
                                    onChange={e => updateEditTag(idx, 'unit', e.target.value)}
                                    disabled={!tag.university}
                                  >
                                    <option value="">{t('uq.recent.tag.unit_placeholder')}</option>
                                    {(UNIVERSITIES.find(u => u.id === tag.university)?.units || []).map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                  <select
                                    className="uq-select"
                                    value={tag.year || ''}
                                    onChange={e => updateEditTag(idx, 'year', e.target.value)}
                                  >
                                    <option value="">{t('uq.recent.tag.session_placeholder')}</option>
                                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                  <input
                                    type="text"
                                    className="uq-select"
                                    value={tag.shift || ''}
                                    onChange={e => updateEditTag(idx, 'shift', e.target.value)}
                                    placeholder={t('uq.recent.tag.shift_placeholder')}
                                    style={{ minWidth: '140px' }}
                                  />
                                </>
                              )}
                            </div>
                            <button
                              type="button"
                              className="uq-tag-remove-btn"
                              onClick={() => removeEditTag(idx)}
                              title={t('uq.recent.tag.remove')}
                            >
                              <HiX size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="uq-add-tag-row">
                        <button type="button" className="uq-add-tag-btn uq-add-tag-btn--board" onClick={() => addEditTag('board')}>
                          <HiPlus size={14} /> {t('uq.tag.add_board')}
                        </button>
                        <button type="button" className="uq-add-tag-btn uq-add-tag-btn--college" onClick={() => addEditTag('college')}>
                          <HiPlus size={14} /> {t('uq.tag.add_college')}
                        </button>
                        <button type="button" className="uq-add-tag-btn uq-add-tag-btn--admission" onClick={() => addEditTag('admission')}>
                          <HiPlus size={14} /> {t('uq.tag.add_admission')}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="uq-modal__actions">
                    <button
                      type="button"
                      className="uq-modal__btn uq-modal__btn--ghost"
                      onClick={closeEditModal}
                      disabled={savingEdit}
                    >
                      {t('uq.recent.cancel')}
                    </button>
                    <button
                      type="button"
                      className="uq-modal__btn uq-modal__btn--primary"
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                    >
                      {savingEdit ? t('uq.recent.saving') : t('uq.recent.save')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
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
