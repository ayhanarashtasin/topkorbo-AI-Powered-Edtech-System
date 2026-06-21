import { Component } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ForumProvider } from './context/ForumContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Contests from './pages/Contests';
import BecomeTeacher from './pages/BecomeTeacher';
import Setting from './pages/Setting';
import UploadQuestion from './pages/UploadQuestion';
import QuestionBank from './pages/QuestionBank';
import BoardQuestionsView from './pages/BoardQuestionsView';
import VarsityWrittenView from './pages/VarsityWrittenView';
import MockTest from './pages/MockTest';
import MockTestExam from './pages/MockTestExam';
import Battle from './pages/Battle';
import AIBattle from './pages/AIBattle';
import MakeContestQuestion from './pages/MakeContestQuestion';
import MakeContestQuestionNext from './pages/MakeContestQuestionNext';
import MakeContestQuestionNextTwo from './pages/MakeContestQuestionNextTwo';
import MakeContestQuestionChooseQBank from './pages/MakeContestQuestionChooseQBank';
import MakeContestQuestionConfirm from './pages/MakeContestQuestionConfirm';
import ReadingBooks from './pages/ReadingBooks';
import UploadBook from './pages/UploadBook';
import ReadingBookView from './pages/ReadingBookView';
import PracticeHistory from './pages/PracticeHistory';
import MentorLiveClass from './pages/MentorLiveClass';
import StudentLiveClass from './pages/StudentLiveClass';
import './pages/PracticeHistory.css';

// === Forum / Community ===
import ForumLayout from './components/forum/ForumLayout';
import Forum from './pages/Forum';
import ForumPostDetail from './pages/ForumPostDetail';
import ForumCompose from './pages/ForumCompose';
import ForumSearch from './pages/ForumSearch';
import ForumUserProfile from './pages/ForumUserProfile';
import ForumBookmarks from './pages/ForumBookmarks';

import './styles/index.css';
import './styles/animations.css';
import './styles/forum.css';

function AppContent() {
  return (
    <>
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
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <LandingPage />
              <Footer />
            </>
          }
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contests" element={<Contests />} />
        <Route path="/qbank" element={<QuestionBank />} />
        <Route path="/qbank/source-questions" element={<BoardQuestionsView />} />
        <Route path="/qbank/varsity-written" element={<VarsityWrittenView />} />
        <Route path="/setting" element={<Setting />} />
        <Route path="/settings" element={<Setting />} />
        <Route path="/teacher" element={<BecomeTeacher />} />
        <Route path="/upload-question" element={<UploadQuestion />} />
        <Route path="/mock-test" element={<MockTest />} />
        <Route path="/mock-test/exam" element={<MockTestExam />} />
        <Route path="/practice-history" element={<PracticeHistory />} />
        <Route path="/battle" element={<Battle />} />
        <Route path="/battle-ai" element={<AIBattle />} />
        <Route path="/make-contest-question" element={<MakeContestQuestion />} />
        <Route path="/make-contest-question/next" element={<MakeContestQuestionNext />} />
        <Route path="/make-contest-question/next-two" element={<MakeContestQuestionNextTwo />} />
        <Route path="/make-contest-question/choose-qbank" element={<MakeContestQuestionChooseQBank />} />
        <Route path="/make-contest-question/confirm" element={<MakeContestQuestionConfirm />} />
        <Route path="/reading-books" element={<ReadingBooks />} />
        <Route path="/reading-books/upload" element={<UploadBook />} />
        <Route path="/reading-books/:bookId/:chapterId" element={<ReadingBookView />} />
        <Route path="/mentor/live-class" element={<MentorLiveClass />} />
        <Route path="/student/live-class" element={<StudentLiveClass />} />

        {/* === Forum / Community === */}
        <Route element={<ForumProvider><ForumLayout /></ForumProvider>}>
          <Route path="/forum" element={<Forum />} />
          <Route path="/forum/compose" element={<ForumCompose />} />
          <Route path="/forum/post/:id" element={<ForumPostDetail />} />
          <Route path="/forum/search" element={<ForumSearch />} />
          <Route path="/forum/bookmarks" element={<ForumBookmarks />} />
          <Route path="/forum/u/:id" element={<ForumUserProfile />} />
        </Route>

      </Routes>
    </>
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
 * Logs to console + window and renders a visible diagnostic box so the
 * actual exception message is visible without opening DevTools.
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
    // eslint-disable-next-line no-console
    console.error('[ForumErrorBoundary]', error, info);
    if (typeof window !== 'undefined') {
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
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default App;
