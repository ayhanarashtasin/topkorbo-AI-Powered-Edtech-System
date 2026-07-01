import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '../../hooks/useLanguage';
import './QuestionBank.css';

const SOURCES = [
  { 
    name: 'BUET', 
    count: '12,400+', 
    color: '#dc2626',
    icon: (
      <img 
        src="https://www.buet.ac.bd/web/assets/img/BImages/logoBIRN.png" 
        alt="BUET Logo" 
        style={{ width: '52px', height: '52px', objectFit: 'contain' }} 
      />
    )
  },
  { 
    name: 'DU', 
    count: '18,200+', 
    color: '#3b82f6',
    icon: (
      <img 
        src="https://www.freelogovectors.net/wp-content/uploads/2023/03/dhaka-university-logo-freelogovectors.net_.png" 
        alt="DU Logo" 
        style={{ width: '52px', height: '52px', objectFit: 'contain' }} 
      />
    )
  },
  { 
    name: 'Medical', 
    count: '22,800+', 
    color: '#22c55e',
    icon: (
      <img 
        src="https://mampower.net/assets/uploads/page/original/dmc.png" 
        alt="Medical Logo" 
        style={{ width: '52px', height: '52px', objectFit: 'contain' }} 
      />
    )
  },
  { 
    name: 'CUET', 
    count: '8,500+', 
    color: '#f59e0b',
    icon: (
      <img 
        src="https://cuet.ac.bd/assets/images/logo.png" 
        alt="CUET Logo" 
        style={{ width: '52px', height: '52px', objectFit: 'contain' }} 
      />
    )
  },
  { 
    name: 'RU', 
    count: '9,100+', 
    color: '#8b5cf6',
    icon: (
      <img 
        src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSN8MFxhDCSTud5gJ_nj5aGxwFXdX6A8HGyiw&s" 
        alt="RU Logo" 
        style={{ width: '52px', height: '52px', objectFit: 'contain' }} 
      />
    )
  },
  { 
    name: 'SUST', 
    count: '6,300+', 
    color: '#14b8a6',
    icon: (
      <img 
        src="https://www.sanirepo.com/uploads/users/images/untitled-design-2-1748236321.png" 
        alt="SUST Logo" 
        style={{ width: '52px', height: '52px', objectFit: 'contain' }} 
      />
    )
  },
  { 
    name: 'HSC Dhaka', 
    count: '15,000+', 
    color: '#ec4899',
    icon: (
      <img 
        src="https://www.dhakaeducationboard.gov.bd/site/assets/custom/img/logog.gif" 
        alt="HSC Dhaka Logo" 
        style={{ width: '52px', height: '52px', objectFit: 'contain' }} 
      />
    )
  },
  { 
    name: 'HSC Rajshahi', 
    count: '11,200+', 
    color: '#f97316',
    icon: (
      <img 
        src="https://upload.wikimedia.org/wikipedia/en/thumb/f/fa/Board_of_Intermediate_and_Secondary_Education-Rajshahi_Logo.jpg/330px-Board_of_Intermediate_and_Secondary_Education-Rajshahi_Logo.jpg" 
        alt="HSC Rajshahi Logo" 
        style={{ width: '52px', height: '52px', objectFit: 'contain' }} 
      />
    )
  },
];

export default function QuestionBank() {
  const { t } = useLanguage();
  const { ref, inView } = useInView({ threshold: 0.15, triggerOnce: true });

  return (
    <section className="qbank section" id="questionbank" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-title">{t('questionbank.title')}</h2>
          <p className="section-subtitle">{t('questionbank.subtitle')}</p>
        </motion.div>

        <motion.div
          className="qbank__filter-bar"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <span className="qbank__filter-chip qbank__filter-chip--active">Physics</span>
          <span className="qbank__filter-arrow">→</span>
          <span className="qbank__filter-chip qbank__filter-chip--active">Optics</span>
          <span className="qbank__filter-arrow">→</span>
          <span className="qbank__filter-chip qbank__filter-chip--active">Refraction</span>
        </motion.div>

        <div className="qbank__grid">
          {SOURCES.map((source, i) => (
            <motion.div
              className="qbank__source-card card"
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.5 }}
            >
              {source.icon ? (
                <div className="qbank__source-icon-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '54px', marginBottom: '12px' }}>
                  {source.icon}
                </div>
              ) : (
                <span className="qbank__source-emoji">{source.emoji}</span>
              )}
              <h4 className="qbank__source-name">{source.name}</h4>
              <span className="qbank__source-count" style={{ color: source.color }}>
                {source.count}
              </span>
              <span className="qbank__source-label">Questions</span>
            </motion.div>
          ))}
        </div>

        <div className="qbank__categories">
          {[t('questionbank.hsc'), t('questionbank.admission'), t('questionbank.college'), t('questionbank.custom')].map((cat, i) => (
            <span className="qbank__category-badge" key={i}>{cat}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
