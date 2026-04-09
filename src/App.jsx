import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ContactPage from "./pages/ContactPage";
import BarcelosRooster from "./components/BarcelosRooster";

const AppLayout = () => {
  const { isDarkMode } = useAppContext();
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
        .custom-cursor {
          position: fixed;
          width: 40px;
          height: 40px;
          pointer-events: none;
          z-index: 9999;
          transition: transform 0.1s ease-out;
          transform: translate(-50%, -50%);
        }
      `}</style>

      {/* Custom Barcelos Rooster Cursor */}
      <div
        className="custom-cursor"
        style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }}
      >
        <BarcelosRooster className="w-full h-full drop-shadow-lg" />
      </div>

      <div
        className={`min-h-screen transition-colors duration-500 flex flex-col overflow-x-hidden
        ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-blue-50 text-slate-900"}`}
      >
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
      <Footer />
      </div>
    </>
  );
};

const App = () => {
  return (
    <Router>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </Router>
  );
};

export default App;