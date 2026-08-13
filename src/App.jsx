import { useState, useEffect, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import { useTierAccess } from "./hooks/useTierAccess";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ContactPage from "./pages/ContactPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import OnboardingPage from "./pages/OnboardingPage";
import PricingPage from "./pages/PricingPage";
import SubscriptionResultPage from "./pages/SubscriptionResultPage";
import AppUnavailablePage from "./pages/AppUnavailablePage";
import AlertMessage from "./components/Alert";
import GlobalCompassCursor from "./components/GlobalCompassCursor";
import Loader from "./components/Loader";
import SEOMeta from "./components/SEOMeta";

// ── /dashboard/* pages — route-level code splitting ──────────────────────────
const DashboardLayout = lazy(() => import("./pages/dashboard/DashboardLayout"));
const DashboardHomePage = lazy(() => import("./pages/dashboard/DashboardHomePage"));
const TranslatorPage = lazy(() => import("./pages/dashboard/TranslatorPage"));
const DictionaryPage = lazy(() => import("./pages/dashboard/DictionaryPage"));

const ChallengesMenu = lazy(() => import("./components/ChallengesMenu"));
const HangmanPage = lazy(() => import("./pages/dashboard/games/HangmanPage"));
const ScrambledWordPage = lazy(() => import("./pages/dashboard/games/ScrambledWordPage"));
const WordSearchPage = lazy(() => import("./pages/dashboard/games/WordSearchPage"));
const WordLinkPage = lazy(() => import("./pages/dashboard/games/WordLinkPage"));
const WordLadderPage = lazy(() => import("./pages/dashboard/games/WordLadderPage"));
const WordQuizComingSoonPage = lazy(() => import("./pages/dashboard/games/WordQuizComingSoonPage"));
const CrosswordsComingSoonPage = lazy(() => import("./pages/dashboard/games/CrosswordsComingSoonPage"));

const ExamTrainingMenu = lazy(() => import("./components/ExamTrainingMenu"));
const ListeningExercisePage = lazy(() => import("./pages/dashboard/exercises/ListeningExercisePage"));
const ReadingExercisePage = lazy(() => import("./pages/dashboard/exercises/ReadingExercisePage"));
const WritingExercisePage = lazy(() => import("./pages/dashboard/exercises/WritingExercisePage"));
const FullExamExercisePage = lazy(() => import("./pages/dashboard/exercises/FullExamExercisePage"));

const GrammarMenu = lazy(() => import("./components/GrammarMenu"));
const GrammarStructuresPage = lazy(() => import("./pages/dashboard/grammar/GrammarStructuresPage"));
const GrammarTipsPage = lazy(() => import("./pages/dashboard/grammar/GrammarTipsPage"));
const GrammarAskPage = lazy(() => import("./pages/dashboard/grammar/GrammarAskPage"));
const GrammarPracticeComingSoonPage = lazy(() => import("./pages/dashboard/grammar/GrammarPracticeComingSoonPage"));

const AiTutorPage = lazy(() => import("./pages/dashboard/coming-soon/AiTutorPage"));
const RealPersonTutorPage = lazy(() => import("./pages/dashboard/coming-soon/RealPersonTutorPage"));
const VoicePracticePage = lazy(() => import("./pages/dashboard/coming-soon/VoicePracticePage"));
const StoryGeneratorPage = lazy(() => import("./pages/dashboard/StoryGeneratorPage"));
const HistoryCulturePage = lazy(() => import("./pages/dashboard/HistoryCulturePage"));
const ProfessionalToolsPage = lazy(() => import("./pages/dashboard/coming-soon/ProfessionalToolsPage"));
const FoodPage = lazy(() => import("./pages/dashboard/coming-soon/FoodPage"));
const RadioTvPage = lazy(() => import("./pages/dashboard/coming-soon/RadioTvPage"));

const PublicLayout = () => {
  const { interfaceLang } = useAppContext();

  return (
    <>
      {/* Sitewide default — overridden per-page by each page's own <SEOMeta> */}
      <SEOMeta
        title="Multi Lingo AI | Learn any language with AI"
        description="The first AI powered platform that teaches you European Portuguese from any language or dialect you speak. Available in English, Portuguese, Spanish, French, and German. AI-powered, human-supported."
        path="/"
        lang={interfaceLang}
      />
      <Header />
      <Routes>
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/subscription/success" element={<SubscriptionResultPage />} />
        <Route path="/*" element={<HomePage />} />
      </Routes>
      <Footer />
    </>
  );
};

// Guard component that redirects to onboarding if learningDialect is not set
const RequireOnboarding = ({ children }) => {
  const { user, isLoadingUser } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingUser && user && !user.learningDialect) {
      navigate("/onboarding", { replace: true });
    }
  }, [user, isLoadingUser, navigate]);

  return children;
};

