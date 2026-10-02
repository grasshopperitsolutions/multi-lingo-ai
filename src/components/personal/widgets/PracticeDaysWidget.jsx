import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../../contexts/AppContext";
import PersonalWidgetCard from "../PersonalWidgetCard";
import {
  MAX_WEEKLY_TARGET,
  bestMonth,
  daysThisMonth,
  daysThisWeek,
  localToday,
  resolveWeeklyTarget,
  totalDays,
} from "../../../utils/practiceDays";

/**
 * PracticeDaysWidget
 *
 * How much you practise: a ring for this week against your goal, three numbers
 * (this month, best month, total) and the month as a row of days.
 *
 * It replaced the day-streak widget. A practice day is a day you opened the
 * app, and nothing here ever resets: miss a day and the ring simply has one
 * fewer segment filled. That is deliberate and it is the product's promise, so
 * do not add a "current run" number back.
 *
 * The weekly goal is edited here, with a stepper, because this is where it is
 * measured. It is saved through the same settings hook as the goal card, which
 * also mirrors it onto the profile. Without `onChangeTarget` the stepper is not
 * drawn, so the widget still works as a read-only view.
 *
 * The widget id stays `streak` in `config/personalWidgets.js`: it is what
 * users' `hiddenPersonalWidgets` stores, so renaming it would silently bring
 * the widget back for everyone who had hidden it. It takes both columns at
 * `lg:`, and from `sm:` up the month row carries the day numbers; on a phone
 * it is a thin bar, because 31 numbers do not fit in 330px.
 *
 * Costs no request — everything is hydrated onto the context user with the
 * profile. Reads only.
 */

const RING_RADIUS = 44;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const WeekRing = ({ done, target, isDarkMode }) => {
  const { t } = useTranslation();
  const filled = Math.min(done / target, 1) * RING_LENGTH;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <svg
        viewBox="0 0 120 120"
        className="w-28 h-28 sm:w-32 sm:h-32"
        role="img"
        aria-label={`${t("personal.practice_week")}: ${done}/${target}`}
      >
        <circle
          cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="14"
          className={isDarkMode ? "stroke-slate-700" : "stroke-slate-200"}
        />
        <circle
          cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${RING_LENGTH.toFixed(1)}`}
          transform="rotate(-90 60 60)"
          className={isDarkMode ? "stroke-blue-400" : "stroke-blue-500"}
        />
        <text
          x="60" y="68" textAnchor="middle" fontSize="28" fontWeight="900"
          className={isDarkMode ? "fill-white" : "fill-slate-900"}
        >
          {done}/{target}
        </text>
      </svg>
      <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
        {t("personal.practice_week")}
      </span>
    </div>
  );
};

WeekRing.propTypes = {
  done: PropTypes.number.isRequired,
  target: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const Figure = ({ label, value, note, isDarkMode }) => (
  <div className="min-w-0">
    <div className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
      {label}
    </div>
    <div className={`text-2xl sm:text-3xl font-black tracking-tighter tabular-nums ${isDarkMode ? "text-white" : "text-slate-900"}`}>
      {value}
    </div>
    {note && (
      <div className={`text-xs font-semibold capitalize break-words ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        {note}
      </div>
    )}
  </div>
);

Figure.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  note: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
};

