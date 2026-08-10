/**
 * Root application component for the TopKorbo client.
 *
 * Defines all client-side routes, wraps the app in the language provider and
 * router, and renders global chrome (Navbar, Footer, toast notifications).
 * Heavy page components are code-split via React.lazy so each route only
 * downloads its own bundle on first visit, keeping the initial payload small.
 * The forum routes are nested inside a shared ForumShell layout that provides
 * sidebar navigation and context for the community feature.
 */

import { Component, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import BackendStatusBanner from './components/system/BackendStatusBanner';
// The landing page is the LCP element for first-time visitors, so it stays in
// the entry bundle. Every other route is code-split with React.lazy so a given
// page only downloads its own JS/CSS (and heavy deps like react-pdf, katex,
// framer-motion, socket.io) when it is actually visited.
import LandingPage from './pages/LandingPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Contests = lazy(() => import('./pages/Contests'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const BecomeTeacher = lazy(() => import('./pages/BecomeTeacher'));
const Setting = lazy(() => import('./pages/Setting'));
const UploadQuestion = lazy(() => import('./pages/UploadQuestion'));
const QuestionBank = lazy(() => import('./pages/QuestionBank'));
const BoardQuestionsView = lazy(() => import('./pages/BoardQuestionsView'));
const VarsityWrittenView = lazy(() => import('./pages/VarsityWrittenView'));
const MockTest = lazy(() => import('./pages/MockTest'));
const MockTestExam = lazy(() => import('./pages/MockTestExam'));
const StudyRoutine = lazy(() => import('./pages/StudyRoutine'));
const Battle = lazy(() => import('./pages/Battle'));
const MakeContestQuestion = lazy(() => import('./pages/MakeContestQuestion'));
const MakeContestQuestionNext = lazy(() => import('./pages/MakeContestQuestionNext'));
const MakeContestQuestionNextTwo = lazy(() => import('./pages/MakeContestQuestionNextTwo'));
const MakeContestQuestionChooseQBank = lazy(() => import('./pages/MakeContestQuestionChooseQBank'));
const MakeContestQuestionConfirm = lazy(() => import('./pages/MakeContestQuestionConfirm'));
const Pricing = lazy(() => import('./pages/Pricing'));
const MentorPricing = lazy(() => import('./pages/MentorPricing'));
const PaymentStatus = lazy(() => import('./pages/PaymentStatus'));
const ReadingBooks = lazy(() => import('./pages/ReadingBooks'));
const UploadBook = lazy(() => import('./pages/UploadBook'));
const ReadingBookView = lazy(() => import('./pages/ReadingBookView'));
const PracticeHistory = lazy(() => import('./pages/PracticeHistory'));
const FindMentor = lazy(() => import('./pages/FindMentor'));
const MentorLiveClass = lazy(() => import('./pages/MentorLiveClass'));
const StudentLiveClass = lazy(() => import('./pages/StudentLiveClass'));
const IeltsPrep = lazy(() => import('./pages/IeltsPrep'));
const IeltsTeacher = lazy(() => import('./pages/IeltsTeacher'));
const IeltsListeningUpload = lazy(() => import('./pages/IeltsListeningUpload'));
const IeltsReadingUpload = lazy(() => import('./pages/IeltsReadingUpload'));
const IeltsWritingUpload = lazy(() => import('./pages/IeltsWritingUpload'));
const IeltsSpeakingUpload = lazy(() => import('./pages/IeltsSpeakingUpload'));
const IeltsListening = lazy(() => import('./pages/IeltsListening'));
const IeltsReading = lazy(() => import('./pages/IeltsReading'));
const IeltsWriting = lazy(() => import('./pages/IeltsWriting'));
const IeltsSpeaking = lazy(() => import('./pages/IeltsSpeaking'));
const IeltsListeningPractice = lazy(() => import('./pages/IeltsListeningPractice'));
const IeltsReadingPractice = lazy(() => import('./pages/IeltsReadingPractice'));
const IeltsWritingPractice = lazy(() => import('./pages/IeltsWritingPractice'));
const IeltsWritingDemo = lazy(() => import('./pages/IeltsWritingDemo'));
const IeltsSpeakingPractice = lazy(() => import('./pages/IeltsSpeakingPractice'));
const IeltsSpeakingDemo = lazy(() => import('./pages/IeltsSpeakingDemo'));

// === Forum / Community ===
const ForumShell = lazy(() => import('./components/forum/ForumShell'));
const Forum = lazy(() => import('./pages/Forum'));
const ForumPostDetail = lazy(() => import('./pages/ForumPostDetail'));
const ForumCompose = lazy(() => import('./pages/ForumCompose'));
const ForumSearch = lazy(() => import('./pages/ForumSearch'));
const ForumUserProfile = lazy(() => import('./pages/ForumUserProfile'));
const ForumBookmarks = lazy(() => import('./pages/ForumBookmarks'));
import { renderAdminRoutes } from './admin/routes/AdminRoutes';

import './styles/index.css';
import './styles/animations.css';
import './pages/Dashboard.css';
import './styles/forum.css';

function LandingShell({ initialAuthMode = null }) {
  return (
    <>
      <Navbar initialAuthMode={initialAuthMode} />
      <LandingPage />
      <Footer />
    </>
  );
}

function AppContent() {
  return (
    <>
      <BackendStatusBanner />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#333',
            color: '#fff',
            fontWeight: '500',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }
        }}
      />
      <PaywallListener />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={<LandingShell />}
          />
          <Route path="/signup" element={<LandingShell initialAuthMode="signup" />} />
          <Route path="/login" element={<LandingShell initialAuthMode="login" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contests" element={<Contests />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/qbank" element={<QuestionBank />} />
          <Route path="/qbank/source-questions" element={<BoardQuestionsView />} />
          <Route path="/qbank/varsity-written" element={<VarsityWrittenView />} />
          <Route path="/setting" element={<Setting />} />
          <Route path="/settings" element={<Setting />} />
          <Route path="/teacher" element={<BecomeTeacher />} />
          <Route path="/upload-question" element={<UploadQuestion />} />
          <Route path="/mock-test" element={<MockTest />} />
          <Route path="/mock-test/exam" element={<MockTestExam />} />
          <Route path="/study-routine" element={<StudyRoutine />} />
          <Route path="/practice-history" element={<PracticeHistory />} />
          <Route path="/student/find-mentor" element={<FindMentor />} />
          <Route path="/battle" element={<Battle />} />
          <Route path="/make-contest-question" element={<MakeContestQuestion />} />
          <Route path="/make-contest-question/next" element={<MakeContestQuestionNext />} />
          <Route path="/make-contest-question/next-two" element={<MakeContestQuestionNextTwo />} />
          <Route path="/make-contest-question/choose-qbank" element={<MakeContestQuestionChooseQBank />} />
          <Route path="/make-contest-question/confirm" element={<MakeContestQuestionConfirm />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/mentor-pricing" element={<MentorPricing />} />
          <Route path="/payment-status" element={<PaymentStatus />} />
          <Route path="/reading-books" element={<ReadingBooks />} />
          <Route path="/reading-books/upload" element={<UploadBook />} />
          <Route path="/reading-books/:bookId/:chapterId" element={<ReadingBookView />} />
          <Route path="/mentor/live-class" element={<MentorLiveClass />} />
          <Route path="/student/live-class" element={<StudentLiveClass />} />
          <Route path="/ielts-prep" element={<IeltsPrep />} />
          <Route path="/ielts-teacher" element={<IeltsTeacher />} />
          <Route path="/ielts-teacher/listening/upload" element={<IeltsListeningUpload />} />
          <Route path="/ielts-teacher/reading/upload" element={<IeltsReadingUpload />} />
          <Route path="/ielts-teacher/writing/upload" element={<IeltsWritingUpload />} />
          <Route path="/ielts-teacher/speaking/upload" element={<IeltsSpeakingUpload />} />
          <Route path="/ielts-prep/listening" element={<IeltsListening />} />
          <Route path="/ielts-prep/reading" element={<IeltsReading />} />
          <Route path="/ielts-prep/writing" element={<IeltsWriting />} />
          <Route path="/ielts-prep/speaking" element={<IeltsSpeaking />} />
          <Route path="/ielts-prep/listening/practice" element={<IeltsListeningPractice />} />
          <Route path="/ielts-prep/reading/practice" element={<IeltsReadingPractice />} />
          <Route path="/ielts-prep/writing/practice" element={<IeltsWritingPractice />} />
          <Route path="/ielts-prep/writing/demo" element={<IeltsWritingDemo />} />
          <Route path="/ielts-prep/speaking/practice" element={<IeltsSpeakingPractice />} />
          <Route path="/ielts-prep/speaking/demo" element={<IeltsSpeakingDemo />} />

          {renderAdminRoutes()}

          {/* Forum routes are nested under ForumShell, which provides the
              shared sidebar layout, forum context, and real-time socket
              connection for all community pages. */}
          <Route element={<ForumShell />}>
            <Route path="/forum" element={<Forum />} />
            <Route path="/forum/compose" element={<ForumCompose />} />
            <Route path="/forum/post/:id" element={<ForumPostDetail />} />
            <Route path="/forum/search" element={<ForumSearch />} />
            <Route path="/forum/bookmarks" element={<ForumBookmarks />} />
            <Route path="/forum/u/:id" element={<ForumUserProfile />} />
          </Route>

        </Routes>
      </Suspense>
    </>
  );
}

