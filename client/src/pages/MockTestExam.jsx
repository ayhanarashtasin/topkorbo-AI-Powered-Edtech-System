import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import {
  HiArrowLeft,
  HiBookmark,
  HiCheckCircle,
  HiChevronDown,
  HiX,
  HiClock,
  HiEye,
} from "react-icons/hi";
import katex from "katex";
import "katex/dist/katex.min.css";
import Confetti from "react-confetti";
import "./MockTestExam.css";

const BOARD_ABBRS = {
  Dhaka: "DB",
  Comilla: "CB",
  Rajshahi: "RB",
  Jessore: "JB",
  Chittagong: "CtgB",
  Sylhet: "SB",
  Barishal: "BB",
  Dinajpur: "DjB",
  Mymensingh: "MB",
  Madrasa: "MadB",
  Technical: "TB",
};

const UNIV_ABBRS = {
  "Dhaka University": "DU",
  "Chittagong University": "CU",
  "Rajshahi University": "RU",
  "Jahangirnagar University": "JU",
  "Agriculture (Cluster)": "AGRI",
  "GST (Cluster)": "GST",
  "CKRUET (Cluster)": "CKRUET",
  "IBA (DU)": "IBA",
};

const COLLEGE_ABBRS = {
  "Notre Dame College": "NDC",
  "Adamjee Cantonment College": "ACC",
  "Rajuk Uttara Model College": "RUMC",
  "Holy Cross College": "HCC",
  "Viqarunnisa Noon School & College": "VNSC",
  "Dhaka Residential Model College": "DRMC",
  "Dhaka College": "DC",
  "Birshreshtha Noor Mohammad Public College": "BNMPC",
  "BAF Shaheen College Dhaka": "BSCD",
  "St. Joseph Higher Secondary School": "SJHSS",
  "Abdul Kadir Mollah City College": "AKCC",
  "Government Hazi Mohammad Mohsin College": "GHMMC",
  "Chittagong College": "ChC",
  "Rajshahi College": "RC",
  "Government Azizul Haque College": "GAHC",
  "Ananda Mohan College": "AMC",
  "Cumilla Victoria Government College": "CVGC",
  "Government Brojomohun College": "GBC",
  "MC College": "MCC",
  "Government Edward College": "GEC",
};

