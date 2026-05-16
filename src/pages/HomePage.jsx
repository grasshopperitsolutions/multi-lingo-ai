import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Mic, MessageSquare, Calendar, Users, Globe, Zap, Star, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import FeatureCard from "../components/FeatureCard";

// ── Real reviews pool (26 reviews, shortest/trivial ones excluded) ──
const ALL_REVIEWS = [
  { name: "Nadja", quote: "Nuno is an amazing tutor, he adapts the lessons to the students needs and is very helpful." },
  { name: "Claudia", quote: "Nuno is an exceptional teacher who is accelerating my Portuguese learning. His fun and effective method is boosting my confidence and skills." },
  { name: "Chloe", quote: "I LOVE learning with Nuno. He is smart, funny, and his classes are really interesting. I feel like I learn a lot and the 50 minutes fly by each time. Excited to get conversational in 2026!" },
  { name: "Fabian", quote: "Nuno is a great teacher, he's patient and happy to tailor each lesson to what we need. We've seen a huge amount of progress in a short amount of time — we love our lessons!" },
  { name: "Kelsey", quote: "Nuno's classes are easy to understand and he really caters toward your needs and ability level. Would definitely recommend!" },
  { name: "Jacob", quote: "Nuno is a great tutor; he really listens to his students and, through that, becomes a better tutor than lots of others I've seen on Preply." },
  { name: "Erek", quote: "Excellent for casual speak on day to day scenarios with verb structure and review. Nice guy and down to earth — easy to relate. He's pretty cool too." },
  { name: "Alasdair", quote: "Nuno is a great teacher. He's very patient and willing to adapt to the students needs. He has lots of knowledge and is capable of explaining things very clearly." },
  { name: "Nia", quote: "Nuno is a dedicated teacher who addresses individual needs and takes a practical approach." },
  { name: "Jade", quote: "I like the personalised approach Nuno takes in his classes. He goes at the tempo you need without adding too much pressure or taking away from his qualitative knowledge sharing." },
  { name: "Ludovica", quote: "Nuno is a great teacher. He is patient and really focused on your needs. I noticed progress after just a few lessons. I highly recommend him, even if you've never studied the language before." },
  { name: "Andrew", quote: "Working with Nuno has been great. I'm already making noticeable progress after just two lessons. Looking forward to the next one!" },
  { name: "Michael", quote: "I have been learning Portuguese with Nuno and it has been an excellent experience! He is patient, smart and takes the time to personalize the learning to my needs. I highly recommend him." },
  { name: "George", quote: "Nuno's approach to teaching is fantastic, engaging and interesting. He provides clear, helpful guidance in a relaxed and informal way, making the lessons a fun experience!" },
  { name: "Philipp", quote: "I started my Preply journey with Nuno and I am very happy with our classes. He asks about your goals and adjusts accordingly. Highly recommend!" },
  { name: "Charles", quote: "Making great progress on my Portuguese! Highly recommend Nuno for starting — he does a great job getting you comfortable with the basics and then helping you apply it conversationally." },
  { name: "Sh", quote: "Clear and nice lessons. He has patience and makes the lessons fun." },
  { name: "Laura", quote: "Nuno is very patient. He is able to explain words and meanings so that it makes sense." },
  { name: "Hlib", quote: "Nuno is an excellent Portuguese tutor. He explains everything clearly, making it easy to follow along. Highly recommend him, especially for those working in IT." },
  { name: "Jennifer", quote: "Very fun to talk to." },
  { name: "Yegane", quote: "Nuno is a fantastic teacher, and I highly recommend him. His kind demeanour quickly put me at ease with the Portuguese language. You can tell he is passionate about teaching." },
  { name: "Rosa", quote: "He has a lot of patience and is very encouraging!" },
  { name: "Angie", quote: "Nuno is an amazing tutor, both friendly and knowledgeable. His positive attitude and enthusiasm make each lesson a great experience." },
  { name: "Josep", quote: "Nuno is an exceptional Portuguese teacher. His classes are always dynamic and engaging. Thanks to his friendly personality and patience, each lesson is very pleasant." },
  { name: "Isobelle", quote: "Thank you very much Nuno, my classes are very fun and interesting." },
  { name: "Bas", quote: "Today I had my first class with Nuno, it was very pleasant. He has a lot of patience and gave me a very funny homework assignment. I am excited to attend the next class." },
];