RequireOnboarding.propTypes = {
  children: PropTypes.node.isRequired,
};

// Guard component that redirects to the dashboard if the user isn't an admin
const RequireAdmin = ({ children }) => {
  const { isAdmin } = useTierAccess();
  const { isLoadingUser } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingUser && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, isLoadingUser, navigate]);

  return isAdmin ? children : null;
};

RequireAdmin.propTypes = {
  children: PropTypes.node.isRequired,
};

const AppLayout = () => {
  const { isDarkMode, alert, closeAlert } = useAppContext();
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Detect touch/mobile devices — compass cursor is mouse-only
  const isTouchDevice =
    typeof window !== "undefined" &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

  useEffect(() => {
    if (isTouchDevice) return; // skip mouse tracking on mobile

    const handleMouseMove = (e) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isTouchDevice]);

  return (
    <>
      {!isTouchDevice && (
        <style>{`* { cursor: none !important; }`}</style>
      )}
      <AlertMessage alert={alert} onClose={closeAlert} />

      {!isTouchDevice && (
        <GlobalCompassCursor
          x={cursorPos.x}
          y={cursorPos.y}
          isDarkMode={isDarkMode}
        />
      )}

      <div
        className={`min-h-screen transition-colors duration-500 flex flex-col overflow-x-hidden
        ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-blue-50 text-slate-900"}`}
      >
        <Routes>
          {/* Public pages — with Header and Footer */}
          <Route path="/*" element={<PublicLayout />} />

          {/* App pages — no Header or Footer */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireOnboarding>
                <Suspense fallback={<Loader fullScreen isDarkMode={isDarkMode} />}>
                  <DashboardLayout />
                </Suspense>
              </RequireOnboarding>
            }
          >
            <Route index element={<DashboardHomePage />} />
            <Route path="translator" element={<TranslatorPage />} />
            <Route path="dictionary" element={<DictionaryPage />} />

            <Route path="challenges" element={<ChallengesMenu isDarkMode={isDarkMode} />} />
            <Route path="challenges/hangman" element={<HangmanPage />} />
            <Route path="challenges/scrambled-word" element={<ScrambledWordPage />} />
            <Route path="challenges/word-search" element={<WordSearchPage />} />
            <Route path="challenges/word-link" element={<WordLinkPage />} />
            <Route path="challenges/word-ladder" element={<WordLadderPage />} />
            <Route path="challenges/word-quiz" element={<WordQuizComingSoonPage />} />
            <Route path="challenges/crosswords" element={<CrosswordsComingSoonPage />} />

            <Route path="exam-training" element={<ExamTrainingMenu isDarkMode={isDarkMode} />} />
            <Route path="exam-training/listening" element={<ListeningExercisePage />} />
            <Route path="exam-training/reading" element={<ReadingExercisePage />} />
            <Route path="exam-training/writing" element={<WritingExercisePage />} />
            <Route path="exam-training/full-exam" element={<FullExamExercisePage />} />

            <Route path="grammar" element={<GrammarMenu isDarkMode={isDarkMode} />} />
            <Route path="grammar/structures" element={<GrammarStructuresPage />} />
            <Route path="grammar/tips" element={<GrammarTipsPage />} />
            <Route path="grammar/ask" element={<GrammarAskPage />} />
            <Route path="grammar/practice" element={<GrammarPracticeComingSoonPage />} />
            <Route path="ai-tutor" element={<AiTutorPage />} />
            <Route path="real-person-tutor" element={<RealPersonTutorPage />} />
            <Route path="voice-practice" element={<VoicePracticePage />} />
            <Route path="story-generator" element={<StoryGeneratorPage />} />
            <Route path="history-culture" element={<HistoryCulturePage />} />
            <Route path="professional-tools" element={<ProfessionalToolsPage />} />
            <Route path="food" element={<FoodPage />} />
            <Route path="radio-tv" element={<RadioTvPage />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route path="/settings" element={<RequireOnboarding><SettingsPage /></RequireOnboarding>} />
          <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/app-unavailable" element={<AppUnavailablePage />} />
        </Routes>
      </div>
    </>
  );
};

const App = () => {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
};

export default App;
