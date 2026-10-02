import PropTypes from "prop-types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { localToday, shiftDate } from "../../utils/practiceDays";

/**
 * DatePicker
 *
 * A calendar in the app's own style, replacing `<input type="date">`, whose
 * native picker looks different on every browser and ignores the theme.
 *
 * The value is a `YYYY-MM-DD` string, exactly what the native input produced,
 * so nothing that stores or reads one changes. Weeks start on Monday, and
 * month and weekday names come from `Intl` in the reader's language, so no
 * month list lives in the translation files.
 *
 * ## It renders in a portal
 *
 * The personal widgets are scroll containers, and an `overflow` ancestor clips
 * an absolutely positioned popover. The calendar is mounted on `document.body`
 * and positioned from the trigger's rectangle, flipped above it when there is
 * no room below and clamped inside the viewport, so it also works on a phone.
 * It closes when the page scrolls under it, rather than drifting away from its
 * button.
 *
 * ## Keyboard
 *
 * The grid is a roving tab stop: Tab enters on the selected day (or today),
 * arrows move by a day or a week, PageUp/PageDown by a month, Home/End to the
 * start and end of the week, Escape closes and returns focus to the button.
 */

const POPOVER_WIDTH = 288; // 18rem
const GAP = 8;
const MARGIN = 8;

const parse = (date) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** `date` moved by whole months, keeping the day when the month is long enough. */
const shiftMonth = (date, months) => {
  const d = parse(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const length = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, length));
  return localToday(d);
};