/** The weekly goal: a big number with a button either side, each a full touch target. */
const GoalStepper = ({ target, onChange, isDarkMode }) => {
  const { t } = useTranslation();
  const button = `flex-1 min-h-[44px] rounded-xl border-2 font-black text-lg leading-none transition-all active:scale-95 disabled:opacity-30 ${
    isDarkMode
      ? "border-slate-600 text-slate-200 hover:bg-slate-700"
      : "border-slate-900 text-slate-900 hover:bg-slate-100"
  }`;

  return (
    <div className="min-w-0">
      <div className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
        {t("personal.practice_goal")}
      </div>
      <div className={`text-2xl sm:text-3xl font-black tracking-tighter tabular-nums ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {target}
      </div>
      <div className="flex gap-1.5 mt-1">
        <button
          type="button"
          className={button}
          aria-label={t("personal.practice_goal_less")}
          disabled={target <= 1}
          onClick={() => onChange(target - 1)}
        >
          −
        </button>
        <button
          type="button"
          className={button}
          aria-label={t("personal.practice_goal_more")}
          disabled={target >= MAX_WEEKLY_TARGET}
          onClick={() => onChange(target + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
};

GoalStepper.propTypes = {
  target: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

/** "setembro de 2026" in the reader's language; the key itself if Intl cannot say. */
const monthLabel = (key, locale) => {
  const [year, month] = key.split("-").map(Number);
  try {
    return new Date(year, month - 1, 1, 12).toLocaleDateString(locale, { month: "long", year: "numeric" });
  } catch {
    return key;
  }
};

/**
 * The month as one cell per day. A thin bar on a phone; from `sm:` up each cell
 * is taller and carries its day number, which is what makes it readable as a
 * calendar rather than a progress bar.
 */
const MonthRow = ({ today, dates, isDarkMode }) => {
  const [year, month] = today.split("-").map(Number);
  const length = new Date(year, month, 0).getDate();
  const done = new Set(dates);

  return (
    <div className="grid grid-flow-col auto-cols-fr gap-[2px] sm:gap-1" aria-hidden="true">
      {Array.from({ length }, (_, i) => {
        const day = i + 1;
        const date = `${today.slice(0, 8)}${String(day).padStart(2, "0")}`;
        const practiced = done.has(date);
        const isToday = date === today;
        const isFuture = date > today;

        const tone = practiced
          ? isDarkMode ? "bg-blue-400 text-slate-900" : "bg-blue-500 text-white"
          : isDarkMode ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500";

        return (
          <div
            key={date}
            className={`h-5 sm:h-9 rounded-[3px] sm:rounded-md flex items-center justify-center text-[10px] font-black tabular-nums ${tone} ${
              isFuture ? "opacity-40" : ""
            } ${isToday ? (isDarkMode ? "ring-2 ring-white" : "ring-2 ring-slate-900") : ""}`}
          >
            <span className="hidden sm:inline">{day}</span>
          </div>
        );
      })}
    </div>
  );
};

MonthRow.propTypes = {
  today: PropTypes.string.isRequired,
  dates: PropTypes.arrayOf(PropTypes.string).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const PracticeDaysWidget = ({ isDarkMode, weeklyTarget, onChangeTarget }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAppContext();

  const today = localToday();
  // The settings value wins while it is loaded: it moves on the tap, whereas
  // the profile copy only follows after the save is flushed.
  const target = resolveWeeklyTarget(weeklyTarget ?? user?.weeklyTarget);
  const dates = Array.isArray(user?.practiceDates) ? user.practiceDates : [];
  const best = bestMonth(user?.practiceMonths);

  return (
    <PersonalWidgetCard widgetId="streak" isDarkMode={isDarkMode}>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center gap-4 sm:gap-8 flex-wrap">
          <WeekRing done={daysThisWeek(dates, today)} target={target} isDarkMode={isDarkMode} />

          <div className="flex-1 min-w-[10rem] grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 items-start">
            <Figure
              label={t("personal.practice_month")}
              value={String(daysThisMonth(dates, today))}
              isDarkMode={isDarkMode}
            />
            <Figure
              label={t("personal.practice_best_month")}
              value={String(best?.count ?? 0)}
              note={best ? monthLabel(best.key, i18n.language) : undefined}
              isDarkMode={isDarkMode}
            />
            <Figure
              label={t("personal.practice_total")}
              value={String(totalDays(user))}
              isDarkMode={isDarkMode}
            />
            {onChangeTarget && (
              <GoalStepper target={target} onChange={onChangeTarget} isDarkMode={isDarkMode} />
            )}
          </div>
        </div>

        <MonthRow today={today} dates={dates} isDarkMode={isDarkMode} />
      </div>
    </PersonalWidgetCard>
  );
};

PracticeDaysWidget.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  /** The goal as the settings hook holds it; falls back to the profile copy. */
  weeklyTarget: PropTypes.number,
  /** Called with the new goal (1 to 7). Omit for a read-only widget. */
  onChangeTarget: PropTypes.func,
};

export default PracticeDaysWidget;
