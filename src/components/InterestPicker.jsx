import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import NeoDropdown from "./NeoDropdown";
import { useTierAccess } from "../hooks/useTierAccess";

/** "Nothing in particular" — never a real interest id. */
const NO_INTEREST = "";

/**
 * InterestPicker — write the next tale or culture piece about one of the
 * reader's own interests.
 *
 * Choosing one is a custom request, so it is gated like CustomRequestInput:
 * the `custom_requests` feature, or a pool the reader has already been
 * through. A chosen interest cannot be served from the shared pool (nothing
 * there was written about it alone), so it always spends a generation — the
 * same bargain as the free-text box, which is why the two unlock together.
 * Locked, it is shown rather than hidden, so the feature stays discoverable.
 *
 * Only the interests already saved on the profile, like the challenges' theme
 * picker: which interests someone has is a Settings decision, not a per-tale
 * one.
 */
const InterestPicker = ({ interests, value, onChange, cacheExhausted = false, disabled = false, isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canAccess, isReady } = useTierAccess();

  const unlocked = canAccess("custom_requests") || cacheExhausted;
  // NeoDropdown's own label, so all three states read as the same control.
  const labelClass = "block font-black uppercase text-xs tracking-widest ml-1";

  // Nothing until access is known, rather than flashing a lock at somebody
  // who turns out to have the feature.
  if (!isReady) return null;

  if (interests.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className={labelClass}>{t("interest_picker.label")}</p>
        <p className={`text-xs font-bold leading-snug ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("interest_picker.no_interests_prefix")}{" "}
          <Link
            to="/settings#practiceLanguage"
            className={`underline font-black ${
              isDarkMode ? "text-yellow-400 hover:text-yellow-300" : "text-blue-600 hover:text-blue-800"
            }`}
          >
            {t("interest_picker.settings_link")}
          </Link>
          {t("interest_picker.no_interests_suffix")}
        </p>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-2">
        <p className={labelClass}>{t("interest_picker.label")}</p>
        <button
          type="button"
          onClick={() => navigate("/pricing")}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-4 border-dashed text-left transition-all active:scale-95 ${
            isDarkMode
              ? "border-slate-700 text-slate-400 hover:border-slate-600"
              : "border-slate-300 text-slate-500 hover:border-slate-400"
          }`}
        >
          <Lock size={14} className="shrink-0" />
          <span className="text-[11px] font-bold leading-snug">{t("interest_picker.locked")}</span>
        </button>
      </div>
    );
  }

  const options = [
    { value: NO_INTEREST, label: t("interest_picker.none") },
    ...interests.map((interest) => ({ value: interest.id, label: interest.label })),
  ];

  return (
    <NeoDropdown
      options={options}
      value={value ?? NO_INTEREST}
      onChange={(next) => onChange(next === NO_INTEREST ? null : next)}
      isDarkMode={isDarkMode}
      disabled={disabled}
      searchable={false}
      label={t("interest_picker.label")}
      className="!w-full"
    />
  );
};

InterestPicker.propTypes = {
  /** From useInterestTopics().topics. */
  interests: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired }),
  ).isRequired,
  /** The chosen interest id, or null for nothing in particular. */
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  /** The reader has seen the whole pool, which unlocks custom requests. */
  cacheExhausted: PropTypes.bool,
  disabled: PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
};

export default InterestPicker;
