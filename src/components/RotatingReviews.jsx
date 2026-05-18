import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Star } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

const RotatingReviews = ({ reviews }) => {
  const { isDarkMode } = useAppContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered || !Array.isArray(reviews) || reviews.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isHovered, reviews]);

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return null;
  }

  const getReviewAtIndex = (index) => {
    return reviews[(currentIndex + index) % reviews.length];
  };

  const review1 = getReviewAtIndex(0);
  const review2 = getReviewAtIndex(1);
  const review3 = getReviewAtIndex(2);

  return (
    <section className="max-w-7xl mx-auto px-4 py-20 relative z-10">
      <div className="text-center mb-16">
        <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter inline-block border-b-8 border-pink-400 pb-2">
          Wall of Love
        </h2>
      </div>

      {/* ── MOBILE: single card, navigated via dots ───────────────────── */}
      <div
        className="block md:hidden"
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        {(() => {
          const review = reviews[currentIndex];
          return (
            <div
              className={`p-8 rounded-[2rem] border-4 transition-all duration-500
              ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"}`}
            >
              <div className="flex gap-1 mb-4 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} fill="currentColor" size={20} />
                ))}
              </div>
              <p className="font-bold text-lg mb-6 line-clamp-4">&quot;{review.quote}&quot;</p>
              <div>
                <h4 className="font-black uppercase tracking-tight">{review.name}</h4>
                <p className="text-sm font-bold opacity-60">{review.date}</p>
              </div>
            </div>
          );
        })()}

        {/* Mobile dot navigation */}
        <div className="flex justify-center gap-2 mt-8">
          {reviews.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-3 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "bg-yellow-400 w-8"
                  : isDarkMode
                  ? "bg-slate-600 w-3"
                  : "bg-slate-300 w-3"
              }`}
              aria-label={`Go to review ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── DESKTOP: 3-column rotating grid ──────────────────────────── */}
      <div
        className="hidden md:grid grid-cols-3 gap-8"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Review Card 1 */}
        <div
          className={`p-8 rounded-[2rem] border-4 transition-all duration-500 opacity-100 transform rotate-1 hover:-rotate-1
          ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"}`}
        >
          <div className="flex gap-1 mb-4 text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} fill="currentColor" size={20} />
            ))}
          </div>
          <p className="font-bold text-lg mb-6 line-clamp-4">&quot;{review1.quote}&quot;</p>
          <div>
            <h4 className="font-black uppercase tracking-tight">{review1.name}</h4>
            <p className="text-sm font-bold opacity-60">{review1.date}</p>
          </div>
        </div>

        {/* Review Card 2 */}
        <div
          className={`p-8 rounded-[2rem] border-4 transition-all duration-500 opacity-100 transform -rotate-2 hover:rotate-1 mt-8
          ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"}`}
        >
          <div className="flex gap-1 mb-4 text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} fill="currentColor" size={20} />
            ))}
          </div>
          <p className="font-bold text-lg mb-6 line-clamp-4">&quot;{review2.quote}&quot;</p>
          <div>
            <h4 className="font-black uppercase tracking-tight">{review2.name}</h4>
            <p className="text-sm font-bold opacity-60">{review2.date}</p>
          </div>
        </div>

        {/* Review Card 3 */}
        <div
          className={`p-8 rounded-[2rem] border-4 transition-all duration-500 opacity-100 transform rotate-2 hover:-rotate-2
          ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"}`}
        >
          <div className="flex gap-1 mb-4 text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} fill="currentColor" size={20} />
            ))}
          </div>
          <p className="font-bold text-lg mb-6 line-clamp-4">&quot;{review3.quote}&quot;</p>
          <div>
            <h4 className="font-black uppercase tracking-tight">{review3.name}</h4>
            <p className="text-sm font-bold opacity-60">{review3.date}</p>
          </div>
        </div>
      </div>

      {/* Desktop progress indicators */}
      <div className="hidden md:flex justify-center gap-2 mt-12">
        {reviews.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-3 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "bg-yellow-400 w-8"
                : isDarkMode
                ? "bg-slate-600 w-3"
                : "bg-slate-300 w-3"
            }`}
            aria-label={`Go to review ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

RotatingReviews.propTypes = {
  reviews: PropTypes.arrayOf(
    PropTypes.shape({
      quote: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default RotatingReviews;