/**
 * PaywallListener — routes the user to /pricing when any API call reports a
 * plan limit / upgrade-required response (see utils/paywall.js, which toasts
 * and dispatches the `topkorbo:paywall` event).
 */
function PaywallListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const onPaywall = () => navigate('/pricing');
    window.addEventListener('topkorbo:paywall', onPaywall);
    return () => window.removeEventListener('topkorbo:paywall', onPaywall);
  }, [navigate]);
  return null;
}

/**
 * Lightweight fallback shown while a lazily-loaded route chunk downloads.
 * Intentionally minimal (no heavy deps) so it never delays the first paint.
 */
function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div className="route-fallback-spinner" />
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Router>
        <ForumErrorBoundary>
          <AppContent />
        </ForumErrorBoundary>
      </Router>
    </LanguageProvider>
  );
}

/**
 * ForumErrorBoundary — surfaces render errors instead of a blank white page.
 * Logs diagnostics for developers while keeping production error details
 * out of the rendered page.
 */
class ForumErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ForumErrorBoundary]', error, info);
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      window.__lastForumError = { message: String(error?.message || error), stack: error?.stack, info };
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            maxWidth: 720,
            margin: '40px auto',
            padding: 24,
            borderRadius: 12,
            background: '#fff4f4',
            border: '1px solid #f5b5b5',
            color: '#7a1f1f',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 8 }}>Something went wrong rendering this page</h2>
          <p style={{ marginTop: 0 }}>Open DevTools → Console for the full stack. Details below:</p>
          <pre
            data-testid="forum-error"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#fff',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #f5b5b5',
              fontSize: 13
            }}
          >
            Please refresh the page. If the problem continues, contact support.
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default App;
