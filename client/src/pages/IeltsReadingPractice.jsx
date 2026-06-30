import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { HiBookOpen, HiArrowLeft, HiCheckCircle } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import './IeltsReadingPractice.css';

// Mock IELTS Reading Sets
const MOCK_READING_SETS = [
  {
    _id: 'reading_set_1',
    setName: 'Cambridge Practice: The Rise of Artificial Intelligence',
    creator: 'TopKorbo Expert',
    createdAt: new Date().toISOString(),
    passageTitle: 'The Rise of Artificial Intelligence in Modern Healthcare',
    passageText: `Artificial intelligence (AI) has rapidly transitioned from a science fiction concept to a transformative force in modern medicine. Today, machine learning algorithms and neural networks are being deployed across the globe to assist clinical decisions, optimize operational workflows, and customize patient care. One of the most promising applications of AI in medicine is medical imaging. Machine learning models, trained on millions of historical X-rays, MRIs, and CT scans, are now capable of identifying micro-anomalies—such as early-stage tumors or cardiovascular blockages—with a level of precision that rivals, and in some cases exceeds, seasoned radiologists.

    Furthermore, the predictive capability of AI is revolutionizing preventative care. By analyzing electronic health records (EHRs) and longitudinal patient history in real-time, predictive models can forecast the likelihood of critical events such as sepsis onset or acute kidney failures hours before symptoms manifest clinically. This gives healthcare providers a vital head-start to initiate life-saving interventions.

    However, the integration of AI into medicine is not without deep-seated challenges. Critics raise concerns regarding data privacy, as these models require access to vast amounts of sensitive patient data to refine their accuracy. Additionally, the 'black box' nature of deep learning networks—where the decision-making process is too complex for human programmers to fully trace—poses ethical questions about clinical accountability. If an algorithm makes a faulty recommendation, does the liability rest with the developer, the clinical institution, or the attending physician? Bridging the gap between technological capabilities and legal-ethical structures remains a crucial task.`,
    questions: [
      {
        id: 'q1',
        text: 'What is highlighted as a major benefit of AI in medical imaging?',
        options: [
          'It completely replaces the need for clinical institutions.',
          'It identifies micro-anomalies with high precision.',
          'It automatically cures early-stage tumors.',
          'It decreases patient records storage requirements.'
        ],
        correctIndex: 1,
        explanation: 'The passage explicitly mentions that machine learning models are capable of identifying micro-anomalies with a precision that rivals radiologists.'
      },
      {
        id: 'q2',
        text: 'How does AI contribute to preventative care according to the text?',
        options: [
          'By performing complicated cardiovascular surgeries.',
          'By predicting the onset of critical events like sepsis before symptoms appear.',
          'By making healthcare completely free of cost.',
          'By ensuring data privacy is never compromised.'
        ],
        correctIndex: 1,
        explanation: 'The text states that predictive models forecast critical events like sepsis hours before they manifest clinically, providing a vital head-start.'
      },
      {
        id: 'q3',
        text: 'What concern does the term "black box" refer to in the passage?',
        options: [
          'The physical enclosure of patient files.',
          'The inability to trace the complex decision-making steps of the algorithm.',
          'The high cost of maintaining server infrastructure.',
          'The dark user interface of clinical terminals.'
        ],
        correctIndex: 1,
        explanation: 'The term "black box" is described as the nature of deep learning networks where the decision-making process is too complex for humans to trace.'
      },
      {
        id: 'q4',
        text: 'According to the author, who is legally accountable for a faulty AI recommendation?',
        options: [
          'The developer of the machine learning model.',
          'The attending physician.',
          'It is currently an unresolved legal and ethical question.',
          'The clinical institution.'
        ],
        correctIndex: 2,
        explanation: 'The author notes that this poses questions about clinical accountability and poses the question of where liability rests, stating that bridging this gap is still a crucial task.'
      }
    ]
  },
  {
    _id: 'reading_set_2',
    setName: 'Admission Special: Evolution of Language',
    creator: 'Prof. S. Rahman',
    createdAt: new Date().toISOString(),
    passageTitle: 'The Evolution and Divergence of Human Language',
    passageText: `Language is arguably the most defining characteristic of the human species. While other animals communicate through signals, human language is unique in its infinite productivity and recursion—the ability to combine a finite set of words to form an infinite number of sentences. Linguists have long debated the origins of this complex system. Some argue that language arose suddenly due to a single genetic mutation, while others believe it evolved gradually through cognitive adaptations.

    As early human populations migrated out of Africa, their languages began to diverge. Isolation, geographical barriers, and contact with different environments played critical roles in language evolution. For instance, vocal systems of languages in heavily forested areas tend to rely on lower-frequency sounds which travel better through dense vegetation.

    Over millennia, languages group into families originating from a shared ancestral mother language. The Indo-European family, which includes English, Spanish, Hindi, and Bengali, is one of the most widely spoken language families. By tracing structural and vocabulary similarities, historical linguists can reconstruct extinct parent languages like Proto-Indo-European (PIE), offering windows into the cultures and beliefs of ancient human societies.`,
    questions: [
      {
        id: 'q1',
        text: 'What makes human language unique compared to animal communication?',
        options: [
          'It is purely written and does not rely on sounds.',
          'Its infinite productivity and recursion.',
          'It was created by a single genetic mutation.',
          'It does not change over time.'
        ],
        correctIndex: 1,
        explanation: 'The passage states that human language is unique in its infinite productivity and recursion.'
      },
      {
        id: 'q2',
        text: 'How does dense forest vegetation affect language sounds according to linguists?',
        options: [
          'It makes languages completely silent.',
          'It favors low-frequency sounds which travel better.',
          'It leads to the creation of Indo-European grammar.',
          'It stops languages from diverging.'
        ],
        correctIndex: 1,
        explanation: 'The passage notes that languages in forested areas tend to rely on lower-frequency sounds to travel better through dense vegetation.'
      },
      {
        id: 'q3',
        text: 'Which of the following languages is NOT mentioned as part of the Indo-European family?',
        options: [
          'Bengali',
          'Hindi',
          'Arabic',
          'English'
        ],
        correctIndex: 2,
        explanation: 'The Indo-European family is stated to include English, Spanish, Hindi, and Bengali. Arabic is not listed.'
      }
    ]
  }
];

