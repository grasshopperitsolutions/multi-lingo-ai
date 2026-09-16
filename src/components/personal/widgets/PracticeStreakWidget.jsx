import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Flame, TrendingUp, Star } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import PersonalWidgetCard from "../PersonalWidgetCard";

/**
 * PracticeStreakWidget
 *
 * The three numbers the app already knows about how much you practise, in the
 * one place where the rest of your own material lives.
 *
 * They also appear on `/dashboard`'s Today panel, and that is not a duplication
 * to remove: there they are one of several glanceable stats among features you
 * might open; here they sit beside the goal countdown, which is what gives them
 * a point. A streak next to "30 days to Lisboa" reads as progress toward
 * something. A streak on its own is a number.
 *
 * Costs no request — all three are hydrated onto the context user with the
 * profile. Reads only; nothing here is settable, because a streak you could
 * edit would not be a streak.
 */
const Stat = ({ icon: Icon, label, value, isDarkMode }) => (
  <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
    <Icon size={18} className={isDarkMode ? "text-slate-400" : "text-slate-500"} strokeWidth={3} />
    <span
      className={`text-xl sm:text-2xl font-black tracking-tighter tabular-nums ${
        isDarkMode ? "text-white" : "text-slate-900"
      }`}
    >
      {value}
    </span>
    <span
      className={`text-[9px] font-black uppercase tracking-widest text-center ${
        isDarkMode ? "text-slate-500" : "text-slate-400"
      }`}
    >
      {label}
    </span>
  </div>
);

Stat.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const PracticeStreakWidget = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();

  return (
    <PersonalWidgetCard
      widgetId="streak"
      isDarkMode={isDarkMode}
    >
      <div className="flex items-start gap-2 py-1 sm:py-2">
        <Stat
          icon={Flame}
          label={t("dashboard.day_streak")}
          value={String(user?.dayStreak ?? 0)}
          isDarkMode={isDarkMode}
        />
        <Stat
          icon={TrendingUp}
          label={t("dashboard.highest_streak")}
          value={String(user?.highestDayStreak ?? 0)}
          isDarkMode={isDarkMode}
        />
        <Stat
          icon={Star}
          label={t("dashboard.words")}
          value={String(user?.wordsFound ?? 0)}
          isDarkMode={isDarkMode}
        />
      </div>
    </PersonalWidgetCard>
  );
};

PracticeStreakWidget.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PracticeStreakWidget;