// Auto-generate abbreviation from college name if not in the lookup table
const autoCollegeAbbr = (name) => {
  if (!name) return "";
  const skip = new Set(["and", "&", "of", "the", "al"]);
  return name
    .split(/[\s.]+/)
    .filter((w) => w.length > 0 && !skip.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join("");
};

const formatSessionYear = (year) => {
  if (!year) return "";
  const yearStr = String(year).trim();
  if (yearStr.includes("-")) {
    const parts = yearStr.split("-");
    const y1 = parts[0].trim().slice(-2);
    const y2 = parts[1].trim().slice(-2);
    return `${y1}-${y2}`;
  }
  if (yearStr.includes("/")) {
    const parts = yearStr.split("/");
    const y1 = parts[0].trim().slice(-2);
    const y2 = parts[1].trim().slice(-2);
    return `${y1}-${y2}`;
  }
  return yearStr.slice(-2);
};

const getTagAbbreviation = (tag) => {
  if (!tag) return "";
  const yearStr = tag.year ? String(tag.year).slice(-2) : "";

  if (tag.category === "board") {
    const boardAbbr =
      BOARD_ABBRS[tag.board] ||
      (tag.board ? `${tag.board.charAt(0).toUpperCase()}B` : "");
    return yearStr ? `${boardAbbr}-${yearStr}` : boardAbbr;
  } else if (tag.category === "college") {
    const college = tag.college || "";
    const collegeAbbr = COLLEGE_ABBRS[college] || autoCollegeAbbr(college);
    return yearStr ? `${collegeAbbr}-${yearStr}` : collegeAbbr;
  } else {
    // admission / university
    const univ = tag.university || "";
    const univAbbr = UNIV_ABBRS[univ] || univ;
    const sessionYear = formatSessionYear(tag.year);
    return sessionYear ? `${univAbbr} · ${sessionYear}` : univAbbr;
  }
};

const getTagTitle = (tag) => {
  if (!tag) return "";
  if (tag.category === "board") {
    return `${tag.board} Board${tag.year ? ` - ${tag.year}` : ""}`;
  } else if (tag.category === "college") {
    return `${tag.college}${tag.year ? ` - ${tag.year}` : ""}`;
  } else {
    return `${tag.university}${tag.unit ? ` (${tag.unit})` : ""}${tag.year ? ` - ${tag.year}` : ""}`;
  }
};

export default function MockTestExam() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [config, setConfig] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [explanationModalQuestion, setExplanationModalQuestion] =
    useState(null);
  const [explanationTab, setExplanationTab] = useState("manual"); // 'manual' | 'ai' | 'video'
  const [filterType, setFilterType] = useState("all"); // 'all' | 'correct' | 'skipped' | 'wrong'
  const [fromQbank, setFromQbank] = useState(false);
  const [writtenAnswers, setWrittenAnswers] = useState({});
  const [activeCameraQuestionKey, setActiveCameraQuestionKey] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const storedQuestions = sessionStorage.getItem("mock_exam_questions");
    const storedConfig = sessionStorage.getItem("mock_exam_config");
    const storedFromQbank =
      sessionStorage.getItem("mock_exam_from_qbank") === "true";

    if (!storedQuestions || !storedConfig) {
      navigate(storedFromQbank ? "/qbank" : "/mock-test");
      return;
    }

    try {
      const parsedQuestions = JSON.parse(storedQuestions);
      const parsedConfig = JSON.parse(storedConfig);
      setQuestions(parsedQuestions);
      setConfig(parsedConfig);
      setFromQbank(storedFromQbank);

      // ── Restore saved answers ────────────────────────────────────────────
      const savedAnswers = sessionStorage.getItem("mock_exam_answers");
      if (savedAnswers) {
        try {
          setAnswers(JSON.parse(savedAnswers));
        } catch (_) { }
      }

      // ── Restore saved written answers ────────────────────────────────────
      const savedWrittenAnswers = sessionStorage.getItem("mock_exam_written_answers");
      if (savedWrittenAnswers) {
        try {
          setWrittenAnswers(JSON.parse(savedWrittenAnswers));
        } catch (_) { }
      }

      // ── Restore submitted / review state ────────────────────────────────
      const wasSubmitted =
        sessionStorage.getItem("mock_exam_submitted") === "true";
      const wasReview =
        sessionStorage.getItem("mock_exam_review_mode") === "true";

      if (wasSubmitted) {
        setIsSubmitted(true);
        setIsReviewMode(true); // skip the result modal on refresh — go straight to review
        const savedTimeLeft = sessionStorage.getItem("mock_exam_time_left");
        setTimeLeft(savedTimeLeft ? parseInt(savedTimeLeft, 10) : 0);
        return;
      }

      // ── Restore / initialise the countdown using an absolute end-time ────
      const savedEndTime = sessionStorage.getItem("mock_exam_end_time");
      if (savedEndTime) {
        // Page was refreshed mid-exam — recalculate how many seconds remain
        const remaining = Math.round(
          (parseInt(savedEndTime, 10) - Date.now()) / 1000,
        );
        if (remaining <= 0) {
          // Time ran out while the page was closed/refreshing
          setTimeLeft(0);
          setIsSubmitted(true);
          setIsReviewMode(true);
          sessionStorage.setItem("mock_exam_submitted", "true");
          sessionStorage.setItem("mock_exam_review_mode", "true");
          sessionStorage.setItem("mock_exam_time_left", "0");
        } else {
          setTimeLeft(remaining);
        }
      } else {
        // Very first load — stamp the absolute end-time
        const endTime = Date.now() + parsedConfig.duration * 60 * 1000;
        sessionStorage.setItem("mock_exam_end_time", endTime.toString());
        setTimeLeft(parsedConfig.duration * 60);
      }
    } catch (e) {
      console.error("Failed to parse exam data", e);
      navigate(storedFromQbank ? "/qbank" : "/mock-test");
    }
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ── Persist answers on every change ─────────────────────────────────────
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      sessionStorage.setItem("mock_exam_answers", JSON.stringify(answers));
    }
  }, [answers]);

  const getQuestionKey = (question, index) =>
    question._id || `question-${index}`;

  const getCorrectOptionIndex = (question) => {
    if (!Array.isArray(question.options)) return -1;
    return question.options.findIndex((option) => option.isCorrect);
  };

  const resultStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let score = 0;

    questions.forEach((question, index) => {
      const key = getQuestionKey(question, index);
      const selectedIndex = answers[key];
      const correctIndex = getCorrectOptionIndex(question);

      if (selectedIndex === undefined || selectedIndex === null) {
        skipped += 1;
        return;
      }

      if (selectedIndex === correctIndex) {
        correct += 1;
        score += 1;
      } else {
        wrong += 1;
        if (config?.negativeMarking) score -= 0.25;
      }
    });

    const writtenUploadedCount = Object.keys(writtenAnswers).length;

    return {
      correct,
      wrong,
      skipped,
      score: Math.max(0, score),
      total: questions.length,
      timeTakenSeconds: Math.max(0, (config?.duration || 0) * 60 - timeLeft),
      writtenUploadedCount,
    };
  }, [answers, config, questions, timeLeft, writtenAnswers]);

  useEffect(() => {
    if (isSubmitted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted, timeLeft]);

  const handleSubmit = () => {
    if (isSubmitted) return;
    setIsSubmitted(true);
    setShowResultModal(true);
    // Persist submitted state so a refresh lands in review mode
    sessionStorage.setItem("mock_exam_submitted", "true");
    sessionStorage.setItem("mock_exam_time_left", String(timeLeft));
  };

  const handleContinueToReview = () => {
    setShowResultModal(false);
    setIsReviewMode(true);
    sessionStorage.setItem("mock_exam_review_mode", "true");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStartAgain = () => {
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
      "mock_exam_questions",
      "mock_exam_config",
      "mock_exam_from_qbank",
      "mock_exam_answers",
      "mock_exam_end_time",
      "mock_exam_submitted",
      "mock_exam_review_mode",
      "mock_exam_time_left",
      "mock_exam_written_answers",
    ].forEach((key) => sessionStorage.removeItem(key));
    navigate(fromQbank ? "/qbank" : "/mock-test");
  };

  const handleOptionSelect = (questionId, optionIndex) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleWrittenFileChange = (e, questionKey) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

        setWrittenAnswers((prev) => {
          const updated = { ...prev, [questionKey]: dataUrl };
          sessionStorage.setItem("mock_exam_written_answers", JSON.stringify(updated));
          return updated;
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveWrittenFile = (questionKey) => {
    setWrittenAnswers((prev) => {
      const updated = { ...prev };
      delete updated[questionKey];
      sessionStorage.setItem("mock_exam_written_answers", JSON.stringify(updated));
      return updated;
    });
  };

  const startCamera = async (questionKey) => {
    setActiveCameraQuestionKey(questionKey);
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });
      } catch (envErr) {
        console.warn("Could not access environment camera, trying fallback...", envErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert(
        language === "en"
          ? "Unable to access device camera. Please check permissions."
          : "ক্যামেরা অ্যাক্সেস করা যাচ্ছে না। দয়া করে পারমিশন চেক করুন।"
      );
      setActiveCameraQuestionKey(null);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActiveCameraQuestionKey(null);
  };

  const capturePhoto = (questionKey) => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let finalWidth = width;
      let finalHeight = height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          finalHeight *= MAX_WIDTH / width;
          finalWidth = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          finalWidth *= MAX_HEIGHT / height;
          finalHeight = MAX_HEIGHT;
        }
      }

      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, finalWidth, finalHeight);
      
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      setWrittenAnswers((prev) => {
        const updated = { ...prev, [questionKey]: dataUrl };
        sessionStorage.setItem("mock_exam_written_answers", JSON.stringify(updated));
        return updated;
      });

      stopCamera();
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toBnNum = (numStr) => {
    const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
    return String(numStr).replace(/\d/g, (d) => bnDigits[d]);
  };

  const formatDisplayNumber = (value) => {
    const normalized = Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(/\.?0+$/, "");
    return language === "en" ? normalized : toBnNum(normalized);
  };

  const renderMath = (text) => {
    if (!text) return { __html: "" };

    const renderedText = text
      .replace(/\$\$([\s\S]+?)\$\$/g, (match, p1) => {
        try {
          return katex.renderToString(p1.trim(), {
            displayMode: true,
            throwOnError: false,
          });
        } catch (e) {
          return match;
        }
      })
      .replace(/\$([^\$]+)\$/g, (match, p1) => {
        try {
          return katex.renderToString(p1.trim(), {
            displayMode: false,
            throwOnError: false,
          });
        } catch (e) {
          return match;
        }
      });

    return { __html: renderedText };
  };

  const getOptionPrefix = (index) => {
    if (language === "en") {
      return ["A", "B", "C", "D"][index] || "";
    }
    return ["ক", "খ", "গ", "ঘ"][index] || "";
  };

  const getOptionState = (question, questionIndex, optionIndex) => {
    if (!isReviewMode) return "";
    const key = getQuestionKey(question, questionIndex);
    const selectedIndex = answers[key];
    const correctIndex = getCorrectOptionIndex(question);

    if (optionIndex === correctIndex) return "correct";
    if (optionIndex === selectedIndex && selectedIndex !== correctIndex)
      return "wrong";
    return "";
  };

  if (questions.length === 0 || !config) {
    return <div className="exam-loading">Loading...</div>;
  }

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const timeLabel =
    language === "en"
      ? `${Math.ceil(resultStats.timeTakenSeconds / 60)} min`
      : `${toBnNum(Math.ceil(resultStats.timeTakenSeconds / 60))} মিনিট`;

  return (
    <div
      className={`exam-room-container ${showResultModal ? "exam-room-container--dimmed" : ""}`}
    >
      <header
        className={`exam-header-card ${isReviewMode ? "exam-header-card--review" : ""}`}
      >
        {isReviewMode && (
          <button
            type="button"
            className="exam-back-btn"
            onClick={() => navigate(fromQbank ? "/qbank" : "/mock-test")}
          >
            <HiArrowLeft size={22} />
          </button>
        )}
        <h1 className="exam-title">
          {fromQbank
            ? language === "en"
              ? "Question Bank Exam"
              : "প্রশ্নব্যাংক পরীক্ষা"
            : language === "en"
              ? "Mock Test"
              : "মক পরীক্ষা"}
        </h1>
        {fromQbank && config?.sourceLabel && (
          <p className="exam-source-label">{config.sourceLabel}</p>
        )}

        {isReviewMode ? (
          <>
            <div className="exam-report-cards">
              <div className="exam-report-card exam-report-card--score">
                <span>
                  {language === "en" ? "Points earned" : "পয়েন্ট পেয়েছো"}
                </span>
                <strong>★ {formatDisplayNumber(resultStats.score)}</strong>
              </div>
              <div className="exam-report-card exam-report-card--marks">
                {questions.some(q => q.type === "written") ? (
                  <>
                    <span>
                      {language === "en" ? "Written Uploaded" : "আপলোড করা উত্তর"}
                    </span>
                    <strong>📁 {formatDisplayNumber(resultStats.writtenUploadedCount)}</strong>
                  </>
                ) : (
                  <>
                    <span>{language === "en" ? "Marks" : "মার্কস"}</span>
                    <strong>
                      ● {formatDisplayNumber(resultStats.correct)} /{" "}
                      {formatDisplayNumber(resultStats.total)}
                    </strong>
                  </>
                )}
              </div>
              <div className="exam-report-card exam-report-card--time">
                <span>{language === "en" ? "Time taken" : "সময় নিয়েছো"}</span>
                <strong>◉ {timeLabel}</strong>
              </div>
            </div>
            <div className="exam-result-chips">
              <button
                type="button"
                className={`exam-result-chip exam-result-chip--correct ${filterType === "correct" ? "exam-result-chip--active" : ""}`}
                onClick={() =>
                  setFilterType((prev) =>
                    prev === "correct" ? "all" : "correct",
                  )
                }
              >
                <i /> {formatDisplayNumber(resultStats.correct)}{" "}
                {language === "en" ? "Correct" : "সঠিক"}
              </button>
              <button
                type="button"
                className={`exam-result-chip exam-result-chip--skipped ${filterType === "skipped" ? "exam-result-chip--active" : ""}`}
                onClick={() =>
                  setFilterType((prev) =>
                    prev === "skipped" ? "all" : "skipped",
                  )
                }
              >
                <i /> {formatDisplayNumber(resultStats.skipped)}{" "}
                {language === "en" ? "Skipped" : "স্কিপ"}
              </button>
              <button
                type="button"
                className={`exam-result-chip exam-result-chip--wrong ${filterType === "wrong" ? "exam-result-chip--active" : ""}`}
                onClick={() =>
                  setFilterType((prev) => (prev === "wrong" ? "all" : "wrong"))
                }
              >
                <i /> {formatDisplayNumber(resultStats.wrong)}{" "}
                {language === "en" ? "Wrong" : "ভুল"}
              </button>
            </div>
            <button
              type="button"
              className="exam-start-again-btn"
              onClick={handleStartAgain}
            >
              {fromQbank
                ? language === "en"
                  ? "Back to Question Bank"
                  : "প্রশ্নব্যাংকে ফিরে যাও"
                : language === "en"
                  ? "Back to Mock Test"
                  : "মক টেস্টে ফিরে যাও"}
            </button>
          </>
        ) : (
          <div className="exam-header-info">
            <div className="exam-header-badges">
              <span className="exam-header-badge exam-header-badge--time">
                <HiClock size={14} />
                {language === "en"
                  ? `${config.duration} Minutes`
                  : `${toBnNum(config.duration)} মিনিট`}
              </span>
              <span className="exam-header-badge exam-header-badge--questions">
                {language === "en"
                  ? `${totalCount} Questions`
                  : `${toBnNum(totalCount)} প্রশ্ন`}
              </span>
              <span className="exam-header-badge exam-header-badge--marks">
                {language === "en"
                  ? "1 mark / question"
                  : "প্রতি প্রশ্নে ১ নম্বর"}
              </span>
              {config.negativeMarking && (
                <span className="exam-header-badge exam-header-badge--warning">
                  {language === "en" ? "−0.25 for wrong answer" : "ভুলে −০.২৫"}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="exam-questions-list">
        {questions
          .filter((q, qIndex) => {
            if (!isReviewMode || filterType === "all") return true;
            const questionKey = getQuestionKey(q, qIndex);
            const selectedIndex = answers[questionKey];
            const correctIndex = getCorrectOptionIndex(q);

            if (filterType === "correct") {
              return (
                selectedIndex === correctIndex && selectedIndex !== undefined
              );
            }
            if (filterType === "wrong") {
              return (
                selectedIndex !== undefined && selectedIndex !== correctIndex
              );
            }
            if (filterType === "skipped") {
              return selectedIndex === undefined;
            }
            return true;
          })
          .map((q, qIndex) => {
            // Note: we use the original index to display the correct question number
            // So we need to find its actual index in the `questions` array.
            const actualIndex = questions.findIndex(
              (origQ) => origQ._id === q._id || origQ === q,
            );
            const questionKey = getQuestionKey(q, actualIndex);

            return (
              <div key={questionKey} className="exam-question-card">
                {isReviewMode && (
                  <div className="exam-question-actions-top">
                    {q.tags && q.tags.length > 0 && (
                      <div className="exam-question-tags-wrapper">
                        {q.tags.map((tag, tIdx) => {
                          const abbr = getTagAbbreviation(tag);
                          if (!abbr) return null;
                          return (
                            <span
                              key={tIdx}
                              className={`exam-question-tag exam-question-tag--${tag.category}`}
                              title={getTagTitle(tag)}
                            >
                              {abbr}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      className="exam-explanation-btn"
                      onClick={() => {
                        setExplanationModalQuestion(q);
                        setExplanationTab("manual");
                      }}
                      title={
                        language === "en"
                          ? "Show Explanation"
                          : "ব্যাখ্যা দেখুন"
                      }
                    >
                      <HiEye size={20} />
                    </button>
                  </div>
                )}

                <div className="exam-question-top">
                  <div className="exam-question-text-wrapper">
                    <span className="exam-question-number">
                      {language === "en"
                        ? `${actualIndex + 1}. `
                        : `${toBnNum(actualIndex + 1)}. `}
                    </span>
                    <span
                      className="exam-question-text"
                      dangerouslySetInnerHTML={renderMath(q.questionText)}
                    />
                  </div>
                </div>

                {q.imageUrl && (
                  <div className="exam-question-image">
                    <img src={q.imageUrl} alt="Question figure" />
                  </div>
                )}

                {q.type === "mcq" && q.options && (
                  <div className="exam-options-grid">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = answers[questionKey] === optIdx;
                      const optionState = getOptionState(
                        q,
                        actualIndex,
                        optIdx,
                      );
                      return (
                        <button
                          key={optIdx}
                          className={`exam-option-btn ${isSelected ? "exam-option-btn--selected" : ""} ${optionState ? `exam-option-btn--${optionState}` : ""}`}
                          onClick={() =>
                            handleOptionSelect(questionKey, optIdx)
                          }
                          type="button"
                        >
                          <div
                            className={`exam-option-prefix ${isSelected ? "exam-option-prefix--selected" : ""} ${optionState ? `exam-option-prefix--${optionState}` : ""}`}
                          >
                            {getOptionPrefix(optIdx)}
                          </div>
                          <div
                            className="exam-option-text"
                            dangerouslySetInnerHTML={renderMath(opt.text)}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === "written" && q.options && q.options.length > 0 && (
                  <div className="exam-options-grid">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = answers[questionKey] === optIdx;
                      const optionState = getOptionState(
                        q,
                        actualIndex,
                        optIdx,
                      );
                      return (
                        <button
                          key={optIdx}
                          className={`exam-option-btn ${isSelected ? "exam-option-btn--selected" : ""} ${optionState ? `exam-option-btn--${optionState}` : ""}`}
                          onClick={() =>
                            handleOptionSelect(questionKey, optIdx)
                          }
                          type="button"
                          disabled={isSubmitted}
                        >
                          <div
                            className={`exam-option-prefix ${isSelected ? "exam-option-prefix--selected" : ""} ${optionState ? `exam-option-prefix--${optionState}` : ""}`}
                          >
                            {getOptionPrefix(optIdx)}
                          </div>
                          <div
                            className="exam-option-text"
                            dangerouslySetInnerHTML={renderMath(opt.text)}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === "written" && (
                  <div className="exam-written-upload-section">
                    <p className="exam-written-upload-title">
                      {language === "en" ? "Upload Written Response:" : "লিখিত উত্তর আপলোড করুন:"}
                    </p>
                    
                    {!isSubmitted && (
                      <div className="exam-written-upload-controls">
                        <label className="exam-written-upload-label">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleWrittenFileChange(e, questionKey)}
                            style={{ display: "none" }}
                          />
                          <div className="exam-written-upload-btn">
                            <svg className="exam-upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px', marginRight: '8px' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                            </svg>
                            <span>
                              {writtenAnswers[questionKey] 
                                ? (language === "en" ? "Change Image" : "ছবি পরিবর্তন করুন")
                                : (language === "en" ? "Choose Image" : "ছবি নির্বাচন করুন")}
                            </span>
                          </div>
                        </label>

                        <button
                          type="button"
                          className="exam-written-camera-btn"
                          onClick={() => startCamera(questionKey)}
                        >
                          <svg className="exam-camera-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px', marginRight: '8px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          </svg>
                          <span>
                            {language === "en" ? "Use Camera" : "ক্যামেরা ব্যবহার করুন"}
                          </span>
                        </button>
                      </div>
                    )}

                    {writtenAnswers[questionKey] && (
                      <div className="exam-written-preview-container">
                        <img
                          src={writtenAnswers[questionKey]}
                          alt="Written Answer Preview"
                          className="exam-written-preview-img"
                        />
                        {!isSubmitted && (
                          <button
                            type="button"
                            className="exam-written-remove-btn"
                            onClick={() => handleRemoveWrittenFile(questionKey)}
                            title={language === "en" ? "Remove Image" : "ছবি মুছে ফেলুন"}
                          >
                            <HiX size={16} />
                          </button>
                        )}
                      </div>
                    )}

                    {activeCameraQuestionKey === questionKey && (
                      <div className="exam-camera-overlay">
                        <div className="exam-camera-modal">
                          <h3 className="exam-camera-modal-title">
                            {language === "en" ? "Take Answer Photo" : "উত্তর ছবি তুলুন"}
                          </h3>
                          <div className="exam-camera-video-container">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="exam-camera-video"
                            />
                          </div>
                          <div className="exam-camera-actions">
                            <button
                              type="button"
                              className="exam-camera-btn exam-camera-btn--capture"
                              onClick={() => capturePhoto(questionKey)}
                            >
                              {language === "en" ? "Capture Photo" : "ছবি তুলুন"}
                            </button>
                            <button
                              type="button"
                              className="exam-camera-btn exam-camera-btn--cancel"
                              onClick={stopCamera}
                            >
                              {language === "en" ? "Cancel" : "বাতিল"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {!isReviewMode && (
        <div className="exam-floating-status-box">
          <div className="exam-status-item">
            <HiClock size={20} className="exam-status-icon" />
            <span>
              {language === "en"
                ? formatTime(timeLeft)
                : toBnNum(formatTime(timeLeft))}
            </span>
          </div>
          <div className="exam-status-divider" />
          <div className="exam-status-item">
            <HiCheckCircle size={20} className="exam-status-icon" />
            <span>
              {language === "en"
                ? `${answeredCount} / ${totalCount}`
                : `${toBnNum(answeredCount)} / ${toBnNum(totalCount)}`}
            </span>
          </div>
          <button
            className="exam-submit-btn-floating"
            onClick={handleSubmit}
            type="button"
          >
            {language === "en" ? "Submit" : "সাবমিট"}
          </button>
        </div>
      )}

      {showResultModal && (
        <div className="exam-result-overlay" role="dialog" aria-modal="true">
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={400}
            gravity={0.15}
          />
          <div className="exam-result-modal">
            <button
              type="button"
              className="exam-result-close"
              onClick={handleContinueToReview}
              aria-label="Close"
            >
              <HiX size={20} />
            </button>
            <div className="exam-result-illustration" aria-hidden="true">
              <img
                src="/assets/exam_result_mascot.png"
                alt="Mascot Celebrating"
                className="exam-result-mascot-img"
              />
            </div>
            <h2>
              {language === "en" ? "Result is ready" : "দুঃখ ভরা জীবন আমার"}
            </h2>
            <p>
              {language === "en"
                ? "Review your score and see every answer."
                : "তোমার ভালো পয়েন্ট এর দেখা পাই না"}
            </p>
            <div className="exam-result-modal-cards">
              <div className="exam-report-card exam-report-card--score">
                <span>{language === "en" ? "Points" : "পয়েন্ট"}</span>
                <strong>★ {formatDisplayNumber(resultStats.score)}</strong>
              </div>
              <div className="exam-report-card exam-report-card--marks">
                {questions.some(q => q.type === "written") ? (
                  <>
                    <span>{language === "en" ? "Written Answers" : "লিখিত উত্তর"}</span>
                    <strong>📁 {formatDisplayNumber(resultStats.writtenUploadedCount)}</strong>
                  </>
                ) : (
                  <>
                    <span>{language === "en" ? "Marks" : "মার্কস"}</span>
                    <strong>
                      ● {formatDisplayNumber(resultStats.correct)} /{" "}
                      {formatDisplayNumber(resultStats.total)}
                    </strong>
                  </>
                )}
              </div>
              <div className="exam-report-card exam-report-card--time">
                <span>{language === "en" ? "Time" : "সময়"}</span>
                <strong>◉ {timeLabel}</strong>
              </div>
            </div>
            <button
              type="button"
              className="exam-result-continue"
              onClick={handleContinueToReview}
            >
              {language === "en" ? "Continue" : "এগিয়ে যাও"}
            </button>
          </div>
        </div>
      )}

      {explanationModalQuestion && (
        <div
          className="exam-explanation-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setExplanationModalQuestion(null)}
        >
          <div
            className="exam-explanation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="exam-explanation-close"
              onClick={() => setExplanationModalQuestion(null)}
              aria-label="Close"
            >
              <HiX size={20} />
            </button>
            <h2 className="exam-explanation-title">
              {language === "en" ? "Explanation" : "ব্যাখ্যা"}
            </h2>
            <div className="exam-explanation-question-preview">
              <strong className="exam-explanation-q-label">
                {language === "en" ? "Question: " : "প্রশ্ন: "}
              </strong>
              <div
                className="exam-explanation-q-text"
                dangerouslySetInnerHTML={renderMath(
                  explanationModalQuestion.questionText,
                )}
              />
            </div>

            <div className="exam-explanation-tabs">
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === "manual" ? "exam-explanation-tab-btn--active" : ""}`}
                onClick={() => setExplanationTab("manual")}
              >
                {language === "en"
                  ? "Manual Explanation"
                  : "ম্যানুয়াল ব্যাখ্যা"}
              </button>
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === "ai" ? "exam-explanation-tab-btn--active" : ""}`}
                onClick={() => setExplanationTab("ai")}
              >
                {language === "en" ? "AI Explanation" : "এআই ব্যাখ্যা"}
              </button>
              <button
                type="button"
                className={`exam-explanation-tab-btn ${explanationTab === "video" ? "exam-explanation-tab-btn--active" : ""}`}
                onClick={() => setExplanationTab("video")}
              >
                {language === "en" ? "Video Solution" : "ভিডিও সমাধান"}
              </button>
            </div>

            <div className="exam-explanation-content">
              {explanationTab === "manual" &&
                (() => {
                  let isCqSolution = false;
                  let parsedSolutions = [];
                  const solutionStr = explanationModalQuestion.solution;
                  try {
                    if (
                      solutionStr &&
                      (solutionStr.trim().startsWith("[") ||
                        solutionStr.trim().startsWith("{"))
                    ) {
                      const parsed = JSON.parse(solutionStr);
                      if (Array.isArray(parsed)) {
                        isCqSolution = true;
                        parsedSolutions = parsed;
                      }
                    }
                  } catch (e) {
                    // Not JSON
                  }

                  if (isCqSolution) {
                    return (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        {parsedSolutions.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              borderBottom:
                                idx < parsedSolutions.length - 1
                                  ? "1px solid #E2E8F0"
                                  : "none",
                              paddingBottom:
                                idx < parsedSolutions.length - 1 ? "12px" : "0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "flex-start",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: "700",
                                  color: "#4F46E5",
                                  minWidth: "24px",
                                }}
                              >
                                ({item.label.toLowerCase()})
                              </span>
                              <span
                                dangerouslySetInnerHTML={renderMath(item.text)}
                              />
                            </div>
                            {item.imageUrl && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  maxWidth: "100%",
                                  overflow: "hidden",
                                }}
                              >
                                <img
                                  src={item.imageUrl}
                                  alt={`Solution Part ${item.label.toUpperCase()}`}
                                  style={{
                                    maxWidth: "300px",
                                    maxHeight: "200px",
                                    objectFit: "contain",
                                    borderRadius: "6px",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div
                        className="exam-explanation-body-text"
                        dangerouslySetInnerHTML={renderMath(
                          solutionStr ||
                          (language === "en"
                            ? "No explanation added yet."
                            : "এখনও ব্যাখ্যা যোগ করা হয়নি।"),
                        )}
                      />
                      {explanationModalQuestion.solutionImageUrl && (
                        <div
                          style={{
                            marginTop: "8px",
                            maxWidth: "100%",
                            overflow: "hidden",
                          }}
                        >
                          <img
                            src={explanationModalQuestion.solutionImageUrl}
                            alt="Solution Figure"
                            style={{
                              maxWidth: "300px",
                              maxHeight: "200px",
                              objectFit: "contain",
                              borderRadius: "6px",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
              {explanationTab === "ai" && (
                <div className="exam-explanation-placeholder">
                  <div className="exam-explanation-placeholder-badge">
                    {language === "en" ? "Coming Soon" : "শীঘ্রই আসছে"}
                  </div>
                  <p>
                    {language === "en"
                      ? "AI Explanation feature is under development and will be available soon!"
                      : "এআই ব্যাখ্যা সুবিধাটি তৈরি করা হচ্ছে এবং শীঘ্রই চালু হবে!"}
                  </p>
                </div>
              )}
              {explanationTab === "video" && (
                <div className="exam-explanation-placeholder">
                  <div className="exam-explanation-placeholder-badge">
                    {language === "en" ? "Coming Soon" : "শীঘ্রই আসছে"}
                  </div>
                  <p>
                    {language === "en"
                      ? "Video solution is being prepared and will be added in a future update."
                      : "ভিডিও সমাধান তৈরি করা হচ্ছে এবং শীঘ্রই যুক্ত করা হবে।"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
