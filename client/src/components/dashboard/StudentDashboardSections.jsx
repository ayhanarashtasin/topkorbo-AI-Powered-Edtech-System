import { memo, useMemo } from 'react';
import { getHeatLevel } from '../../utils/dashboardAnalytics';

const RATING_TIERS = [
  { name: 'Newbie', min: 0, color: '#9aa0a6' },
  { name: 'Pupil', min: 1200, color: '#1aa334' },
  { name: 'Specialist', min: 1400, color: '#03a89e' },
  { name: 'Expert', min: 1600, color: '#3b5bdb' },
  { name: 'Candidate Master', min: 1900, color: '#a11bbf' },
  { name: 'Master', min: 2100, color: '#ff8c00' },
  { name: 'International Master', min: 2300, color: '#ff8c00' },
  { name: 'Grandmaster', min: 2400, color: '#e8462c' }
];

const WEEKDAY_LABELS = [['Mon', 1], ['Wed', 3], ['Fri', 5]];
const HEAT_LEVELS = [0, 1, 2, 3, 4];

function getInitials(name) {
  return (name || 'Student')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'S';
}

function getRatingTier(rating) {
  let tier = RATING_TIERS[0];
  for (const candidate of RATING_TIERS) {
    if (rating >= candidate.min) tier = candidate;
  }
  return tier;
}

