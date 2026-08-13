import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { useTierAccess } from "../hooks/useTierAccess";

/**
 * CustomRequestInput
 *
 * The "ask for something specific" text box shared by the Story Generator and
 * History & Culture.
 *
 * Typing a description sends an AI call aimed at exactly that, skipping the
 * shared cache — so it's reserved for unlimited tiers, who aren't spending a
 * scarce daily allowance. Everyone else draws from the cache instead, which
 * costs nothing, and the box unlocks for them once they've seen everything in
 * it (at which point their next request has to generate anyway, so gating it
 * would achieve nothing but hiding a choice).
 *
 * Renders the lock state itself rather than being hidden by the caller, so the
 * feature is discoverable to the tiers that don't have it yet.
 */
const CustomRequestInput = ({
  value,
  onChange,
  placeholder,
  cacheExhausted,
  disabled,
  isDarkMode,
}) => {
  const { t } = useTranslation();
  const { hasUnlimitedAI } = useTierAccess();
  const navigate = useNavigate();

  const unlocked = hasUnlimitedAI || cacheExhausted;

  if (!unlocked) {
    return (
      <button
        type="button"
        onClick={() => navigate("/pricing")}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-4 border-dashed text-left transition-all hover:-translate-y-0.5 active:scale-95 ${
          isDarkMode
            ? "border-slate-700 text-slate-400 hover:border-slate-600"
            : "border-slate-300 text-slate-500 hover:border-slate-400"
        }`}
      >
        <Lock size={16} className="shrink-0" />
        <span className="text-sm font-bold">{t("custom_request.locked")}</span>
      </button>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={200}
        className={`w-full px-4 py-3 rounded-xl border-4 font-semibold outline-none transition-colors disabled:opacity-50 ${
          isDarkMode
            ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-sky-400"
            : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-sky-500"
        }`}
      />
      {/* Only lower tiers reach this by exhausting the cache, so only they need
          telling why the box just appeared. */}
      {!hasUnlimitedAI && cacheExhausted && (
        <p className={`mt-2 text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
          {t("custom_request.unlocked_by_exhaustion")}
        </p>
      )}
    </div>
  );
};

CustomRequestInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  cacheExhausted: PropTypes.bool,
  disabled: PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
};

export default CustomRequestInput;
