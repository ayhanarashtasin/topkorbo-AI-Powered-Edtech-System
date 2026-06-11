import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import BecomeTeacher from './pages/BecomeTeacher';
import Setting from './pages/Setting';
import UploadQuestion from './pages/UploadQuestion';
import QuestionBank from './pages/QuestionBank';
import BoardQuestionsView from './pages/BoardQuestionsView';
import VarsityWrittenView from './pages/VarsityWrittenView';
import MockTest from './pages/MockTest';
import MockTestExam from './pages/MockTestExam';
import MakeContestQuestion from './pages/MakeContestQuestion';
import MakeContestQuestionNext from './pages/MakeContestQuestionNext';
import MakeContestQuestionNextTwo from './pages/MakeContestQuestionNextTwo';
import MakeContestQuestionChooseQBank from './pages/MakeContestQuestionChooseQBank';
import MakeContestQuestionConfirm from './pages/MakeContestQuestionConfirm';
import ReadingBooks from './pages/ReadingBooks';
import UploadBook from './pages/UploadBook';
import ReadingBookView from './pages/ReadingBookView';
import './styles/index.css';
import './styles/animations.css';

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
        <Route path="/qbank" element={<QuestionBank />} />
        <Route path="/qbank/source-questions" element={<BoardQuestionsView />} />
        <Route path="/qbank/varsity-written" element={<VarsityWrittenView />} />
        <Route path="/setting" element={<Setting />} />
        <Route path="/settings" element={<Setting />} />
        <Route path="/teacher" element={<BecomeTeacher />} />
        <Route path="/upload-question" element={<UploadQuestion />} />
        <Route path="/mock-test" element={<MockTest />} />
        <Route path="/mock-test/exam" element={<MockTestExam />} />
        <Route path="/make-contest-question" element={<MakeContestQuestion />} />
        <Route path="/make-contest-question/next" element={<MakeContestQuestionNext />} />
        <Route path="/make-contest-question/next-two" element={<MakeContestQuestionNextTwo />} />
        <Route path="/make-contest-question/choose-qbank" element={<MakeContestQuestionChooseQBank />} />
        <Route path="/make-contest-question/confirm" element={<MakeContestQuestionConfirm />} />
        <Route path="/reading-books" element={<ReadingBooks />} />
        <Route path="/reading-books/upload" element={<UploadBook />} />
        <Route path="/reading-books/:bookId/:chapterId" element={<ReadingBookView />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Router>
        <AppContent />
      </Router>
    </LanguageProvider>
  );
}

export default App;
