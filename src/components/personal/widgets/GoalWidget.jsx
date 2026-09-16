import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import PersonalWidgetCard from "../PersonalWidgetCard";
import AutoGrowTextarea from "../AutoGrowTextarea";
import { personalInputClasses, personalLabelClasses } from "../fieldStyles";

/**
 * GoalWidget
 *
 * What you are practising *for*, and how long is left.
 *
 * Fully editable inline. The three fields are a text box, a native date picker
 * and a number — none of them needs the room a page gives, and a countdown you
 * cannot set from the place you read it is an odd thing to ship.
 *
 * `type="date"` rather than a custom picker: the native one is correct on every
 * mobile OS and costs nothing.
 *
 * With no date set there is no countdown — not a "0 dias", which would read as
 * a deadline today. The weekly target is shown as **stated intent**, never as
 * progress: nothing in the app counts tutor sessions, and deriving them from
 * the day streak would undercount a Mon/Tue/Thu/Fri week as 2.
 */
const GoalWidget = ({ settings, daysToGoal, onSave, isDarkMode, isLoading }) => {
  const { t } = useTranslation();

  const inputClasses = personalInputClasses(isDarkMode);
  const labelClasses = personalLabelClasses(isDarkMode);

  return (
    <PersonalWidgetCard
      widgetId="goal"
      isDarkMode={isDarkMode}
      isLoading={isLoading}
      expandTo="/dashboard/personal/goal"
    >
      <div className="flex flex-col gap-3 sm:gap-4">
        {daysToGoal !== null && (
          <div className="flex flex-col items-center gap-1 pb-1">
            <span
              className={`text-4xl sm:text-5xl font-black tracking-tighter tabular-nums ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              {Math.abs(daysToGoal)}
            </span>
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {daysToGoal >= 0 ? t("personal.goal_days_left") : t("personal.goal_passed")}
            </span>
          </div>
        )}

        <div>
          <label className={labelClasses} htmlFor="dash-goal-label">
            {t("personal.goal_label_field")}
          </label>
          <AutoGrowTextarea
            id="dash-goal-label"
            value={settings.goalLabel}
            onChange={(next) => onSave({ goalLabel: next })}
            maxLength={120}
            enterKeyHint="done"
            placeholder={t("personal.goal_label_placeholder")}
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses} htmlFor="dash-goal-date">
            {t("personal.goal_date_field")}
          </label>
          <input
            id="dash-goal-date"
            type="date"
            value={settings.goalDate}
            onChange={(e) => onSave({ goalDate: e.target.value })}
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses} htmlFor="dash-goal-weekly">
            {t("personal.goal_weekly_field")}
          </label>
          <input
            id="dash-goal-weekly"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={settings.weeklyTarget || ""}
            onChange={(e) => onSave({ weeklyTarget: Number(e.target.value) || 0 })}
            placeholder="3"
            className={inputClasses}
          />
        </div>
      </div>
    </PersonalWidgetCard>
  );
};

GoalWidget.propTypes = {
  settings: PropTypes.shape({
    goalLabel: PropTypes.string,
    goalDate: PropTypes.string,
    weeklyTarget: PropTypes.number,
  }).isRequired,
  daysToGoal: PropTypes.number,
  onSave: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
};

export default GoalWidget;