function normalizeRating(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export const StudentProfileSection = memo(function StudentProfileSection({
  user,
  practiceStats,
  ratingData,
  progressStats
}) {
  const overall = practiceStats?.overall || {};
  const currentRating = normalizeRating(ratingData.current);
  const maxRating = normalizeRating(ratingData.max, currentRating);
  const currentTier = getRatingTier(currentRating);
  const overallAccuracy = Math.round((overall.accuracy || 0) * 100);
  const solvedTotal = typeof overall.correctQuestions === 'number'
    ? overall.correctQuestions
    : progressStats.solvedAllTime;
  const attemptedTotal = overall.attemptedQuestions || 0;
  const sessionCount = overall.totalAttempts || 0;

  const metricCards = [
    {
      name: 'Rating',
      subtitle: currentTier.name,
      primaryLabel: 'Current',
      primaryValue: currentRating,
      secondaryLabel: 'Max',
      secondaryValue: maxRating,
      accent: currentTier.color
    },
    {
      name: 'Contest points',
      subtitle: (ratingData.contestsPlayed || 0) > 0 ? `${ratingData.contestsPlayed} contests` : 'No contests yet',
      primaryLabel: 'Points',
      primaryValue: ratingData.contestPoints || 0,
      secondaryLabel: 'Played',
      secondaryValue: ratingData.contestsPlayed || 0,
      accent: '#d9a441'
    },
    {
      name: 'Problems solved',
      subtitle: sessionCount ? `${overallAccuracy}% accuracy` : 'Start practicing',
      primaryLabel: 'Solved',
      primaryValue: solvedTotal,
      secondaryLabel: 'Attempted',
      secondaryValue: attemptedTotal,
      accent: '#4f8fba'
    }
  ];

  return (
    <section className="dashboard-panel student-profile-section">
      <div className="student-profile-card">
        <div className="student-profile-card__main">
          <div className="student-profile-avatar" aria-label={`${user.name} profile picture`}>
            {user.avatar ? <img src={user.avatar} alt={user.name} /> : <span>{getInitials(user.name)}</span>}
          </div>
          <div>
            <span className="student-profile-kicker">Student profile</span>
            <h3>{user.name}</h3>
            <p>{user.collegeName || 'College name not added yet'}</p>
            <div className="student-profile-meta">
              <span>{user.hscBatch ? `HSC ${user.hscBatch}` : 'HSC batch not set'}</span>
              <span>{user.email || 'Student account'}</span>
            </div>
          </div>
        </div>

        <div className="student-rating-cards">
          {metricCards.map((card) => (
            <article key={card.name} className="student-rating-card" style={{ '--rating-accent': card.accent }}>
              <div className="student-rating-card__top">
                <strong>{card.name}</strong>
                <span>{card.subtitle}</span>
              </div>
              <div className="student-rating-card__values">
                <div>
                  <span>{card.primaryLabel}</span>
                  <strong>{card.primaryValue}</strong>
                </div>
                <div>
                  <span>{card.secondaryLabel}</span>
                  <strong>{card.secondaryValue}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
});

export const ContestRatingSection = memo(function ContestRatingSection({ ratingData }) {
  const model = useMemo(() => {
    const ratingHistory = ratingData.history || [];
    const currentRating = normalizeRating(ratingData.current);
    const maxRating = normalizeRating(ratingData.max, currentRating);
    const currentTier = getRatingTier(currentRating);
    const plot = { left: 60, right: 984, top: 20, bottom: 314 };
    const ratingValues = ratingHistory.map((point) => point.newRating);
    const dataMin = ratingValues.length ? Math.min(...ratingValues) : 0;
    const dataMax = ratingValues.length ? Math.max(...ratingValues) : 400;
    const yMin = Math.max(0, Math.floor((dataMin - 90) / 100) * 100);
    let yMax = Math.ceil((dataMax + 90) / 100) * 100;
    if (yMax - yMin < 400) yMax = yMin + 400;
    const xOf = (index) => (ratingHistory.length <= 1
      ? (plot.left + plot.right) / 2
      : plot.left + (index / (ratingHistory.length - 1)) * (plot.right - plot.left));
    const yOf = (rating) => plot.bottom - ((rating - yMin) / (yMax - yMin)) * (plot.bottom - plot.top);
    const chartPoints = ratingHistory.map((item, index) => ({ ...item, x: xOf(index), y: yOf(item.newRating) }));
    const linePath = chartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(' ');
    const ratingBands = RATING_TIERS.map((tier, index) => {
      const next = RATING_TIERS[index + 1];
      const low = Math.max(tier.min, yMin);
      const high = Math.min(next ? next.min : yMax, yMax);
      if (high <= low) return null;
      return { color: tier.color, yTop: yOf(high), yBottom: yOf(low) };
    }).filter(Boolean);

    return {
      ratingHistory,
      hasRatingHistory: ratingHistory.length > 0,
      currentRating,
      maxRating,
      currentTier,
      lastDelta: ratingHistory.length ? ratingHistory.at(-1).delta : 0,
      plot,
      yOf,
      chartPoints,
      linePath,
      ratingBands,
      yTicks: RATING_TIERS.map((tier) => tier.min).filter((value) => value > yMin && value < yMax),
      labelEvery: Math.max(1, Math.ceil(ratingHistory.length / 6))
    };
  }, [ratingData]);

  const shortDate = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <section className="dashboard-panel student-rating-graph-section">
      <div className="dashboard-panel__header student-section-header">
        <div>
          <h3>Contest rating</h3>
          <p>Your rating changes only when you participate in a contest.</p>
        </div>
        <div className="student-graph-summary">
          <span className="cf-rank-pill" style={{ '--rank-color': model.currentTier.color }}>
            {model.currentTier.name} {model.currentRating}
          </span>
          <span className="dashboard-stat-pill">Max {model.maxRating}</span>
          {model.hasRatingHistory ? (
            <span className={`student-rating-change ${model.lastDelta >= 0 ? 'student-rating-change--up' : 'student-rating-change--down'}`}>
              {model.lastDelta >= 0 ? '+' : ''}{model.lastDelta}
            </span>
          ) : null}
        </div>
      </div>

      {model.hasRatingHistory ? (
        <>
          <div className="cf-rating-chart" role="img" aria-label="Student rating progression chart">
            <svg viewBox="0 0 1000 344">
              {model.ratingBands.map((band, index) => (
                <rect
                  key={`band-${index}`}
                  x={model.plot.left}
                  y={band.yTop}
                  width={model.plot.right - model.plot.left}
                  height={band.yBottom - band.yTop}
                  fill={band.color}
                  opacity="0.13"
                />
              ))}

              {model.yTicks.map((rating) => {
                const y = model.yOf(rating);
                return (
                  <g key={`tick-${rating}`}>
                    <line x1={model.plot.left} x2={model.plot.right} y1={y} y2={y} className="cf-chart-gridline" />
                    <text x={model.plot.left - 10} y={y + 4} textAnchor="end" className="cf-chart-axis-text">{rating}</text>
                  </g>
                );
              })}

              <line x1={model.plot.left} x2={model.plot.right} y1={model.plot.bottom} y2={model.plot.bottom} className="cf-chart-axis-line" />
              <path d={model.linePath} fill="none" className="cf-rating-line" vectorEffect="non-scaling-stroke" />

              {model.chartPoints.map((point, index) => {
                const tier = getRatingTier(point.newRating);
                const showLabel = index % model.labelEvery === 0 || index === model.chartPoints.length - 1;
                return (
                  <g key={`pt-${index}`} className="cf-rating-point">
                    <title>{`${point.contestName} · Rank ${point.rank}/${point.participants} · ${point.newRating} (${tier.name}) · ${shortDate(point.date)}`}</title>
                    <circle cx={point.x} cy={point.y} r="9" fill="transparent" />
                    <circle cx={point.x} cy={point.y} r="3.6" fill={tier.color} stroke="#ffffff" strokeWidth="1.4" />
                    {showLabel ? (
                      <text x={point.x} y="336" textAnchor="middle" className="cf-chart-axis-text cf-chart-date-text">
                        {shortDate(point.date)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="student-contest-trend-list">
            {model.ratingHistory.slice(-4).map((item, index) => {
              const tier = getRatingTier(item.newRating);
              return (
                <div key={`${item.date}-${index}`} className="student-contest-trend-item">
                  <div>
                    <strong>{item.contestName}</strong>
                    <span>{shortDate(item.date)} · Rank #{item.rank}/{item.participants} · <em style={{ color: tier.color, fontStyle: 'normal', fontWeight: 600 }}>{tier.name} {item.newRating}</em></span>
                  </div>
                  <span className={item.delta >= 0 ? 'trend-up' : 'trend-down'}>{item.delta >= 0 ? '+' : ''}{item.delta}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="dashboard-empty">
          You start at 0 as a Newbie. Register for a contest and participate — your rating graph appears here once the contest ends.
        </div>
      )}
    </section>
  );
});

export const DailyProgressSection = memo(function DailyProgressSection({ analytics }) {
  const { weeks, monthLabels, stats } = analytics;

  return (
    <section className="dashboard-panel student-progress-section">
      <div className="dashboard-panel__header student-section-header">
        <div>
          <h3>Daily problem-solving progress</h3>
          <p>Each square is one day. Tap or hover a square to see how many problems you solved that day.</p>
        </div>
        <span className="dashboard-stat-pill">Last 12 months</span>
      </div>

      <div className="student-progress-heatmap" aria-label="Daily solved problem calendar">
        <div className="student-heatmap-grid">
          {monthLabels.map((label, weekIndex) => label ? (
            <span
              key={`m-${weekIndex}`}
              className="student-heatmap-month"
              style={{ gridColumn: weekIndex + 2, gridRow: 1 }}
            >
              {label}
            </span>
          ) : null)}

          {WEEKDAY_LABELS.map(([label, dayIndex]) => (
            <span
              key={label}
              className="student-heatmap-weekday"
              style={{ gridColumn: 1, gridRow: dayIndex + 2 }}
            >
              {label}
            </span>
          ))}

          {weeks.map((column, weekIndex) => column.map((cell, dayIndex) => cell ? (
            <span
              key={cell.date}
              className={`student-heat-cell student-heat-cell--${getHeatLevel(cell.solved)}`}
              style={{ gridColumn: weekIndex + 2, gridRow: dayIndex + 2 }}
              title={`${cell.solved} problem${cell.solved === 1 ? '' : 's'} solved · ${cell.date}`}
              aria-label={`${cell.date}: ${cell.solved} problems solved`}
            />
          ) : null))}
        </div>
      </div>
      <p className="student-heatmap-mobile-hint">Swipe sideways to view all 12 months.</p>

      <div className="student-heatmap-legend" aria-hidden="true">
        <span>Less</span>
        {HEAT_LEVELS.map((level) => <i key={level} className={`student-heat-cell student-heat-cell--${level}`} />)}
        <span>More</span>
      </div>

      <div className="student-progress-stats student-progress-stats--solve">
        <div><strong>{stats.solvedAllTime}</strong><span>solved for all time</span></div>
        <div><strong>{stats.solvedLastYear}</strong><span>solved for the last year</span></div>
        <div><strong>{stats.solvedLastMonth}</strong><span>solved for the last month</span></div>
        <div><strong>{stats.maxStreakAllTime}</strong><span>max. in a row</span></div>
        <div><strong>{stats.maxStreakLastYear}</strong><span>in a row for the last year</span></div>
        <div><strong>{stats.maxStreakLastMonth}</strong><span>in a row for the last month</span></div>
      </div>
    </section>
  );
});
