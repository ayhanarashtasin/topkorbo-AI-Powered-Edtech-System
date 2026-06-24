/**
 * Practice History Page
 * ----------------------------------------------------------------------------
 * Shows every Mock Test, QBank inline practice, and free practice attempt
 * the student has completed. Filterable by:
 *   - mode (mock_test / qbank_practice / inline_qbank / free_practice)
 *   - subject, paper, chapter, topic
 *   - percentage range
 *   - date range
 *
 * Clicking an attempt opens a side panel with the full per-question
 * breakdown, marks, AI feedback, and the option to delete.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  HiOutlineAcademicCap,
  HiOutlineChartBar,
  HiOutlineClipboardCheck,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineFilter,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineMinusCircle,
  HiOutlineBookOpen,
  HiOutlineFolder,
  HiOutlineChevronRight,
  HiOutlineCalendar,
  HiOutlineTrendingUp
} from "react-icons/hi";
import toast from "react-hot-toast";
import Sidebar from "../components/layout/Sidebar";
import { useLanguage } from "../hooks/useLanguage";
import {
  listMyAttempts,
  getAttempt,
  deleteAttempt,
  getStats
} from "../services/practiceApi";
import "./PracticeHistory.css";
import katex from "katex";
import "katex/dist/katex.min.css";

const MODE_LABELS = {
  mock_test: "Mock Test",
  qbank_practice: "QBank Practice",
  inline_qbank: "QBank Inline",
  free_practice: "Free Practice"
};

const MODE_COLORS = {
  mock_test: "#C08552",
  qbank_practice: "#059669",
  inline_qbank: "#8C5A3C",
  free_practice: "#e11d48"
};

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatDuration(seconds = 0) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function renderMarkdownWithMath(text) {
  if (!text) return { __html: "" };

  // Normalize double backslashes to single backslashes for LaTeX commands/symbols
  const normalizedText = text.replace(/\\\\([a-zA-Z\d_{}%])/g, '\\$1');

  const mathBlocks = [];

  // 1. Extract and render display math: $$...$$
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

  // 2. Extract and render inline math: $...$
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

  // 3. Apply markdown formatting to the remaining text (with placeholders)
  processed = processed
    // Headings: ### Heading, ## Heading, # Heading
    .replace(/^### (.+)$/gm, '<div style="font-size:15px;font-weight:700;color:#8C5A3C;margin:16px 0 6px;border-bottom:1px solid rgba(192, 133, 82, 0.15);padding-bottom:4px;">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-size:17px;font-weight:700;color:#251817;margin:20px 0 8px;border-bottom:2px solid #C08552;padding-bottom:6px;">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-size:19px;font-weight:800;color:#251817;margin:20px 0 10px;border-bottom:2px solid #C08552;padding-bottom:6px;">$1</div>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#251817;">$1</strong>')
    // Numbered steps
    .replace(/^(\d+)\.\s/gm, '<span style="display:inline-block;background:#C08552;color:#FFF;font-weight:700;font-size:13px;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;margin-right:8px;">$1</span>')
    // Bullet points
    .replace(/^[-•]\s(.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;"><span style="color:#C08552;font-weight:bold;margin-top:2px;">•</span><span>$1</span></div>')
    // Line breaks
    .replace(/\n\n/g, '<div style="margin:12px 0;"></div>')
    .replace(/\n/g, '<br/>');

  // 4. Restore the math blocks
  mathBlocks.forEach((renderedMath, index) => {
    processed = processed.replace(`%%MATH_BLOCK_${index}%%`, () => renderedMath);
  });

  return { __html: processed };
}

export default function PracticeHistory() {
  const { t } = useLanguage();
  const [user] = useState({
    name: localStorage.getItem("topkorbo_name") || "Student",
    role: localStorage.getItem("topkorbo_role") || "student"
  });

  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);

  // Filter state
  const [filters, setFilters] = useState({
    mode: "",
    subject: "",
    paper: "",
    chapter: "",
    topic: "",
    minPercentage: "",
    maxPercentage: "",
    from: "",
    to: ""
  });

  // Detail drawer
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const activeTab = "practice-history";

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) params[k] = v;
      });
      const res = await listMyAttempts({ ...params, limit: 100 });
      setAttempts(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("[PracticeHistory] fetchList failed:", err);
      toast.error(err?.message || "Failed to load practice history");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
    } catch (err) {
      console.warn("stats load failed", err);
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, [fetchList, fetchStats]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      mode: "",
      subject: "",
      paper: "",
      chapter: "",
      topic: "",
      minPercentage: "",
      maxPercentage: "",
      from: "",
      to: ""
    });
  };

  const openDetail = async (id) => {
    setDetail(null);
    setDetailLoading(true);
    try {
      const a = await getAttempt(id);
      setDetail(a);
    } catch (err) {
      console.error("[PracticeHistory] getAttempt failed:", err);
      toast.error(err?.message || "Failed to load attempt");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this attempt? This cannot be undone.")) return;
    try {
      await deleteAttempt(id);
      toast.success("Attempt deleted");
      setDetail(null);
      fetchList();
      fetchStats();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  // Build subject/paper/chapter/topic filter options from the visible rows
  const filterOptions = useMemo(() => {
    const subjects = new Set();
    const papers = new Set();
    const chapters = new Set();
    const topics = new Set();
    attempts.forEach((a) => {
      (a.subjects || []).forEach((s) => s && subjects.add(s));
      (a.papers || []).forEach((s) => s && papers.add(s));
      (a.chapters || []).forEach((s) => s && chapters.add(s));
      (a.topics || []).forEach((s) => s && topics.add(s));
    });
    return {
      subjects: Array.from(subjects).sort(),
      papers: Array.from(papers).sort(),
      chapters: Array.from(chapters).sort(),
      topics: Array.from(topics).sort()
    };
  }, [attempts]);

  return (
    <div className="dashboard-container practice-history-page">
      <Sidebar user={user} activeTab={activeTab} />
      <div className="practice-history-main">
        <header className="practice-history-header">
          <div>
            <h1 className="practice-history-title">
              <HiOutlineClipboardCheck size={28} />
              Practice History
            </h1>
            <p className="practice-history-sub">
              Every mock test and QBank practice you complete is saved here.
            </p>
          </div>
          {stats && (
            <div className="practice-history-overall">
              <StatPill
                icon={<HiOutlineDocumentText />}
                label="Attempts"
                value={stats.overall.totalAttempts}
              />
              <StatPill
                icon={<HiOutlineChartBar />}
                label="Accuracy"
                value={`${(stats.overall.accuracy * 100).toFixed(1)}%`}
              />
              <StatPill
                icon={<HiOutlineClock />}
                label="Total Time"
                value={formatDuration(stats.overall.totalTimeSeconds)}
              />
              <StatPill
                icon={<HiOutlineAcademicCap />}
                label="Marks"
                value={`${stats.overall.totalObtained}/${stats.overall.totalPossible}`}
              />
            </div>
          )}
        </header>

        {/* ── Filters ────────────────────────────────────────────── */}
        <section className="practice-history-filters">
          <div className="ph-filter-row">
            <FilterSelect
              label="Mode"
              value={filters.mode}
              onChange={(v) => handleFilterChange("mode", v)}
              options={[
                { value: "", label: "All modes" },
                { value: "mock_test", label: "Mock Test" },
                { value: "qbank_practice", label: "QBank Practice" },
                { value: "inline_qbank", label: "QBank Inline" },
                { value: "free_practice", label: "Free Practice" }
              ]}
            />
            <FilterSelect
              label="Subject"
              value={filters.subject}
              onChange={(v) => handleFilterChange("subject", v)}
              options={[
                { value: "", label: "All subjects" },
                ...filterOptions.subjects.map((s) => ({ value: s, label: s }))
              ]}
            />
            <FilterSelect
              label="Paper"
              value={filters.paper}
              onChange={(v) => handleFilterChange("paper", v)}
              options={[
                { value: "", label: "All papers" },
                ...filterOptions.papers.map((s) => ({ value: s, label: s }))
              ]}
            />
            <FilterSelect
              label="Chapter"
              value={filters.chapter}
              onChange={(v) => handleFilterChange("chapter", v)}
              options={[
                { value: "", label: "All chapters" },
                ...filterOptions.chapters.map((s) => ({ value: s, label: s }))
              ]}
            />
            <FilterSelect
              label="Topic"
              value={filters.topic}
              onChange={(v) => handleFilterChange("topic", v)}
              options={[
                { value: "", label: "All topics" },
                ...filterOptions.topics.map((s) => ({ value: s, label: s }))
              ]}
            />
          </div>
          <div className="ph-filter-row">
            <FilterInput
              label="Min %"
              type="number"
              value={filters.minPercentage}
              onChange={(v) => handleFilterChange("minPercentage", v)}
            />
            <FilterInput
              label="Max %"
              type="number"
              value={filters.maxPercentage}
              onChange={(v) => handleFilterChange("maxPercentage", v)}
            />
            <FilterInput
              label="From"
              type="date"
              value={filters.from}
              onChange={(v) => handleFilterChange("from", v)}
            />
            <FilterInput
              label="To"
              type="date"
              value={filters.to}
              onChange={(v) => handleFilterChange("to", v)}
            />
            <button className="ph-clear-btn" onClick={clearFilters}>
              <HiOutlineFilter size={16} /> Clear
            </button>
          </div>
        </section>

        {/* ── List ────────────────────────────────────────────── */}
        <section className="practice-history-list">
          {loading ? (
            <div className="ph-empty">Loading…</div>
          ) : attempts.length === 0 ? (
            <div className="ph-empty">
              <HiOutlineSearch size={28} />
              <p>No attempts yet. Take a mock test or answer a QBank question to see it here.</p>
            </div>
          ) : (
            <>
              <div className="ph-results-meta">
                Showing {attempts.length} of {total}
              </div>
              {attempts.map((a) => (
                <AttemptCard
                  key={a._id}
                  attempt={a}
                  onOpen={() => openDetail(a._id)}
                />
              ))}
            </>
          )}
        </section>
      </div>

      {/* ── Detail drawer ────────────────────────────────────────────── */}
      {(detail || detailLoading) && (
        <DetailDrawer
          attempt={detail}
          loading={detailLoading}
          onClose={() => setDetail(null)}
          onDelete={() => detail && handleDelete(detail._id)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatPill({ icon, label, value }) {
  return (
    <div className="ph-stat-pill">
      <span className="ph-stat-pill-icon">{icon}</span>
      <div>
        <div className="ph-stat-pill-value">{value}</div>
        <div className="ph-stat-pill-label">{label}</div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="ph-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({ label, type, value, onChange }) {
  return (
    <label className="ph-filter-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function AttemptCard({ attempt, onOpen }) {
  const pct = attempt.marks?.percentage ?? 0;
  const color = pct >= 80 ? "#059669" : pct >= 50 ? "#8C5A3C" : "#e11d48";
  const mode = attempt.mode;
  return (
    <div className="ph-attempt-card" onClick={onOpen}>
      <div
        className="ph-attempt-mode"
        style={{ backgroundColor: MODE_COLORS[mode] || "#6366f1" }}
      >
        {MODE_LABELS[mode] || mode}
      </div>
      <div className="ph-attempt-body">
        <h3 className="ph-attempt-title">{attempt.title || "Untitled attempt"}</h3>
        <div className="ph-attempt-meta">
          {attempt.subjects && attempt.subjects.length > 0 && (
            <span>
              <HiOutlineBookOpen size={14} className="ph-meta-icon" />
              {attempt.subjects.join(", ")}
            </span>
          )}
          {attempt.papers && attempt.papers.length > 0 && (
            <span>
              <HiOutlineDocumentText size={14} className="ph-meta-icon" />
              {attempt.papers.join(", ")}
            </span>
          )}
          {attempt.chapters && attempt.chapters.length > 0 && (
            <span>
              <HiOutlineFolder size={14} className="ph-meta-icon" />
              {attempt.chapters.join(", ")}
            </span>
          )}
        </div>
        <div className="ph-attempt-submeta">
          <span>
            <HiOutlineClock size={14} /> {formatDuration(attempt.timing?.timeTakenSeconds)}
          </span>
          <span>
            <HiOutlineAcademicCap size={14} /> {attempt.config?.questionCount || attempt.questions?.length || 0} questions
          </span>
          <span>
            <HiOutlineCalendar size={14} /> {formatDate(attempt.createdAt)}
          </span>
        </div>
      </div>
      <div className="ph-attempt-score" style={{ color }}>
        <div className="ph-attempt-score-num">{pct.toFixed(1)}%</div>
        <div className="ph-attempt-score-sub">
          {attempt.marks?.obtained ?? 0} / {attempt.marks?.total ?? 0}
        </div>
      </div>
      <div className="ph-attempt-chevron">
        <HiOutlineChevronRight size={18} />
      </div>
    </div>
  );
}

function DetailDrawer({ attempt, loading, onClose, onDelete }) {
  return (
    <div className="ph-drawer-backdrop" onClick={onClose}>
      <div className="ph-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ph-drawer-header">
          <h2>{attempt ? attempt.title || "Attempt" : "Loading…"}</h2>
          <button className="ph-icon-btn" onClick={onClose} aria-label="Close">
            <HiOutlineX size={20} />
          </button>
        </div>

        {loading || !attempt ? (
          <div className="ph-empty">Loading attempt…</div>
        ) : (
          <>
            <div className="ph-drawer-summary">
              <div>
                <div className="ph-drawer-summary-label">Score</div>
                <div className="ph-drawer-summary-value">
                  {attempt.marks?.obtained ?? 0} / {attempt.marks?.total ?? 0}
                  <span className="ph-drawer-summary-sub">
                    ({attempt.marks?.percentage?.toFixed(1) ?? 0}%)
                  </span>
                </div>
              </div>
              <div>
                <div className="ph-drawer-summary-label">Time</div>
                <div className="ph-drawer-summary-value">
                  {formatDuration(attempt.timing?.timeTakenSeconds)}
                </div>
              </div>
              <div>
                <div className="ph-drawer-summary-label">Mode</div>
                <div className="ph-drawer-summary-value">
                  {MODE_LABELS[attempt.mode] || attempt.mode}
                </div>
              </div>
              <div>
                <div className="ph-drawer-summary-label">Correct / Wrong / Skipped</div>
                <div className="ph-drawer-summary-value">
                  <span style={{ color: "#059669" }}>{attempt.marks?.correct || 0}</span>
                  {" / "}
                  <span style={{ color: "#e11d48" }}>{attempt.marks?.incorrect || 0}</span>
                  {" / "}
                  <span style={{ color: "var(--text-muted)" }}>{attempt.marks?.skipped || 0}</span>
                </div>
              </div>
            </div>

            <div className="ph-drawer-section-title">Questions</div>
            <div className="ph-drawer-questions">
              {(attempt.questions || []).map((q, idx) => {
                const icon = !q.isAttempted ? (
                  <HiOutlineMinusCircle size={20} color="var(--text-muted)" />
                ) : q.isCorrect ? (
                  <HiOutlineCheckCircle size={20} color="#059669" />
                ) : (
                  <HiOutlineXCircle size={20} color="#e11d48" />
                );
                return (
                  <div key={q._id || idx} className="ph-drawer-q">
                    <div className="ph-drawer-q-head">
                      {icon}
                      <div className="ph-drawer-q-num">Q{idx + 1}</div>
                      <div className="ph-drawer-q-meta">
                        {q.subject && <span>{q.subject}</span>}
                        {q.paper && <span>· {q.paper} Paper</span>}
                        {q.chapter && <span>· {q.chapter}</span>}
                        {q.topic && <span>· {q.topic}</span>}
                      </div>
                      <div className="ph-drawer-q-score">
                        {q.score?.toFixed?.(2) ?? q.score} / {q.maxScore}
                      </div>
                    </div>
                    {q.snapshot?.questionText && (
                      <div
                        className="ph-drawer-q-text"
                        dangerouslySetInnerHTML={renderMarkdownWithMath(q.snapshot.questionText)}
                      />
                    )}
                    {q.aiFeedback && (
                      <div
                        className="ph-drawer-q-feedback"
                        dangerouslySetInnerHTML={renderMarkdownWithMath(`**AI feedback:** ${q.aiFeedback}`)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="ph-drawer-footer">
              <button className="ph-delete-btn" onClick={onDelete}>
                <HiOutlineTrash size={16} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
