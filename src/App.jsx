import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Routes, Route, useNavigate } from "react-router-dom";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ContactPage from "./pages/ContactPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import OnboardingPage from "./pages/OnboardingPage";
import PricingPage from "./pages/PricingPage";
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import SubscriptionCancelPage from "./pages/SubscriptionCancelPage";
import AlertMessage from "./components/Alert";
import GlobalCompassCursor from "./components/GlobalCompassCursor";
import app from "./firebase";
import { getDocument, createDocument } from "./services/firestoreService";
import enLocale from "./locales/en/translation.json";
import deLocale from "./locales/de/translation.json";
import esLocale from "./locales/es/translation.json";
import frLocale from "./locales/fr/translation.json";
import ptPtLocale from "./locales/pt-PT/translation.json";

const PublicLayout = () => (
  <>
    <Header />
    <Routes>
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
      <Route path="/subscription/cancel" element={<SubscriptionCancelPage />} />
      <Route path="/*" element={<HomePage />} />
    </Routes>
    <Footer />
  </>
);

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

  // TODO: DELETE THIS ASAP — seeds all locale data to Firestore on first load
  useEffect(() => {
    const run = async () => {
      if (!app) return;
      try {
        const entries = [
          ["en-US", enLocale],
          ["de-DE", deLocale],
          ["es-ES", esLocale],
          ["fr-FR", frLocale],
          ["pt-PT", ptPtLocale],
        ];
        for (const [code, data] of entries) {
          const existing = await getDocument("appConfig/config/locales", code);
          if (existing?.data) {
            console.log(`[firestore-init] locale "${code}" already exists`);
            continue;
          }
          await createDocument("appConfig/config/locales", data, code);
          console.log(`[firestore-init] locale "${code}" seeded`);
        }
      } catch (err) {
        console.warn("[firestore-init] skipped:", err.message);
      }
    };
    run();
  }, []);

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
          <Route path="/dashboard" element={<RequireOnboarding><DashboardPage /></RequireOnboarding>} />
          <Route path="/settings" element={<RequireOnboarding><SettingsPage /></RequireOnboarding>} />
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
