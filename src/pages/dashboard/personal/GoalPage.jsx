import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { usePersonalSettings } from "../../../hooks/usePersonalSettings";
import Loader from "../../../components/Loader";
import { daysUntil } from "../../../utils/dates";
import {
  personalInputClasses,
  personalLabelClasses,
} from "../../../components/personal/fieldStyles";
import { FeaturePageShell, Card } from "../../../components/ui";

/**
 * GoalPage
 *
 * The thing you are practising *for*, and how long is left.
 *
 * A trip, an exam, a move. Nothing here is enforced or tracked — it exists to
 * put a number on a page, which is the whole of its usefulness. `type="date"`
 * rather than a custom picker: the native one is correct on every mobile OS
 * and costs nothing.
 */
const GoalPage = () => {
  const { isDarkMode } = useAppContext();
  const { canAccess, isReady } = useTierAccess();
  const { settings, isLoading, save } = usePersonalSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isReady && !canAccess("personal_tools")) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const days = daysUntil(settings.goalDate);

  const inputClasses = personalInputClasses(isDarkMode);
  const labelClasses = personalLabelClasses(isDarkMode);

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="violet"
      title={t("personal.goal_title")}
      reportContext="GoalPage"
      showFavourite={false}
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("dashboard.personal_tools"), onClick: () => navigate("/dashboard/personal") },
        { label: t("personal.goal_title") },
      ]}
    >
      {isLoading ? (
        <Loader message={t("common.loading")} isDarkMode={isDarkMode} />
      ) : (
        <>
          {days !== null && (
            <Card isDarkMode={isDarkMode}>
              <div className="flex flex-col items-center gap-2 py-4">
                <span
                  className={`text-7xl font-black tracking-tighter tabular-nums ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {Math.max(0, days)}
                </span>
                <span className={`text-xs font-black uppercase tracking-widest ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}>
                  {days >= 0 ? t("personal.goal_days_left") : t("personal.goal_passed")}
                </span>
                {settings.goalLabel && (
                  <p className={`font-bold text-center mt-1 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    {settings.goalLabel}
                  </p>
                )}
              </div>
            </Card>
          )}

          <Card isDarkMode={isDarkMode}>
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClasses} htmlFor="goal-label">
                  {t("personal.goal_label_field")}
                </label>
                <input
                  id="goal-label"
                  type="text"
                  value={settings.goalLabel}
                  onChange={(e) => save({ goalLabel: e.target.value })}
                  maxLength={120}
                  enterKeyHint="done"
                  placeholder={t("personal.goal_label_placeholder")}
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses} htmlFor="goal-date">
                  {t("personal.goal_date_field")}
                </label>
                <input
                  id="goal-date"
                  type="date"
                  value={settings.goalDate}
                  onChange={(e) => save({ goalDate: e.target.value })}
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses} htmlFor="goal-weekly">
                  {t("personal.goal_weekly_field")}
                </label>
                <input
                  id="goal-weekly"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={settings.weeklyTarget || ""}
                  onChange={(e) => save({ weeklyTarget: Number(e.target.value) || 0 })}
                  placeholder="3"
                  className={inputClasses}
                />
                <p className={`mt-2 text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  {t("personal.goal_weekly_hint")}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </FeaturePageShell>
  );
};

export default GoalPage;
