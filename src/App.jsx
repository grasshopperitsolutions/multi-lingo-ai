import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
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
import AlertMessage from "./components/Alert";
import GlobalCompassCursor from "./components/GlobalCompassCursor";

const PublicLayout = () => (
  <>
    <Header />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/contact" element={<ContactPage />} />
    </Routes>
    <Footer />
  </>
);

const AppLayout = () => {
  const { isDarkMode, alert, closeAlert } = useAppContext();
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <>
      <style>{`
        * { cursor: none !important; }
      `}</style>
      <AlertMessage alert={alert} onClose={closeAlert} />

      <GlobalCompassCursor
        x={cursorPos.x}
        y={cursorPos.y}
        isDarkMode={isDarkMode}
      />

      <div
        className={`min-h-screen transition-colors duration-500 flex flex-col overflow-x-hidden
        ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-blue-50 text-slate-900"}`}
      >
        <Routes>
          {/* Public pages — with Header and Footer */}
          <Route path="/*" element={<PublicLayout />} />

          {/* App pages — no Header or Footer */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
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
