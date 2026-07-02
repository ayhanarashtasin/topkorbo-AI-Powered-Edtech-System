import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiAcademicCap,
  HiBeaker,
  HiBookOpen,
  HiBriefcase,
  HiCalendar,
  HiChartBar,
  HiCheckCircle,
  HiClock,
  HiCog,
  HiCollection,
  HiDocumentText,
  HiGlobeAlt,
  HiLibrary,
  HiPencilAlt,
  HiSelector,
  HiTag,
  HiArrowLeft,
  HiPlus,
  HiEye,
  HiPencil,
  HiOutlineClipboardList,
  HiTrash
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './MakeContestQuestion.css';

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


// ─── HSC Subject Data ────────────────────────────────────────────────────────
const HSC_SUBJECTS = [
  { id: 'Physics', labelEn: 'Physics', labelBn: 'পদার্থবিজ্ঞান' },
  { id: 'Chemistry', labelEn: 'Chemistry', labelBn: 'রসায়ন' },
  { id: 'Higher Math', labelEn: 'Higher Math', labelBn: 'উচ্চতর গণিত' },
  { id: 'Biology', labelEn: 'Biology', labelBn: 'জীববিজ্ঞান' },
  { id: 'ICT', labelEn: 'ICT', labelBn: 'তথ্য ও যোগাযোগ প্রযুক্তি' },
  { id: 'English', labelEn: 'English', labelBn: 'ইংরেজি' },
  { id: 'Bangla', labelEn: 'Bangla', labelBn: 'বাংলা' },
];

// ─── Admission Sub-options ───────────────────────────────────────────────────
const ADMISSION_OPTIONS = [
  { id: 'medical', labelEn: 'Medical', labelBn: 'মেডিকেল', icon: HiBriefcase },
  { id: 'varsity', labelEn: 'University', labelBn: 'বিশ্ববিদ্যালয়', icon: HiLibrary },
  { id: 'engineering', labelEn: 'Engineering', labelBn: 'ইঞ্জিনিয়ারিং', icon: HiCog },
];

const VARSITY_OPTIONS = [
  {
    id: 'science',
    badgeEn: 'Science',
    badgeBn: 'বিজ্ঞান',
    labelEn: 'DU A / RU C/ JU A & D/ JnU A/ KU A/ SUST A/ CU A/ GST A',
    labelBn: 'DU A / RU C/ JU A & D/ JnU A/ KU A/ SUST A/ CU A/ GST A',
    icon: HiBeaker
  },
  {
    id: 'commerce',
    badgeEn: 'Commerce',
    badgeBn: 'ব্যবসায় শিক্ষা',
    labelEn: 'DU C / RU B/ JU E/ JnU C/ KU C/ CU C/ GST C',
    labelBn: 'DU C / RU B/ JU E/ JnU C/ KU C/ CU C/ GST C',
    icon: HiChartBar
  },
  {
    id: 'arts',
    badgeEn: 'Humanities',
    badgeBn: 'মানবিক',
    labelEn: 'DU B/ RU A/ JU B & C/ JnU B/ KU B/ CU B & D/ GST B',
    labelBn: 'DU B/ RU A/ JU B & C/ JnU B/ KU B/ CU B & D/ GST B',
    icon: HiPencilAlt
  },
  {
    id: 'iba',
    labelEn: 'IBA',
    labelBn: 'IBA',
    icon: HiBriefcase
  }
];

