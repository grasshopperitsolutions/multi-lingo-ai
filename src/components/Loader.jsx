import PropTypes from "prop-types";

/**
 * Reusable neo-brutalist loader/spinner.
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
      {/* Spinner ring */}
      <div
        className={`w-14 h-14 rounded-full border-4 animate-spin
          ${
            isDarkMode
              ? "border-slate-600 border-t-yellow-400"
              : "border-slate-200 border-t-yellow-400"
          }`}
      />

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
