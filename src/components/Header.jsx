import React from "react";
import { Sun, Moon } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { Link } from "react-router-dom";
import BarcelosRooster from "./BarcelosRooster";

const Header = () => {
  const { isDarkMode, setIsDarkMode } = useAppContext();

  return (
    <header
      className={`sticky top-4 z-50 mx-4 md:mx-8 rounded-2xl border-4 transition-all duration-300
      ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]" : "bg-white border-slate-900 neo-shadow-light"}`}
    >
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center space-x-3 group cursor-pointer"
        >
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-slate-900 shadow-[4px_4px_0px_0px_#facc15] group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <BarcelosRooster className="w-10 h-10" />
          </div>
          <span className="text-2xl font-black tracking-tight uppercase group-hover:text-blue-600 transition-colors">
            Multi Lingo AI
          </span>
        </Link>

        <div className="flex items-center space-x-3 md:space-x-6">
          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-3 rounded-full border-2 transition-transform hover:scale-110 active:scale-95
              ${isDarkMode ? "bg-slate-700 border-yellow-400" : "bg-yellow-400 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"}`}
          >
            {isDarkMode ? (
              <Sun size={20} className="text-yellow-400" />
            ) : (
              <Moon size={20} className="text-slate-900" />
            )}
          </button>

          {/* Login Button */}
          <Link
            to="/login"
            className={`hidden md:flex px-8 py-3 rounded-full font-black uppercase tracking-wider border-2 transition-all active:scale-95
            ${
              isDarkMode
                ? "bg-blue-600 border-slate-900 text-white hover-neo-dark"
                : "bg-blue-600 border-slate-900 text-white hover-neo-light"
            }`}
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
