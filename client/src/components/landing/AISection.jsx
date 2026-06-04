import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLanguage } from '../../hooks/useLanguage';
import { HiOutlineSparkles, HiOutlineDocumentText, HiOutlineAdjustments, HiOutlineLightningBolt } from 'react-icons/hi';
import './AISection.css';

const CHAT_MESSAGES = [
  { role: 'user', key: 'আমাকে SN1 vs SN2 reaction এর পার্থক্য বুঝিয়ে দাও' },
  { role: 'ai', key: 'চলো ভাবি! প্রথমে বলো — একটি nucleophile যখন carbon কে attack করে, তখন কি leaving group আগে চলে যায়, নাকি একই সাথে?' },
  { role: 'user', key: 'আমার মনে হয় দুইভাবেই হতে পারে...' },
  { role: 'ai', key: 'একদম ঠিক! 🎯 যখন leaving group আগে চলে যায় → carbocation তৈরি হয় → তখন SN1। আর যখন একই ধাপে nucleophile attack + leaving → SN2। এখন বলো, কোন ক্ষেত্রে tertiary carbon ভালো কাজ করবে?' },
];

export default function AISection() {
  const { t } = useLanguage();
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });
  const [visibleMessages, setVisibleMessages] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setVisibleMessages(prev => {
        if (prev >= CHAT_MESSAGES.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [inView]);

  const features = [
    { icon: <HiOutlineSparkles />, title: t('ai.tutor'), color: '#8B5CF6' },
    { icon: <HiOutlineDocumentText />, title: t('ai.evaluator'), color: '#3B82F6' },
    { icon: <HiOutlineAdjustments />, title: t('ai.adaptive'), color: '#10B981' },
    { icon: <HiOutlineLightningBolt />, title: t('ai.question_maker'), color: '#F59E0B' },
  ];

  return (
    <section className="ai-section section" id="ai" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-title">{t('ai.title')}</h2>
          <p className="section-subtitle">{t('ai.subtitle')}</p>
        </motion.div>

        <div className="ai-section__layout">
          <motion.div
            className="ai-section__chat"
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <div className="ai-section__chat-header">
              <div className="ai-section__chat-avatar">
                <svg viewBox="0 0 100 100" className="ai-section__chat-avatar-svg" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
                  {/* Outer head silhouette traces - Deeper Dark Blue Theme Accent */}
                  <path d="M30 18 L22 28 L22 42" stroke="var(--dark-blue)" strokeWidth="2.5" />
                  <circle cx="30" cy="18" r="3" fill="var(--dark-blue)" />
                  
                  <path d="M18 48 L15 54 L25 68 L32 78" stroke="var(--dark-blue)" strokeWidth="2.5" />
                  <circle cx="18" cy="48" r="3" fill="var(--dark-blue)" />
                  
                  <path d="M70 18 L78 28 L78 42" stroke="var(--dark-blue)" strokeWidth="2.5" />
                  <circle cx="70" cy="18" r="3" fill="var(--dark-blue)" />
                  
                  <path d="M82 48 L85 54 L75 68 L68 78" stroke="var(--dark-blue)" strokeWidth="2.5" />
                  <circle cx="82" cy="48" r="3" fill="var(--dark-blue)" />
                  
                  <path d="M42 15 A12 12 0 0 1 58 15" stroke="var(--dark-blue)" strokeWidth="2" />
                  <circle cx="42" cy="15" r="2.5" fill="var(--dark-blue)" />
                  <circle cx="58" cy="15" r="2.5" fill="var(--dark-blue)" />
                  
                  {/* Inner circuits - Deepest Text Primary Color */}
                  <path d="M32 30 L42 30 L42 22" stroke="var(--text-primary)" strokeWidth="2" />
                  <path d="M50 22 L50 32" stroke="var(--text-primary)" strokeWidth="2" />
                  <circle cx="50" cy="22" r="2" fill="var(--text-primary)" />
                  <path d="M58 22 L58 32 L68 32" stroke="var(--text-primary)" strokeWidth="2" />
                  
                  {/* Eyes - Deepest Text Primary Color */}
                  <circle cx="35" cy="45" r="4" stroke="var(--text-primary)" strokeWidth="2.5" />
                  <path d="M25 45 L31 45" stroke="var(--text-primary)" strokeWidth="2" />
                  <circle cx="25" cy="45" r="2" fill="var(--text-primary)" />
                  
                  <circle cx="65" cy="45" r="4" stroke="var(--text-primary)" strokeWidth="2.5" />
                  <path d="M75 45 L69 45" stroke="var(--text-primary)" strokeWidth="2" />
                  <circle cx="75" cy="45" r="2" fill="var(--text-primary)" />
                  
                  {/* Nose - Deeper Dark Blue */}
                  <path d="M50 38 L50 56 L55 56" stroke="var(--dark-blue)" strokeWidth="2.5" />
                  <circle cx="55" cy="56" r="2" fill="var(--dark-blue)" />
                  
                  {/* Cheek lines - Deeper Dark Blue */}
                  <path d="M32 56 L24 56" stroke="var(--dark-blue)" strokeWidth="2" />
                  <circle cx="24" cy="56" r="2" fill="var(--dark-blue)" />
                  
                  <path d="M68 56 L76 56" stroke="var(--dark-blue)" strokeWidth="2" />
                  <circle cx="76" cy="56" r="2" fill="var(--dark-blue)" />
                  
                  {/* Mouth & chin - Deepest Text Primary Color */}
                  <path d="M42 66 L58 66" stroke="var(--text-primary)" strokeWidth="2.5" />
                  <path d="M46 72 L54 72" stroke="var(--text-primary)" strokeWidth="2" />
                  <circle cx="46" cy="72" r="1.5" fill="var(--text-primary)" />
                  <circle cx="54" cy="72" r="1.5" fill="var(--text-primary)" />
                  
                  <path d="M38 82 L50 82 L62 82" stroke="var(--text-primary)" strokeWidth="2.5" />
                  <circle cx="50" cy="82" r="2.5" fill="var(--text-primary)" />
                </svg>
              </div>
              <div>
                <span className="ai-section__chat-name">TopKorbo AI Tutor</span>
                <span className="ai-section__chat-status">Online</span>
              </div>
            </div>
            <div className="ai-section__chat-body">
              {CHAT_MESSAGES.slice(0, visibleMessages).map((msg, i) => (
                <motion.div
                  key={i}
                  className={`ai-section__message ai-section__message--${msg.role}`}
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  {msg.key}
                </motion.div>
              ))}
              {visibleMessages < CHAT_MESSAGES.length && visibleMessages > 0 && (
                <div className="ai-section__typing">
                  <span className="ai-section__typing-dot"></span>
                  <span className="ai-section__typing-dot"></span>
                  <span className="ai-section__typing-dot"></span>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            className="ai-section__features"
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.5, duration: 0.7 }}
          >
            {features.map((f, i) => (
              <div className="ai-section__feature-badge" key={i}>
                <span className="ai-section__feature-icon" style={{ color: f.color, background: f.color + '12' }}>
                  {f.icon}
                </span>
                <span className="ai-section__feature-label">{f.title}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
