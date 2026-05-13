import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import FeatureCard from "../components/FeatureCard";
import {
  Mic,
  MessageSquare,
  Calendar,
  Users,
  Settings,
  LogOut,
  Zap,
  BookOpen,
  Flame,
  Star,
  ArrowRight,
} from "lucide-react";

const StatCard = ({ icon: Icon, label, value, color, isDarkMode }) => (
  <div
    className={`p-6 rounded-2xl border-4 flex flex-col gap-3 transition-all hover:-translate-y-1
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}
  >
    <div className={`w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center ${color}`}>
      <Icon size={22} />
    </div>
    <div>
      <p className={`text-3xl font-black tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {value}
      </p>
      <p className={`text-xs font-black uppercase tracking-widest mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        {label}
      </p>
    </div>
  </div>
);

const ActivityRow = ({ flag, title, date, score, isDarkMode }) => (
  <div
    className={`flex items-center justify-between px-5 py-4 rounded-xl border-4 transition-all hover:-translate-y-0.5
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
    }`}
  >
    <div className="flex items-center gap-4">
      <span className="text-2xl">{flag}</span>
      <div>
        <p className={`font-black text-sm uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          {title}
        </p>
        <p className={`text-xs font-bold uppercase tracking-widest ${ isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {date}
        </p>
      </div>
    </div>
    <span
      className={`px-3 py-1 rounded-full border-2 text-xs font-black uppercase tracking-widest
      ${
        isDarkMode
          ? "bg-yellow-400 border-slate-900 text-slate-900"
          : "bg-yellow-400 border-slate-900 text-slate-900"
      }`}
    >
      {score}
    </span>
  </div>
);

const DashboardPage = () => {
  const { isDarkMode, user, logoutUser, showAlert } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) {
      navigate("/");
    }
  };

  const handleNotImplemented = () => {
    showAlert("error", "This feature isn't implemented yet");
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Learner";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <main className="flex-grow px-4 md:px-8 py-10 max-w-7xl mx-auto w-full">
      {/* Welcome Banner */}
      <div
        className={`p-8 md:p-10 rounded-[2rem] border-4 mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6
        ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 shadow-[8px_8px_0px_0px_#1e293b]"
            : "bg-yellow-400 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
        }`}
      >
        <div className="flex items-center gap-5">
          <div
            className={`w-16 h-16 rounded-2xl border-4 flex items-center justify-center text-2xl font-black
            ${
              isDarkMode
                ? "bg-yellow-400 border-slate-900 text-slate-900"
                : "bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
            }`}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt={displayName} className="w-full h-full rounded-xl object-cover" />
            ) : (
              avatarLetter
            )}
          </div>
          <div>
            <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-700"}`}>
              Welcome back
            </p>
            <h1 className={`text-3xl md:text-4xl font-black uppercase tracking-tighter ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}>
              {displayName}
            </h1>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/settings")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 hover:-translate-y-1
            ${
              isDarkMode
                ? "bg-slate-700 border-slate-600 text-white shadow-[3px_3px_0px_0px_#0f172a]"
                : "bg-white border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
            }`}
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 hover:-translate-y-1
            ${
              isDarkMode
                ? "bg-slate-700 border-slate-600 text-white hover:border-rose-500 shadow-[3px_3px_0px_0px_#0f172a]"
                : "bg-white border-slate-900 text-slate-900 hover:border-rose-500 shadow-[3px_3px_0px_0px_#0f172a]"
            }`}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
        <StatCard icon={Flame} label="Day Streak" value="0" color="bg-orange-400 text-slate-900" isDarkMode={isDarkMode} />
        <StatCard icon={BookOpen} label="Sessions" value="0" color="bg-blue-400 text-slate-900" isDarkMode={isDarkMode} />
        <StatCard icon={Star} label="Words Mastered" value="0" color="bg-pink-400 text-slate-900" isDarkMode={isDarkMode} />
        <StatCard icon={Zap} label="XP Points" value="0" color="bg-green-400 text-slate-900" isDarkMode={isDarkMode} />
      </div>

      {/* Two-column: Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Quick Actions */}
        <div
          className={`p-8 rounded-[2rem] border-4
          ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
          }`}
        >
          <h2 className={`text-xl font-black uppercase tracking-widest mb-6 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}>
            Quick Actions
          </h2>
          <div className="flex flex-col gap-4">
            <button
              onClick={handleNotImplemented}
              className="w-full px-6 py-4 bg-yellow-400 border-4 border-slate-900 text-slate-900 rounded-xl font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-between"
            >
              <span className="flex items-center gap-3"><Mic size={20} /> Start Voice Session</span>
              <ArrowRight size={18} />
            </button>
            <button
              onClick={handleNotImplemented}
              className={`w-full px-6 py-4 border-4 rounded-xl font-black uppercase tracking-widest hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-between
              ${
                isDarkMode
                  ? "bg-blue-600 border-slate-700 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <span className="flex items-center gap-3"><MessageSquare size={20} /> Chat with AI</span>
              <ArrowRight size={18} />
            </button>
            <button
              onClick={handleNotImplemented}
              className={`w-full px-6 py-4 border-4 rounded-xl font-black uppercase tracking-widest hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-between
              ${
                isDarkMode
                  ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <span className="flex items-center gap-3"><Users size={20} /> Book Tutor Session</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div
          className={`p-8 rounded-[2rem] border-4
          ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
          }`}
        >
          <h2 className={`text-xl font-black uppercase tracking-widest mb-6 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}>
            Recent Activity
          </h2>
          <div className="flex flex-col gap-3">
            <ActivityRow flag="🇵🇹" title="European Portuguese Basics" date="Today" score="+50 XP" isDarkMode={isDarkMode} />
            <ActivityRow flag="🗣️" title="Pronunciation Practice" date="Yesterday" score="+30 XP" isDarkMode={isDarkMode} />
            <ActivityRow flag="📖" title="Vocabulary Builder" date="2 days ago" score="+20 XP" isDarkMode={isDarkMode} />
          </div>
        </div>
      </div>

      {/* Feature Cards — Explore */}
      <div>
        <h2 className={`text-xl font-black uppercase tracking-widest mb-6 ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}>
          Explore Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard icon={Mic} title="AI Voice Tutor" delay="0s" color="bg-yellow-400 text-slate-900" />
          <FeatureCard icon={MessageSquare} title="Urban Dictionary" delay="0.1s" color="bg-blue-400 text-slate-900" />
          <FeatureCard icon={Calendar} title="Smart Scheduler" delay="0.2s" color="bg-pink-400 text-slate-900" />
          <FeatureCard icon={Users} title="Human Tutors" delay="0.3s" color="bg-green-400 text-slate-900" />
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;
