import { useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown } from "lucide-react";

/**
 * SettingsSection.jsx
 *
 * One collapsible card on the Settings page.
 *
 * Separate from CollapsibleCard, which caps its body at 600px and scrolls
 * inside itself. That is right for a sidebar panel and wrong here: a settings
 * card is a form somebody is filling in, and a scroll region nested inside a
 * page that already scrolls loses the field you were typing in. This one grows
 * to fit its content.
 *
 * Open state is per-card and lives in the component. It is deliberately not
 * persisted: which card you opened last is not worth a profile write, and
 * remembering it across devices would mean a phone reopening what a desktop
 * left open, which is the opposite of what `defaultOpen` is trying to do.
 */
const SettingsSection = ({
  title,
  icon = null,
  isDarkMode,
  defaultOpen = false,
  id = undefined,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Deliberately NOT overflow-hidden. A dropdown inside a card opens as an
  // absolutely-positioned panel, and an ancestor's overflow clips it no matter
  // what z-index it carries — the language pickers lost their bottom rows
  // inside the card. Nothing here needs clipping: the body is unmounted when
  // closed rather than collapsed behind max-height, so the only thing that
  // could bleed past the rounded corner is the header's hover background,
  // which is rounded to match instead (2rem shell minus the 4px border).
  const shellClasses = `rounded-[2rem] border-4 mb-6 transition-colors
    ${isDarkMode
      ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
      : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"}`;

  return (
    <div id={id} className={shellClasses}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-3 px-6 sm:px-8 py-5 text-left transition-colors
          rounded-t-[1.75rem] ${isOpen ? "" : "rounded-b-[1.75rem]"}
          ${isDarkMode ? "hover:bg-slate-700/40" : "hover:bg-slate-50"}`}
      >
        <span
          className={`text-lg font-black uppercase tracking-widest ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {icon}
          {title}
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""} ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}
        />
      </button>

      {/*
        Unmounted rather than hidden when closed. A settings card holds live
        inputs, and keeping them mounted behind `max-h-0` leaves focusable
        fields in the tab order that nobody can see — and on a phone, where
        every card starts closed, that is the whole form.
      */}
      {isOpen && (
        <div
          className={`px-6 sm:px-8 pb-8 pt-2 border-t-2 ${
            isDarkMode ? "border-slate-700" : "border-slate-200"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

SettingsSection.propTypes = {
  title: PropTypes.string.isRequired,
  /** Rendered inline before the title, e.g. <BookOpen size={16} ... />. */
  icon: PropTypes.node,
  isDarkMode: PropTypes.bool.isRequired,
  defaultOpen: PropTypes.bool,
  /** Optional id on the wrapper, so a link elsewhere (e.g. Settings#foo) can
   *  scroll straight to this card. */
  id: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default SettingsSection;
