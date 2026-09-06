import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { AlertTriangle, Check, Loader2, RotateCcw, Save } from "lucide-react";
import { auth } from "../../firebase";
import { BASE_LOCALE } from "../../i18n";
import {
  TEMPLATE_GROUPS,
  TEMPLATE_VARIABLES,
  loadEmailTemplates,
  saveEmailTemplates,
} from "../../services/emailTemplateService";

/**
 * Editor for the transactional email copy.
 *
 * Edits the `email.*` keys of the pt-PT locale document — the same keys the
 * API reads through lib/email-copy.ts — rather than a separate template
 * store, so the copy stays inside the translation pipeline instead of
 * becoming a second source of truth that only exists in one language.
 *
 * Admin-only copy is intentionally hardcoded English, matching the rest of
 * the admin panel.
 */

/** A body is long-form; everything else fits on one line. */
const isMultiline = (key) => key.endsWith(".body") || key.endsWith("_tagline");

/** "email.welcome.subject" -> "Subject" */
const fieldLabel = (key) => {
  const last = key.split(".").pop();
  return last.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

const EmailTemplatesSection = ({ isDarkMode }) => {
  const [original, setOriginal] = useState(null);
  const [values, setValues] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const loaded = await loadEmailTemplates(token);
        setOriginal(loaded);
        setValues(loaded);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const dirtyKeys = original
    ? Object.keys(values).filter((k) => values[k] !== original[k])
    : [];

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const result = await saveEmailTemplates(values, original, token);
      setOriginal({ ...values });
      setSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    setValues({ ...original });
    setSaved(null);
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold outline-none transition-all
    ${isDarkMode
      ? "bg-slate-900 border-slate-700 text-white focus:border-yellow-400 placeholder-slate-500"
      : "bg-white border-slate-300 text-slate-900 focus:border-blue-600 placeholder-slate-400"}`;

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2
    ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8">
        <Loader2 size={20} className="animate-spin" />
        <span className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          Loading templates…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={`p-4 rounded-xl border-4 ${
          isDarkMode ? "bg-slate-900 border-slate-700" : "bg-blue-50 border-blue-600"
        }`}
      >
        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
          These are the <code className="font-mono text-xs">email.*</code> keys of the{" "}
          <strong>{BASE_LOCALE}</strong> locale — the same copy the API sends. Editing here
          changes Portuguese immediately.
        </p>
        <p className={`mt-2 text-sm font-bold ${isDarkMode ? "text-amber-300" : "text-amber-700"}`}>
          Other languages keep their current wording until you run a force resync in the
          Locales section. A resync re-translates from {BASE_LOCALE} and overwrites any
          hand-tuned per-language edits.
        </p>
      </div>

      {TEMPLATE_GROUPS.map((group) => (
        <div
          key={group.id}
          className={`p-5 rounded-2xl border-4 ${
            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-300"
          }`}
        >
          <h3
            className={`text-sm font-black uppercase tracking-widest ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {group.label}
          </h3>
          <p className={`mt-1 mb-4 text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {group.hint}
          </p>

          <div className="space-y-4">
            {group.keys.map((key) => {
              const vars = TEMPLATE_VARIABLES[key];
              const isDirty = original && values[key] !== original[key];
              return (
                <div key={key}>
                  <span className={labelClasses}>
                    {fieldLabel(key)}
                    {isDirty && (
                      <span className={isDarkMode ? "text-yellow-400" : "text-blue-600"}> • edited</span>
                    )}
                  </span>
                  {isMultiline(key) ? (
                    <textarea
                      rows={3}
                      value={values[key] ?? ""}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                      className={inputClasses}
                    />
                  ) : (
                    <input
                      type="text"
                      value={values[key] ?? ""}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                      className={inputClasses}
                    />
                  )}
                  {vars && (
                    <p className={`mt-1 text-xs font-mono ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                      Keep: {vars.map((v) => `{{${v}}}`).join("  ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {error && (
        <div
          className={`p-4 rounded-xl border-4 flex items-start gap-3 ${
            isDarkMode ? "bg-rose-950/40 border-rose-800" : "bg-rose-50 border-rose-600"
          }`}
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" />
          <p className="text-sm font-bold text-rose-500">{error}</p>
        </div>
      )}

      {saved && (
        <div
          className={`p-4 rounded-xl border-4 ${
            isDarkMode ? "bg-emerald-950/40 border-emerald-800" : "bg-emerald-50 border-emerald-600"
          }`}
        >
          <p className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>
            {saved.changed === 0
              ? "Nothing to save"
              : `Saved ${saved.changed} ${saved.changed === 1 ? "string" : "strings"}`}
          </p>
          {saved.changed > 0 && (
            <p className={`mt-2 text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              Run a force resync in Locales to push this to the other languages.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || dirtyKeys.length === 0}
          className={`inline-flex items-center gap-3 px-6 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95
            ${dirtyKeys.length === 0 || isSaving
              ? "opacity-40 cursor-not-allowed border-slate-400 text-slate-400"
              : isDarkMode
                ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[4px_4px_0px_0px_#854d0e]"
                : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {dirtyKeys.length === 0
            ? "No changes"
            : `Save ${dirtyKeys.length} ${dirtyKeys.length === 1 ? "change" : "changes"}`}
        </button>

        {dirtyKeys.length > 0 && (
          <button
            type="button"
            onClick={handleRevert}
            disabled={isSaving}
            className={`inline-flex items-center gap-3 px-6 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95
              ${isDarkMode
                ? "bg-slate-700 border-slate-600 text-slate-200"
                : "bg-white border-slate-900 text-slate-900"}`}
          >
            <RotateCcw size={18} />
            Revert
          </button>
        )}

        {saved && saved.changed > 0 && dirtyKeys.length === 0 && (
          <span className={`inline-flex items-center gap-2 px-4 font-bold text-sm ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
            <Check size={18} /> Up to date
          </span>
        )}
      </div>
    </div>
  );
};

EmailTemplatesSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default EmailTemplatesSection;
