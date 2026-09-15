import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { usePersonalNoteBoard } from "../../../hooks/usePersonalNoteBoard";
import { NOTE_BOARD_MAX_CHARS } from "../../../services/personalService";
import Loader from "../../../components/Loader";
import { FeaturePageShell } from "../../../components/ui";

/** Show the character count only once it is close enough to matter. */
const COUNTER_THRESHOLD = Math.round(NOTE_BOARD_MAX_CHARS * 0.9);

/**
 * PersonalNotesPage
 *
 * One board, not a list of notes.
 *
 * A note board is somewhere you keep adding to — a page you scribble on
 * during a lesson and scroll back through afterwards. Making it a list would
 * mean naming and filing every stray thought before writing it down, which is
 * exactly the friction that sends people to their phone's notes app instead.
 * So: no titles, no rows, no delete. One field, and it saves itself.
 *
 * The text area is the page rather than something sitting on it, which is why
 * there is no Card around it: a bordered box inside a bordered box reads as
 * two objects when this one is meant to read as a surface.
 */
const PersonalNotesPage = () => {
  const { isDarkMode } = useAppContext();
  const { canAccess, isReady } = useTierAccess();
  const { text, setText, isLoading, status } = usePersonalNoteBoard();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isReady && !canAccess("personal_tools")) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const STATUS_LINE = {
    unsaved: { icon: null, label: t("personal.notes_unsaved") },
    saving: { icon: Loader2, label: t("personal.notes_saving"), spin: true },
    saved: { icon: Check, label: t("personal.notes_saved") },
    error: { icon: CloudOff, label: t("personal.notes_save_failed"), isError: true },
  };
  const line = STATUS_LINE[status];
  const Icon = line?.icon;


  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="violet"
      title={t("personal.notes_title")}
      reportContext="PersonalNotesPage"
      showFavourite={false}
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("dashboard.personal_tools"), onClick: () => navigate("/dashboard/personal") },
        { label: t("personal.notes_title") },
      ]}
    >
      {isLoading ? (
        <Loader message={t("common.loading")} isDarkMode={isDarkMode} />
      ) : (
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="note-board">
            {t("personal.notes_title")}
          </label>
          <textarea
            id="note-board"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("personal.notes_placeholder")}
            maxLength={NOTE_BOARD_MAX_CHARS}
            // No text-sm anywhere near an input: under 16px, iOS Safari zooms
            // the viewport on focus and leaves it zoomed.
            className={`w-full min-h-[60vh] px-4 py-4 rounded-xl border-4 font-medium leading-relaxed outline-none resize-y transition-colors ${
              isDarkMode
                ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-violet-400"
                : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-violet-500"
            }`}
          />

          <div className="flex items-center justify-between gap-3 min-h-[1.25rem]">
            {/* The page has no save button, so it has to say where it stands. */}
            <span
              aria-live="polite"
              className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${
                line?.isError
                  ? "text-red-500"
                  : isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {Icon && <Icon size={13} strokeWidth={3} className={line.spin ? "animate-spin" : ""} />}
              {line?.label ?? ""}
            </span>

            {text.length >= COUNTER_THRESHOLD && (
              <span className={`text-xs font-bold tabular-nums ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}>
                {t("personal.notes_counter", { used: text.length, max: NOTE_BOARD_MAX_CHARS })}
              </span>
            )}
          </div>
        </div>
      )}
    </FeaturePageShell>
  );
};

export default PersonalNotesPage;
