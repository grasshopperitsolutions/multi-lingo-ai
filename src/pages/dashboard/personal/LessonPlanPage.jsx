import { Check } from "lucide-react";
import PersonalListPage from "../../../components/personal/PersonalListPage";
import { PERSONAL_KINDS } from "../../../services/personalService";

/**
 * LessonPlanPage
 *
 * Things to ask your tutor next time, collected during the week and ticked off
 * in the lesson.
 *
 * The only list page with a custom row, because a question has a state that
 * the others do not: the whole row is the toggle, not a small checkbox beside
 * it, so it works with a thumb. Done questions stay — going back over what you
 * already asked is the point — but they sink visually.
 */
const LessonPlanPage = () => (
  <PersonalListPage
    kind={PERSONAL_KINDS.QUESTION}
    titleKey="personal.plan_title"
    emptyKey="personal.plan_empty"
    reportContext="LessonPlanPage"
    fields={[
      {
        name: "text",
        labelKey: "personal.plan_field_text",
        placeholderKey: "personal.plan_field_text_placeholder",
        multiline: true,
        rows: 2,
      },
    ]}
    renderRow={(item, { isDarkMode, update }) => {
      const done = item.done === true;
      return (
        <button
          type="button"
          onClick={() => update(item.id, { done: !done })}
          aria-pressed={done}
          className="w-full flex items-start gap-3 text-left"
        >
          <span
            className={`shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-lg border-4 ${
              done
                ? isDarkMode
                  ? "bg-yellow-400 border-yellow-400"
                  : "bg-blue-600 border-slate-900"
                : isDarkMode
                  ? "border-slate-600"
                  : "border-slate-400"
            }`}
            aria-hidden="true"
          >
            {done && (
              <Check size={13} strokeWidth={4} className={isDarkMode ? "text-slate-900" : "text-white"} />
            )}
          </span>
          <span
            className={`font-bold leading-relaxed ${
              done
                ? `line-through opacity-60 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`
                : isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {item.text}
          </span>
        </button>
      );
    }}
  />
);

export default LessonPlanPage;