export default function IeltsReadingPractice() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student',
  });

  const [selectedSet, setSelectedSet] = useState(null);
  const [answers, setAnswers] = useState({}); // { questionId: selectedOptionIndex }
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  // Auth Guard
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      navigate('/');
      return;
    }
  }, [navigate]);

  if (user.role !== 'student') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>IELTS Reading Practice is only available for students.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handleSelectSet = (set) => {
    setSelectedSet(set);
    setAnswers({});
    setIsSubmitted(false);
    setScore(0);
    toast.success(language === 'en' ? `Opened ${set.setName}` : `${set.setName} খোলা হয়েছে`);
  };

  const handleOptionSelect = (qId, optionIdx) => {
    if (isSubmitted) return;
    setAnswers(prev => ({
      ...prev,
      [qId]: optionIdx
    }));
  };

  const handleSubmitQuiz = () => {
    // Check if all questions are answered
    const unanswered = selectedSet.questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      toast.error(
        language === 'en' 
          ? `Please answer all questions. (${unanswered.length} remaining)`
          : `অনুগ্রহ করে সব প্রশ্নের উত্তর দিন। (বাকি রয়েছেঃ ${unanswered.length}টি)`
      );
      return;
    }

    // Calculate score
    let correctCount = 0;
    selectedSet.questions.forEach(q => {
      if (answers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    setScore(correctCount);
    setIsSubmitted(true);
    toast.success(
      language === 'en'
        ? `Quiz submitted! Your score: ${correctCount}/${selectedSet.questions.length}`
        : `কুইজ সাবমিট হয়েছে! আপনার স্কোরঃ ${correctCount}/${selectedSet.questions.length}`
    );
  };

  return (
    <div className="ielts-reading-practice-page">
      <Sidebar activeTab="ielts-prep" user={user} />

      <main className="ielts-reading-practice-content">
        {/* Header */}
        <header className="ielts-reading-practice-header">
          <button 
            onClick={() => navigate('/ielts-prep', { state: { step: 2 } })} 
            className="ielts-reading-practice-back-btn" 
            title={language === 'en' ? 'Go Back to Prep' : 'পিছনে যান'}
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="ielts-reading-practice-header-text">
            <h2>{language === 'en' ? 'IELTS Reading Practice Room' : 'আইইএলটিএস রিডিং প্র্যাকটিস রুম'}</h2>
            <p>
              {language === 'en'
                ? 'Enhance reading comprehension skills with passages and instant evaluations.'
                : 'প্যাসেজ ও ইনস্ট্যান্ট মূল্যায়নের সাহায্যে রিডিং দক্ষতা বৃদ্ধি করুন।'}
            </p>
          </div>
        </header>

        {/* Workspace */}
        <div className="ielts-reading-practice-workspace">
          <div className="ielts-reading-practice-container">
            
            {selectedSet ? (
              /* Split Layout Workspace: Passage on Left, Questions on Right */
              <div className="ielts-reading-practice-panel">
                <div className="ielts-reading-practice-panel-header">
                  <div>
                    <h3>{selectedSet.setName}</h3>
                  </div>
                  <button onClick={() => setSelectedSet(null)} className="ielts-reading-practice-close-btn">
                    {language === 'en' ? 'Back to Sets' : 'সব সেটে ফিরে যান'}
                  </button>
                </div>

                <div className="ielts-reading-split-workspace">
                  {/* Left Side: Passage Box */}
                  <div className="ielts-reading-passage-box">
                    <h4>{selectedSet.passageTitle}</h4>
                    {selectedSet.passageText.split('\n\n').map((para, index) => (
                      <p key={index} style={{ marginBottom: '1.25rem' }}>{para}</p>
                    ))}
                  </div>

                  {/* Right Side: Questions Box */}
                  <div className="ielts-reading-questions-box">
                    {isSubmitted && (
                      <div className="ielts-reading-score-panel">
                        {language === 'en' 
                          ? `Your Score: ${score} / ${selectedSet.questions.length}` 
                          : `আপনার স্কোরঃ ${score} / ${selectedSet.questions.length}`}
                      </div>
                    )}

                    {selectedSet.questions.map((q, idx) => (
                      <div key={q.id} className="ielts-reading-question-item">
                        <span className="ielts-reading-question-text">
                          {idx + 1}. {q.text}
                        </span>

                        <div className="ielts-reading-mcq-options">
                          {q.options.map((opt, optIdx) => {
                            const isChecked = answers[q.id] === optIdx;
                            const isCorrect = q.correctIndex === optIdx;
                            let labelClass = 'ielts-reading-mcq-label';
                            
                            if (isSubmitted) {
                              if (isCorrect) labelClass += ' correct';
                              else if (isChecked) labelClass += ' incorrect';
                            } else {
                              if (isChecked) labelClass += ' checked';
                            }

                            return (
                              <div 
                                key={optIdx} 
                                className={labelClass}
                                onClick={() => handleOptionSelect(q.id, optIdx)}
                              >
                                <input 
                                  type="radio" 
                                  name={q.id}
                                  checked={isChecked}
                                  disabled={isSubmitted}
                                  readOnly
                                  style={{ marginRight: '6px', cursor: 'pointer' }}
                                />
                                <span>{opt}</span>
                              </div>
                            );
                          })}
                        </div>

                        {isSubmitted && (
                          <div className="ielts-reading-explanation-box">
                            <strong>{language === 'en' ? 'Explanation: ' : 'ব্যাখ্যাঃ '}</strong>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}

                    {!isSubmitted ? (
                      <button onClick={handleSubmitQuiz} className="ielts-reading-submit-btn">
                        <HiCheckCircle size={18} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                        <span style={{ verticalAlign: 'middle' }}>{language === 'en' ? 'Submit Answers' : 'উত্তর সাবমিট করুন'}</span>
                      </button>
                    ) : (
                      <button onClick={() => setSelectedSet(null)} className="ielts-reading-submit-btn" style={{ background: '#64748b' }}>
                        <span>{language === 'en' ? 'Finish Practice' : 'অনুশীলন সম্পন্ন করুন'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Lists of sets available */
              <div className="ielts-practice-set-grid">
                {MOCK_READING_SETS.map((set) => (
                  <div key={set._id} className="ielts-practice-set-card">
                    <div className="ielts-practice-set-info">
                      <h3>{set.setName}</h3>
                      <div className="ielts-practice-set-meta">
                        <span>👤 {set.creator}</span>
                        <span>📑 {set.questions.length} MCQs</span>
                      </div>
                    </div>
                    <button onClick={() => handleSelectSet(set)} className="ielts-practice-set-btn">
                      <span>{language === 'en' ? 'Start Test' : 'টেস্ট শুরু করুন'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
