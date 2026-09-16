import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Card } from "../ui";

/**
 * FirstRunCard
 *
 * What a brand-new user sees above an empty dashboard: a heading, one sentence,
 * and three ways in.
 *
 * It exists because the alternative designs are both worse. Hiding widgets
 * until they have content means the page reflows under the user's thumb the
 * moment they tap `+1`. Replacing the grid with a splash means the first thing
 * they do is dismiss something. This sits above a grid that is fully rendered
 * and fully usable, and disappears the instant *anything* exists — no dismiss
 * button, no stored flag, and it comes back if they later empty everything out.
 *
 * Two of the three buttons do not navigate. "Write a note" focuses the board
 * that is already on screen; "I have lessons booked" sets the counter to 1,
 * which flips the empty check and makes the card vanish without moving
 * anything else. Only the goal opens a page, because a date picker deserves
 * one.
 */
const FirstRunCard = ({ onWriteNote, onSetLessons, onSetGoal, isDarkMode }) => {
  const { t } = useTranslation();

  const button = `px-4 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
    isDarkMode
      ? "border-slate-600 text-slate-200 hover:bg-slate-700"
      : "border-slate-900 text-slate-900 hover:bg-slate-100"
  }`;

  return (
    <Card isDarkMode={isDarkMode}>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className={isDarkMode ? "text-yellow-400" : "text-blue-600"} />
          <h2
            className={`text-sm font-black uppercase tracking-widest ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {t("personal.dash_start_title")}
          </h2>
        </div>

        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          {t("personal.dash_start_body")}
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onWriteNote} className={button}>
            {t("personal.dash_start_note")}
          </button>
          <button type="button" onClick={onSetLessons} className={button}>
            {t("personal.dash_start_lessons")}
          </button>
          <button type="button" onClick={onSetGoal} className={button}>
            {t("personal.dash_start_goal")}
          </button>
        </div>
      </div>
    </Card>
  );
};

FirstRunCard.propTypes = {
  onWriteNote: PropTypes.func.isRequired,
  onSetLessons: PropTypes.func.isRequired,
  onSetGoal: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default FirstRunCard;
