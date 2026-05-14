import { ArrowRight, Mic, MessageSquare, Calendar, Users, Globe, Sparkles, Zap } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import FeatureCard from "../components/FeatureCard";

const HomePage = () => {
  const { isDarkMode } = useAppContext();

  return (
    <>
      {/* MAIN CONTENT */}
      <main className="flex-grow flex flex-col items-center justify-center pt-16 pb-24 px-4 relative">
        {/* Floating Decorative Elements */}
        <div className="absolute top-20 left-10 md:left-32 w-24 h-24 bg-yellow-400 rounded-full border-4 border-slate-900 neo-shadow-light float-1 hidden md:flex items-center justify-center opacity-80 z-0">
          <span className="font-black text-2xl rotate-12 text-slate-900">
            PT-PT
          </span>
        </div>
        <div className="absolute bottom-40 right-10 md:right-32 w-32 h-32 bg-blue-400 rounded-3xl border-4 border-slate-900 neo-shadow-light float-2 hidden md:flex items-center justify-center opacity-80 z-0 rotate-12">
          <Zap size={48} className="text-white" />
        </div>

        {/* Hero Section */}
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div
            className={`inline-flex items-center space-x-2 px-6 py-2 mb-8 font-bold border-2 rounded-full float-3
            ${isDarkMode ? "bg-slate-800 border-yellow-400 text-yellow-400" : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
          >
            <Sparkles
              size={18}
              className={isDarkMode ? "text-yellow-400" : "text-blue-600"}
            />
            <span>THE AI REVOLUTION IS HERE</span>
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 tracking-tighter leading-[0.9]">
            <span className="block">Ask AI</span>
            <span
              className={`block my-2 mx-auto w-fit px-4 border-4 -rotate-2 hover:rotate-2 transition-transform duration-300
              ${isDarkMode ? "bg-yellow-400 text-slate-900 border-slate-900" : "bg-blue-600 text-white border-slate-900 neo-shadow-light"}`}
            >
              Everything
            </span>
            <span className="block">about Portuguese</span>
          </h1>

          <p className="text-xl md:text-3xl font-semibold mb-12 max-w-3xl mx-auto leading-relaxed opacity-90">
            The first platform that teaches you European Portuguese from any language or dialect you speak. AI-powered, human-supported.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-6 sm:space-y-0 sm:space-x-6">
            <button
              className={`w-full sm:w-auto px-10 py-5 text-xl font-black rounded-full border-4 flex items-center justify-center transition-all active:scale-95 group
              ${
                isDarkMode
                  ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark"
                  : "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-light"
              }`}
            >
              Start Learning Now
              <ArrowRight className="ml-3 w-8 h-8 group-hover:translate-x-3 transition-transform" />
            </button>
          </div>
        </div>
      </main>

      {/* Marquee Divider */}
      <div
        className={`w-full py-4 border-y-4 border-slate-900 transform -rotate-2 scale-105 my-12
        ${isDarkMode ? "bg-blue-600 text-white" : "bg-blue-600 text-white"}`}
      >
        <div className="marquee-container">
          <div className="marquee-content font-black text-3xl uppercase tracking-widest flex space-x-12">
            <span>LEARN PORTUGUESE FAST</span>
            <span>•</span>
            <span>NO BORING GRAMMAR</span>
            <span>•</span>
            <span>AI POWERED</span>
            <span>•</span>
            <span>NATIVE SLANG</span>
            <span>•</span>
            <span>LEARN PORTUGUESE FAST</span>
            <span>•</span>
            <span>NO BORING GRAMMAR</span>
            <span>•</span>
            <span>AI POWERED</span>
            <span>•</span>
            <span>NATIVE SLANG</span>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={Mic}
            title="24/7 AI Voice Tutor"
            delay="0s"
            color="bg-yellow-400 text-slate-900"
          />
          <FeatureCard
            icon={MessageSquare}
            title="Urban Dictionary"
            delay="0.2s"
            color="bg-blue-400 text-slate-900"
          />
          <FeatureCard
            icon={Calendar}
            title="Smart Scheduler"
            delay="0.4s"
            color="bg-pink-400 text-slate-900"
          />
          <FeatureCard
            icon={Users}
            title="Human Tutor Sessions"
            delay="0.6s"
            color="bg-green-400 text-slate-900"
          />
        </div>
      </section>

      {/* Dynamic Language Demo */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div
          className={`p-10 md:p-16 rounded-[3rem] border-4 flex flex-col items-center text-center float-2
          ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[12px_12px_0px_0px_#1e293b]" : "bg-yellow-100 border-slate-900 shadow-[12px_12px_0px_0px_#0f172a]"}`}
        >
          <Globe
            className="text-blue-600 mb-6 w-20 h-20 animate-spin-slow"
            style={{ animationDuration: "10s" }}
          />
          <h3 className="text-4xl md:text-5xl font-black mb-6 uppercase">
            The Universal Input
          </h3>
          <p className="text-xl md:text-2xl font-semibold mb-10 max-w-2xl opacity-80">
            Learning from Irish? Irish Gaelic? Mandarin? Just type it. Our AI
            bridges the gap.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              "Gaelic ➜ PT",
              "US English ➜ PT",
              "Thai ➜ PT",
              "Aussie Slang ➜ PT",
            ].map((item, i) => (
              <span
                key={i}
                className={`px-6 py-3 font-bold border-2 rounded-full text-lg wiggle-hover cursor-pointer
                ${isDarkMode ? "bg-slate-700 border-slate-500" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default HomePage;