// Fisher-Yates shuffle — runs once on component mount
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── Stars component ──
const Stars = () => (
  <div className="flex gap-1 mb-4" aria-label="5 star rating">
    {[...Array(5)].map((_, i) => (
      <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
    ))}
  </div>
);

// ── Testimonials section ──
const Testimonials = ({ isDarkMode }) => {
  const [reviews] = useState(() => shuffleArray(ALL_REVIEWS));
  const [startIndex, setStartIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const total = reviews.length;
  const CARDS = 3;
  const groupCount = Math.ceil(total / CARDS);
  const currentGroup = Math.floor(startIndex / CARDS);

  const getVisible = (idx) => {
    return Array.from({ length: CARDS }, (_, i) => reviews[(idx + i) % total]);
  };

  const rotate = useCallback((dir) => {
    setVisible(false);
    setTimeout(() => {
      setStartIndex((prev) => (prev + dir * CARDS + total) % total);
      setVisible(true);
    }, 280);
  }, [total]);

  // Auto-advance every 5 seconds — correct useEffect usage (external timer system)
  useEffect(() => {
    const timer = setInterval(() => rotate(1), 5000);
    return () => clearInterval(timer);
  }, [rotate]);

  const cards = getVisible(startIndex);

  const cardClass = `flex flex-col justify-between p-7 rounded-[2rem] border-4 min-h-[200px]
    ${ isDarkMode
      ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
      : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  return (
    <section className="max-w-7xl mx-auto px-4 py-20">
      <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter text-center mb-4
        ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
        What Learners Say
      </h2>
      <p className={`text-center font-semibold mb-12 opacity-70 ${ isDarkMode ? "text-slate-300" : "text-slate-700" }`}>
        Real reviews from real students.
      </p>

      {/* Cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {cards.map((review, i) => (
          <div key={`${review.name}-${i}`} className={cardClass}>
            <div>
              <Stars />
              <p className={`font-semibold leading-relaxed text-base line-clamp-4 italic
                ${ isDarkMode ? "text-slate-300" : "text-slate-700" }`}>
                &ldquo;{review.quote}&rdquo;
              </p>
            </div>
            <p className={`mt-5 font-black uppercase tracking-widest text-sm
              ${ isDarkMode ? "text-yellow-400" : "text-slate-900" }`}>
              — {review.name}
            </p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => rotate(-1)}
          aria-label="Previous reviews"
          className={`w-11 h-11 rounded-full border-4 flex items-center justify-center font-black transition-all active:scale-95
            ${ isDarkMode
              ? "bg-slate-700 border-slate-500 text-white hover:bg-slate-600 shadow-[3px_3px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 text-slate-900 hover:bg-slate-100 shadow-[3px_3px_0px_0px_#0f172a]"
            }`}
        >
          <ArrowLeft size={18} />
        </button>

        {/* Dot indicators */}
        <div className="flex gap-2">
          {Array.from({ length: groupCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => { setVisible(false); setTimeout(() => { setStartIndex(i * CARDS); setVisible(true); }, 280); }}
              aria-label={`Go to review group ${i + 1}`}
              className={`w-2.5 h-2.5 rounded-full border-2 transition-all
                ${ i === currentGroup
                  ? isDarkMode ? "bg-yellow-400 border-yellow-400" : "bg-slate-900 border-slate-900"
                  : isDarkMode ? "bg-slate-600 border-slate-500" : "bg-slate-300 border-slate-400"
                }`}
            />
          ))}
        </div>

        <button
          onClick={() => rotate(1)}
          aria-label="Next reviews"
          className={`w-11 h-11 rounded-full border-4 flex items-center justify-center font-black transition-all active:scale-95
            ${ isDarkMode
              ? "bg-slate-700 border-slate-500 text-white hover:bg-slate-600 shadow-[3px_3px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 text-slate-900 hover:bg-slate-100 shadow-[3px_3px_0px_0px_#0f172a]"
            }`}
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
};

// ── Main HomePage ──
const HomePage = () => {
  const { isDarkMode, user } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const languagePills = t('home.language_pills', { returnObjects: true });
  const marqueeItems = t('home.marquee', { returnObjects: true });

  const handleStartLearning = () => navigate(user ? "/dashboard" : "/login");
  const handleSeeFeatures = () => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });

  const statsBg = isDarkMode
    ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
    : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]";

  return (
    <>
      {/* MAIN CONTENT */}
      <main className="flex-grow flex flex-col items-center justify-center pt-16 pb-24 px-4 relative">
        {/* Floating Decorative Elements */}
        <div className="absolute top-20 left-10 md:left-32 w-24 h-24 bg-yellow-400 rounded-full border-4 border-slate-900 neo-shadow-light float-1 hidden md:flex items-center justify-center opacity-80 z-0">
          <span className="font-black text-2xl rotate-12 text-slate-900">PT-PT</span>
        </div>
        <div className="absolute bottom-40 right-10 md:right-32 w-32 h-32 bg-blue-400 rounded-3xl border-4 border-slate-900 neo-shadow-light float-2 hidden md:flex items-center justify-center opacity-80 z-0 rotate-12">
          <Zap size={48} className="text-white" />
        </div>

        {/* Hero Section */}
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className={`inline-flex items-center space-x-2 px-6 py-2 mb-8 font-bold border-2 rounded-full float-3
            ${isDarkMode ? "bg-slate-800 border-yellow-400 text-yellow-400" : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}>
            <span>{t('home.badge')}</span>
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 tracking-tighter leading-[0.9]">
            <span className="block">{t('home.hero_line1')}</span>
            <span className={`block my-2 mx-auto w-fit px-4 border-4 -rotate-2 hover:rotate-2 transition-transform duration-300
              ${isDarkMode ? "bg-yellow-400 text-slate-900 border-slate-900" : "bg-blue-600 text-white border-slate-900 neo-shadow-light"}`}>
              {t('home.hero_highlight')}
            </span>
            <span className="block">{t('home.hero_line2')}</span>
          </h1>

          <p className="text-xl md:text-3xl font-semibold mb-12 max-w-3xl mx-auto leading-relaxed opacity-90">
            {t('home.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button
              onClick={handleStartLearning}
              className={`w-full sm:w-auto px-10 py-5 text-xl font-black rounded-full border-4 flex items-center justify-center transition-all active:scale-95 group
                ${ isDarkMode
                  ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark"
                  : "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-light"
                }`}
            >
              {t('home.cta_start')}
              <ArrowRight className="ml-3 w-8 h-8 group-hover:translate-x-3 transition-transform" />
            </button>

            <button
              onClick={handleSeeFeatures}
              className={`w-full sm:w-auto px-10 py-5 text-xl font-black rounded-full border-4 flex items-center justify-center transition-all active:scale-95 group
                ${ isDarkMode
                  ? "bg-transparent border-slate-400 text-slate-300 hover:border-yellow-400 hover:text-yellow-400"
                  : "bg-transparent border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white"
                }`}
            >
              See How It Works
              <ChevronRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>

      {/* Stats Bar */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className={`grid grid-cols-3 divide-x-4 divide-slate-900 rounded-[2rem] border-4 overflow-hidden
          ${ isDarkMode ? "bg-slate-800 border-slate-700 divide-slate-700 shadow-[8px_8px_0px_0px_#1e293b]" : "bg-white border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]" }`}>
          {[
            { value: "12,000+", label: "Learners" },
            { value: "40+", label: "Source Languages" },
            { value: "4.9 ★", label: "Average Rating" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <span className={`text-3xl md:text-4xl font-black tracking-tight ${ isDarkMode ? "text-yellow-400" : "text-blue-600" }`}>
                {value}
              </span>
              <span className={`text-xs md:text-sm font-bold uppercase tracking-widest mt-1 ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Marquee Divider */}
      <div className={`w-full py-4 border-y-4 border-slate-900 transform -rotate-2 scale-105 my-12
        ${ isDarkMode ? "bg-blue-600 text-white" : "bg-blue-600 text-white" }`}>
        <div className="marquee-container">
          <div className="marquee-content font-black text-3xl uppercase tracking-widest flex">
            {Array.isArray(marqueeItems) && [
              ...marqueeItems,
              ...marqueeItems,
            ].map((text, idx) => (
              <span key={idx} className="mx-6">
                {text}
                <span className="mx-6 opacity-60">•</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-20 relative z-10">
        <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter text-center mb-4
          ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
          Everything You Need
        </h2>
        <p className={`text-center font-semibold mb-14 opacity-70 ${ isDarkMode ? "text-slate-300" : "text-slate-700" }`}>
          One platform. Every tool for real-world Portuguese.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard icon={Mic} title={t('home.features.voice_tutor')} delay="0s" color="bg-yellow-400 text-slate-900" />
          <FeatureCard icon={MessageSquare} title={t('home.features.urban_dictionary')} delay="0.2s" color="bg-blue-400 text-slate-900" />
          <FeatureCard icon={Calendar} title={t('home.features.smart_scheduler')} delay="0.4s" color="bg-pink-400 text-slate-900" />
          <FeatureCard icon={Users} title={t('home.features.human_sessions')} delay="0.6s" color="bg-green-400 text-slate-900" />
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter text-center mb-4
          ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
          How It Works
        </h2>
        <p className={`text-center font-semibold mb-14 opacity-70 ${ isDarkMode ? "text-slate-300" : "text-slate-700" }`}>
          Three steps. No fluff.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              title: "Tell Us Your Language",
              desc: "Speak English, Thai, or Aussie slang? We start from where YOU are.",
              color: "bg-yellow-400",
            },
            {
              step: "02",
              title: "Ask Anything",
              desc: "No rigid lessons. Ask how to order a bifana or flirt in Lisbon naturally.",
              color: "bg-blue-400",
            },
            {
              step: "03",
              title: "Practice & Improve",
              desc: "Download cheat sheets and practise daily with our 24/7 AI Voice Tutor.",
              color: "bg-pink-400",
            },
          ].map(({ step, title, desc, color }) => (
            <div key={step} className={`p-8 rounded-[2rem] border-4 relative overflow-hidden
              ${ isDarkMode
                ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
              }`}>
              <span className={`absolute -top-4 -right-4 text-8xl font-black opacity-10 select-none ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
                {step}
              </span>
              <div className={`w-12 h-12 rounded-2xl border-4 border-slate-900 ${color} flex items-center justify-center font-black text-slate-900 text-lg mb-6`}>
                {step}
              </div>
              <h3 className={`text-xl font-black uppercase tracking-tight mb-3 ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
                {title}
              </h3>
              <p className={`font-semibold leading-relaxed ${ isDarkMode ? "text-slate-400" : "text-slate-600" }`}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Dynamic Language Demo */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className={`p-10 md:p-16 rounded-[3rem] border-4 flex flex-col items-center text-center float-2
          ${ isDarkMode ? "bg-slate-800 border-slate-700 shadow-[12px_12px_0px_0px_#1e293b]" : "bg-yellow-100 border-slate-900 shadow-[12px_12px_0px_0px_#0f172a]" }`}>
          <Globe className="text-blue-600 mb-6 w-20 h-20 animate-spin-slow" style={{ animationDuration: "10s" }} />
          <h3 className="text-4xl md:text-5xl font-black mb-6 uppercase">
            {t('home.universal_input.title')}
          </h3>
          <p className="text-xl md:text-2xl font-semibold mb-10 max-w-2xl opacity-80">
            {t('home.universal_input.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {Array.isArray(languagePills) && languagePills.map((item, i) => (
              <span key={i} className={`px-6 py-3 font-bold border-2 rounded-full text-lg wiggle-hover cursor-pointer
                ${ isDarkMode ? "bg-slate-700 border-slate-500" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]" }`}>
                {item}
              </span>
            ))}
          </div>
          <button
            onClick={handleStartLearning}
            className={`px-10 py-4 text-lg font-black rounded-full border-4 flex items-center gap-3 transition-all active:scale-95 group
              ${ isDarkMode
                ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark"
                : "bg-blue-600 border-slate-900 text-white hover-neo-light"
              }`}
          >
            Try It Free
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials isDarkMode={isDarkMode} />

      {/* Bottom CTA Banner */}
      <section className={`w-full border-y-4 py-20 px-4
        ${ isDarkMode ? "bg-yellow-400 border-slate-900" : "bg-blue-600 border-slate-900" }`}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className={`text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6
            ${ isDarkMode ? "text-slate-900" : "text-white" }`}>
            Start Speaking Portuguese Today.
          </h2>
          <p className={`text-lg md:text-2xl font-semibold mb-10 opacity-80
            ${ isDarkMode ? "text-slate-800" : "text-blue-100" }`}>
            Join thousands of learners mastering real-world Portuguese.
          </p>
          <button
            onClick={handleStartLearning}
            className={`px-12 py-5 text-xl font-black rounded-full border-4 flex items-center gap-3 mx-auto transition-all active:scale-95 group
              ${ isDarkMode
                ? "bg-slate-900 border-slate-900 text-yellow-400 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,0.3)] hover:-translate-y-1"
                : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#1e293b] hover:shadow-[10px_10px_0px_0px_#1e293b] hover:-translate-y-1"
              }`}
          >
            {t('home.cta_start')}
            <ArrowRight className="w-7 h-7 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </section>
    </>
  );
};

export default HomePage;
