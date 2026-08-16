import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { HiArrowLeft, HiAcademicCap, HiCalendar, HiEye, HiX, HiPaperAirplane, HiPaperClip } from 'react-icons/hi';
import { useLanguage } from '../hooks/useLanguage';
import katex from 'katex';
import { sanitizeHtml } from '../utils/safeHtml';
import 'katex/dist/katex.min.css';
import './VarsityWrittenView.css';
import './MockTestExam.css';

// Map a subject id (e.g. "math_1") to the stored subject key used in the DB.
const SUBJECT_KEY_MAP = {
  physics_1: "Physics",
  physics_2: "Physics 2nd Paper",
  chemistry_1: "Chemistry",
  chemistry_2: "Chemistry 2nd Paper",
  math_1: "Higher Math",
  math_2: "Higher Math 2nd Paper",
  biology_1: "Biology",
  biology_2: "Biology 2nd Paper",
  botany_1: "Botany",
  botany_2: "Botany 2nd Paper",
  zoology_1: "Zoology",
  zoology_2: "Zoology 2nd Paper",
  hmath_1: "Higher Math",
  hmath_2: "Higher Math 2nd Paper",
  ict: "ICT",
  english: "English",
};

const PAPER_MAP = { 1: "1st", 2: "2nd" };

const renderMarkdownWithMath = (text) => {
  if (!text) return { __html: "" };

  // Normalize double backslashes to single backslashes for LaTeX commands/symbols
  const normalizedText = text.replace(/\\\\([a-zA-Z\d_{}%])/g, '\\$1');

  const mathBlocks = [];

  // 1. Extract and render display math: $$...$$ and \[...\]
  let processed = normalizedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, p1) => {
    try {
      const rendered = katex.renderToString(p1.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      const index = mathBlocks.length;
      mathBlocks.push(rendered);
      return `%%MATH_BLOCK_${index}%%`;
    } catch (e) {
      return match;
    }
  });

  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (match, p1) => {
    try {
      const rendered = katex.renderToString(p1.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      const index = mathBlocks.length;
      mathBlocks.push(rendered);
      return `%%MATH_BLOCK_${index}%%`;
    } catch (e) {
      return match;
    }
  });

  // 2. Extract and render inline math: $...$ and \(...\)
  processed = processed.replace(/\$([^\$]+)\$/g, (match, p1) => {
    try {
      const rendered = katex.renderToString(p1.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      const index = mathBlocks.length;
      mathBlocks.push(rendered);
      return `%%MATH_BLOCK_${index}%%`;
    } catch (e) {
      return match;
    }
  });

  processed = processed.replace(/\\\((.+?)\\\)/g, (match, p1) => {
    try {
      const rendered = katex.renderToString(p1.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      const index = mathBlocks.length;
      mathBlocks.push(rendered);
      return `%%MATH_BLOCK_${index}%%`;
    } catch (e) {
      return match;
    }
  });

  // 3. Apply markdown formatting to the remaining text (with placeholders)
  processed = processed
    // Headings: ### Heading, ## Heading, # Heading
    .replace(/^### (.+)$/gm, '<div style="font-size:15px;font-weight:700;color:#4F46E5;margin:16px 0 6px;border-bottom:1px solid #E2E8F0;padding-bottom:4px;">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-size:17px;font-weight:700;color:#1E293B;margin:20px 0 8px;border-bottom:2px solid #6366F1;padding-bottom:6px;">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-size:19px;font-weight:800;color:#1E293B;margin:20px 0 10px;border-bottom:2px solid #6366F1;padding-bottom:6px;">$1</div>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1E293B;">$1</strong>')
    // Numbered steps
    .replace(/^(\d+)\.\s/gm, '<span style="display:inline-block;background:#6366F1;color:#FFF;font-weight:700;font-size:13px;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;margin-right:8px;">$1</span>')
    // Bullet points
    .replace(/^[-•]\s(.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;"><span style="color:#6366F1;font-weight:bold;margin-top:2px;">•</span><span>$1</span></div>')
    // Line breaks
    .replace(/\n\n/g, '<div style="margin:12px 0;"></div>')
    .replace(/\n/g, '<br/>');

  // 4. Restore the math blocks
  mathBlocks.forEach((renderedMath, index) => {
    processed = processed.replace(`%%MATH_BLOCK_${index}%%`, () => renderedMath);
  });

  return { __html: sanitizeHtml(processed) };
};

const VarsityWrittenView = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, t } = useLanguage();

  const universityParam = searchParams.get("university") || "DU";
  const subjectParam = searchParams.get("subject") || "math_1";
  const paperParam = searchParams.get("paper") || "1";

  const subjectKey = SUBJECT_KEY_MAP[subjectParam] || "Higher Math";
  const paperLabel = PAPER_MAP[paperParam] || "1st";

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChapter, setActiveChapter] = useState("all");
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // AI Practice States
  const [studentImage, setStudentImage] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // AI Explanation & Tutor Modal states
  const [explanationModalQuestion, setExplanationModalQuestion] = useState(null);
  const [explanationTab, setExplanationTab] = useState("manual");
  const [aiExplanations, setAiExplanations] = useState({});
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiChatThreads, setAiChatThreads] = useState({});
  const [followUpText, setFollowUpText] = useState("");
  const [followUpImage, setFollowUpImage] = useState(null);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const followUpFileRef = useRef(null);

  const processImageFile = (file, callback) => {
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
        callback(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSendFollowUp = async () => {
    if (!explanationModalQuestion || isSendingFollowUp) return;
    const text = followUpText.trim();
    if (!text && !followUpImage) return;

    const qId = explanationModalQuestion._id;
    const currentThread = aiChatThreads[qId] || [];

    // 1. Construct the new user message
    const userMessage = {
      role: "user",
      content: text,
      image: followUpImage || undefined
    };

    // 2. Optimistically append user message to local state
    setAiChatThreads(prev => ({
      ...prev,
      [qId]: [...currentThread, userMessage]
    }));

    // Clear follow-up input states
    setFollowUpText("");
    setFollowUpImage(null);
    setIsSendingFollowUp(true);

    try {
      const backendBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${backendBaseUrl}/evaluate/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("topkorbo_token") || localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          questionId: qId,
          history: currentThread,
          message: text,
          studentImageBase64: userMessage.image
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Append AI response
        setAiChatThreads(prev => ({
          ...prev,
          [qId]: [
            ...(prev[qId] || []),
            { role: "assistant", content: data.response }
          ]
        }));
      } else {
        const errData = await res.json().catch(() => ({}));
        setAiChatThreads(prev => ({
          ...prev,
          [qId]: [
            ...(prev[qId] || []),
            { role: "assistant", content: `Error: ${errData.msg || "Failed to send message."}` }
          ]
        }));
      }
    } catch (err) {
      setAiChatThreads(prev => ({
        ...prev,
        [qId]: [
          ...(prev[qId] || []),
          { role: "assistant", content: `Network Error: ${err.message}` }
        ]
      }));
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  const handleImageUpload = (e) => {
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
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        setStudentImage(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const evaluateAnswer = async () => {
    if (!studentImage || isEvaluating || !selectedQuestion) return;
    setIsEvaluating(true);
    try {
      const payload = [{
        questionId: selectedQuestion._id,
        studentImageBase64: studentImage
      }];

      const backendBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${backendBaseUrl}/evaluate/written`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("topkorbo_token") || localStorage.getItem("token")}`
        },
        body: JSON.stringify({ answers: payload })
      });
      if (res.ok) {
        const data = await res.json();
        if (data[selectedQuestion._id]) {
          setAiEvaluation(data[selectedQuestion._id]);
          setShowAnswer(true); // Show manual answer after evaluation
        }
      }
    } catch (err) {
      console.error("AI Check Error:", err);
    }
    setIsEvaluating(false);
  };

  useEffect(() => {
    let cancelled = false;
    const fetchWritten = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("topkorbo_token");
        const backendBaseUrl =
          import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const params = new URLSearchParams({
          subject: subjectKey,
          paper: paperLabel,
          university: universityParam,
        });
        const response = await fetch(
          `${backendBaseUrl}/questions/varsity-written?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const resData = await response.json();
        if (cancelled) return;
        if (resData.success) {
          setQuestions(resData.data || []);
        } else {
          setError(resData.message || "Failed to load questions");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWritten();
    return () => {
      cancelled = true;
    };
  }, [subjectKey, paperLabel, universityParam]);

  const chapters = useMemo(() => {
    const set = new Set();
    questions.forEach((q) => {
      if (q.chapter) set.add(q.chapter);
    });
    return ["all", ...Array.from(set)];
  }, [questions]);

  const visibleQuestions = useMemo(() => {
    if (activeChapter === "all") return questions;
    return questions.filter((q) => q.chapter === activeChapter);
  }, [questions, activeChapter]);

  const totalCount = questions.length;
  const chapterCount = chapters.length - 1;

  return (
    <div className="varsity-written-page animate-fade-in">
      <button
        type="button"
        className="qbank-back-btn"
        onClick={() =>
          navigate(`/qbank?university=${universityParam}&view=chooser`)
        }
      >
        <HiArrowLeft size={16} />
        <span>
          {language === "en" ? "Back to Formats" : "ফরম্যাটে ফিরে যান"}
        </span>
      </button>

      {/* Subject & Paper Selector Row */}
      <div className="varsity-written-selectors">
        <div className="varsity-written-selector-group">
          <label>
            {language === "en" ? "Select Subject:" : "বিষয় নির্বাচন করুন:"}
          </label>
          <div className="varsity-written-btn-row">
            {[
              {
                id: "physics_1",
                base: "physics",
                labelEn: "Physics",
                labelBn: "পদার্থবিজ্ঞান",
              },
              {
                id: "chemistry_1",
                base: "chemistry",
                labelEn: "Chemistry",
                labelBn: "রসায়ন",
              },
              {
                id: "math_1",
                base: "math",
                labelEn: "Higher Math",
                labelBn: "উচ্চতর গণিত",
              },
              {
                id: "biology_1",
                base: "biology",
                labelEn: "Biology",
                labelBn: "জীববিজ্ঞান",
              },
            ].map((sub) => {
              const isActive = subjectParam.startsWith(sub.base);
              return (
                <button
                  key={sub.id}
                  type="button"
                  className={`varsity-written-select-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    setSearchParams({
                      university: universityParam,
                      subject: isActive ? subjectParam : `${sub.base}_1`,
                      paper: paperParam,
                    });
                  }}
                >
                  {language === "en" ? sub.labelEn : sub.labelBn}
                </button>
              );
            })}
          </div>
        </div>

        <div className="varsity-written-selector-group">
          <label>
            {language === "en" ? "Select Paper:" : "পত্র নির্বাচন করুন:"}
          </label>
          <div className="varsity-written-btn-row">
            {[
              { val: "1", labelEn: "1st Paper", labelBn: "১ম পত্র" },
              { val: "2", labelEn: "2nd Paper", labelBn: "২য় পত্র" },
            ].map((p) => {
              const isActive = paperParam === p.val;
              const subBase = subjectParam.split("_")[0];
              return (
                <button
                  key={p.val}
                  type="button"
                  className={`varsity-written-select-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    setSearchParams({
                      university: universityParam,
                      subject: `${subBase}_${p.val}`,
                      paper: p.val,
                    });
                  }}
                >
                  {language === "en" ? p.labelEn : p.labelBn}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="varsity-written-stats">
        <div className="varsity-written-stat">
          <span className="varsity-written-stat__label">
            {language === "en" ? "Total Questions" : "মোট প্রশ্ন"}
          </span>
          <span className="varsity-written-stat__value">{totalCount}</span>
        </div>
        <div className="varsity-written-stat">
          <span className="varsity-written-stat__label">
            {language === "en" ? "Chapters Covered" : "অধ্যায় সংখ্যা"}
          </span>
          <span className="varsity-written-stat__value">{chapterCount}</span>
        </div>
        <div className="varsity-written-stat">
          <span className="varsity-written-stat__label">
            {language === "en" ? "Source" : "উৎস"}
          </span>
          <span className="varsity-written-stat__value">
            {language === "en"
              ? "University Admission"
              : "বিশ্ববিদ্যালয় ভর্তি"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="varsity-written-loading">
          <div className="varsity-written-spinner" />
          <p>
            {language === "en"
              ? "Loading written questions…"
              : "লিখিত প্রশ্ন লোড হচ্ছে…"}
          </p>
        </div>
      ) : error ? (
        <div className="varsity-written-empty">
          <h3>
            {language === "en"
              ? "Could not load questions"
              : "প্রশ্ন লোড করা যায়নি"}
          </h3>
          <p>{error}</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="varsity-written-empty">
          <h3>
            {language === "en"
              ? "No written questions yet"
              : "এখনও কোনো লিখিত প্রশ্ন নেই"}
          </h3>
          <p>
            {language === "en"
              ? "Our team is curating written admission archives. Please check back soon."
              : "আমাদের দল লিখিত ভর্তি আর্কাইভ তৈরি করছে। শীঘ্রই দেখুন।"}
          </p>
        </div>
      ) : (
        <div className="varsity-written-body">
          <aside className="varsity-written-sidebar">
            <h4>{language === "en" ? "Chapters" : "অধ্যায়সমূহ"}</h4>
            <ul>
              {chapters.map((chap) => (
                <li key={chap}>
                  <button
                    type="button"
                    className={`varsity-written-chap-btn ${activeChapter === chap ? "is-active" : ""}`}
                    onClick={() => setActiveChapter(chap)}
                  >
                    {chap === "all"
                      ? language === "en"
                        ? "All Chapters"
                        : "সকল অধ্যায়"
                      : chap}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="varsity-written-list">
            {visibleQuestions.map((q, idx) => (
              <article
                key={q._id || `${q.year}-${idx}`}
                className="varsity-written-card"
                onClick={() => {
                  setSelectedQuestion(q);
                  setStudentImage(null);
                  setAiEvaluation(null);
                  setIsEvaluating(false);
                  setShowAnswer(false);
                }}
              >
                <div className="varsity-written-card__head">
                  <div className="varsity-written-card__chip">
                    <HiAcademicCap size={14} />
                    <span>
                      {q.chapter || (language === "en" ? "General" : "সাধারণ")}
                    </span>
                  </div>
                  {q.year && (
                    <div className="varsity-written-card__chip varsity-written-card__chip--year">
                      <HiCalendar size={14} />
                      <span>{q.year}</span>
                    </div>
                  )}
                </div>
                <div className="varsity-written-card__body">
                  <div
                    className="varsity-written-card__stem"
                    dangerouslySetInnerHTML={{
                      __html: q.stem || q.question || "",
                    }}
                  />
                </div>
                <div className="varsity-written-card__meta">
                  <span className="varsity-written-card__src">
                    {q.university ||
                      (language === "en"
                        ? "University Archive"
                        : "বিশ্ববিদ্যালয় আর্কাইভ")}
                  </span>
                  <span className="varsity-written-card__cta">
                    {language === "en" ? "Read more" : "বিস্তারিত"} →
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {selectedQuestion && (
        <div
          className="varsity-written-modal"
          onClick={() => setSelectedQuestion(null)}
        >
          <div
            className="varsity-written-modal__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h3>
                {selectedQuestion.chapter ||
                  (language === "en" ? "Written Question" : "লিখিত প্রশ্ন")}
              </h3>
              <button
                type="button"
                className="varsity-written-modal__close"
                onClick={() => setSelectedQuestion(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="varsity-written-modal__body">
              <div className="varsity-written-modal__meta">
                {selectedQuestion.university && (
                  <span>
                    <HiAcademicCap size={14} /> {selectedQuestion.university}
                  </span>
                )}
                {selectedQuestion.year && (
                  <span>
                    <HiCalendar size={14} /> {selectedQuestion.year}
                  </span>
                )}
              </div>
              {selectedQuestion.stem && (
                <section>
                  <h4>{language === "en" ? "Question Stem" : "উদ্দীপক"}</h4>
                  <div
                    className="varsity-written-modal__html"
                    dangerouslySetInnerHTML={{ __html: selectedQuestion.stem }}
                  />
                </section>
              )}
              {selectedQuestion.parts && selectedQuestion.parts.length > 0 && (
                <section>
                  <h4>{language === "en" ? "Parts" : "অংশসমূহ"}</h4>
                  <ol className="varsity-written-modal__parts">
                    {selectedQuestion.parts.map((part, i) => (
                      <li key={i}>
                        <strong>{part.label || i + 1}.</strong>{" "}
                        <span
                          dangerouslySetInnerHTML={{ __html: part.text || "" }}
                        />
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section className="varsity-written-practice" style={{ marginTop: '20px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#334155' }}>
                  {language === "en" ? "Practice with AI" : "এআই দিয়ে প্র্যাকটিস করুন"}
                </h4>
                {!studentImage ? (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#4F46E5', color: '#FFF', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: "none" }}
                    />
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {language === "en" ? "Upload Your Answer (Image)" : "আপনার উত্তর আপলোড করুন (ছবি)"}
                  </label>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <img src={studentImage} alt="Your Answer" style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #CBD5E1' }} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => setStudentImage(null)} disabled={isEvaluating} style={{ padding: '8px 16px', backgroundColor: '#EF4444', color: '#FFF', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                        {language === "en" ? "Remove" : "মুছুন"}
                      </button>
                      <button onClick={evaluateAnswer} disabled={isEvaluating} style={{ padding: '8px 16px', backgroundColor: '#10B981', color: '#FFF', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                        {isEvaluating ? (language === "en" ? "Evaluating..." : "মূল্যায়ন হচ্ছে...") : (language === "en" ? "Check with AI" : "এআই দিয়ে চেক করুন")}
                      </button>
                    </div>
                  </div>
                )}
                {aiEvaluation && (
                  <div className="exam-ai-eval-box" style={{ marginTop: '16px', padding: '12px', backgroundColor: '#F0FDF4', borderLeft: '4px solid #22C55E', borderRadius: '4px' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {language === "en" ? "AI Evaluation" : "এআই মূল্যায়ন"}
                    </h4>
                    <div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#15803D' }}>
                      {language === "en" ? "Marks: " : "প্রাপ্ত নম্বর: "}
                      {aiEvaluation.marks ?? aiEvaluation.score}
                      {aiEvaluation.totalMarks ? ` / ${aiEvaluation.totalMarks}` : ''}
                    </div>
                    <div style={{ color: '#166534', fontSize: '14px' }}>
                      <strong>{language === "en" ? "Feedback: " : "মতামত: "}</strong>
                      <div
                        style={{ display: 'inline', marginLeft: '4px', lineHeight: '1.6' }}
                        dangerouslySetInnerHTML={renderMarkdownWithMath(aiEvaluation.feedback)}
                      />
                    </div>
                  </div>
                )}
              </section>

              <section style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setExplanationModalQuestion(selectedQuestion);
                    setExplanationTab("ai");
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#8B5CF6',
                    color: '#FFF',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {language === "en" ? "AI Tutor & Explanation" : "এআই টিউটর ও ব্যাখ্যা"}
                </button>

                {selectedQuestion.explanation && (
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#E2E8F0',
                      color: '#334155',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {showAnswer ? (language === "en" ? "Hide Manual Answer" : "ম্যানুয়াল উত্তর লুকান") : (language === "en" ? "Show Manual Answer" : "ম্যানুয়াল উত্তর দেখুন")}
                  </button>
                )}
              </section>

              {selectedQuestion.explanation && showAnswer && (
                <section style={{ marginTop: '12px' }}>
                  <div
                    className="varsity-written-modal__html"
                    dangerouslySetInnerHTML={{
                      __html: selectedQuestion.explanation,
                    }}
                  />
                </section>
              )}
            </div>
          </div>
        </div>
      )}
      {explanationModalQuestion && (
        <div
          className="exam-explanation-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setExplanationModalQuestion(null)}
          style={{ zIndex: 9999 }}
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
              <div className="exam-explanation-q-text">
                <div dangerouslySetInnerHTML={renderMarkdownWithMath(explanationModalQuestion.questionText || explanationModalQuestion.question || explanationModalQuestion.stem)} />
                {explanationModalQuestion.parts && explanationModalQuestion.parts.length > 0 && (
                  <ol style={{ margin: '8px 0 0 16px', padding: 0, listStyle: 'decimal' }}>
                    {explanationModalQuestion.parts.map((part, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>
                        <strong>({part.label?.toLowerCase() || i + 1})</strong>{" "}
                        <span dangerouslySetInnerHTML={renderMarkdownWithMath(part.text || "")} />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
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
                  const solutionStr = explanationModalQuestion.solution || explanationModalQuestion.explanation;
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
                                dangerouslySetInnerHTML={renderMarkdownWithMath(item.text)}
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
                        dangerouslySetInnerHTML={renderMarkdownWithMath(
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Action buttons */}
                  {!aiExplanations[explanationModalQuestion?._id] && !aiExplainLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '32px 16px' }}>
                      <p style={{ margin: '0 0 8px', color: '#64748B', fontSize: '15px', textAlign: 'center', lineHeight: '1.6' }}>
                        {language === "en"
                          ? "Get a detailed step-by-step solution from the AI Tutor. You can ask follow-up questions and upload images in the chat."
                          : "এআই টিউটরের কাছ থেকে এই প্রশ্নটির একটি বিস্তারিত সমাধান তৈরি করো। তুমি চ্যাটের মাধ্যমে পরবর্তী প্রশ্ন জিজ্ঞাসা করতে এবং ছবি আপলোড করতে পারবে।"}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!explanationModalQuestion) return;
                          setAiExplainLoading(true);
                          try {
                            const backendBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                            const res = await fetch(`${backendBaseUrl}/evaluate/explain`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${localStorage.getItem("topkorbo_token") || localStorage.getItem("token")}`,
                              },
                              body: JSON.stringify({
                                questionId: explanationModalQuestion._id,
                              }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setAiExplanations(prev => ({ ...prev, [explanationModalQuestion._id]: data.explanation }));

                              const initialThread = [
                                {
                                  role: "user",
                                  content: language === "en" ? "Generate a detailed solution for this question." : "এই প্রশ্নের একটি বিস্তারিত সমাধান তৈরি করো।"
                                },
                                {
                                  role: "assistant",
                                  content: data.explanation
                                }
                              ];

                              setAiChatThreads(prev => ({
                                ...prev,
                                [explanationModalQuestion._id]: initialThread
                              }));
                            } else {
                              const errData = await res.json().catch(() => ({}));
                              setAiExplanations(prev => ({ ...prev, [explanationModalQuestion._id]: `Error: ${errData.msg || 'Failed to generate explanation.'}` }));
                            }
                          } catch (err) {
                            setAiExplanations(prev => ({ ...prev, [explanationModalQuestion._id]: `Network Error: ${err.message}` }));
                          } finally {
                            setAiExplainLoading(false);
                          }
                        }}
                        style={{
                          padding: '12px 24px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                          color: '#FFF',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.45)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.35)'; }}
                      >
                        {language === "en" ? "Generate Detailed Solution" : "বিস্তারিত সমাধান তৈরি করো"}
                      </button>
                    </div>
                  )}

                  {/* Loading state */}
                  {aiExplainLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px 16px' }}>
                      <div style={{
                        width: '40px', height: '40px',
                        border: '3px solid #E2E8F0',
                        borderTopColor: '#6366F1',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      <p style={{ color: '#6366F1', fontWeight: '500', fontSize: '15px', margin: 0 }}>
                        {language === "en" ? "AI is thinking..." : "AI চিন্তা করছে..."}
                      </p>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}

                  {/* Explanation output & Tutoring Chat */}
                  {aiExplanations[explanationModalQuestion?._id] && !aiExplainLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Messages Thread */}
                      <div
                        className="ai-chat-thread-container"
                        style={{
                          maxHeight: '400px',
                          overflowY: 'auto',
                          padding: '12px',
                          border: '1px solid #F1F5F9',
                          borderRadius: '12px',
                          backgroundColor: '#FAF9F6',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px'
                        }}
                      >
                        {(aiChatThreads[explanationModalQuestion._id] || [
                          { role: "assistant", content: aiExplanations[explanationModalQuestion._id] }
                        ]).map((msg, index) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div
                              key={index}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isUser ? 'flex-end' : 'flex-start',
                                alignSelf: isUser ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                gap: '4px'
                              }}
                            >
                              {/* Avatar / Name label */}
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', margin: isUser ? '0 8px 0 0' : '0 0 0 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {isUser
                                  ? (language === "en" ? "You" : "তুমি")
                                  : (language === "en" ? "AI Tutor" : "এআই টিউটর")}
                              </span>

                              {/* Message bubble */}
                              <div
                                style={{
                                  background: isUser
                                    ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                                    : '#FFFFFF',
                                  color: isUser ? '#FFFFFF' : '#1E293B',
                                  border: isUser ? 'none' : '1px solid #E2E8F0',
                                  borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                  padding: '12px 16px',
                                  boxShadow: isUser ? '0 3px 10px rgba(99, 102, 241, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.03)',
                                  fontSize: '14px',
                                  lineHeight: '1.6',
                                }}
                              >
                                {/* Thumbnail attachment if present */}
                                {msg.image && (
                                  <div style={{ marginBottom: '8px' }}>
                                    <img
                                      src={msg.image}
                                      alt="Attachment"
                                      style={{
                                        maxWidth: '180px',
                                        maxHeight: '130px',
                                        objectFit: 'contain',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 255, 255, 0.2)'
                                      }}
                                    />
                                  </div>
                                )}
                                <div
                                  className="chat-bubble-text"
                                  dangerouslySetInnerHTML={
                                    isUser
                                      ? { __html: msg.content.replace(/\n/g, '<br/>') }
                                      : renderMarkdownWithMath(msg.content)
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}

                        {/* Typing / Sending indicator */}
                        {isSendingFollowUp && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              alignSelf: 'flex-start',
                              background: '#F1F5F9',
                              borderRadius: '12px 12px 12px 2px',
                              padding: '10px 14px',
                              color: '#64748B',
                              fontSize: '13px'
                            }}
                          >
                            <div style={{
                              width: '6px', height: '6px',
                              backgroundColor: '#94A3B8',
                              borderRadius: '50%',
                              animation: 'bounce 1.4s infinite ease-in-out both'
                            }} />
                            <div style={{
                              width: '6px', height: '6px',
                              backgroundColor: '#94A3B8',
                              borderRadius: '50%',
                              animation: 'bounce 1.4s infinite ease-in-out both 0.2s'
                            }} />
                            <div style={{
                              width: '6px', height: '6px',
                              backgroundColor: '#94A3B8',
                              borderRadius: '50%',
                              animation: 'bounce 1.4s infinite ease-in-out both 0.4s'
                            }} />
                            <span style={{ marginLeft: '4px' }}>
                              {language === "en" ? "AI is replying..." : "AI উত্তর দিচ্ছে..."}
                            </span>
                            <style>{`
                              @keyframes bounce {
                                0%, 80%, 100% { transform: scale(0); }
                                40% { transform: scale(1.0); }
                              }
                            `}</style>
                          </div>
                        )}
                      </div>

                      {/* Chat Input & File upload Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Hidden follow-up image file input */}
                        <input
                          ref={followUpFileRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            processImageFile(file, (dataUrl) => {
                              setFollowUpImage(dataUrl);
                            });
                          }}
                        />

                        {/* Image Preview attachment */}
                        {followUpImage && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', position: 'relative' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={followUpImage}
                                alt="Attachment preview"
                                style={{ maxWidth: '100px', maxHeight: '80px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                              />
                              <button
                                type="button"
                                onClick={() => setFollowUpImage(null)}
                                style={{
                                  position: 'absolute',
                                  top: '-6px',
                                  right: '-6px',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: '#EF4444',
                                  color: '#FFF',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px'
                                }}
                              >
                                <HiX size={12} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Input bar */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: '1.5px solid #CBD5E1',
                            borderRadius: '10px',
                            padding: '4px 8px',
                            backgroundColor: '#FFF'
                          }}
                        >
                          {/* Image Attach Button */}
                          <button
                            type="button"
                            onClick={() => followUpFileRef.current?.click()}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#64748B',
                              cursor: 'pointer',
                              padding: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title={language === "en" ? "Attach image" : "ছবি যুক্ত করুন"}
                          >
                            <HiPaperClip size={20} />
                          </button>

                          {/* Chat Input Textarea */}
                          <textarea
                            value={followUpText}
                            onChange={(e) => setFollowUpText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendFollowUp();
                              }
                            }}
                            placeholder={language === "en" ? "Ask a follow-up question..." : "এই প্রশ্নটি সম্পর্কে কোনো কনফিউশন থাকলে জিজ্ঞাসা করো..."}
                            style={{
                              flex: 1,
                              border: 'none',
                              outline: 'none',
                              resize: 'none',
                              height: '40px',
                              maxHeight: '100px',
                              fontFamily: 'inherit',
                              fontSize: '14px',
                              color: '#1E293B',
                              padding: '8px 4px',
                            }}
                          />

                          {/* Send Button */}
                          <button
                            type="button"
                            onClick={handleSendFollowUp}
                            disabled={isSendingFollowUp || (!followUpText.trim() && !followUpImage)}
                            style={{
                              backgroundColor: (followUpText.trim() || followUpImage) && !isSendingFollowUp ? '#6366F1' : '#E2E8F0',
                              color: (followUpText.trim() || followUpImage) && !isSendingFollowUp ? '#FFF' : '#94A3B8',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px',
                              cursor: (followUpText.trim() || followUpImage) && !isSendingFollowUp ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            <HiPaperAirplane size={16} style={{ transform: 'rotate(90deg)' }} />
                          </button>
                        </div>
                      </div>

                      {/* Reset / Regenerate solution */}
                      <button
                        type="button"
                        onClick={() => {
                          setAiExplanations(prev => {
                            const copy = { ...prev };
                            delete copy[explanationModalQuestion._id];
                            return copy;
                          });
                          setAiChatThreads(prev => {
                            const copy = { ...prev };
                            delete copy[explanationModalQuestion._id];
                            return copy;
                          });
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFF',
                          color: '#64748B',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          marginTop: '4px'
                        }}
                      >
                        {language === "en" ? "↻ Reset Conversation" : "↻ নতুন করে শুরু করো"}
                      </button>
                    </div>
                  )}
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
};

export default VarsityWrittenView;
