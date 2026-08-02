import PropTypes from "prop-types";
import { useState } from "react";
import Loader from "../Loader";

const PROVIDER_LABELS = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  twitter: "X (Twitter)",
};

/**
 * LoginProvidersSection — admin toggle switches for which social sign-in
 * buttons are active on LoginPage. Backed by authProvidersService.js.
 */
const LoginProvidersSection = ({ providers, isDarkMode, isLoadingDocs, error, onToggle }) => {
  const [savingId, setSavingId] = useState(null);

  const handleToggle = async (id, current) => {
    setSavingId(id);
    try {
      await onToggle(id, !current);
    } finally {
      setSavingId(null);
    }
  };

  if (isLoadingDocs) {
    return <Loader message="Loading..." isDarkMode={isDarkMode} />;
  }

  if (error) {
    return <p className="font-bold text-rose-500">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {Object.keys(PROVIDER_LABELS).map((id) => {
        const enabled = Boolean(providers[id]);
        const isSaving = savingId === id;

        return (
          <div
            key={id}
            className={`flex items-center justify-between p-4 rounded-xl border-2
              ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"}`}
          >
            <span className={`font-black text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {PROVIDER_LABELS[id]}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={`${PROVIDER_LABELS[id]} sign-in ${enabled ? "enabled" : "disabled"}`}
              disabled={isSaving}
              onClick={() => handleToggle(id, enabled)}
              className={`relative w-14 h-8 shrink-0 rounded-full border-2 transition-colors active:scale-95 disabled:opacity-50
                ${
                  enabled
                    ? "bg-emerald-400 border-emerald-600"
                    : isDarkMode
                      ? "bg-slate-700 border-slate-600"
                      : "bg-slate-300 border-slate-400"
                }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white border-2 border-slate-900 transition-transform
                  ${enabled ? "translate-x-6" : "translate-x-0"}`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
};

LoginProvidersSection.propTypes = {
  providers: PropTypes.object.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onToggle: PropTypes.func.isRequired,
};

export default LoginProvidersSection;
