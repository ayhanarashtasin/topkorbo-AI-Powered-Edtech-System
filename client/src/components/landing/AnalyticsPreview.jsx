import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '../../hooks/useLanguage';
import './AnalyticsPreview.css';

export default function AnalyticsPreview() {
  const { t } = useLanguage();
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });

  const radarData = [
    { label: 'Physics', value: 85, angle: 0 },
    { label: 'Chemistry', value: 62, angle: 60 },
    { label: 'Math', value: 91, angle: 120 },
    { label: 'Biology', value: 45, angle: 180 },
    { label: 'English', value: 78, angle: 240 },
    { label: 'ICT', value: 70, angle: 300 },
  ];

  const ratingHistory = [1200, 1250, 1320, 1280, 1400, 1450, 1520, 1600, 1580, 1650, 1720, 1847];

  const getRadarPoint = (value, angle) => {
    const r = (value / 100) * 90;
    const a = (angle - 90) * (Math.PI / 180);
    return { x: 120 + r * Math.cos(a), y: 120 + r * Math.sin(a) };
  };

  const radarPoints = radarData.map(d => getRadarPoint(d.value, d.angle));
  const radarPath = radarPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const maxRating = Math.max(...ratingHistory);
  const minRating = Math.min(...ratingHistory);
  const range = maxRating - minRating || 1;
  const linePoints = ratingHistory.map((r, i) => ({
    x: 30 + (i / (ratingHistory.length - 1)) * 300,
    y: 120 - ((r - minRating) / range) * 100
  }));
  const linePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <section className="analytics section" id="analytics" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-title">{t('analytics.title')}</h2>
          <p className="section-subtitle">{t('analytics.subtitle')}</p>
        </motion.div>

        <motion.div
          className="analytics__dashboard"
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          {/* Browser chrome */}
          <div className="analytics__browser-bar">
            <span className="analytics__dot analytics__dot--red"></span>
            <span className="analytics__dot analytics__dot--yellow"></span>
            <span className="analytics__dot analytics__dot--green"></span>
            <span className="analytics__browser-url">topkorbo.com/dashboard/analytics</span>
          </div>

          <div className="analytics__content">
            {/* Radar Chart */}
            <div className="analytics__chart-card">
              <h4 className="analytics__chart-title">Topic Mastery</h4>
              <svg viewBox="0 0 240 240" className="analytics__radar">
                {/* Grid circles */}
                {[30, 60, 90].map(r => (
                  <circle key={r} cx="120" cy="120" r={r} fill="none" stroke="var(--ice-blue)" strokeWidth="1" opacity="0.5" />
                ))}
                {/* Axis lines */}
                {radarData.map((d, i) => {
                  const outer = getRadarPoint(100, d.angle);
                  return <line key={i} x1="120" y1="120" x2={outer.x} y2={outer.y} stroke="var(--ice-blue)" strokeWidth="1" opacity="0.3" />;
                })}
                {/* Data area */}
                <motion.path
                  d={radarPath}
                  fill="rgba(192, 133, 82, 0.25)"
                  stroke="var(--sky-blue)"
                  strokeWidth="2.5"
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.8, duration: 1 }}
                />
                {/* Data points */}
                {radarPoints.map((p, i) => (
                  <motion.circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="var(--sky-blue)"
                    initial={{ scale: 0 }}
                    animate={inView ? { scale: 1 } : {}}
                    transition={{ delay: 1 + i * 0.1 }}
                  />
                ))}
                {/* Labels */}
                {radarData.map((d, i) => {
                  const label = getRadarPoint(115, d.angle);
                  return (
                    <text key={i} x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="var(--text-secondary)" fontWeight="600">
                      {d.label}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Rating Graph */}
            <div className="analytics__chart-card">
              <h4 className="analytics__chart-title">Rating History</h4>
              <svg viewBox="0 0 360 150" className="analytics__line-chart">
                {/* Grid */}
                {[0, 1, 2, 3, 4].map(i => (
                  <line key={i} x1="30" y1={20 + i * 25} x2="330" y2={20 + i * 25} stroke="var(--ice-blue)" strokeWidth="1" opacity="0.3" />
                ))}
                {/* Area */}
                <motion.path
                  d={`${linePath} L ${linePoints[linePoints.length - 1].x} 120 L ${linePoints[0].x} 120 Z`}
                  fill="url(#areaGradient)"
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.8, duration: 1.5 }}
                />
                {/* Line */}
                <motion.path
                  d={linePath}
                  fill="none"
                  stroke="var(--sky-blue)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : {}}
                  transition={{ delay: 0.8, duration: 2, ease: 'easeOut' }}
                />
                {/* Points */}
                {linePoints.map((p, i) => (
                  <motion.circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill="white"
                    stroke="var(--sky-blue)"
                    strokeWidth="2"
                    initial={{ scale: 0 }}
                    animate={inView ? { scale: 1 } : {}}
                    transition={{ delay: 1.5 + i * 0.08 }}
                  />
                ))}
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sky-blue)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--sky-blue)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="analytics__rating-label">
                <span>Current: <strong>1847</strong></span>
                <span className="badge badge-success">Expert</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
