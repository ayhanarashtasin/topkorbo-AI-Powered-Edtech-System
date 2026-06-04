import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '../../hooks/useLanguage';
import { HiOutlineLightningBolt, HiOutlineShieldCheck, HiOutlineSparkles, HiOutlineCollection, HiOutlineChartBar, HiOutlineUserGroup, HiOutlineFire, HiOutlineLockClosed, HiOutlineViewGrid, HiOutlinePencilAlt, HiOutlineCog, HiOutlineCreditCard, HiOutlineBell } from 'react-icons/hi';

import './FeaturesGrid.css';

export default function FeaturesGrid() {
  const { t } = useLanguage();
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });

  const features = [
    { key: 'arena', icon: <HiOutlineLightningBolt />, color: '#F59E0B', size: 'large' },
    { key: 'ai', icon: <HiOutlineSparkles />, color: '#8B5CF6', size: 'large' },
    { key: 'battle', icon: <HiOutlineFire />, color: '#F97316', size: 'large' },
    { key: 'student_dash', icon: <HiOutlineViewGrid />, color: '#14B8A6', size: 'large' },
    { key: 'mentor', icon: <HiOutlineUserGroup />, color: '#EC4899', size: 'large' },
    { key: 'questionbank', icon: <HiOutlineCollection />, color: '#10B981', size: 'small' },
    { key: 'analytics', icon: <HiOutlineChartBar />, color: '#3B82F6', size: 'small' },
  ];

  return (
    <section className="features section" id="features" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-title">{t('features.title')}</h2>
          <p className="section-subtitle">{t('features.subtitle')}</p>
        </motion.div>

        <div className="features__grid">
          {features.map((feature, i) => (
            <motion.div
              key={feature.key}
              className={`features__card card ${feature.size === 'large' ? 'features__card--large' : ''}`}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.05, duration: 0.5 }}
            >
              <div
                className="features__icon"
                style={{ background: `${feature.color}15`, color: feature.color }}
              >
                {feature.icon}
              </div>
              <h3 className="features__card-title">
                {t(`features.${feature.key}.title`)}
              </h3>
              <p className="features__card-desc">
                {t(`features.${feature.key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