const DatePicker = ({
  id,
  value,
  onChange,
  min,
  max,
  className = "",
  isDarkMode,
  placeholder,
  ariaLabel,
  clearable = true,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const wantsFocusRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [focusDate, setFocusDate] = useState(() => localToday());
  const [position, setPosition] = useState(null);

  const today = localToday();
  const selected = isDate(value) ? value : null;

  const inRange = useCallback(
    (date) => (!min || date >= min) && (!max || date <= max),
    [min, max],
  );

  const format = useCallback(
    (date, options) => {
      try {
        return parse(date).toLocaleDateString(locale, options);
      } catch {
        return date;
      }
    },
    [locale],
  );

  const weekdays = useMemo(
    // 2024-01-01 is a Monday.
    () => Array.from({ length: 7 }, (_, i) => format(`2024-01-0${i + 1}`, { weekday: "narrow" })),
    [format],
  );

  const openCalendar = () => {
    const start = selected ?? (inRange(today) ? today : (max && today > max ? max : min ?? today));
    setFocusDate(start);
    wantsFocusRef.current = true;
    setOpen(true);
  };

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - MARGIN * 2);
    const height = popover?.offsetHeight ?? 340;

    const left = Math.min(Math.max(MARGIN, rect.left), window.innerWidth - width - MARGIN);
    const below = rect.bottom + GAP;
    const fitsBelow = below + height <= window.innerHeight - MARGIN;
    const above = rect.top - GAP - height;
    // Below by default; above only if that fits better; otherwise pinned to
    // the bottom edge so it is never cut off.
    const top = fitsBelow
      ? below
      : above >= MARGIN
        ? above
        : Math.max(MARGIN, window.innerHeight - height - MARGIN);

    setPosition({ top, left, width });
  }, []);

  // Measured after the popover mounts, so its real height decides above/below.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, focusDate]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (popoverRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close(false);
    };
    const onScroll = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      close(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, close, place]);

  // Move real focus to the roving day after the render that changed it, but
  // only when the change came from the keyboard or from opening.
  useEffect(() => {
    if (!open || !wantsFocusRef.current) return;
    popoverRef.current?.querySelector(`[data-date="${focusDate}"]`)?.focus({ preventScroll: true });
    wantsFocusRef.current = false;
  }, [open, focusDate, position]);

  const pick = (date) => {
    if (!inRange(date)) return;
    onChange(date);
    close(true);
  };

  const moveFocus = (date) => {
    wantsFocusRef.current = true;
    setFocusDate(date);
  };

  const onGridKeyDown = (e) => {
    const steps = {
      ArrowLeft: () => shiftDate(focusDate, -1),
      ArrowRight: () => shiftDate(focusDate, 1),
      ArrowUp: () => shiftDate(focusDate, -7),
      ArrowDown: () => shiftDate(focusDate, 7),
      PageUp: () => shiftMonth(focusDate, -1),
      PageDown: () => shiftMonth(focusDate, 1),
      Home: () => shiftDate(focusDate, -((parse(focusDate).getDay() + 6) % 7)),
      End: () => shiftDate(focusDate, 6 - ((parse(focusDate).getDay() + 6) % 7)),
    };
    const next = steps[e.key]?.();
    if (!next) return;
    e.preventDefault();
    moveFocus(next);
  };

  // The month being shown follows the focused day.
  const view = parse(focusDate);
  const monthStart = `${focusDate.slice(0, 8)}01`;
  const length = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lead = (parse(monthStart).getDay() + 6) % 7;
  const monthLabel = format(monthStart, { month: "long", year: "numeric" });

  const label = selected
    ? format(selected, { day: "numeric", month: "long", year: "numeric" })
    : placeholder ?? t("common.date_pick");

  const surface = isDarkMode
    ? "bg-slate-800 border-slate-600 shadow-[6px_6px_0px_0px_#020617] text-white"
    : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] text-slate-900";
  const navButton = `min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors ${
    isDarkMode ? "hover:bg-slate-700" : "hover:bg-slate-100"
  }`;
  const footerButton = `min-h-[44px] px-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
    isDarkMode ? "hover:bg-slate-700" : "hover:bg-slate-100"
  }`;

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : openCalendar())}
        className={`${className} flex items-center justify-between gap-2 text-left ${selected ? "" : "opacity-70"}`}
      >
        <span className="min-w-0 truncate">{label}</span>
        <CalendarDays size={16} strokeWidth={3} className="shrink-0" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t("common.date_pick")}
            style={{
              position: "fixed",
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width: position?.width ?? POPOVER_WIDTH,
              // Hidden until measured, so it never flashes in the wrong place.
              visibility: position ? "visible" : "hidden",
              zIndex: 1000,
            }}
            className={`rounded-2xl border-4 p-2 ${surface}`}
          >
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label={t("common.date_prev_month")}
                className={navButton}
                onClick={() => setFocusDate(shiftMonth(focusDate, -1))}
              >
                <ChevronLeft size={18} strokeWidth={3} />
              </button>
              <span aria-live="polite" className="text-sm font-black capitalize text-center">
                {monthLabel}
              </span>
              <button
                type="button"
                aria-label={t("common.date_next_month")}
                className={navButton}
                onClick={() => setFocusDate(shiftMonth(focusDate, 1))}
              >
                <ChevronRight size={18} strokeWidth={3} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center" aria-hidden="true">
              {weekdays.map((day, i) => (
                <span
                  key={i}
                  className={`py-1 text-[10px] font-black uppercase ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
                >
                  {day}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1" role="group" aria-label={monthLabel} onKeyDown={onGridKeyDown}>
              {Array.from({ length: lead }, (_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length }, (_, i) => {
                const date = `${monthStart.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
                const isSelected = date === selected;
                const isToday = date === today;
                const disabled = !inRange(date);

                const tone = isSelected
                  ? isDarkMode ? "bg-violet-400 text-slate-900" : "bg-violet-500 text-white"
                  : disabled
                    ? isDarkMode ? "text-slate-600" : "text-slate-300"
                    : isDarkMode ? "hover:bg-slate-700" : "hover:bg-slate-100";

                return (
                  <button
                    key={date}
                    type="button"
                    data-date={date}
                    disabled={disabled}
                    tabIndex={date === focusDate ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={format(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    onClick={() => pick(date)}
                    className={`mx-auto w-10 h-10 rounded-full text-sm font-black tabular-nums transition-colors ${tone} ${
                      isToday && !isSelected ? (isDarkMode ? "ring-2 ring-white" : "ring-2 ring-slate-900") : ""
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-1">
              <button
                type="button"
                className={footerButton}
                disabled={!inRange(today)}
                onClick={() => pick(today)}
              >
                {t("common.date_today")}
              </button>
              {clearable && selected && (
                <button
                  type="button"
                  className={footerButton}
                  onClick={() => {
                    onChange("");
                    close(true);
                  }}
                >
                  {t("common.date_clear")}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

DatePicker.propTypes = {
  id: PropTypes.string,
  /** `YYYY-MM-DD`, or "" for none. */
  value: PropTypes.string,
  /** Called with `YYYY-MM-DD`, or "" when cleared. */
  onChange: PropTypes.func.isRequired,
  min: PropTypes.string,
  max: PropTypes.string,
  /** Classes for the button that opens the calendar. */
  className: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
  placeholder: PropTypes.string,
  ariaLabel: PropTypes.string,
  clearable: PropTypes.bool,
};

export default DatePicker;
