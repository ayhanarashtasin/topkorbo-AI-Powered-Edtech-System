import { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '../../hooks/useLanguage';
import { FiUsers, FiBookOpen, FiAward, FiStar } from 'react-icons/fi';
import './StatsCounter.css';

function AnimatedNumber({ target, duration = 2000, inView }) {
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return <span>{count.toLocaleString()}</span>;
}

export default function StatsCounter() {
  const { t } = useLanguage();
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });

  const stats = [
    { icon: <FiUsers />, value: 52480, label: t('stats.students'), suffix: '+' },
    { icon: <FiBookOpen />, value: 128750, label: t('stats.questions'), suffix: '+' },
    { icon: <FiAward />, value: 1240, label: t('stats.contests'), suffix: '+' },
    { icon: <FiStar />, value: 385, label: t('stats.mentors'), suffix: '+' },
  ];

  return (
    <section className="stats" ref={ref} id="stats">
      <div className="container">
        <div className="stats__grid">
          {stats.map((stat, i) => (
            <div className="stats__item" key={i}>
              <span className="stats__icon">{stat.icon}</span>
              <span className="stats__value">
                <AnimatedNumber target={stat.value} inView={inView} />
                {stat.suffix}
              </span>
              <span className="stats__label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
