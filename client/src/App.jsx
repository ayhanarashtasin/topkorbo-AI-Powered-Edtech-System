import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import BecomeTeacher from './pages/BecomeTeacher';
import Setting from './pages/Setting';
import UploadQuestion from './pages/UploadQuestion';
import QuestionBank from './pages/QuestionBank';
import './styles/index.css';
import './styles/animations.css';

function AppContent() {
  return (
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
      <Route path="/setting" element={<Setting />} />
      <Route path="/settings" element={<Setting />} />
      <Route path="/teacher" element={<BecomeTeacher />} />
      <Route path="/upload-question" element={<UploadQuestion />} />
    </Routes>
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
