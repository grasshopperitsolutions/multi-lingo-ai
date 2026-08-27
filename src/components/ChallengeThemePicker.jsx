import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Ban, Lock, Sparkles } from "lucide-react";

/**
 * ChallengeThemePicker
 *
 * Chooses what a challenge is about: one of the user's own interests, or a
 * free-text theme. Presentational — useChallengeTheme owns the state and the
 * mutual exclusion.
 *
 * The two inputs cost different things, and the UI says so rather than hiding
 * it. An interest filters the shared word pool, which is free. Free text cannot
 * match a pooled word, so it forces a fresh AI generation — the same kind of
 * custom call the Story Generator gates, and gated by the same feature key.
 *
 * When an interest is picked the free-text box is visibly disabled with the
 * reason on it, rather than removed: a control that vanishes leaves the user
 * guessing why.
 *
 * `unavailable` says the same thing about a whole challenge. Word Ladder needs
 * every word to sit one letter from the next, so a theme cannot survive the
 * chain — the section still appears, saying so, rather than silently differing
 * from the other games.
 */
const ChallengeThemePicker = ({
  interests,
  hasInterests,
  selectedInterestId,
  onSelectInterest,
  freeText,
  onFreeTextChange,
  canUseFreeText,
  freeTextBlockedByInterest,
  isDarkMode,
  disabled,
  unavailable,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const labelClasses = `font-black uppercase text-xs tracking-widest ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;

  if (unavailable) {
    return (
      <div className="flex flex-col gap-2">
        <p className={labelClasses}>{t("challenges.theme.title")}</p>
        <p className={`flex items-start gap-1.5 text-[11px] font-bold leading-snug ${
          isDarkMode ? "text-slate-500" : "text-slate-400"
        }`}>
          <Ban size={12} className="shrink-0 mt-0.5" />
          {t("challenges.theme.unavailable")}
        </p>
      </div>
    );
  }

  const freeTextDisabled = disabled || freeTextBlockedByInterest || !canUseFreeText;

  return (
    <div className="flex flex-col gap-3">
      <p className={labelClasses}>{t("challenges.theme.title")}</p>

      {/* ── Interests ──────────────────────────────────────────────────────── */}
      {hasInterests ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("challenges.theme.title")}>
          {interests.map((interest) => {
            const isSelected = interest.id === selectedInterestId;
            return (
              <button
                key={interest.id}
                type="button"
                onClick={() => onSelectInterest(interest.id)}
                disabled={disabled}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-full border-2 font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? isDarkMode
                      ? "bg-yellow-400 border-yellow-400 text-slate-900"
                      : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
                    : isDarkMode
                      ? "bg-transparent border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
                      : "bg-transparent border-slate-300 text-slate-500 hover:border-slate-900 hover:text-slate-900"
                }`}
              >
                {interest.label}
              </button>
            );
          })}
        </div>
      ) : (
        /* No interests saved. Point at Settings rather than offering a picker
           with nothing in it — the set of interests is a profile decision. */
        <p className={`text-xs font-bold leading-snug ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("challenges.theme.no_interests_prefix")}{" "}
          <Link
            to="/settings"
            className={`underline font-black ${
              isDarkMode ? "text-yellow-400 hover:text-yellow-300" : "text-blue-600 hover:text-blue-800"
            }`}
          >
            {t("challenges.theme.settings_link")}
          </Link>
          {t("challenges.theme.no_interests_suffix")}
        </p>
      )}

      {/* ── Free text ──────────────────────────────────────────────────────── */}
      {canUseFreeText ? (
        <div>
          <input
            type="text"
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            disabled={freeTextDisabled}
            maxLength={200}
            aria-label={t("challenges.theme.free_text_label")}
            placeholder={
              freeTextBlockedByInterest
                ? t("challenges.theme.free_text_blocked")
                : t("challenges.theme.free_text_placeholder")
            }
            className={`w-full px-3 py-2 rounded-xl border-4 font-bold text-xs outline-none transition-all disabled:cursor-not-allowed ${
              freeTextBlockedByInterest
                ? isDarkMode
                  ? "bg-slate-900/60 border-slate-700 border-dashed text-slate-600 placeholder-slate-600"
                  : "bg-slate-100 border-slate-300 border-dashed text-slate-400 placeholder-slate-400"
                : isDarkMode
                  ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-yellow-400"
                  : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-blue-600"
            }`}
          />
          {freeTextBlockedByInterest && (
            <p className={`mt-1.5 text-[10px] font-bold leading-snug ${
              isDarkMode ? "text-slate-500" : "text-slate-400"
            }`}>
              {t("challenges.theme.free_text_blocked_hint")}
            </p>
          )}
        </div>
      ) : (
        /* Locked rather than hidden, so the feature stays discoverable —
           the same treatment CustomRequestInput gives the other free-text
           boxes. */
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
          <span className="text-[11px] font-bold leading-snug">
            {t("challenges.theme.free_text_locked")}
          </span>
        </button>
      )}

      {/* What the AI will actually be asked for, when nothing is chosen. */}
      {!selectedInterestId && !freeText.trim() && (
        <p className={`flex items-start gap-1.5 text-[10px] font-bold leading-snug ${
          isDarkMode ? "text-slate-500" : "text-slate-400"
        }`}>
          <Sparkles size={11} className="shrink-0 mt-0.5" />
          {t("challenges.theme.default_hint")}
        </p>
      )}
    </div>
  );
};

ChallengeThemePicker.propTypes = {
  interests: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired }),
  ),
  hasInterests: PropTypes.bool,
  selectedInterestId: PropTypes.string,
  onSelectInterest: PropTypes.func,
  freeText: PropTypes.string,
  onFreeTextChange: PropTypes.func,
  canUseFreeText: PropTypes.bool,
  freeTextBlockedByInterest: PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
  /** Locks the whole picker while a round is loading. */
  disabled: PropTypes.bool,
  /** This challenge cannot honour a theme at all. Renders the reason instead
   *  of the controls, so no theme state is needed. */
  unavailable: PropTypes.bool,
};

ChallengeThemePicker.defaultProps = {
  interests: [],
  hasInterests: false,
  selectedInterestId: null,
  onSelectInterest: () => {},
  freeText: "",
  onFreeTextChange: () => {},
  canUseFreeText: false,
  freeTextBlockedByInterest: false,
  disabled: false,
  unavailable: false,
};

export default ChallengeThemePicker;
