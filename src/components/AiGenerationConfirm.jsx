import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import ConfirmModal from "./ConfirmModal";

/**
 * AiGenerationConfirm
 *
 * The warning shown when a user is about to spend one of their last AI calls
 * of the day. Rendered once at the app root and driven by AppContext, which
 * registers the handler aiService awaits — so one component covers every
 * feature rather than each call site growing its own dialog.
 *
 * The copy is deliberately about the user's remaining allowance and nothing
 * else. It says nothing about where content comes from or whether it has been
 * checked — users should never be told they are looking at unreviewed output.
 *
 * AppContext decides *whether* to show it; this component only renders. It
 * stays quiet for tiers with no cap, while there is still comfortable
 * allowance left, and once the user has silenced it for the day — see
 * AI_CONFIRM_WARN_AT_OR_BELOW there. With nothing left it never opens: the
 * call fails as the limit, and the screen offers the plans. Quick reflex tools (translator,
 * dictionary, word lookup) and background work (TTS, translation back-fill)
 * opt out at the call site with `skipConfirm`.
 */
const AiGenerationConfirm = () => {
  const { t } = useTranslation();
  const { isDarkMode, aiConfirm, resolveAiConfirm } = useAppContext();
  const [muteToday, setMuteToday] = useState(false);

  // Each prompt starts with the box unticked — a previous session's choice
  // shouldn't silently carry into a fresh warning.
  useEffect(() => {
    if (aiConfirm) setMuteToday(false);
  }, [aiConfirm]);

  if (!aiConfirm) return null;

  const remaining = aiConfirm.remaining;

  const message = (
    <span className="flex flex-col gap-4">
      <span>
        {t(
          "ai_confirm.message_low",
          "This will use one of your remaining calls for today. Your allowance resets tomorrow.",
        )}
      </span>

      {/* The other answer to running low. A button rather than a link:
          leaving has to decline this call first, or the screen that asked
          would wait on it for ever. AppContext then navigates. */}
      <button
        type="button"
        onClick={() => resolveAiConfirm(false, { toPlans: true })}
        className={`self-start text-sm font-bold underline decoration-2 underline-offset-4 transition-colors hover:decoration-yellow-400 ${
          isDarkMode ? "text-slate-200" : "text-slate-900"
        }`}
      >
        {t("ai_usage.see_plans")}
      </button>

      <label
        className={`flex items-center gap-2 text-sm font-bold cursor-pointer ${
          isDarkMode ? "text-slate-300" : "text-slate-600"
        }`}
      >
        <input
          type="checkbox"
          checked={muteToday}
          onChange={(e) => setMuteToday(e.target.checked)}
          className="w-4 h-4 shrink-0"
        />
        {t("ai_confirm.mute_today", "Don't warn me again today")}
      </label>
    </span>
  );

  return (
    <ConfirmModal
      isDarkMode={isDarkMode}
      title={t("ai_confirm.title_low", "{{count}} AI call(s) left today", {
        count: remaining,
      })}
      message={message}
      confirmLabel={t("ai_confirm.confirm", "Continue")}
      confirmColor="yellow"
      // The prompt fires from inside askAI, by which point the calling feature
      // has already put up its own full-screen loader at z-50. Same z-index +
      // rendered earlier in the DOM meant the loader painted on top and the
      // buttons were unreachable. Sit above every feature overlay, but below
      // the alert toast (z-200) so alerts remain visible.
      zIndexClass="z-[150]"
      onConfirm={() => resolveAiConfirm(true, { muteToday })}
      onCancel={() => resolveAiConfirm(false)}
    />
  );
};

export default AiGenerationConfirm;
