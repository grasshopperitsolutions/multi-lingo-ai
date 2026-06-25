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
import AlertMessage from "./components/Alert";
import GlobalCompassCursor from "./components/GlobalCompassCursor";

const PublicLayout = () => (
  <>
    <Header />
    <Routes>
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/contact" element={<ContactPage />} />
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
