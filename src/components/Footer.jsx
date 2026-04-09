import React from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import BarcelosRooster from "./BarcelosRooster";

const Footer = () => {
  const { isDarkMode, t } = useAppContext();

  return (
    <footer
      className={`py-12 border-t-4 mt-auto
      ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-900"}`}
    >
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0 font-bold">
        <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border-2 border-slate-900">
                <BarcelosRooster className="w-8 h-8" />
            </div>
          <span className="text-xl uppercase tracking-tighter">
            {t.brand}
          </span>
        </div>
        <p className="opacity-70">{t.footer}</p>
        <div className="flex space-x-6">
          <Link
            to="/privacy"
            className="hover:text-blue-600 hover:-translate-y-1 transition-transform"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="hover:text-blue-600 hover:-translate-y-1 transition-transform"
          >
            Terms
          </Link>
          <Link
            to="/contact"
            className="hover:text-blue-600 hover:-translate-y-1 transition-transform"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;