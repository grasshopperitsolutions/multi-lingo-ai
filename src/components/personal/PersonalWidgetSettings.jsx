import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Check } from "lucide-react";
import { useHiddenWidgets } from "../../hooks/useHiddenWidgets";
import { PERSONAL_WIDGETS } from "../../config/personalWidgets";
import { SettingsSection } from "../ui";

/**
 * PersonalWidgetSettings
 *
 * Which widgets appear on the personal dashboard.
 *
 * It lives in Settings rather than on the dashboard itself because a row of
 * "hide me" controls on nine cards is nine controls you have to look past
 * every day to use the one you came for. Choosing your layout is a thing you
 * do once; the dashboard is a thing you use daily.
 *
 * Reads and writes `hiddenPersonalWidgets` on the profile, which is already in
 * context — so this section costs no request to render, and the dashboard
 * picks a change up on the next visit without a refetch.
 *
 * The switch reads as "shown", not "hidden", even though the stored value is
 * the hidden list. A checked box meaning "off" is the kind of thing people
 * get wrong every single time.
 */
const PersonalWidgetSettings = ({ isDarkMode, defaultOpen = false }) => {
  const { t } = useTranslation();
  const { isHidden, toggle } = useHiddenWidgets();

  const shownCount = PERSONAL_WIDGETS.filter((w) => !isHidden(w.id)).length;

  return (
    <SettingsSection
      title={t("personal.widgets_settings_title")}
      icon={<LayoutGrid size={16} className="inline mr-2" />}
      isDarkMode={isDarkMode}
      defaultOpen={defaultOpen}
      id="personalWidgets"
    >
      <p className={`text-sm font-bold mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {t("personal.widgets_settings_intro")}
      </p>

      <div className="flex flex-col gap-2">
        {PERSONAL_WIDGETS.map((widget) => {
          const isOn = !isHidden(widget.id);

          return (
            <div
              key={widget.id}
              className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl ${
                isDarkMode ? "bg-slate-900" : "bg-slate-50"
              }`}
            >
              {/* The name alone does not tell you what "Lembras-te?" or
                  "A tua prática" actually puts on the page, and deciding
                  whether to switch something off is exactly when you need to
                  know. `min-w-0` so a long description wraps rather than
                  pushing the switch off the row. */}
              <div className="min-w-0 flex-1">
                <span
                  className={`block font-bold ${
                    isOn
                      ? isDarkMode ? "text-white" : "text-slate-900"
                      : isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {t(widget.titleKey)}
                </span>
                <span
                  className={`block text-sm font-semibold break-words ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  } ${isOn ? "" : "opacity-60"}`}
                >
                  {t(widget.descKey)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => toggle(widget.id)}
                aria-pressed={isOn}
                aria-label={t(widget.titleKey)}
                className={`shrink-0 w-11 h-11 rounded-xl border-4 flex items-center justify-center transition-all active:scale-90 ${
                  isOn
                    ? isDarkMode
                      ? "bg-yellow-400 border-slate-900 text-slate-900"
                      : "bg-blue-600 border-slate-900 text-white"
                    : isDarkMode
                      ? "bg-slate-700 border-slate-600 text-slate-500"
                      : "bg-white border-slate-300 text-slate-300"
                }`}
              >
                {isOn ? <Check size={20} strokeWidth={4} /> : null}
              </button>
            </div>
          );
        })}
      </div>

      {shownCount === 0 && (
        <p className={`mt-4 text-sm font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
          {t("personal.widgets_settings_none")}
        </p>
      )}
    </SettingsSection>
  );
};

PersonalWidgetSettings.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  defaultOpen: PropTypes.bool,
};

export default PersonalWidgetSettings;
