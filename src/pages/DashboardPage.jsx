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
import PropTypes from "prop-types";

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
        <p className={`font-black uppercase tracking-tight text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>{title}</p>
        <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{date}</p>
      </div>
    </div>
    <span className={`px-3 py-1 rounded-full border-2 border-current font-black text-xs uppercase tracking-widest ${
      score >= 80 ? "text-emerald-500" : score >= 60 ? "text-yellow-500" : "text-rose-500"
    }`}>
      {score}%
    </span>
  </div>
);

const DashboardPage = () => {
  const { isDarkMode, user, logoutUser } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) navigate("/");
  };

  const stats = [
    { icon: BookOpen, label: "Languages", value: "3", color: "text-blue-500" },
    { icon: Zap, label: "Sessions", value: "24", color: "text-yellow-500" },
    { icon: Flame, label: "Day Streak", value: "7", color: "text-rose-500" },
    { icon: Star, label: "Words", value: "312", color: "text-emerald-500" },
  ];

  const activity = [
    { flag: "🇪🇸", title: "Spanish Conversation", date: "Today", score: 92 },
    { flag: "🇫🇷", title: "French Vocabulary", date: "Yesterday", score: 74 },
    { flag: "🇯🇵", title: "Japanese Basics", date: "2 days ago", score: 58 },
  ];

  const features = [
    { icon: Mic, title: "Voice Practice", description: "Speak and get instant AI feedback on your pronunciation." },
    { icon: MessageSquare, title: "AI Conversation", description: "Chat with an AI tutor in your target language." },
    { icon: Calendar, title: "Daily Challenges", description: "New exercises every day to keep your streak alive." },
    { icon: Users, title: "Community", description: "Practice with native speakers and fellow learners." },
  ];

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 space-y-10">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-4xl font-black uppercase tracking-tighter ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}>
            Hey, {user?.displayName?.split(" ")[0] || "Learner"} 👋
          </h1>
          <p className={`font-bold uppercase tracking-widest text-sm mt-1 ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}>Welcome back to your language hub</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/settings")}
            className={`p-3 rounded-xl border-4 transition-all hover:-translate-y-0.5 active:scale-95 ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
            }`}
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={handleLogout}
            className={`p-3 rounded-xl border-4 transition-all hover:-translate-y-0.5 active:scale-95 ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 text-rose-400 shadow-[4px_4px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 text-rose-500 shadow-[4px_4px_0px_0px_#0f172a]"
            }`}
            aria-label="Sign out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <section>
        <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>Your Progress</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} isDarkMode={isDarkMode} />
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>Recent Activity</h2>
        <div className="space-y-3">
          {activity.map((a) => (
            <ActivityRow key={a.title} {...a} isDarkMode={isDarkMode} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section>
        <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>What You Can Do</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} isDarkMode={isDarkMode} />
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>Quick Actions</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-lg transition-all active:scale-95 hover:-translate-y-1
              bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a]`}
          >
            <Zap size={22} /> Start Session
          </button>
          <button
            onClick={() => navigate("/settings")}
            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-lg transition-all active:scale-95 hover:-translate-y-1 ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 text-white shadow-[6px_6px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
            }`}
          >
            <ArrowRight size={22} /> Explore Languages
          </button>
        </div>
      </section>
    </main>
  );
};

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

ActivityRow.propTypes = {
  flag: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  date: PropTypes.string.isRequired,
  score: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default DashboardPage;