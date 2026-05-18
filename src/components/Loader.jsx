import PropTypes from "prop-types";

/**
 * Reusable neo-brutalist loader/spinner.
 *
 * Uses a "Bouncing Neo-Blocks" design with three coloured blocks that
 * bounce in a staggered rhythm.
 *
 * Props:
 *   message    {string}  — text shown below the spinner  (default: "Loading...")
 *   isDarkMode {bool}    — adapts colours to dark/light mode
 *   fullScreen {bool}    — if true, covers the full viewport with a backdrop;
 *                          if false, renders as an inline centred block
 */
const Loader = ({ message = "Loading...", isDarkMode = false, fullScreen = false }) => {
  const card = (
    <div
      className={`flex flex-col items-center gap-6 p-10 rounded-2xl border-4 transition-colors
        ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 shadow-[8px_8px_0px_0px_#1e293b]"
            : "bg-white border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
        }`}
    >
      {/* Injected keyframes for self-contained animations */}
      <style>{`
        @keyframes loader-neo-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .loader-neo-bounce-1 {
          animation: loader-neo-bounce 0.8s infinite 0s ease-in-out;
        }
        .loader-neo-bounce-2 {
          animation: loader-neo-bounce 0.8s infinite 0.15s ease-in-out;
        }
        .loader-neo-bounce-3 {
          animation: loader-neo-bounce 0.8s infinite 0.3s ease-in-out;
        }
      `}</style>

      {/* Bouncing Neo-Blocks */}
      <div className="flex gap-2.5 h-14 items-center justify-center" role="presentation">
        <div className="w-5 h-5 border-4 border-slate-900 rounded-md bg-yellow-400 loader-neo-bounce-1" />
        <div className="w-5 h-5 border-4 border-slate-900 rounded-md bg-blue-400 loader-neo-bounce-2" />
        <div className="w-5 h-5 border-4 border-slate-900 rounded-md bg-pink-400 loader-neo-bounce-3" />
      </div>

      {/* Message */}
      {message && (
        <p
          className={`font-black uppercase tracking-widest text-sm
            ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
        >
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center
          ${
            isDarkMode
              ? "bg-slate-900/80 backdrop-blur-sm"
              : "bg-white/80 backdrop-blur-sm"
          }`}
        role="status"
        aria-live="polite"
        aria-label={message}
      >
        {card}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {card}
    </div>
  );
};

Loader.propTypes = {
  message: PropTypes.string,
  isDarkMode: PropTypes.bool,
  fullScreen: PropTypes.bool,
};

export default Loader;