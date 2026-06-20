import HeroSection from '../components/landing/HeroSection';
import StatsCounter from '../components/landing/StatsCounter';
import FeaturesGrid from '../components/landing/FeaturesGrid';
import ArenaShowcase from '../components/landing/ArenaShowcase';
import AISection from '../components/landing/AISection';
import BattleArena from '../components/landing/BattleArena';
import MentorSection from '../components/landing/MentorSection';
import AnalyticsPreview from '../components/landing/AnalyticsPreview';
import QuestionBank from '../components/landing/QuestionBank';
import TestimonialsSection from '../components/landing/TestimonialsSection';

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <StatsCounter />
      <FeaturesGrid />
      <ArenaShowcase />
      <AISection />
      <BattleArena />
      <MentorSection />
      <AnalyticsPreview />
      <QuestionBank />
      <TestimonialsSection />
    </main>
  );
}
