import PropTypes from "prop-types";
import { FileText } from "lucide-react";
import {
  TEMPLATE_GROUPS,
  TEMPLATE_VARIABLES,
  loadEmailTemplates,
} from "../../services/emailTemplateService";

/**
 * The transactional email and push-reminder copy, as shipped.
 *
 * **Read-only on purpose.** This used to be an editor writing to a pt-PT
 * locale document in Firestore, which made three copies of the same strings —
 * this bundle, the API's EMAIL_COPY_BASE, and that document. The database
 * copy was the only one no pull request could be gated on, so it was the one
 * free to drift; it has been deleted. Two copies remain, in two repos, and CI
 * fails when they disagree. Changing a template is a code change followed by
 * a deploy, which for these strings is a fair price for never wondering which
 * version is the real one.
 *
 * So this screen answers one question — what does the app actually send? —
 * without anyone opening the repo, and it is the only place the four push
 * reminders are visible at all.
 *
 * Admin-only copy is intentionally hardcoded English, matching the rest of
 * the admin panel.
 */

/** "email.welcome.subject" -> "Subject" */
const fieldLabel = (key) => {
  const last = key.split(".").pop();
  return last.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

const EmailTemplatesSection = ({ isDarkMode }) => {
  // No request and no state: the bundled file is the whole answer.
  const values = loadEmailTemplates();

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2
    ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  const valueClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold whitespace-pre-wrap break-words
    ${isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-300 text-slate-900"}`;

  return (
    <div className="space-y-6">
      <div
        className={`p-4 rounded-xl border-4 ${
          isDarkMode ? "bg-slate-900 border-slate-700" : "bg-blue-50 border-blue-600"
        }`}
      >
        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
          The copy the app sends, exactly as deployed — read-only. It lives in{" "}
          <code className="font-mono text-xs">src/locales/pt/translation.json</code> under{" "}
          <code className="font-mono text-xs">email.*</code>, and the API keeps a generated copy
          that CI checks on every push. Changing a template means editing that file and
          deploying both repos.
        </p>
        <p className={`mt-2 text-sm font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
          Other languages are translated from these strings. To push a change out to them, run a
          force resync in the Locales section — which overwrites any hand-tuned per-language
          wording.
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
            <FileText size={16} className="inline mr-2" />
            {group.label}
          </h3>
          <p className={`mt-1 mb-4 text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {group.hint}
          </p>

          <div className="space-y-4">
            {group.keys.map((key) => {
              const vars = TEMPLATE_VARIABLES[key];
              const value = values[key];
              return (
                <div key={key}>
                  <span className={labelClasses}>{fieldLabel(key)}</span>
                  {/* Never truncate: the point of the screen is the exact
                      text that goes out, and a clipped subject line is the
                      half most likely to be wrong. */}
                  <p className={valueClasses}>
                    {value || (
                      <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>
                        (empty — this message has no button)
                      </span>
                    )}
                  </p>
                  {vars && (
                    <p className={`mt-1 text-xs font-mono ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                      Variables: {vars.map((v) => `{{${v}}}`).join("  ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

EmailTemplatesSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default EmailTemplatesSection;
