import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "../hooks/useTierAccess";
import ConfirmModal from "./ConfirmModal";

/**
 * AiGenerationConfirm
 *
 * The prompt shown before any billable AI call. Rendered once at the app root
 * (next to the global alert) and driven by AppContext, which registers the
 * handler that aiService awaits — so one component covers every feature rather
 * than each call site growing its own dialog.
 *
 * Two messages, picked by whether the tier has an allowance to spend:
 *   - Limited tiers see the full notice: the cached pool is exhausted and this
 *     will cost one of their calls.
 *   - Unlimited tiers (Maestro, VIP, Admin) have nothing to ration, so they get
 *     a short heads-up that fresh content is being made instead.
 */
const AiGenerationConfirm = () => {
  const { t } = useTranslation();
  const { isDarkMode, aiConfirm, resolveAiConfirm } = useAppContext();
  const { hasUnlimitedAI, aiCallsRemaining } = useTierAccess();

  if (!aiConfirm) return null;

  const isLimited = !hasUnlimitedAI;

  return (
    <ConfirmModal
      isDarkMode={isDarkMode}
      title={
        isLimited
          ? t("ai_confirm.title_limited", "All cached content used")
          : t("ai_confirm.title_unlimited", "New AI content incoming")
      }
      message={
        isLimited
          ? t(
              "ai_confirm.message_limited",
              "Congratulations! You have finished all cached exercises. Your next call shall use AI generation. New content is stored and reviewed constantly. Try again later or get yourself new content now!",
            )
          : t("ai_confirm.message_unlimited", "This will generate fresh content with AI.")
      }
      warning={
        isLimited && Number.isFinite(aiCallsRemaining)
          ? t("ai_confirm.remaining", "You have {{count}} AI call(s) left today.", {
              count: aiCallsRemaining,
            })
          : undefined
      }
      confirmLabel={t("ai_confirm.confirm", "Generate now")}
      confirmColor="yellow"
      onConfirm={() => resolveAiConfirm(true)}
      onCancel={() => resolveAiConfirm(false)}
    />
  );
};

export default AiGenerationConfirm;
