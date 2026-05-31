import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '../../hooks/useLanguage';
import { HiOutlineStar, HiOutlineUserGroup, HiOutlineBadgeCheck } from 'react-icons/hi';
import './MentorSection.css';

const MENTORS = [
  { name: 'Dr. Ayesha Rahman', uni: 'BUET', dept: 'EEE', rank: '#3 Merit', rating: 4.9, students: 28, specialties: ['Physics', 'Math'], emoji: '👩‍🏫' },
  { name: 'Tanvir Hasan', uni: 'DU', dept: 'Chemistry', rank: '#7 Merit', rating: 4.8, students: 30, specialties: ['Chemistry', 'Biology'], emoji: '👨‍🔬' },
  { name: 'Sadia Islam', uni: 'DMC', dept: 'MBBS', rank: '#12 Merit', rating: 4.9, students: 25, specialties: ['Biology', 'Chemistry'], emoji: '👩‍⚕️' },
  { name: 'Rahim Uddin', uni: 'BUET', dept: 'CSE', rank: '#1 Merit', rating: 5.0, students: 30, specialties: ['Physics', 'ICT', 'Math'], emoji: '👨‍💻' },
  { name: 'Fatema Noor', uni: 'CUET', dept: 'CE', rank: '#5 Merit', rating: 4.7, students: 22, specialties: ['Math', 'Physics'], emoji: '👩‍🎓' },
];

export default function MentorSection() {
  const { t } = useLanguage();
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });

  return (
    <section className="mentors section" id="mentors" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-title">{t('mentor.title')}</h2>
          <p className="section-subtitle">{t('mentor.subtitle')}</p>
        </motion.div>

        <div className="mentors__scroll-container">
          <div className="mentors__track">
            {MENTORS.map((mentor, i) => (
              <motion.div
                className="mentors__card card"
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              >
                <div className="mentors__card-header">
                  <div className="mentors__avatar">{mentor.emoji}</div>
                  <span className="mentors__verified badge badge-blue">
                    <HiOutlineBadgeCheck /> {t('mentor.verified')}
                  </span>
                </div>

                <h4 className="mentors__name">{mentor.name}</h4>
                <p className="mentors__uni">
                  {mentor.uni} • {mentor.dept}
                </p>
                <p className="mentors__rank">{mentor.rank}</p>

                <div className="mentors__rating">
                  <HiOutlineStar className="mentors__star" />
                  <span>{mentor.rating}</span>
                  <span className="mentors__separator">•</span>
                  <HiOutlineUserGroup />
                  <span>{mentor.students} {t('mentor.students')}</span>
                </div>

                <div className="mentors__specialties">
                  {mentor.specialties.map((s, j) => (
                    <span className="mentors__specialty-tag" key={j}>{s}</span>
                  ))}
                </div>

                <button className={`btn ${mentor.students >= 30 ? 'btn-secondary' : 'btn-primary'} btn-sm mentors__btn`}>
                  {mentor.students >= 30 ? t('mentor.waitlist') : t('mentor.book')}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