// ─── Timezone Data ───────────────────────────────────────────────────────────
const TIMEZONES = [
  { id: 'Asia/Dhaka', label: 'Bangladesh (BST)', offset: '+06:00' },
  { id: 'Asia/Kolkata', label: 'India (IST)', offset: '+05:30' },
  { id: 'Asia/Dubai', label: 'Dubai (GST)', offset: '+04:00' },
  { id: 'Europe/London', label: 'London (GMT/BST)', offset: '+00:00' },
  { id: 'America/New_York', label: 'New York (EST)', offset: '-05:00' },
  { id: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
  { id: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+08:00' },
  { id: 'Australia/Sydney', label: 'Sydney (AEST)', offset: '+10:00' },
];

const TZ_OFFSETS = {
  'Asia/Dhaka': '+06:00',
  'Asia/Kolkata': '+05:30',
  'Asia/Dubai': '+04:00',
  'Europe/London': '+00:00',
  'America/New_York': '-05:00',
  'Asia/Tokyo': '+09:00',
  'Asia/Singapore': '+08:00',
  'Australia/Sydney': '+10:00'
};

export default function MakeContestQuestion() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  // ── View Mode: 'list' (default) or 'create' ──
  const [viewMode, setViewMode] = useState('list');
  const [myContests, setMyContests] = useState([]);
  const [loadingContests, setLoadingContests] = useState(false);
  const [selectedContestForView, setSelectedContestForView] = useState(null);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [fetchingQuestionsContestId, setFetchingQuestionsContestId] = useState('');

  // ── Form State ──
  const [contestName, setContestName] = useState(() => sessionStorage.getItem('cc_contestName') || '');
  const [contestDate, setContestDate] = useState(() => sessionStorage.getItem('cc_contestDate') || '');
  const [durationHours, setDurationHours] = useState(() => sessionStorage.getItem('cc_durationHours') || '1');
  const [durationMinutes, setDurationMinutes] = useState(() => sessionStorage.getItem('cc_durationMinutes') || '0');
  const [startHour, setStartHour] = useState(() => sessionStorage.getItem('cc_startHour') || '10');
  const [startMinute, setStartMinute] = useState(() => sessionStorage.getItem('cc_startMinute') || '00');
  const [startPeriod, setStartPeriod] = useState(() => sessionStorage.getItem('cc_startPeriod') || 'AM');
  const [timezone, setTimezone] = useState(() => sessionStorage.getItem('cc_timezone') || 'Asia/Dhaka');
  const [level, setLevel] = useState(() => sessionStorage.getItem('cc_level') || '');
  const [selectedSubjects, setSelectedSubjects] = useState(() => {
    const saved = sessionStorage.getItem('cc_selectedSubjects');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedAdmission, setSelectedAdmission] = useState(() => sessionStorage.getItem('cc_selectedAdmission') || '');
  const [varsitySubtype, setVarsitySubtype] = useState(() => sessionStorage.getItem('cc_varsitySubtype') || '');
  const [questionType, setQuestionType] = useState(() => sessionStorage.getItem('cc_questionType') || 'mcq');

  // ── Persist form state to sessionStorage ──
  useEffect(() => { sessionStorage.setItem('cc_contestName', contestName); }, [contestName]);
  useEffect(() => { sessionStorage.setItem('cc_contestDate', contestDate); }, [contestDate]);
  useEffect(() => { sessionStorage.setItem('cc_durationHours', durationHours); }, [durationHours]);
  useEffect(() => { sessionStorage.setItem('cc_durationMinutes', durationMinutes); }, [durationMinutes]);
  useEffect(() => { sessionStorage.setItem('cc_startHour', startHour); }, [startHour]);
  useEffect(() => { sessionStorage.setItem('cc_startMinute', startMinute); }, [startMinute]);
  useEffect(() => { sessionStorage.setItem('cc_startPeriod', startPeriod); }, [startPeriod]);
  useEffect(() => { sessionStorage.setItem('cc_timezone', timezone); }, [timezone]);
  useEffect(() => { sessionStorage.setItem('cc_level', level); }, [level]);
  useEffect(() => { sessionStorage.setItem('cc_selectedSubjects', JSON.stringify(selectedSubjects)); }, [selectedSubjects]);
  useEffect(() => { sessionStorage.setItem('cc_selectedAdmission', selectedAdmission); }, [selectedAdmission]);
  useEffect(() => { sessionStorage.setItem('cc_varsitySubtype', varsitySubtype); }, [varsitySubtype]);
  useEffect(() => { sessionStorage.setItem('cc_questionType', questionType); }, [questionType]);

  // Keep `questionType` valid when level context changes
  useEffect(() => {
    let validIds;
    if (level === 'hsc') {
      validIds = ['mcq', 'cq', 'both'];
    } else if (level === 'admission' && selectedAdmission === 'medical') {
      validIds = ['mcq'];
    } else if (level === 'admission' && (selectedAdmission === 'varsity' || selectedAdmission === 'engineering')) {
      validIds = ['mcq', 'written', 'both'];
    } else {
      validIds = ['mcq'];
    }
    if (!validIds.includes(questionType)) {
      setQuestionType(validIds[0]);
    }
  }, [level, selectedAdmission]);

  const activeTab = 'make-contest-question';

  // ── Auth Guard & fetch user ──
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { navigate('/'); return; }

    const fetchUserData = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const resData = await res.json();
          const data = resData.data || {};
          setUser({
            name: data.name || '',
            avatar: data.avatar || '',
            email: data.email || '',
            role: data.role || 'student'
          });
          localStorage.setItem('topkorbo_name', data.name || '');
          localStorage.setItem('topkorbo_avatar', data.avatar || '');
          localStorage.setItem('topkorbo_email', data.email || '');
          localStorage.setItem('topkorbo_role', data.role || 'student');
          if (data.role !== 'teacher') navigate('/dashboard');
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    };
    fetchUserData();
  }, [navigate]);

  // ── Fetch teacher's contests ──
  const fetchMyContests = async () => {
    setLoadingContests(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${API_BASE}/contests/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.success && resData.data) {
          setMyContests(resData.data);
        }
      }
    } catch (err) {
      console.error('Error fetching teacher contests:', err);
    } finally {
      setLoadingContests(false);
    }
  };

  useEffect(() => {
    if (user.role === 'teacher') {
      fetchMyContests();
    }
  }, [user.role]);

  // ── Action Handlers ──

  const handleDeleteContest = async (contestId, contestName) => {
    const confirmMessage = language === 'en'
      ? `Are you sure you want to delete the contest "${contestName}"? This action is permanent and cannot be undone.`
      : `আপনি কি নিশ্চিত যে আপনি "${contestName}" কনটেস্টটি মুছে ফেলতে চান? এই অ্যাকশনটি স্থায়ী এবং আর ফেরত আনা যাবে না।`;
      
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const token = localStorage.getItem('topkorbo_token');
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${API_BASE}/contests/${contestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.success) {
          toast.success(language === 'en' ? 'Contest deleted successfully' : 'কনটেস্টটি সফলভাবে মুছে ফেলা হয়েছে');
          fetchMyContests();
        } else {
          toast.error(resData.message || (language === 'en' ? 'Failed to delete contest' : 'কনটেস্ট মুছতে ব্যর্থ হয়েছে'));
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.message || (language === 'en' ? 'Failed to delete contest' : 'কনটেস্ট মুছতে ব্যর্থ হয়েছে'));
      }
    } catch (err) {
      console.error('Error deleting contest:', err);
      toast.error(language === 'en' ? 'Network error occurred' : 'নেটওয়ার্ক ত্রুটি ঘটেছে');
    }
  };

  const hasDraft = () => {
    return !!(
      sessionStorage.getItem('cc_contestName') ||
      sessionStorage.getItem('cc_level') ||
      sessionStorage.getItem('cc_confirmedQuestions') ||
      sessionStorage.getItem('cc_qbank_selectedQuestionIds')
    );
  };

  const handleCreateNewClick = () => {
    // Clear storage for fresh contest creation
    const keysToClear = [
      'cc_contestName',
      'cc_contestDate',
      'cc_durationHours',
      'cc_durationMinutes',
      'cc_startHour',
      'cc_startMinute',
      'cc_startPeriod',
      'cc_timezone',
      'cc_level',
      'cc_selectedSubjects',
      'cc_selectedAdmission',
      'cc_varsitySubtype',
      'cc_questionType',
      'cc_contestData',
      'cc_qbankSelections',
      'cc_confirmedQuestions',
      'cc_qbank_step',
      'cc_qbank_selectedSubjectIds',
      'cc_qbank_selectedChapters',
      'cc_qbank_topicsMap',
      'cc_qbank_selectedTopics',
      'cc_qbank_selectedQuestionIds',
      'cc_qbankQuestions',
      'cc_isEditing',
      'cc_editingContestId'
    ];
    keysToClear.forEach(key => sessionStorage.removeItem(key));

    setContestName('');
    setContestDate('');
    setDurationHours('1');
    setDurationMinutes('0');
    setStartHour('10');
    setStartMinute('00');
    setStartPeriod('AM');
    setTimezone('Asia/Dhaka');
    setLevel('');
    setSelectedSubjects([]);
    setSelectedAdmission('');
    setVarsitySubtype('');
    setQuestionType('mcq');

    setViewMode('create');
  };

  const handleEditQuestions = async (contestId) => {
    setFetchingQuestionsContestId(contestId);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE}/contests/${contestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        const contest = resData.data;

        // Set all details in state
        setContestName(contest.name);
        setContestDate(contest.date);
        setDurationHours(String(contest.duration.hours));
        setDurationMinutes(String(contest.duration.minutes));
        setStartHour(String(contest.startTime.hour));
        setStartMinute(String(contest.startTime.minute).padStart(2, '0'));
        setStartPeriod(contest.startTime.period);
        setTimezone(contest.startTime.timezone);
        setLevel(contest.level);
        setSelectedSubjects(contest.subjects || []);
        setSelectedAdmission(contest.admissionType || '');
        setVarsitySubtype(contest.admissionSubtype || '');
        setQuestionType(contest.questionType);

        // Put detailed fields into sessionStorage
        const contestData = {
          name: contest.name,
          date: contest.date,
          duration: contest.duration,
          startTime: contest.startTime,
          level: contest.level,
          subjects: contest.subjects,
          admissionType: contest.admissionType,
          admissionSubtype: contest.admissionSubtype,
          questionType: contest.questionType
        };

        sessionStorage.setItem('cc_contestName', contest.name);
        sessionStorage.setItem('cc_contestDate', contest.date);
        sessionStorage.setItem('cc_durationHours', String(contest.duration.hours));
        sessionStorage.setItem('cc_durationMinutes', String(contest.duration.minutes));
        sessionStorage.setItem('cc_startHour', String(contest.startTime.hour));
        sessionStorage.setItem('cc_startMinute', String(contest.startTime.minute).padStart(2, '0'));
        sessionStorage.setItem('cc_startPeriod', contest.startTime.period);
        sessionStorage.setItem('cc_timezone', contest.startTime.timezone);
        sessionStorage.setItem('cc_level', contest.level);
        sessionStorage.setItem('cc_selectedSubjects', JSON.stringify(contest.subjects || []));
        sessionStorage.setItem('cc_selectedAdmission', contest.admissionType || '');
        sessionStorage.setItem('cc_varsitySubtype', contest.admissionSubtype || '');
        sessionStorage.setItem('cc_questionType', contest.questionType);
        
        sessionStorage.setItem('cc_contestData', JSON.stringify(contestData));
        sessionStorage.setItem('cc_confirmedQuestions', JSON.stringify(contest.questions || []));
        sessionStorage.setItem('cc_qbankSelections', JSON.stringify(contest.qbankSelections || null));
        sessionStorage.setItem('cc_isEditing', 'true');
        sessionStorage.setItem('cc_editingContestId', contest._id);

        // Clear sub-page storage keys
        [
          'cc_qbank_step',
          'cc_qbank_selectedSubjectIds',
          'cc_qbank_selectedChapters',
          'cc_qbank_topicsMap',
          'cc_qbank_selectedTopics',
          'cc_qbank_selectedQuestionIds',
          'cc_qbankQuestions'
        ].forEach(k => sessionStorage.removeItem(k));

        // Go directly to questions editing step
        navigate('/make-contest-question/next-two');
      } else {
        toast.error(resData.message || 'Failed to load contest questions');
      }
    } catch (err) {
      console.error('Error fetching questions for edit:', err);
      toast.error('Network error loading contest details');
    } finally {
      setFetchingQuestionsContestId('');
    }
  };

  const handleViewQuestions = async (contestId) => {
    setFetchingQuestionsContestId(contestId);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE}/contests/${contestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setSelectedContestForView(resData.data);
        setShowQuestionsModal(true);
      } else {
        toast.error(resData.message || 'Failed to load questions');
      }
    } catch (err) {
      console.error('Error viewing questions:', err);
      toast.error('Network error loading questions');
    } finally {
      setFetchingQuestionsContestId('');
    }
  };

  // ── Helper: determine if contest ended ──
  const isContestEnded = (c) => {
    const nowTime = new Date().getTime();
    const tz = c.startTime?.timezone || 'Asia/Dhaka';
    const offset = TZ_OFFSETS[tz] || '+06:00';
    let hour = c.startTime?.hour || 12;
    const minute = c.startTime?.minute || 0;
    const period = c.startTime?.period || 'AM';

    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    const pad = (num) => String(num).padStart(2, '0');
    const startMs = new Date(`${c.date}T${pad(hour)}:${pad(minute)}:00${offset}`).getTime();
    const durationHours = c.duration?.hours || 0;
    const durationMinutes = c.duration?.minutes || 0;
    const endMs = startMs + (durationHours * 60 * 60 * 1000) + (durationMinutes * 60 * 1000);

    return nowTime > endMs;
  };

  // ── Subject Toggle (max 2) ──
  const toggleSubject = (subjectId) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(s => s !== subjectId);
      }
      return [...prev, subjectId];
    });
  };

  // ── Level Change Handler ──
  const handleLevelChange = (newLevel) => {
    setLevel(newLevel);
    setSelectedSubjects([]);
    setSelectedAdmission('');
    setVarsitySubtype('');
  };

  // ── Proceed to Next Page ──
  const handleProceedToQuestions = () => {
    const isEnglish = language === 'en';

    if (!contestName.trim()) {
      toast.error(isEnglish ? 'Please enter a contest name' : 'কনটেস্টের নাম লিখুন');
      return;
    }
    if (!contestDate) {
      toast.error(isEnglish ? 'Please select a contest date' : 'কনটেস্টের তারিখ নির্বাচন করুন');
      return;
    }
    if (!level) {
      toast.error(isEnglish ? 'Please select a level (HSC or Admission)' : 'লেভেল নির্বাচন করুন (HSC অথবা এডমিশন)');
      return;
    }
    if (level === 'hsc' && selectedSubjects.length === 0) {
      toast.error(isEnglish ? 'Please select at least one subject' : 'কমপক্ষে একটি বিষয় নির্বাচন করুন');
      return;
    }
    if (level === 'admission' && !selectedAdmission) {
      toast.error(isEnglish ? 'Please select an admission type' : 'এডমিশনের ধরন নির্বাচন করুন');
      return;
    }
    if (level === 'admission' && selectedAdmission === 'varsity' && !varsitySubtype) {
      toast.error(isEnglish ? 'Please select a varsity sub-type' : 'ভার্সিটি ইউনিট নির্বাচন করুন');
      return;
    }
    if (!questionType) {
      toast.error(isEnglish ? 'Please select a question type' : 'প্রশ্নের ধরন নির্বাচন করুন');
      return;
    }

    const contestData = {
      name: contestName.trim(),
      date: contestDate,
      duration: {
        hours: parseInt(durationHours),
        minutes: parseInt(durationMinutes)
      },
      startTime: {
        hour: parseInt(startHour),
        minute: parseInt(startMinute),
        period: startPeriod,
        timezone
      },
      level,
      ...(level === 'hsc' ? { subjects: selectedSubjects } : {}),
      ...(level === 'admission' ? { admissionType: selectedAdmission } : {}),
      ...(level === 'admission' && selectedAdmission === 'varsity' ? { admissionSubtype: varsitySubtype } : {}),
      questionType
    };

    sessionStorage.setItem('cc_contestData', JSON.stringify(contestData));

    navigate('/make-contest-question/next-two', { state: { contestData } });
  };

  const today = new Date().toISOString().split('T')[0];

  let questionTypeOptions;
  if (level === 'hsc') {
    questionTypeOptions = [
      { id: 'mcq', labelEn: 'MCQ (Multiple Choice)', labelBn: 'MCQ (বহুনির্বাচনী)', icon: HiSelector },
      { id: 'cq', labelEn: 'CQ (Creative Question)', labelBn: 'CQ (সৃজনশীল)', icon: HiDocumentText },
      { id: 'both', labelEn: 'Both MCQ and CQ', labelBn: 'MCQ এবং CQ উভয়ই', icon: HiCollection }
    ];
  } else if (level === 'admission' && selectedAdmission === 'medical') {
    questionTypeOptions = [
      { id: 'mcq', labelEn: 'MCQ (Multiple Choice)', labelBn: 'MCQ (বহুনির্বাচনী)', icon: HiSelector }
    ];
  } else if (level === 'admission' && (selectedAdmission === 'varsity' || selectedAdmission === 'engineering')) {
    questionTypeOptions = [
      { id: 'mcq', labelEn: 'MCQ (Multiple Choice)', labelBn: 'MCQ (বহুনির্বাচনী)', icon: HiSelector },
      { id: 'written', labelEn: 'Written', labelBn: 'লিখিত', icon: HiPencilAlt },
      { id: 'both', labelEn: 'MCQ & Written', labelBn: 'MCQ এবং লিখিত', icon: HiCollection }
    ];
  } else {
    questionTypeOptions = [
      { id: 'mcq', labelEn: 'MCQ (Multiple Choice)', labelBn: 'MCQ (বহুনির্বাচনী)', icon: HiSelector }
    ];
  }

  // ── Formatters ──
  const getFormatLabel = (qtype) => {
    if (qtype === 'mcq') return language === 'en' ? 'MCQ Only' : 'শুধুমাত্র MCQ';
    if (qtype === 'cq') return language === 'en' ? 'CQ Only' : 'শুধুমাত্র CQ';
    if (qtype === 'written') return language === 'en' ? 'Written Only' : 'শুধুমাত্র লিখিত';
    return language === 'en' ? 'MCQ & CQ/Written' : 'MCQ এবং CQ/লিখিত';
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(language === 'en' ? 'en-US' : 'bn-BD', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (startTime) => {
    if (!startTime) return '';
    return `${startTime.hour}:${String(startTime.minute).padStart(2, '0')} ${startTime.period}`;
  };

  // ── Render ──

  return (
    <div className="cc-page">
      <Sidebar activeTab={activeTab} user={user} />

      <main className="cc-page__content">
        
        {/* ════════════════════ VIEW MODE: LIST ════════════════════ */}
        {viewMode === 'list' && (
          <div className="cc-page-fade">
            <div className="cc-page__header">
              <div className="cc-page__badge">
                <span className="cc-page__badge-dot"></span>
                Teacher Studio
              </div>
              <h1 className="cc-page__title">
                {language === 'en' ? 'My Contests' : 'আমার কনটেস্টসমূহ'}
              </h1>
              <p className="cc-page__subtitle">
                {language === 'en'
                  ? 'Manage your created contests, view past contest questions, or edit upcoming ones.'
                  : 'আপনার তৈরি কনটেস্টগুলো পরিচালনা করুন, বিগত কনটেস্টের প্রশ্ন দেখুন, বা আসন্ন কনটেস্টের প্রশ্ন এডিট করুন।'}
              </p>
            </div>

            {loadingContests ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                {language === 'en' ? 'Loading contests...' : 'কনটেস্টসমূহ লোড হচ্ছে...'}
              </div>
            ) : myContests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 24px', background: 'var(--white)', border: '1.2px solid rgba(192, 133, 82, 0.15)', borderRadius: '16px', marginBottom: '2rem' }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📅</span>
                <h3 style={{ fontWeight: '800', fontSize: '1.2rem', margin: '0 0 8px 0' }}>
                  {language === 'en' ? 'No Contests Found' : 'কোনো কনটেস্ট পাওয়া যায়নি'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                  {language === 'en' ? 'You have not created any contests yet.' : 'আপনি এখনও কোনো কনটেস্ট তৈরি করেননি।'}
                </p>
              </div>
            ) : (
              <div className="mc-table-card">
                <div className="mc-table-container">
                  <table className="mc-table">
                    <thead>
                      <tr>
                        <th>{language === 'en' ? 'Contest' : 'কনটেস্ট'}</th>
                        <th>{language === 'en' ? 'Level & Format' : 'লেভেল ও ফরম্যাট'}</th>
                        <th>{language === 'en' ? 'Date' : 'তারিখ'}</th>
                        <th>{language === 'en' ? 'Duration' : 'সময়কাল'}</th>
                        <th>{language === 'en' ? 'Start Time' : 'শুরুর সময়'}</th>
                        <th>{language === 'en' ? 'Action' : 'অ্যাকশন'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myContests.map((c) => {
                        const ended = isContestEnded(c);
                        return (
                          <tr key={c._id} className="mc-row">
                            <td className="mc-contest-name">{c.name}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                  {c.level}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {getFormatLabel(c.questionType)}
                                </span>
                              </div>
                            </td>
                            <td>{formatDate(c.date)}</td>
                            <td>{c.duration.hours}h {c.duration.minutes}m</td>
                            <td>{formatTime(c.startTime)} ({c.startTime?.timezone})</td>
                            <td>
                              <div className="mc-action-cell">
                                {ended ? (
                                  <>
                                    <button
                                      type="button"
                                      className="mc-btn mc-btn--secondary"
                                      onClick={() => handleViewQuestions(c._id)}
                                      disabled={fetchingQuestionsContestId === c._id}
                                    >
                                      <HiEye size={14} />
                                      <span>
                                        {fetchingQuestionsContestId === c._id
                                          ? (language === 'en' ? 'Loading...' : 'লোড হচ্ছে...')
                                          : (language === 'en' ? 'View Questions' : 'প্রশ্ন দেখুন')}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="mc-btn mc-btn--danger"
                                      onClick={() => handleDeleteContest(c._id, c.name)}
                                      disabled={fetchingQuestionsContestId === c._id}
                                    >
                                      <HiTrash size={14} />
                                      <span>
                                        {language === 'en' ? 'Delete' : 'মুছে ফেলুন'}
                                      </span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="mc-btn mc-btn--primary"
                                      onClick={() => handleEditQuestions(c._id)}
                                      disabled={fetchingQuestionsContestId === c._id}
                                    >
                                      <HiPencil size={14} />
                                      <span>
                                        {fetchingQuestionsContestId === c._id
                                          ? (language === 'en' ? 'Loading...' : 'লোড হচ্ছে...')
                                          : (language === 'en' ? 'Edit Questions' : 'প্রশ্ন এডিট করুন')}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="mc-btn mc-btn--danger"
                                      onClick={() => handleDeleteContest(c._id, c.name)}
                                      disabled={fetchingQuestionsContestId === c._id}
                                    >
                                      <HiTrash size={14} />
                                      <span>
                                        {language === 'en' ? 'Delete' : 'মুছে ফেলুন'}
                                      </span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mc-bottom-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {hasDraft() && (
                <button
                  type="button"
                  className="cc-submit-btn"
                  onClick={() => {
                    setContestName(sessionStorage.getItem('cc_contestName') || '');
                    setContestDate(sessionStorage.getItem('cc_contestDate') || '');
                    setDurationHours(sessionStorage.getItem('cc_durationHours') || '1');
                    setDurationMinutes(sessionStorage.getItem('cc_durationMinutes') || '0');
                    setStartHour(sessionStorage.getItem('cc_startHour') || '10');
                    setStartMinute(sessionStorage.getItem('cc_startMinute') || '00');
                    setStartPeriod(sessionStorage.getItem('cc_startPeriod') || 'AM');
                    setTimezone(sessionStorage.getItem('cc_timezone') || 'Asia/Dhaka');
                    setLevel(sessionStorage.getItem('cc_level') || '');
                    
                    const savedSubjects = sessionStorage.getItem('cc_selectedSubjects');
                    setSelectedSubjects(savedSubjects ? JSON.parse(savedSubjects) : []);
                    
                    setSelectedAdmission(sessionStorage.getItem('cc_selectedAdmission') || '');
                    setVarsitySubtype(sessionStorage.getItem('cc_varsitySubtype') || '');
                    setQuestionType(sessionStorage.getItem('cc_questionType') || 'mcq');

                    setViewMode('create');
                  }}
                  style={{
                    background: 'transparent',
                    border: '2px solid rgba(16, 185, 129, 0.4)',
                    color: '#059669',
                    boxShadow: 'none',
                    width: 'auto'
                  }}
                >
                  <HiCheckCircle size={18} />
                  <span>{language === 'en' ? 'Resume Unsaved Draft' : 'অসম্পূর্ণ ড্রাফট পুনরায় শুরু করুন'}</span>
                </button>
              )}

              <button
                type="button"
                className="cc-submit-btn"
                onClick={handleCreateNewClick}
                style={{ width: 'auto' }}
              >
                <HiPlus size={18} />
                <span>{language === 'en' ? 'Create New Contest' : 'নতুন কনটেস্ট তৈরি করুন'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════ VIEW MODE: CREATE FORM ════════════════════ */}
        {viewMode === 'create' && (
          <div className="cc-page-fade">
            <button
              type="button"
              className="cc-back-btn"
              onClick={() => setViewMode('list')}
            >
              <HiArrowLeft size={16} />
              <span>{language === 'en' ? 'Back to My Contests' : 'আমার কনটেস্টে ফিরে যান'}</span>
            </button>

            <div className="cc-page__header">
              <div className="cc-page__badge">
                <span className="cc-page__badge-dot"></span>
                Teacher Studio
              </div>
              <h1 className="cc-page__title">
                {language === 'en' ? 'Create Contest' : 'কনটেস্ট তৈরি'}
              </h1>
              <p className="cc-page__subtitle">
                {language === 'en'
                  ? 'Design and schedule a competitive academic contest for students.'
                  : 'শিক্ষার্থীদের জন্য একটি প্রতিযোগিতামূলক একাডেমিক কনটেস্ট ডিজাইন এবং সময়সূচী নির্ধারণ করুন।'}
              </p>
            </div>

            <div className="cc-form">
              <div className="cc-form-grid">

                {/* ──────── 1. CONTEST NAME ──────── */}
                <section className="cc-section cc-section--name">
                  <div className="cc-section__header">
                    <div className="cc-section__icon"><HiTag size={18} /></div>
                    <div>
                      <h2 className="cc-section__title">
                        {language === 'en' ? 'Contest Name' : 'কনটেস্টের নাম'}
                      </h2>
                      <p className="cc-section__desc">
                        {language === 'en' ? 'Enter a descriptive name for your contest.' : 'আপনার কনটেস্টের জন্য একটি বর্ণনামূলক নাম লিখুন।'}
                      </p>
                    </div>
                  </div>
                  <div className="cc-name-input-container">
                    <input
                      type="text"
                      id="contest-name"
                      className="cc-input"
                      placeholder={language === 'en' ? 'e.g. Science Olympiad 2026' : 'যেমন: বিজ্ঞান অলিম্পিয়াড ২০২৬'}
                      value={contestName}
                      onChange={(e) => setContestName(e.target.value)}
                    />
                  </div>
                </section>

                {/* ──────── 2. CONTEST DATE ──────── */}
                <section className="cc-section cc-section--date">
                  <div className="cc-section__header">
                    <div className="cc-section__icon"><HiCalendar size={18} /></div>
                    <div>
                      <h2 className="cc-section__title">
                        {language === 'en' ? 'Contest Date' : 'কনটেস্টের তারিখ'}
                      </h2>
                      <p className="cc-section__desc">
                        {language === 'en' ? 'Select the date when the contest will take place.' : 'কনটেস্ট অনুষ্ঠিত হওয়ার তারিখ নির্বাচন করুন।'}
                      </p>
                    </div>
                  </div>
                  <div className="cc-date-picker">
                    <input
                      type="date"
                      id="contest-date"
                      className="cc-input cc-input--date"
                      value={contestDate}
                      onChange={(e) => setContestDate(e.target.value)}
                      min={today}
                    />
                    {contestDate && (
                      <div className="cc-date-preview">
                        <HiCalendar size={16} />
                        <span>{new Date(contestDate + 'T00:00:00').toLocaleDateString(language === 'en' ? 'en-US' : 'bn-BD', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* ──────── 3. DURATION ──────── */}
                <section className="cc-section cc-section--duration">
                  <div className="cc-section__header">
                    <div className="cc-section__icon"><HiClock size={18} /></div>
                    <div>
                      <h2 className="cc-section__title">
                        {language === 'en' ? 'Duration' : 'সময়কাল'}
                      </h2>
                      <p className="cc-section__desc">
                        {language === 'en' ? 'Set how long the contest will last (hours and minutes).' : 'কনটেস্ট কতক্ষণ চলবে তা নির্ধারণ করুন (ঘণ্টা ও মিনিট)।'}
                      </p>
                    </div>
                  </div>
                  <div className="cc-duration-row">
                    <div className="cc-duration-group">
                      <label className="cc-label" htmlFor="dur-hours">{language === 'en' ? 'Hours' : 'ঘণ্টা'}</label>
                      <select
                        id="dur-hours"
                        className="cc-select"
                        value={durationHours}
                        onChange={(e) => setDurationHours(e.target.value)}
                      >
                        {[0, 1, 2, 3, 4, 5, 6].map(h => (
                          <option key={h} value={h}>{h} {language === 'en' ? 'hr' : 'ঘণ্টা'}</option>
                        ))}
                      </select>
                    </div>
                    <span className="cc-duration-colon">:</span>
                    <div className="cc-duration-group">
                      <label className="cc-label" htmlFor="dur-mins">{language === 'en' ? 'Minutes' : 'মিনিট'}</label>
                      <select
                        id="dur-mins"
                        className="cc-select"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                      >
                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')} {language === 'en' ? 'min' : 'মিনিট'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="cc-duration-preview">
                      <HiClock size={16} />
                      <span>{durationHours}h {String(durationMinutes).padStart(2, '0')}m</span>
                    </div>
                  </div>
                </section>

                {/* ──────── 4. STARTING TIME ──────── */}
                <section className="cc-section cc-section--start">
                  <div className="cc-section__header">
                    <div className="cc-section__icon"><HiGlobeAlt size={18} /></div>
                    <div>
                      <h2 className="cc-section__title">
                        {language === 'en' ? 'Starting Time' : 'শুরুর সময়'}
                      </h2>
                      <p className="cc-section__desc">
                        {language === 'en' ? 'Set the contest start time with timezone (world clock).' : 'টাইমজোন সহ কনটেস্টের শুরুর সময় নির্ধারণ করুন (বিশ্ব ঘড়ি)।'}
                      </p>
                    </div>
                  </div>
                  <div className="cc-time-row">
                    <div className="cc-time-group">
                      <label className="cc-label" htmlFor="start-hour">{language === 'en' ? 'Hour' : 'ঘণ্টা'}</label>
                      <select
                        id="start-hour"
                        className="cc-select"
                        value={startHour}
                        onChange={(e) => setStartHour(e.target.value)}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                    <span className="cc-time-colon">:</span>
                    <div className="cc-time-group">
                      <label className="cc-label" htmlFor="start-min">{language === 'en' ? 'Minute' : 'মিনিট'}</label>
                      <select
                        id="start-min"
                        className="cc-select"
                        value={startMinute}
                        onChange={(e) => setStartMinute(e.target.value)}
                      >
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="cc-time-group">
                      <label className="cc-label">{language === 'en' ? 'Period' : 'পর্ব'}</label>
                      <div className="cc-period-toggle">
                        <button
                          type="button"
                          className={`cc-period-btn ${startPeriod === 'AM' ? 'cc-period-btn--active' : ''}`}
                          onClick={() => setStartPeriod('AM')}
                        >
                          AM
                        </button>
                        <button
                          type="button"
                          className={`cc-period-btn ${startPeriod === 'PM' ? 'cc-period-btn--active' : ''}`}
                          onClick={() => setStartPeriod('PM')}
                        >
                          PM
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="cc-timezone-row">
                    <div className="cc-time-group cc-time-group--tz">
                      <label className="cc-label" htmlFor="timezone-select">{language === 'en' ? 'Timezone' : 'টাইমজোন'}</label>
                      <select
                        id="timezone-select"
                        className="cc-select cc-select--tz"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz.id} value={tz.id}>{tz.label} ({tz.offset})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* ──────── 5. LEVEL ──────── */}
                <section className="cc-section cc-section--level">
                  <div className="cc-section__header">
                    <div className="cc-section__icon"><HiAcademicCap size={18} /></div>
                    <div>
                      <h2 className="cc-section__title">
                        {language === 'en' ? 'Standard Level' : 'স্ট্যান্ডার্ড লেভেল'}
                      </h2>
                      <p className="cc-section__desc">
                        {language === 'en' ? 'Choose whether this contest follows HSC syllabus or Admission standards.' : 'এই কনটেস্টটি HSC সিলেবাস নাকি এডমিশন স্ট্যান্ডার্ড অনুসরণ করে তা নির্বাচন করুন।'}
                      </p>
                    </div>
                  </div>
                  <div className="cc-level-toggle">
                    <button
                      type="button"
                      className={`cc-level-btn ${level === 'hsc' ? 'cc-level-btn--active' : ''}`}
                      onClick={() => handleLevelChange('hsc')}
                    >
                      <span className="cc-level-btn__icon">🎓</span>
                      <div className="cc-level-btn__label-group">
                        <strong className="cc-level-btn__title">HSC</strong>
                        <span className="cc-level-btn__subtitle">{language === 'en' ? 'Academic Syllabus' : 'একাডেমিক সিলেবাস'}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`cc-level-btn ${level === 'admission' ? 'cc-level-btn--active' : ''}`}
                      onClick={() => handleLevelChange('admission')}
                    >
                      <span className="cc-level-btn__icon">🏛️</span>
                      <div className="cc-level-btn__label-group">
                        <strong className="cc-level-btn__title">{language === 'en' ? 'Admission' : 'এডমিশন'}</strong>
                        <span className="cc-level-btn__subtitle">{language === 'en' ? 'University Standards' : 'বিশ্ববিদ্যালয় স্ট্যান্ডার্ড'}</span>
                      </div>
                    </button>
                  </div>

                  {/* HSC Subjects selection */}
                  {level === 'hsc' && (
                    <div className="cc-subject-section cc-section-fade">
                      <label className="cc-label">{language === 'en' ? 'Select Subjects' : 'বিষয় নির্বাচন করুন'}</label>
                      <div className="cc-subject-grid">
                        {HSC_SUBJECTS.map((sub) => {
                          const isSelected = selectedSubjects.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              className={`cc-subject-chip ${isSelected ? 'cc-subject-chip--active' : ''}`}
                              onClick={() => toggleSubject(sub.id)}
                            >
                              {language === 'en' ? sub.labelEn : sub.labelBn}
                              {isSelected && <HiCheckCircle size={16} className="cc-subject-chip__check" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Admission Type selection */}
                  {level === 'admission' && (
                    <div className="cc-admission-section cc-section-fade">
                      <label className="cc-label">{language === 'en' ? 'Admission Program' : 'এডমিশন প্রোগ্রাম'}</label>
                      <div className="cc-admission-grid">
                        {ADMISSION_OPTIONS.map(opt => {
                          const OptionIcon = opt.icon;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              className={`cc-admission-card ${selectedAdmission === opt.id ? 'cc-admission-card--active' : ''}`}
                              onClick={() => {
                                setSelectedAdmission(opt.id);
                                setVarsitySubtype('');
                              }}
                            >
                              <span className="cc-admission-card__icon"><OptionIcon size={22} /></span>
                              <span className="cc-admission-card__label">
                                {language === 'en' ? opt.labelEn : opt.labelBn}
                              </span>
                              {selectedAdmission === opt.id && (
                                <HiCheckCircle size={18} className="cc-admission-card__check" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Varsity Subtype selection */}
                      {selectedAdmission === 'varsity' && (
                        <div className="cc-varsity-section cc-section-fade">
                          <label className="cc-label">{language === 'en' ? 'Select Target Unit' : 'টার্গেট ইউনিট নির্বাচন করুন'}</label>
                          <div className="cc-admission-grid cc-admission-grid--varsity">
                            {VARSITY_OPTIONS.map(opt => {
                              const OptionIcon = opt.icon;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  className={`cc-admission-card cc-admission-card--varsity ${varsitySubtype === opt.id ? 'cc-admission-card--active' : ''}`}
                                  onClick={() => setVarsitySubtype(opt.id)}
                                >
                                  {opt.badgeEn && (
                                    <span className="cc-admission-card__badge">
                                      {language === 'en' ? opt.badgeEn : opt.badgeBn}
                                    </span>
                                  )}
                                  <span className="cc-admission-card__icon"><OptionIcon size={22} /></span>
                                  <span className="cc-admission-card__label" style={{ padding: opt.badgeEn ? '0.4rem 0.2rem 0' : '0' }}>
                                    {language === 'en' ? opt.labelEn : opt.labelBn}
                                  </span>
                                  {varsitySubtype === opt.id && (
                                    <HiCheckCircle size={18} className={`cc-admission-card__check ${opt.badgeEn ? 'cc-admission-card__check--left' : ''}`} />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>

              </div>

              {/* ──────── 6. QUESTION TYPE ──────── */}
              <section className="cc-section">
                <div className="cc-section__header">
                  <div className="cc-section__icon"><HiDocumentText size={18} /></div>
                  <div>
                    <h2 className="cc-section__title">
                      {language === 'en' ? 'Question Type' : 'প্রশ্নের ধরন'}
                    </h2>
                    <p className="cc-section__desc">
                      {language === 'en' ? 'Select the format of the questions in this contest.' : 'এই কনটেস্টে প্রশ্নের ফরম্যাট নির্বাচন করুন।'}
                    </p>
                  </div>
                </div>

                <div className="cc-qtype-grid">
                  {questionTypeOptions.map(opt => {
                    const OptionIcon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`cc-qtype-card ${questionType === opt.id ? 'cc-qtype-card--active' : ''}`}
                        onClick={() => setQuestionType(opt.id)}
                      >
                        <span className="cc-qtype-card__icon"><OptionIcon size={22} /></span>
                        <span className="cc-qtype-card__label">
                          {language === 'en' ? opt.labelEn : opt.labelBn}
                        </span>
                        {questionType === opt.id && (
                          <HiCheckCircle size={18} className="cc-qtype-card__check" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ──────── PROCEED TO QUESTIONS ──────── */}
              <div className="cc-submit-bar">
                <button
                  type="button"
                  className="cc-submit-btn"
                  onClick={handleProceedToQuestions}
                >
                  <HiDocumentText size={18} />
                  <span>{language === 'en' ? 'Make Contest Question' : 'কনটেস্টের প্রশ্ন তৈরি করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════ PAST QUESTION VIEWER MODAL ════════════════════ */}
      {showQuestionsModal && selectedContestForView && (
        <div className="mc-modal-overlay" onClick={() => setShowQuestionsModal(false)}>
          <div className="mc-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="mc-modal-close" onClick={() => setShowQuestionsModal(false)}>
              &times;
            </button>
            <div className="mc-modal-header">
              <h2>{selectedContestForView.name}</h2>
              <p>
                {language === 'en' ? 'Questions List' : 'প্রশ্নাবলী তালিকা'} • {selectedContestForView.questions?.length || 0} {language === 'en' ? 'questions' : 'টি প্রশ্ন'}
              </p>
            </div>

            <div className="mc-modal-content">
              {(!selectedContestForView.questions || selectedContestForView.questions.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  {language === 'en' ? 'No questions in this contest.' : 'এই কনটেস্টে কোনো প্রশ্ন নেই।'}
                </div>
              ) : (
                selectedContestForView.questions.map((q, idx) => {
                  return (
                    <div key={idx} className="mc-question-item">
                      <div className="mc-q-header">
                        <span className="mc-q-num">
                          {language === 'en' ? `Question ${idx + 1}` : `প্রশ্ন ${idx + 1}`}
                        </span>
                        <div className="mc-q-tags">
                          {q.subject && <span className="mc-q-tag">{q.subject}</span>}
                          {q.paper && <span className="mc-q-tag">{q.paper} paper</span>}
                          {q.chapter && <span className="mc-q-tag">{q.chapter}</span>}
                        </div>
                      </div>

                      <div className="mc-q-text" dangerouslySetInnerHTML={{ __html: renderLatex(q.questionText) }} />

                      {q.imageUrl && (
                        <img src={q.imageUrl} alt="question illustration" className="mc-q-image" />
                      )}

                      {/* MCQ Options */}
                      {q.type === 'mcq' && q.options && q.options.length > 0 && (
                        <div className="mc-q-options">
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={`mc-q-opt ${opt.isCorrect ? 'mc-q-opt--correct' : ''}`}
                            >
                              <strong>{['A', 'B', 'C', 'D'][oIdx] || oIdx + 1}.</strong> <span dangerouslySetInnerHTML={{ __html: renderLatex(opt.text) }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CQ Parts */}
                      {q.type === 'cq' && q.cq && q.cq.parts && (
                        <div className="mc-q-cq-parts">
                          {q.cq.parts.map((p, pIdx) => (
                            <div key={pIdx} className="mc-q-cq-part">
                              <strong>({p.label})</strong> <span dangerouslySetInnerHTML={{ __html: renderLatex(p.text) }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {q.solution && (
                        <div className="mc-q-solution">
                          <strong>{language === 'en' ? 'Explanation/Solution:' : 'ব্যাখ্যা/সমাধান:'}</strong>
                          <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: renderLatex(q.solution) }} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
