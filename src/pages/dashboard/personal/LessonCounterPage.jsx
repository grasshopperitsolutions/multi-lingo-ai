import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { usePersonalSettings } from "../../../hooks/usePersonalSettings";
import Loader from "../../../components/Loader";
import { FeaturePageShell, Card } from "../../../components/ui";

/** Quick ways to top up after paying for a block of lessons. */
const TOP_UPS = [1, 4, 8, 10];

/**
 * LessonCounterPage
 *
 * How many lessons you have left with a private tutor — one number, because
 * that is the question people actually ask themselves.
 *
 * This is the most phone-shaped page in the app, so the numeral is large and
 * the two controls are big and low, where a thumb reaches. Writes are
 * debounced in usePersonalSettings: marking off four lessons is four taps and
 * one write.
 */
const LessonCounterPage = () => {
  const { isDarkMode } = useAppContext();
  const { canAccess, isReady } = useTierAccess();
  const { settings, isLoading, save } = usePersonalSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isReady && !canAccess("personal_tools")) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const remaining = settings.lessonsRemaining;

  const stepButton = `flex items-center justify-center w-16 h-16 rounded-2xl border-4 transition-all active:scale-95 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700 text-white"
      : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
  }`;

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="violet"
      title={t("personal.lessons_title")}
      reportContext="LessonCounterPage"
      showFavourite={false}
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("dashboard.personal_tools"), onClick: () => navigate("/dashboard/personal") },
        { label: t("personal.lessons_title") },
      ]}
    >
      {isLoading ? (
        <Loader message={t("common.loading")} isDarkMode={isDarkMode} />
      ) : (
        <Card isDarkMode={isDarkMode}>
          <div className="flex flex-col items-center gap-6 py-4">
            <span className={`text-xs font-black uppercase tracking-widest ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
              {t("personal.lessons_remaining_label")}
            </span>

            <span
              className={`text-7xl font-black tracking-tighter tabular-nums ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
              aria-live="polite"
            >
              {remaining}
            </span>

            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => save({ lessonsRemaining: Math.max(0, remaining - 1) })}
                disabled={remaining <= 0}
                aria-label={t("personal.lessons_use_one")}
                className={`${stepButton} ${remaining <= 0 ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <Minus size={28} strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => save({ lessonsRemaining: remaining + 1 })}
                aria-label={t("personal.lessons_add_one")}
                className={stepButton}
              >
                <Plus size={28} strokeWidth={3} />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className={`text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                {t("personal.lessons_top_up")}
              </span>
              {TOP_UPS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => save({ lessonsRemaining: remaining + amount })}
                  className={`px-4 py-2.5 rounded-full border-2 font-black text-sm tabular-nums transition-all active:scale-95 ${
                    isDarkMode
                      ? "bg-slate-900 border-slate-700 text-slate-200"
                      : "bg-slate-50 border-slate-300 text-slate-700"
                  }`}
                >
                  +{amount}
                </button>
              ))}
            </div>

            <p className={`text-xs font-bold text-center max-w-xs ${
              isDarkMode ? "text-slate-500" : "text-slate-400"
            }`}>
              {t("personal.lessons_hint")}
            </p>
          </div>
        </Card>
      )}
    </FeaturePageShell>
  );
};

export default LessonCounterPage;
