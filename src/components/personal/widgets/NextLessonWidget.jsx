import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import PersonalWidgetCard from "../PersonalWidgetCard";
import QuickAddForm from "../QuickAddForm";

const FIELDS = [
  {
    name: "text",
    labelKey: "personal.plan_field_text",
    placeholderKey: "personal.plan_field_text_placeholder",
  },
];

/**
 * NextLessonWidget
 *
 * Questions to ask your tutor next time — the strongest inline case on the
 * page. Walking *in* to a lesson you read them; walking *out* you add the one
 * you just thought of. Both are one tap from the dashboard.
 *
 * Only open questions are shown. Done ones are the archive: going back over
 * what you already asked is a real use, but it is a sitting-down one, so it
 * lives on the full page and is counted here in a muted line.
 *
 * The whole row is the toggle, not a small checkbox beside it — lifted from
 * `LessonPlanPage`, where it exists so the control works with a thumb.
 */
const NextLessonWidget = ({ openQuestions, doneCount, total, onAdd, onToggle, isDarkMode, isLoading }) => {
  const { t } = useTranslation();

  return (
    <PersonalWidgetCard
      widgetId="plan"
      isDarkMode={isDarkMode}
      isLoading={isLoading}
      count={total > 0 ? String(openQuestions.length) : undefined}
      expandTo="/dashboard/personal/plan"
    >
      <div className="flex flex-col gap-3">
        <QuickAddForm
          fields={FIELDS}
          onAdd={onAdd}
          isDarkMode={isDarkMode}
          compact
        />

        {openQuestions.length === 0 ? (
          <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {t("personal.plan_empty")}
          </p>
        ) : (
          // Capped by height and scrolled, so one very long question cannot
          // push the rest of the page down.
          <ul className="flex flex-col gap-2 max-h-52 sm:max-h-64 overflow-y-auto overscroll-contain scrollbar-hidden">
            {openQuestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onToggle(item.id, { done: true })}
                  aria-pressed={false}
                  className="w-full flex items-start gap-3 text-left py-1.5"
                >
                  <span
                    className={`shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-lg border-4 ${
                      isDarkMode ? "border-slate-600" : "border-slate-400"
                    }`}
                    aria-hidden="true"
                  >
                    <Check size={13} strokeWidth={4} className="opacity-0" />
                  </span>
                  <span
                    className={`font-bold leading-relaxed break-words min-w-0 ${
                      isDarkMode ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {item.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {doneCount > 0 && (
          <p className={`text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
            {t("personal.dash_questions_done", { n: doneCount })}
          </p>
        )}
      </div>
    </PersonalWidgetCard>
  );
};

NextLessonWidget.propTypes = {
  openQuestions: PropTypes.array.isRequired,
  doneCount: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  onAdd: PropTypes.func.isRequired,
  /** usePersonalCollection's `update` — passed straight through, never wrapped. */
  onToggle: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
};

export default NextLessonWidget;
