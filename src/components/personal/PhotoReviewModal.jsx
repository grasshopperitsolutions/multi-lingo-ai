import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Trash2, X } from "lucide-react";
import { PROPOSAL_KINDS } from "../../services/photoCaptureService";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { personalInputClasses } from "./fieldStyles";
import { AiNotice } from "../ui";

/**
 * PhotoReviewModal
 *
 * What the AI read from the photo, where each piece would go, and the chance
 * to change or drop any of it before a single thing is written.
 *
 * **This screen is the feature, not a confirmation step.** A model reading
 * handwriting gets some of it wrong, and these destinations are the student's
 * own notes and their own list of mistakes — the places where a wrong entry is
 * most annoying to find later. So nothing is written until someone presses the
 * button here, every row is editable in place, and dropping a row is one tap.
 *
 * Grouped by destination rather than listed flat, because the question being
 * answered is "what is about to happen to my dashboard?" — and that is a
 * question about places, not about rows. The count in each heading is what
 * makes it answerable at a glance.
 *
 * Kept rows are returned in one array; the caller does the writing, because it
 * is the caller that holds the collection hooks.
 */

/** Which fields each kind shows, in the order they are edited. */
const FIELDS = {
  [PROPOSAL_KINDS.NOTE]: [{ name: "text", labelKey: "personal.photo_field_note", rows: 4 }],
  [PROPOSAL_KINDS.QUESTION]: [{ name: "text", labelKey: "personal.photo_field_question" }],
  [PROPOSAL_KINDS.MISTAKE]: [
    { name: "said", labelKey: "personal.mistakes_field_said" },
    { name: "correction", labelKey: "personal.mistakes_field_correction" },
    { name: "why", labelKey: "personal.mistakes_field_why" },
  ],
  [PROPOSAL_KINDS.PHRASE]: [
    { name: "phrase", labelKey: "personal.phrasebook_field_phrase" },
    { name: "translation", labelKey: "personal.phrasebook_field_translation" },
    { name: "note", labelKey: "personal.phrasebook_field_note" },
  ],
  [PROPOSAL_KINDS.WORD]: [{ name: "word", labelKey: "personal.photo_field_word" }],
};

/** Section order and heading, so the screen reads the way the dashboard does. */
const SECTIONS = [
  { kind: PROPOSAL_KINDS.NOTE, titleKey: "personal.notes_title" },
  { kind: PROPOSAL_KINDS.QUESTION, titleKey: "personal.plan_title" },
  { kind: PROPOSAL_KINDS.MISTAKE, titleKey: "personal.mistakes_title" },
  { kind: PROPOSAL_KINDS.PHRASE, titleKey: "personal.phrasebook_title" },
  { kind: PROPOSAL_KINDS.WORD, titleKey: "personal.dash_words_title" },
];

const PhotoReviewModal = ({ summary = "", proposals, onApply, onClose, isDarkMode }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState(proposals);
  const [isSaving, setIsSaving] = useState(false);

  const kept = rows.filter((row) => row.include);

  const editField = (id, name, value) =>
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, fields: { ...row.fields, [name]: value } } : row
      )
    );

  const drop = (id) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, include: false } : row)));

  const handleApply = async () => {
    if (kept.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      await onApply(kept);
    } finally {
      setIsSaving(false);
    }
  };

  const panelClasses = isDarkMode
    ? "bg-slate-800 border-violet-500"
    : "bg-white border-violet-600";
  const labelClasses = `block text-[11px] font-black uppercase tracking-widest mb-1 ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-review-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isSaving) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSaving ? undefined : onClose}
      />

      <div
        className={`relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2rem] border-4 shadow-[8px_8px_0px_0px_#6d28d9] ${panelClasses}`}
      >
        <div className="p-6 sm:p-8 pb-4 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            aria-label={t("common.close")}
            className={`absolute top-5 right-5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
              isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900"
            }`}
          >
            <X size={20} />
          </button>

          <h2
            id="photo-review-title"
            className={`text-xl font-black uppercase tracking-tight pr-12 ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {t("personal.photo_review_title")}
          </h2>
          {summary && (
            <p
              className={`mt-2 text-sm font-bold break-words ${
                isDarkMode ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {summary}
            </p>
          )}
          <AiNotice isDarkMode={isDarkMode} variant="output" className="mt-3" />
        </div>

        {/* The only scroller: the header and the action bar stay put, so the
            count and the button are never scrolled away from each other. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 sm:px-8 scrollbar-hidden">
          {SECTIONS.map(({ kind, titleKey }) => {
            const section = rows.filter((row) => row.kind === kind && row.include);
            if (section.length === 0) return null;

            return (
              <div key={kind} className="mb-6">
                <h3
                  className={`text-xs font-black uppercase tracking-widest mb-2 ${
                    isDarkMode ? "text-violet-300" : "text-violet-700"
                  }`}
                >
                  {t(titleKey)} · {section.length}
                </h3>

                <div className="flex flex-col gap-3">
                  {section.map((row) => (
                    <div
                      key={row.id}
                      className={`flex items-start gap-2 p-3 rounded-xl ${
                        isDarkMode ? "bg-slate-900" : "bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-2">
                        {FIELDS[kind].map((field) => (
                          <div key={field.name}>
                            <span className={labelClasses}>{t(field.labelKey)}</span>
                            {/* Styled through `className` like every other
                                caller: AutoGrowTextarea spreads unknown props
                                onto the textarea, so an `isDarkMode` here
                                would land on the DOM node as an attribute. */}
                            <AutoGrowTextarea
                              value={row.fields[field.name] ?? ""}
                              onChange={(value) => editField(row.id, field.name, value)}
                              className={personalInputClasses(isDarkMode)}
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => drop(row.id)}
                        aria-label={t("common.remove")}
                        className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
                          isDarkMode
                            ? "text-slate-500 hover:text-rose-400"
                            : "text-slate-400 hover:text-rose-600"
                        }`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {kept.length === 0 && (
            <p
              className={`mb-6 text-sm font-bold ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {t("personal.photo_review_empty")}
            </p>
          )}
        </div>

        <div
          className={`p-6 sm:p-8 pt-4 shrink-0 border-t-4 ${
            isDarkMode ? "border-slate-700" : "border-slate-200"
          }`}
        >
          <button
            type="button"
            onClick={handleApply}
            disabled={kept.length === 0 || isSaving}
            className={`w-full min-h-[44px] flex items-center justify-center gap-3 py-4 rounded-2xl border-4 font-black uppercase tracking-widest transition-all active:scale-95
              ${
                kept.length === 0 || isSaving
                  ? "opacity-40 cursor-not-allowed border-slate-400 text-slate-400"
                  : isDarkMode
                    ? "bg-violet-400 border-slate-900 text-slate-900"
                    : "bg-violet-500 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {t("personal.photo_review_apply", { n: kept.length })}
          </button>
        </div>
      </div>
    </div>
  );
};

PhotoReviewModal.propTypes = {
  summary: PropTypes.string,
  proposals: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      kind: PropTypes.string.isRequired,
      fields: PropTypes.object.isRequired,
      include: PropTypes.bool,
    })
  ).isRequired,
  onApply: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default PhotoReviewModal;
