/**
 * Practice History
 * A study ledger for reviewing attempts, spotting patterns, and choosing
 * what to practise next.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  HiOutlineAcademicCap,
  HiOutlineBookOpen,
  HiOutlineCalendar,
  HiOutlineChartBar,
  HiOutlineCheckCircle,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineFilter,
  HiOutlineFolder,
  HiOutlineMinusCircle,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineTrendingUp,
  HiOutlineX,
  HiOutlineXCircle
} from "react-icons/hi";
import toast from "react-hot-toast";
import katex from "katex";
import Sidebar from "../components/layout/Sidebar";
import {
  deleteAttempt,
  getAttempt,
  getStats,
  listMyAttempts
} from "../services/practiceApi";
import { sanitizeHtml } from "../utils/safeHtml";
import "./PracticeHistory.css";
import "katex/dist/katex.min.css";

const MODE_LABELS = {
  mock_test: "Mock Test",
  qbank_practice: "QBank Practice",
  inline_qbank: "QBank Inline",
  free_practice: "Free Practice"
};

const MODE_CLASS_NAMES = {
  mock_test: "ph-mode--mock",
  qbank_practice: "ph-mode--qbank",
  inline_qbank: "ph-mode--inline",
  free_practice: "ph-mode--free"
};

const MODE_OPTIONS = [
  { value: "", label: "All modes" },
  { value: "mock_test", label: "Mock Test" },
  { value: "qbank_practice", label: "QBank Practice" },
  { value: "inline_qbank", label: "QBank Inline" },
  { value: "free_practice", label: "Free Practice" }
];

const EMPTY_FILTERS = Object.freeze({
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

const EMPTY_OVERALL = Object.freeze({
  totalAttempts: 0,
  totalQuestions: 0,
  attemptedQuestions: 0,
  correctQuestions: 0,
  accuracy: 0,
  totalObtained: 0,
  totalPossible: 0,
  totalTimeSeconds: 0
});

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit"
});

const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short"
});

const NUMBER_FORMATTER = new Intl.NumberFormat();
const PERCENT_FORMATTERS = {
  0: new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }),
  1: new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })
};
const FILTER_KEYS = Object.keys(EMPTY_FILTERS);

function getInitialFilters() {
  if (typeof window === "undefined") return { ...EMPTY_FILTERS };
  const searchParams = new URLSearchParams(window.location.search);
  const initialFilters = { ...EMPTY_FILTERS };
  FILTER_KEYS.forEach((key) => {
    initialFilters[key] = searchParams.get(key) || "";
  });
  return initialFilters;
}

function formatNumber(value) {
  return NUMBER_FORMATTER.format(Number(value) || 0);
}

function formatDate(iso) {
  if (!iso) return { date: "No date", time: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "No date", time: "" };
  return {
    date: DATE_FORMATTER.format(date),
    time: TIME_FORMATTER.format(date)
  };
}

function formatDuration(seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatPercentage(value, decimals = 0) {
  const percentage = Number(value) || 0;
  const formatter = PERCENT_FORMATTERS[decimals] || PERCENT_FORMATTERS[0];
  return `${formatter.format(percentage)}%`;
}

function percentageFromRatio(value) {
  return Math.max(0, Math.min(100, (Number(value) || 0) * 100));
}

function scoreBand(percentage) {
  if (percentage >= 80) return "strong";
  if (percentage >= 50) return "steady";
  return "rebuild";
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMomentumDays(rawDays = [], today = new Date()) {
  const byDate = new Map(rawDays.map((day) => [day._id, day]));
  const days = [];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - offset);
    const key = localDateKey(date);
    const source = byDate.get(key);
    const average = Math.max(0, Math.min(100, Number(source?.avgPct) || 0));

    days.push({
      key,
      average,
      count: Number(source?.count) || 0,
      label: SHORT_DAY_FORMATTER.format(date),
      dateLabel: DATE_FORMATTER.format(date)
    });
  }

  return days;
}

function renderMarkdownWithMath(text) {
  if (!text) return { __html: "" };

  const normalizedText = text.replace(/\\\\([a-zA-Z\d_{}%])/g, "\\$1");
  const mathBlocks = [];

  let processed = normalizedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, value) => {
    try {
      const rendered = katex.renderToString(value.trim(), {
        displayMode: true,
        throwOnError: false
      });
      const index = mathBlocks.length;
      mathBlocks.push(rendered);
      return `%%MATH_BLOCK_${index}%%`;
    } catch {
      return match;
    }
  });

  processed = processed.replace(/\$([^$]+)\$/g, (match, value) => {
    try {
      const rendered = katex.renderToString(value.trim(), {
        displayMode: false,
        throwOnError: false
      });
      const index = mathBlocks.length;
      mathBlocks.push(rendered);
      return `%%MATH_BLOCK_${index}%%`;
    } catch {
      return match;
    }
  });

  processed = processed
    .replace(
      /^### (.+)$/gm,
      '<div class="ph-rich-heading ph-rich-heading--small">$1</div>'
    )
    .replace(
      /^## (.+)$/gm,
      '<div class="ph-rich-heading ph-rich-heading--medium">$1</div>'
    )
    .replace(
      /^# (.+)$/gm,
      '<div class="ph-rich-heading ph-rich-heading--large">$1</div>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /^(\d+)\.\s/gm,
      '<span class="ph-rich-step">$1</span>'
    )
    .replace(
      /^[-•]\s(.+)$/gm,
      '<div class="ph-rich-bullet"><span aria-hidden="true">•</span><span>$1</span></div>'
    )
    .replace(/\n\n/g, '<div class="ph-rich-break"></div>')
    .replace(/\n/g, "<br/>");

  mathBlocks.forEach((renderedMath, index) => {
    processed = processed.replace(
      `%%MATH_BLOCK_${index}%%`,
      () => renderedMath
    );
  });

  return { __html: sanitizeHtml(processed) };
}

export default function PracticeHistory() {
  const [user] = useState(() => ({
    name: localStorage.getItem("topkorbo_name") || "Student",
    role: localStorage.getItem("topkorbo_role") || "student"
  }));
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(getInitialFilters);
  const [drawer, setDrawer] = useState({ status: "closed", attempt: null });
  const drawerRequestRef = useRef(0);

  useEffect(() => {
    let active = true;

    const loadAttempts = async () => {
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          params[key] = value;
        }
      });

      try {
        const response = await listMyAttempts({ ...params, limit: 100 });
        if (!active) return;
        setAttempts(response.items || []);
        setTotal(response.total || 0);
      } catch (error) {
        if (!active) return;
        console.error("[PracticeHistory] list failed:", error);
        toast.error(error?.message || "Failed to load practice history");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAttempts();
    return () => {
      active = false;
    };
  }, [filters]);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      try {
        const response = await getStats();
        if (active) setStats(response);
      } catch (error) {
        console.warn("[PracticeHistory] stats failed:", error);
      }
    };

    loadStats();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    FILTER_KEYS.forEach((key) => {
      if (filters[key]) url.searchParams.set(key, filters[key]);
      else url.searchParams.delete(key);
    });
    window.history.replaceState(window.history.state, "", url);
  }, [filters]);

  const filterOptions = useMemo(() => {
    const subjects = new Set();
    const papers = new Set();
    const chapters = new Set();
    const topics = new Set();

    attempts.forEach((attempt) => {
      (attempt.subjects || []).forEach((value) => value && subjects.add(value));
      (attempt.papers || []).forEach((value) => value && papers.add(value));
      (attempt.chapters || []).forEach((value) => value && chapters.add(value));
      (attempt.topics || []).forEach((value) => value && topics.add(value));
    });

    return {
      subjects: Array.from(subjects).sort(),
      papers: Array.from(papers).sort(),
      chapters: Array.from(chapters).sort(),
      topics: Array.from(topics).sort()
    };
  }, [attempts]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleFilterChange = (name, value) => {
    setLoading(true);
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const clearFilters = () => {
    setLoading(true);
    setFilters({ ...EMPTY_FILTERS });
  };

  const closeDrawer = useCallback(() => {
    drawerRequestRef.current += 1;
    setDrawer({ status: "closed", attempt: null });
  }, []);

  const openDetail = async (id) => {
    const requestId = drawerRequestRef.current + 1;
    drawerRequestRef.current = requestId;
    setDrawer({ status: "loading", attempt: null });

    try {
      const attempt = await getAttempt(id);
      if (drawerRequestRef.current === requestId) {
        setDrawer({ status: "ready", attempt });
      }
    } catch (error) {
      if (drawerRequestRef.current === requestId) {
        setDrawer({ status: "closed", attempt: null });
        toast.error(error?.message || "Failed to load attempt");
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this attempt? This cannot be undone.")) return;

    try {
      await deleteAttempt(id);
    } catch {
      toast.error("Delete failed");
      return;
    }

    closeDrawer();
    toast.success("Attempt deleted");
    setLoading(true);

    try {
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          params[key] = value;
        }
      });
      const [listResponse, statsResponse] = await Promise.all([
        listMyAttempts({ ...params, limit: 100 }),
        getStats()
      ]);
      setAttempts(listResponse.items || []);
      setTotal(listResponse.total || 0);
      setStats(statsResponse);
    } catch {
      toast.error("Record deleted, but the totals could not refresh. Reload the page.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <React.Fragment>
      <div className="dashboard-container practice-history-page">
        <a className="ph-skip-link" href="#practice-history-content">
          Skip to Practice History
        </a>
        <Sidebar user={user} activeTab="practice-history" />

        <main id="practice-history-content" className="practice-history-main">
          <LearningLedgerHero stats={stats} />

          <div className="ph-workspace">
            <aside className="ph-control-rail" aria-label="History controls">
              <FilterPanel
                filters={filters}
                options={filterOptions}
                activeCount={activeFilterCount}
                onChange={handleFilterChange}
                onClear={clearFilters}
              />
              <SubjectSignals subjects={stats?.bySubject || []} />
            </aside>

            <AttemptFeed
              attempts={attempts}
              total={total}
              loading={loading}
              activeFilterCount={activeFilterCount}
              onOpen={openDetail}
            />
          </div>
        </main>

        {drawer.status !== "closed" ? (
          <DrawerShell
            title={
              drawer.status === "ready"
                ? drawer.attempt?.title || "Attempt review"
                : "Opening attempt"
            }
            onClose={closeDrawer}
          >
            {drawer.status === "loading" ? (
              <DrawerLoading />
            ) : (
              <AttemptDetail
                attempt={drawer.attempt}
                onDelete={handleDelete}
              />
            )}
          </DrawerShell>
        ) : null}
      </div>
    </React.Fragment>
  );
}

function LearningLedgerHero({ stats }) {
  const overall = stats?.overall || EMPTY_OVERALL;
  const accuracy = percentageFromRatio(overall.accuracy);
  const momentumDays = useMemo(
    () => buildMomentumDays(stats?.last14Days || []),
    [stats?.last14Days]
  );

  return (
    <header className="ph-hero">
      <div className="ph-hero__intro">
        <span className="ph-kicker">
          <span className="ph-kicker__line" aria-hidden="true" />
          Learning record / Practice
        </span>
        <h1>Practice History</h1>
        <p>
          Read the pattern behind every attempt, then return to the topics
          that need one more pass.
        </p>
      </div>

      <div className="ph-hero__analysis">
        <div className={`ph-accuracy ph-score--${scoreBand(accuracy)}`}>
          <span className="ph-accuracy__label">Overall accuracy</span>
          <strong>{formatPercentage(accuracy, 1)}</strong>
          <span>
            {formatNumber(overall.correctQuestions)} correct of{" "}
            {formatNumber(overall.attemptedQuestions)} answered
          </span>
        </div>
        <MomentumRail days={momentumDays} />
      </div>

      <div className="ph-metric-strip" aria-label="Practice totals">
        <HeroMetric
          icon={<HiOutlineDocumentText aria-hidden="true" />}
          label="Attempts logged"
          value={formatNumber(overall.totalAttempts)}
        />
        <HeroMetric
          icon={<HiOutlineAcademicCap aria-hidden="true" />}
          label="Marks earned"
          value={`${formatNumber(overall.totalObtained)}/${formatNumber(overall.totalPossible)}`}
        />
        <HeroMetric
          icon={<HiOutlineClock aria-hidden="true" />}
          label="Study time"
          value={formatDuration(overall.totalTimeSeconds)}
        />
        <HeroMetric
          icon={<HiOutlineChartBar aria-hidden="true" />}
          label="Questions seen"
          value={formatNumber(overall.totalQuestions)}
        />
      </div>
    </header>
  );
}

function HeroMetric({ icon, label, value }) {
  return (
    <div className="ph-hero-metric">
      <span className="ph-hero-metric__icon">{icon}</span>
      <span className="ph-hero-metric__copy">
        <strong>{value}</strong>
        <span>{label}</span>
      </span>
    </div>
  );
}

function MomentumRail({ days }) {
  const peak = Math.max(1, ...days.map((day) => day.average));

  return (
    <section className="ph-momentum" aria-labelledby="ph-momentum-title">
      <div className="ph-momentum__heading">
        <div>
          <span className="ph-momentum__eyebrow">14-day pulse</span>
          <h2 id="ph-momentum-title">Momentum</h2>
        </div>
        <HiOutlineTrendingUp aria-hidden="true" />
      </div>
      <div
        className="ph-momentum__chart"
        role="list"
        aria-label="Average daily scores"
      >
        {days.map((day, index) => {
          const height = day.count > 0 ? Math.max(12, (day.average / peak) * 100) : 4;
          const showLabel = index === 0 || index === 6 || index === days.length - 1;
          return (
            <div
              className={`ph-momentum__day ${day.count === 0 ? "is-empty" : ""}`}
              key={day.key}
              role="listitem"
              aria-label={`${day.dateLabel}: ${formatNumber(day.count)} attempt${day.count === 1 ? "" : "s"}, ${formatPercentage(day.average)} average`}
              title={`${day.dateLabel}: ${day.count} attempt${day.count === 1 ? "" : "s"}, ${formatPercentage(day.average)} average`}
            >
              <span
                className="ph-momentum__bar"
                style={{ "--ph-bar-height": `${height}%` }}
                aria-hidden="true"
              />
              <span className="ph-momentum__day-label">
                {showLabel ? day.label : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FilterPanel({ filters, options, activeCount, onChange, onClear }) {
  return (
    <section className="ph-index-card" aria-labelledby="ph-filter-title">
      <div className="ph-index-card__header">
        <span className="ph-index-card__number">01</span>
        <div>
          <span className="ph-section-kicker">Find a record</span>
          <h2 id="ph-filter-title">Filter Index</h2>
        </div>
        {activeCount > 0 ? (
          <span className="ph-filter-count" aria-label={`${activeCount} active filters`}>
            {activeCount}
          </span>
        ) : null}
      </div>

      <div className="ph-filter-group">
        <span className="ph-filter-group__label">Source</span>
        <FilterSelect
          label="Practice mode"
          name="mode"
          value={filters.mode}
          onChange={onChange}
          options={MODE_OPTIONS}
        />
        <FilterSelect
          label="Subject"
          name="subject"
          value={filters.subject}
          onChange={onChange}
          options={withAllOption("All subjects", options.subjects)}
        />
        <FilterSelect
          label="Paper"
          name="paper"
          value={filters.paper}
          onChange={onChange}
          options={withAllOption("All papers", options.papers)}
        />
        <FilterSelect
          label="Chapter"
          name="chapter"
          value={filters.chapter}
          onChange={onChange}
          options={withAllOption("All chapters", options.chapters)}
        />
        <FilterSelect
          label="Topic"
          name="topic"
          value={filters.topic}
          onChange={onChange}
          options={withAllOption("All topics", options.topics)}
        />
      </div>

      <div className="ph-filter-group">
        <span className="ph-filter-group__label">Score range</span>
        <div className="ph-filter-split">
          <FilterInput
            label="Minimum"
            name="minPercentage"
            type="number"
            value={filters.minPercentage}
            onChange={onChange}
            suffix="%"
          />
          <FilterInput
            label="Maximum"
            name="maxPercentage"
            type="number"
            value={filters.maxPercentage}
            onChange={onChange}
            suffix="%"
          />
        </div>
      </div>

      <div className="ph-filter-group">
        <span className="ph-filter-group__label">Date range</span>
        <div className="ph-filter-split">
          <FilterInput
            label="From"
            name="from"
            type="date"
            value={filters.from}
            onChange={onChange}
          />
          <FilterInput
            label="To"
            name="to"
            type="date"
            value={filters.to}
            onChange={onChange}
          />
        </div>
      </div>

      <div className="ph-index-card__footer">
        <span>Updates instantly</span>
        <button
          type="button"
          className="ph-reset-button"
          onClick={onClear}
          disabled={activeCount === 0}
        >
          <HiOutlineFilter aria-hidden="true" />
          Reset Filters
        </button>
      </div>
    </section>
  );
}

function withAllOption(label, values) {
  return [
    { value: "", label },
    ...values.map((value) => ({ value, label: value }))
  ];
}

function FilterSelect({ label, name, value, onChange, options }) {
  return (
    <label className="ph-filter-field">
      <span>{label}</span>
      <select
        name={name}
        value={value}
        autoComplete="off"
        onChange={(event) => onChange(name, event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({ label, name, type, value, onChange, suffix }) {
  const numberProps =
    type === "number"
      ? { min: 0, max: 100, step: 1, inputMode: "decimal" }
      : {};

  return (
    <label className="ph-filter-field">
      <span>{label}</span>
      <span className="ph-filter-input-wrap">
        <input
          {...numberProps}
          name={name}
          type={type}
          value={value}
          autoComplete="off"
          onChange={(event) => onChange(name, event.target.value)}
        />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </span>
    </label>
  );
}

function SubjectSignals({ subjects }) {
  const focusSubjects = [...subjects]
    .sort((first, second) => (first.accuracy || 0) - (second.accuracy || 0))
    .slice(0, 4);

  return (
    <section className="ph-signal-card" aria-labelledby="ph-signal-title">
      <div className="ph-signal-card__heading">
        <span className="ph-index-card__number">02</span>
        <div>
          <span className="ph-section-kicker">Revision signal</span>
          <h2 id="ph-signal-title">Focus Next</h2>
        </div>
      </div>

      {focusSubjects.length > 0 ? (
        <div className="ph-signal-list">
          {focusSubjects.map((subject) => {
            const accuracy = percentageFromRatio(subject.accuracy);
            return (
              <div className="ph-signal" key={subject._id || "Uncategorised"}>
                <div className="ph-signal__copy">
                  <span>{subject._id || "Uncategorised"}</span>
                  <strong>{formatPercentage(accuracy)}</strong>
                </div>
                <div className="ph-signal__track" aria-hidden="true">
                  <span style={{ "--ph-signal-width": `${accuracy}%` }} />
                </div>
                <span className="ph-signal__attempts">
                  {formatNumber(subject.attempts)} attempt{subject.attempts === 1 ? "" : "s"}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="ph-signal-card__empty">
          Subject signals appear after your first completed practice.
        </p>
      )}
    </section>
  );
}

function AttemptFeed({ attempts, total, loading, activeFilterCount, onOpen }) {
  return (
    <section className="ph-ledger" aria-labelledby="ph-ledger-title">
      <div className="ph-ledger__header">
        <div className="ph-ledger__title-wrap">
          <span className="ph-index-card__number">03</span>
          <div>
            <span className="ph-section-kicker">Chronological review</span>
            <h2 id="ph-ledger-title">Attempt Ledger</h2>
          </div>
        </div>
        <div className="ph-ledger__count" aria-live="polite">
          {loading
            ? "Checking records…"
            : `${formatNumber(attempts.length)} of ${formatNumber(total)} records`}
        </div>
      </div>

      {loading ? (
        <AttemptFeedLoading />
      ) : attempts.length === 0 ? (
        <AttemptFeedEmpty hasFilters={activeFilterCount > 0} />
      ) : (
        <div className="ph-attempt-list">
          {attempts.map((attempt, index) => (
            <AttemptCard
              key={attempt._id}
              attempt={attempt}
              index={index + 1}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AttemptFeedLoading() {
  return (
    <div className="ph-loading-list" role="status">
      <span className="sr-only">Loading practice records</span>
      {[0, 1, 2].map((item) => (
        <div className="ph-loading-row" key={item} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function AttemptFeedEmpty({ hasFilters }) {
  return (
    <div className="ph-empty-state">
      <span className="ph-empty-state__icon">
        <HiOutlineSearch aria-hidden="true" />
      </span>
      <span className="ph-section-kicker">No matching entry</span>
      <h3>{hasFilters ? "Try a wider filter" : "Your ledger starts here"}</h3>
      <p>
        {hasFilters
          ? "No practice records match this combination. Reset a filter and check again."
          : "Complete a mock test or QBank practice and its review will appear here."}
      </p>
    </div>
  );
}

function AttemptCard({ attempt, index, onOpen }) {
  const percentage = Number(attempt.marks?.percentage) || 0;
  const band = scoreBand(percentage);
  const modeClass = MODE_CLASS_NAMES[attempt.mode] || "ph-mode--default";
  const created = formatDate(attempt.createdAt);
  const title = attempt.title || "Untitled attempt";
  const questionCount =
    attempt.config?.questionCount || attempt.questions?.length || 0;

  return (
    <article className={`ph-attempt ph-score--${band}`}>
      <button
        type="button"
        className="ph-attempt__button"
        onClick={() => onOpen(attempt._id)}
        aria-label={`Review ${title}, score ${formatPercentage(percentage, 1)}`}
      >
        <span className="ph-attempt__sequence" aria-hidden="true">
          {String(index).padStart(2, "0")}
        </span>

        <span className="ph-attempt__main">
          <span className={`ph-mode-label ${modeClass}`}>
            {MODE_LABELS[attempt.mode] || attempt.mode || "Practice"}
          </span>
          <strong className="ph-attempt__title">{title}</strong>
          <span className="ph-attempt__taxonomy">
            {attempt.subjects?.length > 0 ? (
              <span>
                <HiOutlineBookOpen aria-hidden="true" />
                {attempt.subjects.join(", ")}
              </span>
            ) : null}
            {attempt.papers?.length > 0 ? (
              <span>
                <HiOutlineDocumentText aria-hidden="true" />
                {attempt.papers.join(", ")}
              </span>
            ) : null}
            {attempt.chapters?.length > 0 ? (
              <span>
                <HiOutlineFolder aria-hidden="true" />
                {attempt.chapters.join(", ")}
              </span>
            ) : null}
          </span>
          <span className="ph-attempt__facts">
            <span>
              <HiOutlineClock aria-hidden="true" />
              {formatDuration(attempt.timing?.timeTakenSeconds)}
            </span>
            <span>
              <HiOutlineAcademicCap aria-hidden="true" />
              {questionCount} question{questionCount === 1 ? "" : "s"}
            </span>
          </span>
        </span>

        <span className="ph-attempt__date">
          <HiOutlineCalendar aria-hidden="true" />
          <span>{created.date}</span>
          <small>{created.time}</small>
        </span>

        <span className="ph-attempt__score">
          <strong>{formatPercentage(percentage, 1)}</strong>
          <span>
            {formatNumber(attempt.marks?.obtained)}/
            {formatNumber(attempt.marks?.total)} marks
          </span>
        </span>

        <span className="ph-attempt__open" aria-hidden="true">
          <HiOutlineChevronRight />
        </span>
      </button>
    </article>
  );
}

function DrawerShell({ title, onClose, children }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const drawerElement = closeButtonRef.current?.closest(".ph-drawer");
      const focusable = drawerElement?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const handleBackdropPointerDown = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="ph-drawer-backdrop" onMouseDown={handleBackdropPointerDown}>
      <aside
        className="ph-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ph-drawer-title"
      >
        <div className="ph-drawer__header">
          <div>
            <span className="ph-section-kicker">Attempt review</span>
            <h2 id="ph-drawer-title">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="ph-icon-button"
            onClick={onClose}
            aria-label="Close attempt review"
          >
            <HiOutlineX aria-hidden="true" />
          </button>
        </div>
        <div className="ph-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

function DrawerLoading() {
  return (
    <div className="ph-drawer-loading" role="status">
      <span className="ph-drawer-loading__mark" aria-hidden="true" />
      <strong>Opening the record</strong>
      <span>Collecting question-level feedback…</span>
    </div>
  );
}

function AttemptDetail({ attempt, onDelete }) {
  const percentage = Number(attempt?.marks?.percentage) || 0;
  const questions = attempt?.questions || [];

  return (
    <>
      <section className="ph-detail-summary" aria-label="Attempt summary">
        <DetailMetric
          label="Score"
          value={`${formatNumber(attempt?.marks?.obtained)}/${formatNumber(attempt?.marks?.total)}`}
          detail={formatPercentage(percentage, 1)}
        />
        <DetailMetric
          label="Time"
          value={formatDuration(attempt?.timing?.timeTakenSeconds)}
        />
        <DetailMetric
          label="Mode"
          value={MODE_LABELS[attempt?.mode] || attempt?.mode || "Practice"}
        />
      </section>

      <div className="ph-detail-outcomes">
        <Outcome
          kind="correct"
          icon={<HiOutlineCheckCircle aria-hidden="true" />}
          label="Correct"
          value={formatNumber(attempt?.marks?.correct)}
        />
        <Outcome
          kind="incorrect"
          icon={<HiOutlineXCircle aria-hidden="true" />}
          label="Incorrect"
          value={formatNumber(attempt?.marks?.incorrect)}
        />
        <Outcome
          kind="skipped"
          icon={<HiOutlineMinusCircle aria-hidden="true" />}
          label="Skipped"
          value={formatNumber(attempt?.marks?.skipped)}
        />
      </div>

      <div className="ph-detail-section-heading">
        <span className="ph-section-kicker">Question breakdown</span>
        <h3>{questions.length} review item{questions.length === 1 ? "" : "s"}</h3>
      </div>

      {questions.length > 0 ? (
        <div className="ph-question-list">
          {questions.map((question, index) => (
            <QuestionReview
              key={question._id || index}
              question={question}
              index={index}
            />
          ))}
        </div>
      ) : (
        <p className="ph-question-empty">No question details were saved for this attempt.</p>
      )}

      <footer className="ph-drawer__footer">
        <p>Deleting removes this record from your progress totals.</p>
        <button
          type="button"
          className="ph-delete-button"
          onClick={() => onDelete(attempt._id)}
        >
          <HiOutlineTrash aria-hidden="true" />
          Delete Record
        </button>
      </footer>
    </>
  );
}

function DetailMetric({ label, value, detail }) {
  return (
    <div className="ph-detail-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function Outcome({ kind, icon, label, value }) {
  return (
    <div className={`ph-outcome ph-outcome--${kind}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuestionReview({ question, index }) {
  const status = !question.isAttempted
    ? "skipped"
    : question.isCorrect
      ? "correct"
      : "incorrect";
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <article className={`ph-question ph-question--${status}`}>
      <header className="ph-question__header">
        <span className="ph-question__number">Q{String(index + 1).padStart(2, "0")}</span>
        <span className="ph-question__status">{statusLabel}</span>
        <span className="ph-question__score">
          {formatNumber(question.score)}
          <small> / {formatNumber(question.maxScore)}</small>
        </span>
      </header>

      <div className="ph-question__taxonomy">
        {[question.subject, question.paper, question.chapter, question.topic]
          .filter(Boolean)
          .map((item) => (
            <span key={item}>{item}</span>
          ))}
      </div>

      {question.snapshot?.questionText ? (
        <RichText
          className="ph-question__text"
          text={question.snapshot.questionText}
        />
      ) : null}

      {question.aiFeedback ? (
        <div className="ph-question__feedback">
          <span className="ph-question__feedback-label">AI feedback</span>
          <RichText text={question.aiFeedback} />
        </div>
      ) : null}
    </article>
  );
}

function RichText({ className = "", text }) {
  const html = useMemo(() => renderMarkdownWithMath(text), [text]);
  return (
    <div
      className={`ph-rich-text ${className}`}
      dangerouslySetInnerHTML={html}
    />
  );
}
