import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import PersonalWidgetCard from "../PersonalWidgetCard";
import AutoGrowTextarea from "../AutoGrowTextarea";
import { personalInputClasses, personalLabelClasses } from "../fieldStyles";
import DatePicker from "../../ui/DatePicker";

/**
 * GoalWidget
 *
 * What you are practising *for*, and how long is left.
 *
 * Fully editable inline. The text box and the date picker need no more room
 * than a card gives, and a countdown you cannot set from the place you read it
 * is an odd thing to ship.
 *
 * The countdown sits **beside the date**, large, rather than above everything:
 * stacked, the card was the one widget taller than the fixed card height and
 * scrolled for no reason. The weekly practice-days goal used to be a third
 * field here; it now lives in the practice days widget, next to the ring it
 * measures. The goal page still has it.
 *
 * With no date set there is no countdown, not a "0 dias", which would read as
 * a deadline today.
 *
 * The date is the app's own `DatePicker`, not `type="date"`: the native one
 * looks different in every browser and ignores the theme.
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

        <div className="flex items-end gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <label className={labelClasses} htmlFor="dash-goal-date">
              {t("personal.goal_date_field")}
            </label>
            <DatePicker
              id="dash-goal-date"
              value={settings.goalDate}
              onChange={(next) => onSave({ goalDate: next })}
              className={inputClasses}
              isDarkMode={isDarkMode}
            />
          </div>

          {daysToGoal !== null && (
            <div className="flex flex-col items-center shrink-0 min-w-[5.5rem] pb-1">
              <span
                className={`text-5xl sm:text-6xl leading-none font-black tracking-tighter tabular-nums ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                {Math.abs(daysToGoal)}
              </span>
              <span
                className={`mt-1 text-[10px] font-black uppercase tracking-widest text-center ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {daysToGoal >= 0 ? t("personal.goal_days_left") : t("personal.goal_passed")}
              </span>
            </div>
          )}
        </div>
      </div>
    </PersonalWidgetCard>
  );
};

GoalWidget.propTypes = {
  settings: PropTypes.shape({
    goalLabel: PropTypes.string,
    goalDate: PropTypes.string,
  }).isRequired,
  daysToGoal: PropTypes.number,
  onSave: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
};

export default GoalWidget;
