import { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '../../hooks/useLanguage';
import { HiOutlineMail, HiOutlineUser, HiArrowRight, HiCheckCircle } from 'react-icons/hi';
import './CTASection.css';

export default function CTASection() {
  const { t } = useLanguage();
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email) return;
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      await fetch(`${apiUrl}/landing/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
    } catch (err) {
      // Proceed anyway for demo
    }
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <section className="cta section" id="cta" ref={ref}>
      <div className="cta__bg-shapes">
        <div className="cta__shape cta__shape--1"></div>
        <div className="cta__shape cta__shape--2"></div>
      </div>

      <div className="container">
        <motion.div
          className="cta__content"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <h2 className="cta__title">{t('cta.title')}</h2>
          <p className="cta__subtitle">{t('cta.subtitle')}</p>

          {submitted ? (
            <motion.div
              className="cta__success"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <HiCheckCircle className="cta__success-icon" />
              <p>{t('cta.success')}</p>
            </motion.div>
          ) : (
            <form className="cta__form" onSubmit={handleSubmit}>
              <div className="cta__input-group">
                <HiOutlineUser className="cta__input-icon" />
                <input
                  type="text"
                  placeholder={t('cta.placeholder_name')}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="cta__input"
                  id="waitlist-name"
                  required
                />
              </div>
              <div className="cta__input-group">
                <HiOutlineMail className="cta__input-icon" />
                <input
                  type="email"
                  placeholder={t('cta.placeholder_email')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="cta__input"
                  id="waitlist-email"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg cta__btn"
                disabled={loading}
                id="waitlist-submit"
              >
                {loading ? '...' : t('cta.button')}
                {!loading && <HiArrowRight />}
              </button>
            </form>
          )}

          <p className="cta__privacy">{t('cta.privacy')}</p>
        </motion.div>
      </div>
    </section>
  );
}
