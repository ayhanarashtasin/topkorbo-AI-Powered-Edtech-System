import { useState, useEffect, useMemo, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import {
  HiSearch,
  HiLockClosed,
  HiAcademicCap,
  HiArrowLeft,
  HiBookOpen,
  HiOfficeBuilding,
  HiCog,
  HiHeart,
  HiX,
  HiCollection,
  HiPencil,
  HiClock,
  HiQuestionMarkCircle,
  HiChevronRight,
  HiEye,
  HiPlay,
  HiDocumentText,
} from "react-icons/hi";
import Sidebar from "../components/layout/Sidebar";
import "./QuestionBank.css";

const MCQ_ONLY_UNIVERSITIES = ["GST", "AGRI", "CU", "JU", "RU"];
const MCQ_WRITTEN_UNIVERSITIES = ["DU"];

export default function QuestionBank() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return sessionStorage.getItem("qbank_active_sub_tab") || "academic";
  });
  const [activeAdmissionSegment, setActiveAdmissionSegment] = useState(() => {
    return (
      sessionStorage.getItem("qbank_active_admission_segment") || "university"
    );
  });
  const [activeOptionModal, setActiveOptionModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [boardSources, setBoardSources] = useState([]);
  const [collegeSources, setCollegeSources] = useState([]);
  // Modal shown when a board/college card is clicked. Holds the source payload
  // and which sub-screen is active: 'menu' (two CTAs) or 'preview' (list of Qs).
  const [activeSourceModal, setActiveSourceModal] = useState(null); // { source }
  const [sourcesLoading, setSourcesLoading] = useState(false);

  // ── Admission Question Bank state ──
  const [varsityCards, setVarsityCards] = useState([]);
  const [varsityCardsLoading, setVarsityCardsLoading] = useState(false);
  const [user, setUser] = useState({
    name: localStorage.getItem("topkorbo_name") || "Ayhan Arash Tasin",
    avatar: localStorage.getItem("topkorbo_avatar") || "",
    email:
      localStorage.getItem("topkorbo_email") ||
      "ayhan.arash.tasin@g.bracu.ac.bd",
    role: localStorage.getItem("topkorbo_role") || "student",
  });

  const activeTab = "qbank";

  // Fetch the latest user profile details from the backend to ensure absolute synchronization & verify session validity
  useEffect(() => {
    const token = localStorage.getItem("topkorbo_token");

    // Client-side Auth Guard
    if (!token) {
      window.location.href = "/";
      return;
    }

    const fetchUserData = async () => {
      try {
        const backendBaseUrl =
          import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const response = await fetch(`${backendBaseUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem("topkorbo_token");
          window.location.href = "/";
          return;
        }

        const resData = await response.json();
        if (resData.success && resData.data) {
          setUser({
            name: resData.data.name,
            avatar: resData.data.avatar || "",
            email: resData.data.email,
            role: resData.data.role,
          });
          localStorage.setItem("topkorbo_name", resData.data.name);
          localStorage.setItem("topkorbo_avatar", resData.data.avatar || "");
          localStorage.setItem("topkorbo_email", resData.data.email);
          localStorage.setItem("topkorbo_role", resData.data.role);
        }
      } catch (err) {
        console.error("Error fetching user data on question bank:", err);
      }
    };

    fetchUserData();
  }, []);

  // Sync activeSubTab state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("qbank_active_sub_tab", activeSubTab);
  }, [activeSubTab]);

  // Sync activeAdmissionSegment state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(
      "qbank_active_admission_segment",
      activeAdmissionSegment,
    );
  }, [activeAdmissionSegment]);

  // Academic Subject Card Data
  const academicSubjects = [
    {
      id: "english_1",
      titleEn: "English 1st paper",
      titleBn: "ইংরেজি ১ম পত্র",
      type: "card-english-1",
      letter: "A",
      isCustomSvg: false,
    },
    {
      id: "english_2",
      titleEn: "English 2nd paper",
      titleBn: "ইংরেজি ২য় পত্র",
      type: "card-english-2",
      letter: "a",
      isCustomSvg: false,
    },
    {
      id: "bangla_1",
      titleEn: "Bangla 1st paper",
      titleBn: "বাংলা ১ম পত্র",
      type: "card-bangla-1",
      letter: "অ",
      isCustomSvg: false,
    },
    {
      id: "bangla_2",
      titleEn: "Bangla 2nd paper",
      titleBn: "বাংলা ২য় পত্র",
      type: "card-bangla-2",
      letter: "আ",
      isCustomSvg: false,
    },
    {
      id: "ict",
      titleEn: "ICT",
      titleBn: "তথ্য ও যোগাযোগ প্রযুক্তি",
      type: "card-ict",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          <rect
            x="20"
            y="30"
            width="60"
            height="40"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <line
            x1="20"
            y1="62"
            x2="80"
            y2="62"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 35,70 L 65,70 L 70,78 L 30,78 Z"
            fill="currentColor"
            opacity="0.8"
          />
          <line
            x1="45"
            y1="78"
            x2="55"
            y2="78"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="46"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 40,57 C 40,52 60,52 60,57"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      id: "physics_1",
      titleEn: "Physics 1st paper",
      titleBn: "পদার্থবিজ্ঞান ১ম পত্র",
      type: "card-physics-1",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Newton's Cradle */}
          <line
            x1="25"
            y1="25"
            x2="75"
            y2="25"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Threads */}
          <line
            x1="35"
            y1="25"
            x2="35"
            y2="60"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="42"
            y1="25"
            x2="42"
            y2="60"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="50"
            y1="25"
            x2="50"
            y2="60"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="58"
            y1="25"
            x2="58"
            y2="60"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M 66,25 L 76,50" stroke="currentColor" strokeWidth="2" />
          {/* Spheres */}
          <circle cx="35" cy="64" r="4.5" fill="currentColor" />
          <circle cx="42" cy="64" r="4.5" fill="currentColor" />
          <circle cx="50" cy="64" r="4.5" fill="currentColor" />
          <circle cx="58" cy="64" r="4.5" fill="currentColor" />
          <circle cx="78" cy="53" r="4.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "physics_2",
      titleEn: "Physics 2nd paper",
      titleBn: "পদার্থবিজ্ঞান ২য় পত্র",
      type: "card-physics-2",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Electromagnet / Multimeter */}
          <rect
            x="25"
            y="25"
            width="50"
            height="50"
            rx="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <rect
            x="35"
            y="33"
            width="30"
            height="15"
            rx="2"
            fill="currentColor"
            fillOpacity="0.15"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 40,43 A 15,15 0 0,1 60,43"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="50"
            y1="43"
            x2="58"
            y2="35"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="42" cy="60" r="4" fill="currentColor" />
          <circle cx="58" cy="60" r="4" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "chemistry_1",
      titleEn: "Chemistry 1st paper",
      titleBn: "রসায়ন ১ম পত্র",
      type: "card-chemistry-1",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Lab beaker and bubbles */}
          <path
            d="M 35,25 L 45,25 L 45,45 L 30,70 A 8,8 0 0,0 37,80 L 63,80 A 8,8 0 0,0 70,70 L 55,45 L 55,25 L 65,25"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="33"
            y1="65"
            x2="67"
            y2="65"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="43" cy="55" r="3" fill="currentColor" opacity="0.6" />
          <circle cx="52" cy="40" r="2.5" fill="currentColor" opacity="0.6" />
          <circle cx="48" cy="72" r="3.5" fill="currentColor" opacity="0.8" />
          <circle cx="56" cy="74" r="2" fill="currentColor" opacity="0.8" />
        </svg>
      ),
    },
    {
      id: "chemistry_2",
      titleEn: "Chemistry 2nd paper",
      titleBn: "রসায়ন ২য় পত্র",
      type: "card-chemistry-2",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Test tubes */}
          <rect
            x="25"
            y="65"
            width="50"
            height="8"
            rx="2"
            fill="currentColor"
            opacity="0.7"
          />
          <line
            x1="30"
            y1="73"
            x2="30"
            y2="78"
            stroke="currentColor"
            strokeWidth="4"
          />
          <line
            x1="70"
            y1="73"
            x2="70"
            y2="78"
            stroke="currentColor"
            strokeWidth="4"
          />
          <line
            x1="25"
            y1="78"
            x2="75"
            y2="78"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Tubes */}
          <rect
            x="38"
            y="25"
            width="8"
            height="40"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <rect
            x="54"
            y="20"
            width="8"
            height="45"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
      ),
    },
    {
      id: "math_1",
      titleEn: "Higher Math 1st paper",
      titleBn: "উচ্চতর গণিত ১ম পত্র",
      type: "card-math-1",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Notebook & Ruler */}
          <rect
            x="25"
            y="25"
            width="45"
            height="50"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <line
            x1="33"
            y1="35"
            x2="58"
            y2="35"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="33"
            y1="47"
            x2="58"
            y2="47"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="33"
            y1="59"
            x2="50"
            y2="59"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Set square ruler */}
          <path
            d="M 45,75 L 75,75 L 75,45 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M 55,70 L 70,70 L 70,55 Z"
            fill="currentColor"
            opacity="0.3"
          />
        </svg>
      ),
    },
    {
      id: "math_2",
      titleEn: "Higher Math 2nd paper",
      titleBn: "উচ্চতর গণিত ২য় পত্র",
      type: "card-math-2",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Calculator */}
          <rect
            x="28"
            y="22"
            width="44"
            height="56"
            rx="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <rect
            x="36"
            y="30"
            width="28"
            height="10"
            rx="2"
            fill="currentColor"
            fillOpacity="0.15"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="41" cy="50" r="3.5" fill="currentColor" />
          <circle cx="50" cy="50" r="3.5" fill="currentColor" />
          <circle cx="59" cy="50" r="3.5" fill="currentColor" />
          <circle cx="41" cy="60" r="3.5" fill="currentColor" />
          <circle cx="50" cy="60" r="3.5" fill="currentColor" />
          <circle cx="59" cy="60" r="3.5" fill="currentColor" />
          <circle cx="41" cy="70" r="3.5" fill="currentColor" />
          <circle cx="50" cy="70" r="3.5" fill="currentColor" />
          <circle cx="59" cy="70" r="3.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "biology_1",
      titleEn: "Biology 1st paper",
      titleBn: "জীববিজ্ঞান ১ম পত্র",
      type: "card-biology-1",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Microscope */}
          <path
            d="M 30,78 L 70,78"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M 38,78 L 38,65 L 50,60"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle
            cx="50"
            cy="58"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 58,35 L 42,51"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect x="30" y="55" width="16" height="4" fill="currentColor" />
          {/* Slide stage */}
          <line
            x1="35"
            y1="65"
            x2="60"
            y2="65"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
      ),
    },
    {
      id: "biology_2",
      titleEn: "Biology 2nd paper",
      titleBn: "জীববিজ্ঞান ২য় পত্র",
      type: "card-biology-2",
      isCustomSvg: true,
      svg: (
        <svg viewBox="0 0 100 100" className="qbank-card__illustration-svg">
          {/* Brain / Cell DNA illustration */}
          <path
            d="M 30,50 Q 30,25 50,25 Q 70,25 70,50 Q 70,75 50,75 Q 30,75 30,50 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          {/* Helix windings */}
          <path
            d="M 33,40 Q 50,30 67,40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 31,50 Q 50,45 69,50"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 33,60 Q 50,70 67,60"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="42"
            y1="36"
            x2="42"
            y2="44"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="50"
            y1="25"
            x2="50"
            y2="75"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
          <line
            x1="58"
            y1="36"
            x2="58"
            y2="44"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="45"
            y1="58"
            x2="45"
            y2="66"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="55"
            y1="58"
            x2="55"
            y2="66"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
    },
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const formatParam = searchParams.get("format");
  const streamParam = searchParams.get("stream");
  const selectedPrepStream = streamParam;
  const paperParam = subjectParam ? subjectParam.split("_").pop() : "1";

  // Admission Varsity Card Data
  const admissionVarsities = [
    {
      id: "bup",
      name: "BUP",
      color: "var(--univ-bup)",
      bnName: "বিইউপি",
      category: "university",
    },
    {
      id: "gst",
      name: "GST",
      color: "var(--univ-gst)",
      bnName: "জিএসটি",
      category: "university",
    },
    {
      id: "agri",
      name: "AGRI",
      color: "var(--univ-agri)",
      bnName: "কৃষি গুচ্ছ",
      category: "university",
    },
    {
      id: "medical",
      name: "MEDICAL",
      color: "var(--univ-medical)",
      bnName: "মেডিকেল",
      category: "medical",
    },
    {
      id: "dental",
      name: "DENTAL",
      color: "var(--univ-dental)",
      bnName: "ডেন্টাল",
      category: "medical",
    },
    {
      id: "afmc",
      name: "AFMC",
      color: "var(--univ-afmc)",
      bnName: "এএফএমসি",
      category: "medical",
    },
    {
      id: "du",
      name: "DU",
      color: "var(--univ-du)",
      bnName: "ঢাবি",
      category: "university",
    },
    {
      id: "cu",
      name: "CU",
      color: "var(--univ-cu)",
      bnName: "চবি",
      category: "university",
    },
    {
      id: "ju",
      name: "JU",
      color: "var(--univ-ju)",
      bnName: "জাবি",
      category: "university",
    },
    {
      id: "ru",
      name: "RU",
      color: "var(--univ-ru)",
      bnName: "রাবি",
      category: "university",
    },
    {
      id: "buet",
      name: "BUET",
      color: "var(--univ-buet)",
      bnName: "বুয়েট",
      category: "engineering",
    },
    {
      id: "ruet",
      name: "RUET",
      color: "var(--univ-ruet)",
      bnName: "রুয়েট",
      category: "engineering",
    },
    {
      id: "kuet",
      name: "KUET",
      color: "var(--univ-kuet)",
      bnName: "কুয়েট",
      category: "engineering",
    },
    {
      id: "mist",
      name: "MIST",
      color: "var(--univ-mist)",
      bnName: "এমআইএসটি",
      category: "engineering",
    },
    {
      id: "cuet",
      name: "CUET",
      color: "var(--univ-cuet)",
      bnName: "চুয়েট",
      category: "engineering",
    },
    {
      id: "butex",
      name: "BUTEX",
      color: "var(--univ-butex)",
      bnName: "বুটেক্স",
      category: "engineering",
    },
    {
      id: "iut",
      name: "IUT",
      color: "var(--univ-iut)",
      bnName: "আইইউটি",
      category: "engineering",
    },
  ];

  const varsityIdFromUrl = searchParams.get("university");
  const selectedVarsity = useMemo(() => {
    if (!varsityIdFromUrl) return null;
    return (
      admissionVarsities.find(
        (v) => v.id.toUpperCase() === varsityIdFromUrl.toUpperCase(),
      ) || null
    );
  }, [varsityIdFromUrl]);

  const isMcqWritten = useMemo(() => {
    if (!selectedVarsity) return false;
    return MCQ_WRITTEN_UNIVERSITIES.includes(selectedVarsity.id.toUpperCase());
  }, [selectedVarsity]);

  const varsityView = useMemo(() => {
    if (!selectedVarsity) return null;
    return searchParams.get("view") || (isMcqWritten ? "chooser" : "cards");
  }, [selectedVarsity, isMcqWritten, searchParams]);

  const varsityQuestionType = useMemo(() => {
    if (!selectedVarsity) return "mcq";
    return searchParams.get("type") || "mcq";
  }, [selectedVarsity, searchParams]);

  const selectedSubject = useMemo(() => {
    if (!subjectParam) return null;
    return academicSubjects.find((sub) => sub.id === subjectParam) || null;
  }, [subjectParam]);

  // Academic flow: when the user picks a subject paper, they go straight to
  // the MCQ/CQ chooser, then choose a format to drill into the source
  // list (board + college). No other streams are supported from this page.
  const selectedSourceContext = useMemo(() => {
    if (
      !formatParam ||
      !["mcq", "cq"].includes(formatParam) ||
      !selectedSubject
    )
      return null;
    const subjectKeyMap = {
      physics_1: "Physics",
      physics_2: "Physics",
      chemistry_1: "Chemistry",
      chemistry_2: "Chemistry",
      math_1: "Higher Math",
      math_2: "Higher Math",
      biology_1: "Biology",
      biology_2: "Biology",
    };
    const paperMap = { 1: "1st", 2: "2nd" };
    const paperSuffix = selectedSubject.id.slice(-1);
    return {
      subject: subjectKeyMap[selectedSubject.id],
      paper: paperMap[paperSuffix],
      questionType: formatParam,
    };
  }, [formatParam, selectedSubject]);

  // When the user navigates to the source-list screen (subject + paper + questionType),
  // fetch the available boards/colleges for that combination.
  useEffect(() => {
    if (!selectedSourceContext) return;

    const fetchSources = async () => {
      setSourcesLoading(true);
      setBoardSources([]);
      setCollegeSources([]);
      try {
        const token = localStorage.getItem("topkorbo_token");
        const backendBaseUrl =
          import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const params = new URLSearchParams({
          subject: selectedSourceContext.subject,
          paper: selectedSourceContext.paper,
          type: selectedSourceContext.questionType,
        });
        const response = await fetch(
          `${backendBaseUrl}/questions/sources?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const resData = await response.json();
        if (resData.success && resData.data) {
          setBoardSources(resData.data.boards || []);
          setCollegeSources(resData.data.colleges || []);
        }
      } catch (err) {
        console.error("Error fetching question sources:", err);
      } finally {
        setSourcesLoading(false);
      }
    };

    fetchSources();
  }, [selectedSourceContext]);

  useEffect(() => {
    const handleReset = () => {
      setSearchParams({});
    };
    window.addEventListener("reset-qbank", handleReset);
    return () => window.removeEventListener("reset-qbank", handleReset);
  }, [setSearchParams]);

  // Sync activeSubTab when university query parameter is active
  useEffect(() => {
    if (varsityIdFromUrl) {
      setActiveSubTab("admission");
    }
  }, [varsityIdFromUrl]);

  // Fetch admission cards when selectedVarsity, view, or type changes
  useEffect(() => {
    if (selectedVarsity && varsityView === "cards") {
      fetchAdmissionCards(
        selectedVarsity.id.toUpperCase(),
        varsityQuestionType,
      );
    }
  }, [selectedVarsity, varsityView, varsityQuestionType]);

  const handleSubjectClick = (subject) => {
    const targetPapers = [
      "physics_1",
      "physics_2",
      "chemistry_1",
      "chemistry_2",
      "math_1",
      "math_2",
      "biology_1",
      "biology_2",
    ];
    if (targetPapers.includes(subject.id)) {
      setSearchParams({ subject: subject.id });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // When the user clicks a board/college source card, open the two-option
  // action modal (Start Exam vs Show Questions) instead of navigating away.
  const handleSourceCardClick = (source) => {
    setActiveSourceModal({ source });
  };

  // "Start Exam" action – fetches questions for this source and starts mock exam immediately.
  const handleStartExam = async () => {
    if (!selectedSourceContext || !activeSourceModal) return;
    const { source } = activeSourceModal;
    const { subject, paper, questionType } = selectedSourceContext;
    const sourceType = source.sourceType; // 'board' | 'college'
    const name = sourceType === "board" ? source.board : source.college;
    const year = source.year;

    try {
      setSourcesLoading(true);
      const token = localStorage.getItem("topkorbo_token");
      const backendBaseUrl =
        import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const params = new URLSearchParams({
        subject,
        paper,
        sourceType,
        name,
        type: questionType,
      });
      if (year) params.append("year", year);

      const response = await fetch(
        `${backendBaseUrl}/questions/by-source?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const resData = await response.json();
      if (
        resData.success &&
        resData.data &&
        resData.data.questions?.length > 0
      ) {
        const fetchedQuestions = resData.data.questions;

        // Put questions and config in session storage, exactly like MockTest.jsx
        sessionStorage.setItem(
          "mock_exam_questions",
          JSON.stringify(fetchedQuestions),
        );
        // Build a human-readable source label
        const sourceLabel =
          sourceType === "board"
            ? `${name} Board${year ? ` ${year}` : ""}`
            : `${name}${year ? ` ${year}` : ""}`;

        sessionStorage.setItem(
          "mock_exam_config",
          JSON.stringify({
            duration: 25, // default board duration is 25 minutes
            negativeMarking: false,
            questionType,
            standard: "academic",
            totalQuestions: fetchedQuestions.length,
            sourceLabel,
          }),
        );
        sessionStorage.setItem("mock_exam_from_qbank", "true");

        // Clear mock test wizard settings
        [
          "mock_test_step",
          "mock_test_subject_ids",
          "mock_test_chapters",
          "mock_test_selected_topics",
          "mock_exam_standard",
          "mock_question_type",
          "mock_total_questions",
          "mock_exam_duration",
          "mock_negative_marking",
        ].forEach((key) => sessionStorage.removeItem(key));

        closeSourceModal();
        navigate("/mock-test/exam");
      } else {
        alert(
          language === "en"
            ? "No questions found for this source to start exam."
            : "পরীক্ষা শুরু করার জন্য এই উৎসের কোনো প্রশ্ন পাওয়া যায়নি।",
        );
      }
    } catch (err) {
      console.error("Error starting source exam:", err);
      alert(
        language === "en"
          ? "Error starting exam."
          : "পরীক্ষা শুরু করতে সমস্যা হয়েছে।",
      );
    } finally {
      setSourcesLoading(false);
    }
  };

  // "Show Questions" action – open a dedicated page that lists EVERY question
  // in the database for the selected board/college source (no sampling, no
  // cap). The page receives the source via react-router `location.state`.
  const handleShowQuestions = () => {
    if (!selectedSourceContext || !activeSourceModal) return;
    const { source } = activeSourceModal;

    const sourceType = source.sourceType; // 'board' | 'college'
    const name = sourceType === "board" ? source.board : source.college;

    closeSourceModal();
    navigate("/qbank/source-questions", {
      state: {
        sourceType,
        name,
        year: source.year,
        subject: selectedSourceContext.subject,
        paper: selectedSourceContext.paper,
        questionType: selectedSourceContext.questionType,
      },
    });
  };

  const closeSourceModal = () => {
    setActiveSourceModal(null);
  };

  const handleVarsityCardClick = (varsity) => {
    const uniId = varsity.id.toUpperCase();
    if (MCQ_WRITTEN_UNIVERSITIES.includes(uniId)) {
      setSearchParams({ university: uniId, view: "chooser" });
    } else {
      setSearchParams({ university: uniId, view: "cards", type: "mcq" });
    }
  };

  const fetchAdmissionCards = async (university, type) => {
    setVarsityCardsLoading(true);
    setVarsityCards([]);
    try {
      const token = localStorage.getItem("topkorbo_token");
      const backendBaseUrl =
        import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const params = new URLSearchParams({ university });
      if (type) params.append("type", type);

      const response = await fetch(
        `${backendBaseUrl}/questions/admission-cards?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const resData = await response.json();
      if (resData.success && resData.data?.cards) {
        setVarsityCards(resData.data.cards);
      }
    } catch (err) {
      console.error("Error fetching admission cards:", err);
    } finally {
      setVarsityCardsLoading(false);
    }
  };

  const handleVarsityTypeChoice = (type) => {
    if (type === "written") {
      // Navigate to the dedicated varsity written view
      navigate(
        `/qbank/varsity-written?university=${selectedVarsity.id.toUpperCase()}`,
      );
      return;
    }
    setSearchParams({
      university: selectedVarsity.id.toUpperCase(),
      view: "cards",
      type,
    });
  };

  const handleVarsitySourceCardClick = async (card) => {
    // Fetch the actual questions for this card and start exam / show questions
    try {
      setSourcesLoading(true);
      const token = localStorage.getItem("topkorbo_token");
      const backendBaseUrl =
        import.meta.env.VITE_API_URL || "http://localhost:5000/api";

      // Use the existing by-source-like approach but for admission questions
      const match = {
        "tags.category": "admission",
        "tags.university": card.university,
        type: card.type,
      };
      if (card.year) match["tags.year"] = card.year;
      if (card.shift) match["tags.shift"] = card.shift;

      // Build a pseudo-source for the modal
      setActiveSourceModal({
        source: {
          sourceType: "admission",
          university: card.university,
          year: card.year,
          shift: card.shift,
          count: card.count,
          questionType: card.type,
        },
      });
    } catch (err) {
      console.error("Error preparing varsity source modal:", err);
    } finally {
      setSourcesLoading(false);
    }
  };

  // Override handleStartExam to also support admission sources
  const handleStartAdmissionExam = async () => {
    if (
      !activeSourceModal ||
      activeSourceModal.source.sourceType !== "admission"
    )
      return;
    const { source } = activeSourceModal;

    try {
      setSourcesLoading(true);
      const token = localStorage.getItem("topkorbo_token");
      const backendBaseUrl =
        import.meta.env.VITE_API_URL || "http://localhost:5000/api";

      // Fetch ALL questions matching this admission source
      const matchQuery = {
        "tags.category": "admission",
        "tags.university": source.university,
      };
      if (source.year) matchQuery["tags.year"] = source.year;
      if (source.shift) matchQuery["tags.shift"] = source.shift;
      if (source.questionType) matchQuery.type = source.questionType;

      // Use a POST to pass complex filters
      const params = new URLSearchParams({
        subject: "Physics", // We need all subjects, use aggregation
        paper: "1st",
        sourceType: "admission",
        name: source.university,
      });
      if (source.year) params.append("year", source.year);
      if (source.questionType) params.append("type", source.questionType);

      // Directly query using admission filter
      const response = await fetch(
        `${backendBaseUrl}/questions/by-source?sourceType=admission&name=${source.university}&year=${source.year || ""}&type=${source.questionType || ""}&shift=${source.shift || ""}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const resData = await response.json();

      if (resData.success && resData.data?.questions?.length > 0) {
        const fetchedQuestions = resData.data.questions;
        sessionStorage.setItem(
          "mock_exam_questions",
          JSON.stringify(fetchedQuestions),
        );
        // Build a human-readable source label for admission exams
        const admissionSourceLabel = [
          source.university,
          source.year,
          source.shift,
        ]
          .filter(Boolean)
          .join(" · ");

        sessionStorage.setItem(
          "mock_exam_config",
          JSON.stringify({
            duration: 60,
            negativeMarking: true,
            questionType: source.questionType || "mcq",
            standard: "admission",
            totalQuestions: fetchedQuestions.length,
            sourceLabel: admissionSourceLabel,
          }),
        );
        sessionStorage.setItem("mock_exam_from_qbank", "true");

        [
          "mock_test_step",
          "mock_test_subject_ids",
          "mock_test_chapters",
          "mock_test_selected_topics",
          "mock_exam_standard",
          "mock_question_type",
          "mock_total_questions",
          "mock_exam_duration",
          "mock_negative_marking",
        ].forEach((key) => sessionStorage.removeItem(key));

        closeSourceModal();
        navigate("/mock-test/exam");
      } else {
        alert(
          language === "en"
            ? "No questions found for this source to start exam."
            : "পরীক্ষা শুরু করার জন্য এই উৎসের কোনো প্রশ্ন পাওয়া যায়নি।",
        );
      }
    } catch (err) {
      console.error("Error starting admission exam:", err);
      alert(
        language === "en"
          ? "Error starting exam."
          : "পরীক্ষা শুরু করতে সমস্যা হয়েছে।",
      );
    } finally {
      setSourcesLoading(false);
    }
  };

  const handleShowAdmissionQuestions = () => {
    if (
      !activeSourceModal ||
      activeSourceModal.source.sourceType !== "admission"
    )
      return;
    const { source } = activeSourceModal;

    closeSourceModal();
    navigate("/qbank/source-questions", {
      state: {
        sourceType: "admission",
        name: source.university,
        year: source.year,
        shift: source.shift,
        questionType: source.questionType,
      },
    });
  };

  const clearVarsitySelection = () => {
    setVarsityCards([]);
    navigate("/qbank");
  };

  // (Varsity/Engineering/Medical admission options were removed — the qbank
  // now exposes only the Academic Prep card per subject.)

  // Filter items based on active tab and search query
  const filteredAcademicSubjects = academicSubjects.filter((sub) => {
    const query = searchQuery.toLowerCase();
    return (
      sub.titleEn.toLowerCase().includes(query) ||
      sub.titleBn.toLowerCase().includes(query)
    );
  });

  const filteredAdmissionVarsities = admissionVarsities.filter((v) => {
    const query = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(query) ||
      v.bnName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />

      {/* Main Panel Content */}
      <main className="dashboard-main">
        {selectedVarsity ? (
          <div
            key="varsity-options"
            className="qbank-options-page animate-fade-in"
          >
            <header className="dashboard-header qbank-header">
              <button
                type="button"
                className="qbank-back-btn"
                onClick={() => {
                  if (varsityView === "cards" && isMcqWritten) {
                    setVarsityCards([]);
                    setSearchParams({
                      university: selectedVarsity.id.toUpperCase(),
                      view: "chooser",
                    });
                  } else {
                    clearVarsitySelection();
                  }
                }}
              >
                <HiArrowLeft size={16} />
                <span>
                  {varsityView === "cards" && isMcqWritten
                    ? language === "en"
                      ? "Back to Question Format"
                      : "প্রশ্নের ধরনে ফিরে যান"
                    : language === "en"
                      ? "Back to Admission"
                      : "ভর্তি পরীক্ষায় ফিরে যান"}
                </span>
              </button>
              <div className="qbank-options-header-info">
                <h2>
                  {language === "en"
                    ? selectedVarsity.name
                    : selectedVarsity.bnName}
                  {varsityView === "cards"
                    ? ` · ${varsityQuestionType.toUpperCase()} ${language === "en" ? "Questions" : "প্রশ্ন"}`
                    : ""}
                </h2>
                <p>
                  {language === "en"
                    ? "Admission Question Bank"
                    : "ভর্তি পরীক্ষার প্রশ্নব্যাংক"}
                </p>
              </div>
            </header>

            <div className="qbank-workspace">
              {/* DU: MCQ / Written Chooser */}
              {varsityView === "chooser" && (
                <div className="qbank-options-grid">
                  <div
                    className="qbank-option-card qbank-option-card--mcq"
                    style={{ "--option-color": "#10B981" }}
                    onClick={() => handleVarsityTypeChoice("mcq")}
                  >
                    <div
                      className="qbank-option-card__visual"
                      style={{
                        background:
                          "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                      }}
                    >
                      <HiCollection size={28} />
                    </div>
                    <div className="qbank-option-card__info">
                      <h3>
                        {language === "en"
                          ? "MCQ (Multiple Choice)"
                          : "MCQ (বহুনির্বাচনী)"}
                      </h3>
                      <p>
                        {language === "en"
                          ? "Practice admission MCQ questions from past years with answers."
                          : "বিগত বছরের ভর্তি পরীক্ষার MCQ প্রশ্ন উত্তরসহ অনুশীলন করুন।"}
                      </p>
                    </div>
                    <div className="qbank-option-card__action">
                      <span>
                        {language === "en"
                          ? "View MCQ Questions"
                          : "MCQ প্রশ্ন দেখুন"}{" "}
                        &rarr;
                      </span>
                    </div>
                  </div>

                  <div
                    className="qbank-option-card qbank-option-card--cq"
                    style={{ "--option-color": "#6366F1" }}
                    onClick={() => handleVarsityTypeChoice("written")}
                  >
                    <div
                      className="qbank-option-card__visual"
                      style={{
                        background:
                          "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                      }}
                    >
                      <HiPencil size={28} />
                    </div>
                    <div className="qbank-option-card__info">
                      <h3>
                        {language === "en"
                          ? "Written Questions"
                          : "লিখিত প্রশ্ন"}
                      </h3>
                      <p>
                        {language === "en"
                          ? "Practice admission written questions from past years."
                          : "বিগত বছরের ভর্তি পরীক্ষার লিখিত প্রশ্ন অনুশীলন করুন।"}
                      </p>
                    </div>
                    <div className="qbank-option-card__action">
                      <span>
                        {language === "en"
                          ? "View Written Questions"
                          : "লিখিত প্রশ্ন দেখুন"}{" "}
                        &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Admission Source Cards Grid */}
              {varsityView === "cards" && (
                <>
                  {varsityCardsLoading ? (
                    <div className="qbank-empty">
                      <p>
                        {language === "en"
                          ? "Loading questions..."
                          : "প্রশ্ন লোড হচ্ছে..."}
                      </p>
                    </div>
                  ) : varsityCards.length > 0 ? (
                    <section className="qbank-source-section">
                      <h3 className="qbank-source-section-title">
                        <HiOfficeBuilding size={20} />
                        {language === "en"
                          ? `${selectedVarsity.name} — Past Year Questions`
                          : `${selectedVarsity.bnName} — বিগত বছরের প্রশ্ন`}
                      </h3>
                      <div className="qbank-source-grid">
                        {varsityCards.map((card, idx) => (
                          <div
                            key={`adm-${card.university}-${card.year}-${card.shift}-${card.type}-${idx}`}
                            className="qbank-source-card qbank-source-card--admission"
                            onClick={() => handleVarsitySourceCardClick(card)}
                          >
                            <div className="qbank-source-card__glow"></div>
                            <h4 className="qbank-source-card__title">
                              {card.university}
                              {card.year ? ` ${card.year}` : ""}
                            </h4>
                            {card.shift && (
                              <span className="qbank-source-card__shift-badge">
                                {card.shift}
                              </span>
                            )}
                            <div className="qbank-source-card__meta">
                              <span className="qbank-source-card__meta-item">
                                <HiClock size={14} />
                                {language === "en" ? "1 Hour" : "১ ঘন্টা"}
                              </span>
                              <span className="qbank-source-card__meta-item">
                                <HiQuestionMarkCircle size={14} />
                                {language === "en"
                                  ? `${card.count} Questions`
                                  : `${card.count}টি প্রশ্ন`}
                              </span>
                              <span className="qbank-source-card__meta-item">
                                <HiDocumentText size={14} />
                                {card.type.toUpperCase()}
                              </span>
                            </div>
                            <div className="qbank-source-card__action">
                              <span>
                                {language === "en"
                                  ? "Start Practice"
                                  : "অনুশীলন শুরু করুন"}
                              </span>
                              <HiChevronRight size={16} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : (
                    <div className="qbank-empty">
                      <HiDocumentText
                        size={48}
                        style={{ opacity: 0.3, marginBottom: "1rem" }}
                      />
                      <p>
                        {language === "en"
                          ? "No questions found for this university yet."
                          : "এই বিশ্ববিদ্যালয়ের জন্য এখনও কোনো প্রশ্ন পাওয়া যায়নি।"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : selectedSourceContext ? (
          <div className="qbank-options-page animate-fade-in">
            <header className="dashboard-header qbank-header">
              <button
                type="button"
                className="qbank-back-btn"
                onClick={() => setSearchParams({ subject: subjectParam })}
              >
                <HiArrowLeft size={16} />
                <span>
                  {language === "en"
                    ? "Back to Question Format"
                    : "প্রশ্নের ধরনে ফিরে যান"}
                </span>
              </button>
              <div className="qbank-options-header-info">
                <h2>
                  {language === "en"
                    ? `${selectedSubject?.titleEn || ""} · ${formatParam === "cq" ? "CQ Practice" : "MCQ Practice"}`
                    : `${selectedSubject?.titleBn || ""} · ${formatParam === "cq" ? "CQ অনুশীলন" : "MCQ অনুশীলন"}`}
                </h2>
                <p>{t("qbank.sources.subtitle")}</p>
              </div>
            </header>

            <div className="qbank-workspace">
              {sourcesLoading ? (
                <div className="qbank-empty">
                  <p>{t("qbank.sources.loading")}</p>
                </div>
              ) : (
                <>
                  {/* Board sources */}
                  <section className="qbank-source-section">
                    <h3 className="qbank-source-section-title">
                      <HiOfficeBuilding size={20} />
                      {language === "en" ? "Board Questions" : "বোর্ড প্রশ্ন"}
                    </h3>
                    {boardSources.length > 0 ? (
                      <div className="qbank-source-grid">
                        {boardSources.map((src) => (
                          <div
                            key={`board-${src.board}-${src.year}`}
                            className="qbank-source-card qbank-source-card--board"
                            onClick={() =>
                              handleSourceCardClick({
                                ...src,
                                sourceType: "board",
                              })
                            }
                          >
                            <div className="qbank-source-card__glow"></div>
                            <h4 className="qbank-source-card__title">
                              {src.board}
                              {src.year ? ` ${src.year}` : ""}
                            </h4>
                            <div className="qbank-source-card__meta">
                              <span className="qbank-source-card__meta-item">
                                <HiClock size={14} />
                                {t("qbank.sources.time")}
                              </span>
                              <span className="qbank-source-card__meta-item">
                                <HiQuestionMarkCircle size={14} />
                                {t("qbank.sources.questions_count", {
                                  count: src.count,
                                })}
                              </span>
                            </div>
                            <div className="qbank-source-card__action">
                              <span>
                                {language === "en"
                                  ? "Start Practice"
                                  : "অনুশীলন শুরু করুন"}
                              </span>
                              <HiChevronRight size={16} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="qbank-empty">
                        <p>
                          {language === "en"
                            ? "No board questions found for this selection."
                            : "এই নির্বাচনের জন্য কোনো বোর্ড প্রশ্ন পাওয়া যায়নি।"}
                        </p>
                      </div>
                    )}
                  </section>

                  {/* College sources */}
                  <section className="qbank-source-section">
                    <h3 className="qbank-source-section-title">
                      <HiAcademicCap size={20} />
                      {language === "en" ? "College Questions" : "কলেজ প্রশ্ন"}
                    </h3>
                    {collegeSources.length > 0 ? (
                      <div className="qbank-source-grid">
                        {collegeSources.map((src) => (
                          <div
                            key={`college-${src.college}-${src.year}`}
                            className="qbank-source-card qbank-source-card--board"
                            onClick={() =>
                              handleSourceCardClick({
                                ...src,
                                sourceType: "college",
                              })
                            }
                          >
                            <div className="qbank-source-card__glow"></div>
                            <h4 className="qbank-source-card__title">
                              {src.college}
                              {src.year ? ` ${src.year}` : ""}
                            </h4>
                            <div className="qbank-source-card__meta">
                              <span className="qbank-source-card__meta-item">
                                <HiClock size={14} />
                                {t("qbank.sources.time")}
                              </span>
                              <span className="qbank-source-card__meta-item">
                                <HiQuestionMarkCircle size={14} />
                                {t("qbank.sources.questions_count", {
                                  count: src.count,
                                })}
                              </span>
                            </div>
                            <div className="qbank-source-card__action">
                              <span>
                                {language === "en"
                                  ? "Start Practice"
                                  : "অনুশীলন শুরু করুন"}
                              </span>
                              <HiChevronRight size={16} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="qbank-empty">
                        <p>
                          {language === "en"
                            ? "No college questions found for this selection."
                            : "এই নির্বাচনের জন্য কোনো কলেজ প্রশ্ন পাওয়া যায়নি।"}
                        </p>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        ) : selectedSubject ? (
          <div
            key="subject-options"
            className="qbank-options-page animate-fade-in"
          >
            <header className="dashboard-header qbank-header">
              <button
                type="button"
                className="qbank-back-btn"
                onClick={() => navigate("/qbank")}
              >
                <HiArrowLeft size={16} />
                <span>
                  {language === "en"
                    ? "Back to Question Bank"
                    : "প্রশ্নব্যাংকে ফিরে যান"}
                </span>
              </button>
              <div className="qbank-options-header-info">
                <h2>
                  {language === "en"
                    ? selectedSubject.titleEn
                    : selectedSubject.titleBn}
                </h2>
                <p>
                  {language === "en"
                    ? "Choose question format"
                    : "প্রশ্নের ধরন নির্বাচন করুন"}
                </p>
              </div>
            </header>

            <div className="qbank-workspace">
              <div className="qbank-options-grid">
                {/* MCQ Card */}
                <div
                  className="qbank-option-card qbank-option-card--mcq"
                  style={{ "--option-color": "#10B981" }}
                  onClick={() => {
                    setSearchParams({
                      subject: subjectParam,
                      format: "mcq",
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <div
                    className="qbank-option-card__visual"
                    style={{
                      background:
                        "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                    }}
                  >
                    <HiCollection size={28} />
                  </div>
                  <div className="qbank-option-card__info">
                    <h3>
                      {language === "en"
                        ? "MCQ (Multiple Choice)"
                        : "MCQ (বহুনির্বাচনী)"}
                    </h3>
                    <p>
                      {language === "en"
                        ? "Practice chapter-wise multiple choice questions with answers and detailed explanations."
                        : "উত্তর এবং বিস্তারিত ব্যাখ্যাসহ অধ্যায়ভিত্তিক বহুনির্বাচনী প্রশ্ন অনুশীলন করুন।"}
                    </p>
                  </div>
                  <div className="qbank-option-card__action">
                    <span>
                      {language === "en"
                        ? "Start MCQ Practice"
                        : "MCQ অনুশীলন শুরু করুন"}{" "}
                      &rarr;
                    </span>
                  </div>
                </div>

                {/* CQ Card */}
                <div
                  className="qbank-option-card qbank-option-card--cq"
                  style={{ "--option-color": "#6366F1" }}
                  onClick={() => {
                    setSearchParams({ subject: subjectParam, format: "cq" });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <div
                    className="qbank-option-card__visual"
                    style={{
                      background:
                        "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                    }}
                  >
                    <HiPencil size={28} />
                  </div>
                  <div className="qbank-option-card__info">
                    <h3>
                      {language === "en"
                        ? "CQ (Creative Questions)"
                        : "CQ (সৃজনশীল প্রশ্ন)"}
                    </h3>
                    <p>
                      {language === "en"
                        ? "Solve creative question stems, analyze parts A, B, C, D and view manual solutions."
                        : "সৃজনশীল উদ্দীপক সমাধান করুন, ক, খ, গ, ঘ অংশ বিশ্লেষণ করুন এবং সমাধান দেখুন।"}
                    </p>
                  </div>
                  <div className="qbank-option-card__action">
                    <span>
                      {language === "en"
                        ? "Start CQ Practice"
                        : "CQ অনুশীলন শুরু করুন"}{" "}
                      &rarr;
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Fragment key="main-qbank">
            <header className="dashboard-header qbank-header">
              <div className="dashboard-header__welcome">
                <h2>{t("qbank.title")}</h2>
                <p>{t("qbank.subtitle")}</p>
              </div>
              <div className="dashboard-header__actions">
                <span className="dashboard-header__badge">
<<<<<<< HEAD
  { user.role === 'teacher' ? t('db.workspace.teacher') : t('db.workspace') }
=======
                  {t("db.workspace")}
>>>>>>> 6aa5a4c3de341911aeab490f9970ef19cee0f8b8
                </span >
              </div >
            </header >

    {/* Question Bank Workspace Panel */ }
    < div className = "qbank-workspace animate-fade-in" >
      {/* Navigation Control Bar: Tabs & Search */ }
      < div className = "qbank-controls" >
                <div className="qbank-tabs-wrapper">
                  <button
                    type="button"
                    className={`qbank-tab-btn ${activeSubTab === "academic" ? "qbank-tab-btn--active" : ""}`}
                    onClick={() => {
                      setActiveSubTab("academic");
                      setSearchQuery("");
                    }}
                  >
                    {t("qbank.tab.academic")}
                  </button>
                  <button
                    type="button"
                    className={`qbank-tab-btn ${activeSubTab === "admission" ? "qbank-tab-btn--active" : ""}`}
                    onClick={() => {
                      setActiveSubTab("admission");
                      setSearchQuery("");
                    }}
                  >
                    {t("qbank.tab.admission")}
                  </button>
                </div>

                <div className="qbank-search-bar">
                  <span className="qbank-search-icon">
                    <HiSearch size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder={t("qbank.search.placeholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="qbank-search-input"
                  />
                </div>
              </div >

    {/* Tab Description Title */ }
    < div className = "qbank-section-info" >
                <h3>
                  {activeSubTab === "academic" && t("qbank.tab.academic")}
                  {activeSubTab === "admission" && t("qbank.tab.admission")}
                </h3>
                <p>
                  {activeSubTab === "academic" && t("qbank.academic.desc")}
                  {activeSubTab === "admission" && t("qbank.admission.desc")}
                </p>
              </div >

    {/* Gird Content Pane */ }
    < div className = "qbank-grid-container" >
      { activeSubTab === "academic" && (
        <div className="qbank-grid qbank-grid--academic">
          {filteredAcademicSubjects.length > 0 ? (
            filteredAcademicSubjects.map((sub) => (
              <div
                key={sub.id}
                className={`qbank-card qbank-card--academic ${sub.type}`}
                onClick={() => handleSubjectClick(sub)}
              >
                <div className="qbank-card__glow"></div>
                <div className="qbank-card__visual">
                  {sub.isCustomSvg ? (
                    sub.svg
                  ) : (
                    <span className="qbank-card__letter">
                      {sub.letter}
                    </span>
                  )}
                </div>
                <div className="qbank-card__info">
                  <h4 className="qbank-card__subject">
                    {language === "en" ? sub.titleEn : sub.titleBn}
                  </h4>
                  <span className="qbank-card__sub-label">
                    {sub.id.includes("1")
                      ? language === "en"
                        ? "1st paper"
                        : "১ম পত্র"
                      : ""}
                    {sub.id.includes("2")
                      ? language === "en"
                        ? "2nd paper"
                        : "২য় পত্র"
                      : ""}
                    {sub.id === "ict"
                      ? language === "en"
                        ? "HSC Core"
                        : "এইচএসসি আবশ্যিক"
                      : ""}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="qbank-empty">
              <p>
                {language === "en"
                  ? "No subjects found matching your search."
                  : "আপনার অনুসন্ধানের সাথে মেলে এমন কোনো বিষয় পাওয়া যায়নি।"}
              </p>
            </div>
          )}
        </div>
      )
}

{
  activeSubTab === "admission" && (
    <div className="qbank-admission-wrapper">
      {/* Admission Segment Controls (Pills/Tabs) */}
      <div className="qbank-admission-segments">
        <button
          type="button"
          className={`qbank-segment-btn ${activeAdmissionSegment === "university" ? "qbank-segment-btn--active" : ""}`}
          onClick={() => setActiveAdmissionSegment("university")}
        >
          <HiOfficeBuilding size={16} />
          <span>
            {language === "en" ? "University" : "বিশ্ববিদ্যালয়"}
          </span>
        </button>
        <button
          type="button"
          className={`qbank-segment-btn ${activeAdmissionSegment === "engineering" ? "qbank-segment-btn--active" : ""}`}
          onClick={() => setActiveAdmissionSegment("engineering")}
        >
          <HiAcademicCap size={16} />
          <span>
            {language === "en" ? "Engineering" : "ইঞ্জিনিয়ারিং"}
          </span>
        </button>
        <button
          type="button"
          className={`qbank-segment-btn ${activeAdmissionSegment === "medical" ? "qbank-segment-btn--active" : ""}`}
          onClick={() => setActiveAdmissionSegment("medical")}
        >
          <HiHeart size={16} />
          <span>{language === "en" ? "Medical" : "মেডিকেল"}</span>
        </button>
      </div>

      <div className="qbank-admission-container">
        {/* Engineering Section */}
        {activeAdmissionSegment === "engineering" && (
          <div className="qbank-admission-group">
            <h3 className="qbank-admission-group-title">
              <HiAcademicCap
                size={22}
                className="qbank-group-icon"
              />
              <span>
                {language === "en"
                  ? "Engineering Universities"
                  : "ইঞ্জিনিয়ারিং বিশ্ববিদ্যালয়"}
              </span>
              <span className="qbank-group-badge">
                {
                  filteredAdmissionVarsities.filter(
                    (v) => v.category === "engineering",
                  ).length
                }
              </span>
            </h3>
            {filteredAdmissionVarsities.filter(
              (v) => v.category === "engineering",
            ).length > 0 ? (
              <div className="qbank-grid qbank-grid--admission">
                {filteredAdmissionVarsities
                  .filter((v) => v.category === "engineering")
                  .map((v) => (
                    <div
                      key={v.id}
                      className={`qbank-card qbank-card--admission qbank-card--${v.id}`}
                      style={{ "--card-brand": v.color }}
                      onClick={() => handleVarsityCardClick(v)}
                    >
                      <div className="qbank-card__glow"></div>
                      <div className="qbank-card__visual">
                        <span className="qbank-card__letter">
                          {v.name.slice(0, 2)}
                        </span>
                      </div>
                      <div className="qbank-card__info">
                        <h4 className="qbank-card__subject">
                          {v.name}
                        </h4>
                        <span className="qbank-card__sub-label">
                          {language === "en"
                            ? "Question Bank"
                            : "প্রশ্নব্যাংক"}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="qbank-empty">
                <p>
                  {language === "en"
                    ? "No universities found matching your search."
                    : "আপনার অনুসন্ধানের সাথে মেলে এমন কোনো বিশ্ববিদ্যালয় পাওয়া যায়নি।"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Medical Section */}
        {activeAdmissionSegment === "medical" && (
          <div className="qbank-admission-group">
            <h3 className="qbank-admission-group-title">
              <HiHeart size={22} className="qbank-group-icon" />
              <span>
                {language === "en"
                  ? "Medical & Dental"
                  : "মেডিকেল ও ডেন্টাল"}
              </span>
              <span className="qbank-group-badge">
                {
                  filteredAdmissionVarsities.filter(
                    (v) => v.category === "medical",
                  ).length
                }
              </span>
            </h3>
            {filteredAdmissionVarsities.filter(
              (v) => v.category === "medical",
            ).length > 0 ? (
              <div className="qbank-grid qbank-grid--admission">
                {filteredAdmissionVarsities
                  .filter((v) => v.category === "medical")
                  .map((v) => (
                    <div
                      key={v.id}
                      className={`qbank-card qbank-card--admission qbank-card--${v.id}`}
                      style={{ "--card-brand": v.color }}
                      onClick={() => handleVarsityCardClick(v)}
                    >
                      <div className="qbank-card__glow"></div>
                      <div className="qbank-card__visual">
                        <span className="qbank-card__letter">
                          {v.name.slice(0, 2)}
                        </span>
                      </div>
                      <div className="qbank-card__info">
                        <h4 className="qbank-card__subject">
                          {v.name}
                        </h4>
                        <span className="qbank-card__sub-label">
                          {language === "en"
                            ? "Question Bank"
                            : "প্রশ্নব্যাংক"}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="qbank-empty">
                <p>
                  {language === "en"
                    ? "No universities found matching your search."
                    : "আপনার অনুসন্ধানের সাথে মেলে এমন কোনো বিশ্ববিদ্যালয় পাওয়া যায়নি।"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* University Section */}
        {activeAdmissionSegment === "university" && (
          <div className="qbank-admission-group">
            <h3 className="qbank-admission-group-title">
              <HiOfficeBuilding
                size={22}
                className="qbank-group-icon"
              />
              <span>
                {language === "en"
                  ? "General Universities"
                  : "সাধারণ বিশ্ববিদ্যালয়"}
              </span>
              <span className="qbank-group-badge">
                {
                  filteredAdmissionVarsities.filter(
                    (v) => v.category === "university",
                  ).length
                }
              </span>
            </h3>
            {filteredAdmissionVarsities.filter(
              (v) => v.category === "university",
            ).length > 0 ? (
              <div className="qbank-grid qbank-grid--admission">
                {filteredAdmissionVarsities
                  .filter((v) => v.category === "university")
                  .map((v) => (
                    <div
                      key={v.id}
                      className={`qbank-card qbank-card--admission qbank-card--${v.id}`}
                      style={{ "--card-brand": v.color }}
                      onClick={() => handleVarsityCardClick(v)}
                    >
                      <div className="qbank-card__glow"></div>
                      <div className="qbank-card__visual">
                        <span className="qbank-card__letter">
                          {v.name.slice(0, 2)}
                        </span>
                      </div>
                      <div className="qbank-card__info">
                        <h4 className="qbank-card__subject">
                          {v.name}
                        </h4>
                        <span className="qbank-card__sub-label">
                          {language === "en"
                            ? "Question Bank"
                            : "প্রশ্নব্যাংক"}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="qbank-empty">
                <p>
                  {language === "en"
                    ? "No universities found matching your search."
                    : "আপনার অনুসন্ধানের সাথে মেলে এমন কোনো বিশ্ববিদ্যালয় পাওয়া যায়নি।"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
              </div >
            </div >
          </Fragment >
        )}
      </main >

  { activeOptionModal && (
    <div
      className="qbank-modal-overlay"
      onClick={() => setActiveOptionModal(null)}
    >
      <div
        className="qbank-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="qbank-modal-close"
          onClick={() => setActiveOptionModal(null)}
          aria-label="Close"
        >
          <HiX size={20} />
        </button>
        <div
          className="qbank-modal-icon-wrapper"
          style={{ background: activeOptionModal.gradient }}
        >
          {activeOptionModal.icon}
        </div>
        <h2>
          {language === "en"
            ? activeOptionModal.titleEn
            : activeOptionModal.titleBn}
        </h2>
        <p className="qbank-modal-subject">
          {language === "en"
            ? selectedSubject.titleEn
            : selectedSubject.titleBn}
        </p>
        <p className="qbank-modal-desc">
          {language === "en"
            ? "Practice questions and full-length board/admission question banks for this stream are currently being prepared. You will be able to solve them directly here very soon!"
            : "এই বিষয়ের অধ্যায়ভিত্তিক অনুশীলনী এবং বিগত বছরের বোর্ড/ভর্তি পরীক্ষার প্রশ্নব্যাংক প্রস্তুত করা হচ্ছে। শীঘ্রই আপনি সরাসরি এখানে অনুশীলন করতে পারবেন!"}
        </p>
        <button
          type="button"
          className="qbank-modal-cta"
          onClick={() => {
            setActiveOptionModal(null);
            navigate("/mock-test");
          }}
        >
          {language === "en"
            ? "Try Mock Tests in the Meantime"
            : "ইতিমধ্যে মক টেস্ট দিন"}
        </button>
      </div>
    </div>
  )}

{
  activeSourceModal && (
    <div className="qbank-modal-overlay" onClick={closeSourceModal}>
      <div
        className="qbank-source-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="qbank-modal-close"
          onClick={closeSourceModal}
          aria-label="Close"
        >
          <HiX size={20} />
        </button>

        <div className="qbank-source-modal__summary">
          <div
            className={`qbank-source-modal__badge ${activeSourceModal.source.sourceType === "college"
              ? "qbank-source-modal__badge--college"
              : activeSourceModal.source.sourceType === "admission"
                ? "qbank-source-modal__badge--admission"
                : ""
              }`}
          >
            {activeSourceModal.source.sourceType === "board" ? (
              <HiOfficeBuilding size={20} />
            ) : activeSourceModal.source.sourceType === "admission" ? (
              <HiAcademicCap size={20} />
            ) : (
              <HiAcademicCap size={20} />
            )}
            <span>
              {activeSourceModal.source.sourceType === "board"
                ? language === "en"
                  ? "Board Question"
                  : "বোর্ড প্রশ্ন"
                : activeSourceModal.source.sourceType === "admission"
                  ? language === "en"
                    ? "Admission Question"
                    : "ভর্তি পরীক্ষা"
                  : language === "en"
                    ? "College Question"
                    : "কলেজ প্রশ্ন"}
            </span>
          </div>
          <h2 className="qbank-source-modal__title">
            {activeSourceModal.source.sourceType === "admission"
              ? activeSourceModal.source.university
              : activeSourceModal.source.board ||
              activeSourceModal.source.college}
            {activeSourceModal.source.year
              ? ` ${activeSourceModal.source.year}`
              : ""}
            {activeSourceModal.source.shift
              ? ` — ${activeSourceModal.source.shift}`
              : ""}
          </h2>
          <div className="qbank-source-modal__chips">
            <span className="qbank-source-modal__chip">
              <HiClock size={14} />
              {activeSourceModal.source.sourceType === "admission"
                ? language === "en"
                  ? "1 Hour"
                  : "১ ঘন্টা"
                : t("qbank.sources.time")}
            </span>
            <span className="qbank-source-modal__chip">
              <HiQuestionMarkCircle size={14} />
              {activeSourceModal.source.sourceType === "admission"
                ? language === "en"
                  ? `${activeSourceModal.source.count} Questions`
                  : `${activeSourceModal.source.count}টি প্রশ্ন`
                : t("qbank.sources.questions_count", {
                  count: activeSourceModal.source.count,
                })}
            </span>
          </div>
        </div>

        <div className="qbank-source-modal__actions">
          <button
            type="button"
            className="qbank-source-modal__btn qbank-source-modal__btn--primary"
            onClick={
              activeSourceModal.source.sourceType === "admission"
                ? handleStartAdmissionExam
                : handleStartExam
            }
          >
            <HiPlay size={16} />
            <span>{t("qbank.source_action.start_exam")}</span>
          </button>
          <button
            type="button"
            className="qbank-source-modal__btn qbank-source-modal__btn--secondary"
            onClick={
              activeSourceModal.source.sourceType === "admission"
                ? handleShowAdmissionQuestions
                : handleShowQuestions
            }
          >
            <HiEye size={16} />
            <span>{t("qbank.source_action.show_questions")}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
    </div >
  );
}
