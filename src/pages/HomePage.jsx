import {
  ArrowRight,
  Mic,
  MessageSquare,
  Calendar,
  Users,
  Globe,
  Zap,
  Play,
  Star,
  CheckCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import FeatureCard from "../components/FeatureCard";
import RotatingReviews from "../components/RotatingReviews";
import FaqItem from "../components/FaqItem";

const HomePage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const languagePills = t("home.language_pills", { returnObjects: true });
  const marqueeItems = t("home.marquee", { returnObjects: true });
  const reviews = t("home.reviews", { returnObjects: true });
  const faqs = t("home.faqs", { returnObjects: true });

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
        <div className="absolute top-40 right-10 md:right-48 w-16 h-16 bg-pink-400 rounded-full border-4 border-slate-900 neo-shadow-light float-3 hidden md:flex items-center justify-center opacity-80 z-0 -rotate-12">
          <Star size={24} className="text-white" />
        </div>

        {/* Hero Section */}
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div
            className={`inline-flex items-center space-x-2 px-6 py-2 mb-8 font-bold border-4 rounded-full float-3
            ${isDarkMode ? "bg-slate-800 border-slate-700 text-yellow-400 shadow-[4px_4px_0px_0px_#facc15]" : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
          >
            <span>{t("home.badge")}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black mb-8 tracking-tighter leading-[0.9] uppercase">
            <span className="block">{t("home.hero_line1")}</span>
            <span
              className={`block my-2 mx-auto w-fit px-4 sm:px-6 py-1 border-4 -rotate-2 hover:rotate-2 transition-transform duration-300
              ${isDarkMode ? "bg-yellow-400 text-slate-900 border-slate-900" : "bg-blue-600 text-white border-slate-900 neo-shadow-light"}`}
            >
              {t("home.hero_highlight")}
            </span>
            <span className="block">{t("home.hero_line2")}</span>
          </h1>

<p className="text-lg sm:text-xl md:text-2xl font-semibold mb-12 max-w-3xl mx-auto leading-relaxed opacity-90 italic">
  {t("home.subtitle")}
</p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-6 sm:space-y-0 sm:space-x-6">
            <button
              onClick={() => navigate('/login')}
              className={`w-full sm:w-auto px-10 py-5 text-2xl font-black rounded-full border-4 flex items-center justify-center transition-all active:scale-95 group uppercase tracking-tight
              ${
                isDarkMode
                  ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark"
                  : "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-light"
              }`}
            >
              {t("home.cta_start")}
              <ArrowRight className="ml-3 w-8 h-8 group-hover:translate-x-3 transition-transform" />
            </button>
              {/* keep this hidding for now */}
            <button
              className={`hidden w-full sm:w-auto px-10 py-5 text-xl font-black rounded-full border-4 flex items-center justify-center transition-all active:scale-95 group uppercase tracking-tight
              ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-white hover-neo-dark"
                  : "bg-white border-slate-900 text-slate-900 hover-neo-light"
              }`}
            >
              <Play className="mr-3 w-6 h-6 fill-current " /> {t("home.cta_watch_demo")}
            </button>
          </div>
        </div>
      </main>

      {/* Marquee Divider */}
      <div
        className={`w-full py-6 border-y-4 border-slate-900 transform -rotate-2 scale-105 my-12 shadow-2xl relative z-20
        ${isDarkMode ? "bg-blue-600 text-white" : "bg-blue-600 text-white"}`}
      >
        <div className="marquee-container mb-4">
          <div className="marquee-content font-black text-3xl md:text-4xl uppercase tracking-widest flex space-x-12">
            {Array.isArray(marqueeItems) &&
              marqueeItems.map((text, idx) => <span key={idx}>{text} • </span>)}
            {Array.isArray(marqueeItems) &&
              marqueeItems.map((text, idx) => (
                <span key={`repeat-${idx}`}>{text} • </span>
              ))}
          </div>
        </div>
        <div className="marquee-container">
          <div className="marquee-content-reverse font-black text-3xl md:text-4xl uppercase tracking-widest flex space-x-12 opacity-50">
            {Array.isArray(marqueeItems) &&
              marqueeItems.map((text, idx) => (
                <span key={`rev-${idx}`}>{text} • </span>
              ))}
            {Array.isArray(marqueeItems) &&
              marqueeItems.map((text, idx) => (
                <span key={`rev-repeat-${idx}`}>{text} • </span>
              ))}
          </div>
        </div>
      </div>

      {/* 3. HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 py-20 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter inline-block border-b-8 border-yellow-400 pb-2">
            {t("home.how_it_works_heading")}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
          {/* Step 1 */}
          <div
            className={`relative p-6 rounded-[2rem] border-4 rotate-2 hover:rotate-0 transition-transform duration-300
            ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-rose-100 border-slate-900"}`}
          >
            <div
              className={`absolute -top-5 -left-5 w-12 h-12 rounded-full border-4 flex items-center justify-center font-black text-2xl neo-shadow-light
              ${isDarkMode ? "bg-yellow-400 border-slate-900 text-slate-900" : "bg-white border-slate-900 text-slate-900"}`}
            >
              1
            </div>
            <h3 className="text-xl font-black uppercase mt-4 mb-4">
              {t("home.how_it_works_step1_title")}
            </h3>
            <p className="font-bold opacity-80 text-base">
              {t("home.how_it_works_step1_desc")}
            </p>
          </div>
          {/* Step 2 */}
          <div
            className={`relative p-6 rounded-[2rem] border-4 -rotate-2 hover:rotate-0 transition-transform duration-300 mt-6 md:mt-0
            ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-emerald-100 border-slate-900"}`}
          >
            <div
              className={`absolute -top-5 -left-5 w-12 h-12 rounded-full border-4 flex items-center justify-center font-black text-2xl neo-shadow-light
              ${isDarkMode ? "bg-blue-400 border-slate-900 text-slate-900" : "bg-white border-slate-900 text-slate-900"}`}
            >
              2
            </div>
            <h3 className="text-xl font-black uppercase mt-4 mb-4">
              {t("home.how_it_works_step2_title")}
            </h3>
            <p className="font-bold opacity-80 text-base">
              {t("home.how_it_works_step2_desc")}
            </p>
          </div>
          {/* Step 3 */}
          <div
            className={`relative p-6 rounded-[2rem] border-4 rotate-1 hover:rotate-0 transition-transform duration-300 mt-6 md:mt-0
            ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-blue-100 border-slate-900"}`}
          >
            <div
              className={`absolute -top-5 -left-5 w-12 h-12 rounded-full border-4 flex items-center justify-center font-black text-2xl neo-shadow-light
              ${isDarkMode ? "bg-pink-400 border-slate-900 text-slate-900" : "bg-white border-slate-900 text-slate-900"}`}
            >
              3
            </div>
            <h3 className="text-xl font-black uppercase mt-4 mb-4">
              {t("home.how_it_works_step3_title")}
            </h3>
            <p className="font-bold opacity-80 text-base">
              {t("home.how_it_works_step3_desc")}
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            isDarkMode={isDarkMode}
            icon={Mic}
            title={t("home.features.voice_tutor")}
            delay="0s"
            color="bg-yellow-400 text-slate-900"
          />
          <FeatureCard
            isDarkMode={isDarkMode}
            icon={MessageSquare}
            title={t("home.features.urban_dictionary")}
            delay="0.2s"
            color="bg-blue-400 text-slate-900"
          />
          <FeatureCard
            isDarkMode={isDarkMode}
            icon={Calendar}
            title={t("home.features.smart_scheduler")}
            delay="0.4s"
            color="bg-pink-400 text-slate-900"
          />
          <FeatureCard
            isDarkMode={isDarkMode}
            icon={Users}
            title={t("home.features.human_sessions")}
            delay="0.6s"
            color="bg-emerald-400 text-slate-900"
          />
        </div>
      </section>

      {/* Wall of Love - Reviews Section */}
      <section className="w-full px-4 py-20 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter inline-block border-b-8 border-pink-400 pb-2">
            {t("home.wall_of_love_heading")}
          </h2>
        </div>
        {Array.isArray(reviews) && reviews.length > 0 && (
          <RotatingReviews reviews={reviews} />
        )}
      </section>

      {/* Dynamic Language Demo */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div
          className={`p-8 md:p-16 rounded-[3rem] border-4 flex flex-col items-center text-center float-2
          ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[12px_12px_0px_0px_#1e293b]" : "bg-yellow-100 border-slate-900 shadow-[12px_12px_0px_0px_#0f172a]"}`}
        >
          <div className="w-20 h-20 bg-white rounded-full border-4 border-slate-900 flex items-center justify-center mb-6 neo-shadow-light">
            <Globe
              className="text-blue-600 w-10 h-10 animate-spin-slow"
              style={{ animationDuration: "10s" }}
            />
          </div>
          <h3 className="text-3xl md:text-4xl font-black mb-6 uppercase tracking-tighter">
            {t("home.universal_input.title")}
          </h3>
          <p className="text-lg md:text-xl font-semibold mb-10 max-w-2xl opacity-80">
            {t("home.universal_input.subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {Array.isArray(languagePills) &&
              languagePills.map((item, i) => (
                <span
                  key={i}
                  className={`px-4 py-2 font-bold border-4 rounded-full text-base wiggle-hover cursor-pointer transition-transform
                ${isDarkMode ? "bg-slate-700 border-slate-500 shadow-[4px_4px_0px_0px_#facc15]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
                >
                  {item}
                </span>
              ))}
          </div>
        </div>
      </section>
      {/* PRICING SECTION */}
      <section className="max-w-6xl mx-auto px-4 py-20 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter inline-block border-b-8 border-yellow-400 pb-2">
            {t("pricing.title")}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Explorer */}
          <div
            className={`p-6 rounded-[2rem] border-4 flex flex-col items-center text-center
            ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]" : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"}`}
          >
            <h3 className={`text-2xl font-black uppercase mb-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Explorer
            </h3>
            <p className="text-3xl font-black text-emerald-500 mb-1">$0.00</p>
            <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {t("pricing.free_forever")}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
            >
              {t("pricing.get_started")}
            </button>
          </div>

          {/* Voyager */}
          <div
            className={`p-6 rounded-[2rem] border-4 flex flex-col items-center text-center md:scale-105 z-10
            ${isDarkMode ? "bg-slate-800 border-yellow-400 shadow-[8px_8px_0px_0px_#ca8a04]" : "bg-white border-yellow-400 shadow-[8px_8px_0px_0px_#facc15]"}`}
          >
            <div className="bg-yellow-400 text-slate-900 px-4 py-1 rounded-full border-2 border-slate-900 font-black uppercase text-xs tracking-widest mb-3">
              {t("pricing.most_popular")}
            </div>
            <h3 className={`text-2xl font-black uppercase mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Voyager
            </h3>
            <p className="text-3xl font-black text-blue-600 mb-1">$4.99</p>
            <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              /{t("pricing.per_month")}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
            >
              {t("pricing.get_started")}
            </button>
          </div>

          {/* Maestro */}
          <div
            className={`p-6 rounded-[2rem] border-4 flex flex-col items-center text-center
            ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]" : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"}`}
          >
            <h3 className={`text-2xl font-black uppercase mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Maestro
            </h3>
            <p className="text-3xl font-black text-yellow-500 mb-1">$14.99</p>
            <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              /{t("pricing.per_month")}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
            >
              {t("pricing.get_started")}
            </button>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="max-w-4xl mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter inline-block border-b-8 border-blue-400 pb-2">
            {t("home.faq_heading")}
          </h2>
        </div>
        <div className="space-y-4">
          {Array.isArray(faqs) &&
            faqs.map((faq, idx) => (
              <FaqItem
                key={idx}
                question={faq.question}
                answer={faq.answer}
                isDarkMode={isDarkMode}
              />
            ))}
        </div>
      </section>

      {/* FINAL BIG CTA */}
      <section
        className={`w-full py-20 md:py-32 border-t-8 border-slate-900 text-center px-4 relative overflow-hidden
      ${isDarkMode ? "bg-slate-800 text-slate-100" : "bg-yellow-400 text-slate-900"}`}
      >
        {/* BG Accents */}
        <div
          className={`absolute bottom-10 right-10 opacity-20 -rotate-12 ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}
        >
          <CheckCircle size={120} />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter mb-6 leading-none">
            {t("home.final_cta_heading")}
          </h2>
          <p
            className={`text-lg sm:text-xl font-bold mb-12 max-w-2xl mx-auto opacity-90 ${isDarkMode ? "text-slate-100" : ""}`}
          >
            {t("home.final_cta_subtitle")}
          </p>
          <button
            onClick={() => navigate('/login')}
            className={`px-8 sm:px-12 py-5 sm:py-6 text-xl sm:text-2xl font-black rounded-full border-4 flex items-center justify-center transition-all active:scale-95 group uppercase tracking-tight mx-auto
          ${isDarkMode ? "bg-slate-700 border-slate-600 text-white hover:bg-slate-600 shadow-[8px_8px_0px_0px_#64748b]" : "bg-white border-slate-900 text-slate-900 shadow-[8px_8px_0px_0px_#0f172a] hover:bg-slate-900 hover:text-white hover:shadow-none hover:translate-y-2 hover:translate-x-2"}`}
          >
            {t("home.final_cta_button")}
            <ArrowRight className="ml-3 sm:ml-4 w-8 sm:w-10 h-8 sm:h-10 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </section>
    </>
  );
};

export default HomePage;