import { useState } from "react";
import {
  ArrowRight,
  MessageSquare,
  BookMarked,
  BookOpen,
  Gamepad2,
  Check,
  X,
  Globe,
  Play,
  CheckCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { PRICING } from "../config/pricing";
import { createCheckoutSession } from "../services/stripeService";
import { auth } from "../firebase";
import FeatureCard from "../components/FeatureCard";
import FaqItem from "../components/FaqItem";

const SUPPORTED_LANGUAGES = ['PT-PT', 'PT-BR', 'EN-US', 'EN-GB', 'ES-ES', 'ES-MX', 'FR-FR', 'DE-DE'];

const BG_COLORS = ['bg-yellow-400', 'bg-blue-400', 'bg-pink-400', 'bg-emerald-400'];

const FLOAT_ANIMS = ['float-1', 'float-2', 'float-3'];

const ROTATIONS = ['rotate-12', '-rotate-12', 'rotate-6', '-rotate-6'];

const LANG_POSITIONS = [
  { top: 'top-20', left: 'left-10', right: null, bottom: null },
  { top: 'top-48', left: null, right: 'right-24', bottom: null },
  { top: null, left: 'left-8', right: null, bottom: 'bottom-48' },
  { top: null, left: null, right: 'right-12', bottom: 'bottom-32' },
  { top: 'top-24', left: null, right: 'right-8', bottom: null },
  { top: null, left: 'left-16', right: null, bottom: 'bottom-20' },
  { top: 'top-64', left: 'left-40', right: null, bottom: null },
  { top: null, left: null, right: 'right-40', bottom: 'bottom-60' },
];

const HomePage = () => {
  const { isDarkMode, user, showAlert } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [redirectingPlan, setRedirectingPlan] = useState(null);

  // Voyager/Maestro teaser buttons: go straight to checkout if already
  // logged in, otherwise send the picked plan along to /login so it isn't
  // lost — LoginPage resumes checkout for it after a successful sign-in.
  const handleSelectPlan = async (plan) => {
    const firebaseUser = auth?.currentUser;
    if (!user || !firebaseUser) {
      navigate("/login", { state: { plan, interval: "monthly" } });
      return;
    }
    setRedirectingPlan(plan);
    try {
      const token = await firebaseUser.getIdToken();
      await createCheckoutSession(token, plan, "monthly");
    } catch (err) {
      showAlert("error", err.message || t("common.error"));
      setRedirectingPlan(null);
    }
  };

  const languagePills = t("home.language_pills", { returnObjects: true });
  const marqueeItems = t("home.marquee", { returnObjects: true });
  const whatItIs = t("home.what_it_is", { returnObjects: true });
  const whatItIsnt = t("home.what_it_isnt", { returnObjects: true });
  const faqs = t("home.faqs", { returnObjects: true });

  return (
    <>
      {/* MAIN CONTENT */}
      <main className="flex-grow flex flex-col items-center justify-center pt-16 pb-24 px-4 relative">
        {/* Floating Decorative Elements */}
        {SUPPORTED_LANGUAGES.slice(0, 8).map((lang, idx) => {
          const pos = LANG_POSITIONS[idx % LANG_POSITIONS.length];
          const bgColor = BG_COLORS[idx % BG_COLORS.length];
          const floatAnim = FLOAT_ANIMS[idx % FLOAT_ANIMS.length];
          const rotation = ROTATIONS[idx % ROTATIONS.length];
          return (
            <div
              key={lang}
              className={`absolute ${pos.top || ''} ${pos.left ? `left-10 md:left-${pos.left.replace('left-', '')}` : ''} ${pos.right ? `right-10 md:right-${pos.right.replace('right-', '')}` : ''} ${pos.bottom || ''} w-20 h-20 md:w-24 md:h-24 ${bgColor} rounded-full border-4 border-slate-900 neo-shadow-light ${floatAnim} hidden md:flex items-center justify-center opacity-80 z-0`}
            >
              <span className={`font-black text-2xl ${rotation} text-slate-900`}>
                {lang}
              </span>
            </div>
          );
        })}

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
          {/* Only shipped features are listed here. The previous strip
              advertised a voice tutor, a scheduler and human sessions, none of
              which exist yet — "more on the way" below covers those honestly. */}
          <FeatureCard
            isDarkMode={isDarkMode}
            icon={BookMarked}
            title={t("home.features.grammar")}
            description={t("home.features.grammar_desc")}
            delay="0s"
            color="bg-amber-400 text-slate-900"
          />
          <FeatureCard
            isDarkMode={isDarkMode}
            icon={MessageSquare}
            title={t("home.features.dictionary")}
            description={t("home.features.dictionary_desc")}
            delay="0.2s"
            color="bg-violet-400 text-slate-900"
          />
          <FeatureCard
            isDarkMode={isDarkMode}
            icon={BookOpen}
            title={t("home.features.stories")}
            description={t("home.features.stories_desc")}
            delay="0.4s"
            color="bg-sky-400 text-slate-900"
          />
          <FeatureCard
            isDarkMode={isDarkMode}
            icon={Gamepad2}
            title={t("home.features.games")}
            description={t("home.features.games_desc")}
            delay="0.6s"
            color="bg-emerald-400 text-slate-900"
          />
        </div>

        <p className="text-center mt-8 font-bold opacity-70">
          {t("home.features.more")}
        </p>
      </section>

      {/* What this is / what it isn't */}
      <section className="max-w-5xl mx-auto px-4 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className={`p-8 rounded-[2rem] border-4 ${
              isDarkMode
                ? "bg-slate-800 border-emerald-700 shadow-[8px_8px_0px_0px_#1e293b]"
                : "bg-emerald-50 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
            }`}
          >
            <h3 className={`text-2xl font-black uppercase tracking-tighter mb-4 ${
              isDarkMode ? "text-emerald-400" : "text-emerald-700"
            }`}>
              {t("home.what_it_is_heading")}
            </h3>
            <ul className="flex flex-col gap-3">
              {(Array.isArray(whatItIs) ? whatItIs : []).map((line, i) => (
                <li key={i} className="flex items-start gap-3 font-semibold">
                  <Check size={20} className={`shrink-0 mt-0.5 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`} />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`p-8 rounded-[2rem] border-4 ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 shadow-[8px_8px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
            }`}
          >
            <h3 className={`text-2xl font-black uppercase tracking-tighter mb-4 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
              {t("home.what_it_isnt_heading")}
            </h3>
            <ul className="flex flex-col gap-3">
              {(Array.isArray(whatItIsnt) ? whatItIsnt : []).map((line, i) => (
                <li key={i} className="flex items-start gap-3 font-semibold opacity-70">
                  <X size={20} className="shrink-0 mt-0.5" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Who made this — carries the credibility the hidden reviews used to */}
      <section className="max-w-3xl mx-auto px-4 py-16 relative z-10">
        <div
          className={`p-8 md:p-12 rounded-[2rem] border-4 text-center ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 shadow-[8px_8px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
          }`}
        >
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter mb-4">
            {t("home.who_made_this_heading")}
          </h2>
          <p className="text-lg font-semibold leading-relaxed opacity-90">
            {t("home.who_made_this_body")}
          </p>
        </div>
      </section>

      {/* The "Wall of Love" testimonials were removed from the locale files.
          They were quotes from named students about Nuno's own tutoring, and
          the locale files are now the source every other language is machine-
          translated from — which would have rewritten what real, identifiable
          people said, in every language. Social proof lives in "Who made this"
          above instead. src/components/RotatingReviews.jsx is kept but unused;
          restoring the section means supplying the quotes in their original
          language from outside the translation pipeline. */}

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
            <p className="text-3xl font-black text-blue-600 mb-1">${PRICING.voyager.monthly.amount}</p>
            <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              /{t("pricing.per_month")}
            </p>
            <button
              onClick={() => handleSelectPlan('voyager')}
              disabled={redirectingPlan === 'voyager'}
              className="w-full py-3 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none"
            >
              {redirectingPlan === 'voyager' ? t("pricing.redirecting") : t("pricing.get_started")}
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
            <p className="text-3xl font-black text-yellow-500 mb-1">${PRICING.maestro.monthly.amount}</p>
            <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              /{t("pricing.per_month")}
            </p>
            <button
              onClick={() => handleSelectPlan('maestro')}
              disabled={redirectingPlan === 'maestro'}
              className="w-full py-3 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none"
            >
              {redirectingPlan === 'maestro' ? t("pricing.redirecting") : t("pricing.get_started")}
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