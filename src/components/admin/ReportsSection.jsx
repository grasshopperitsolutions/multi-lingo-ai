import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Flag, Mail, MailOpen, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import Loader from "../Loader";
import { GhostButton } from "../ui";

/**
 * Reports filed from the in-app Report button, stored at
 * `appConfig/config/reports`.
 *
 * Admin copy is hardcoded English on purpose — the admin panel is exempt from
 * the translation pipeline, and running these strings through the AI fill
 * would add noise to every locale document.
 */

const CATEGORY_TONES = {
  "Bug / Error": "bg-rose-500",
  "Wrong translation": "bg-amber-500",
  "Inappropriate content": "bg-purple-500",
  "Missing word / language": "bg-blue-500",
  Other: "bg-slate-500",
};

/** ISO string -> a readable local timestamp; falls back to the raw value. */
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

const ReportsSection = ({
  reports, isDarkMode, isLoadingDocs, error, onToggleRead, onDelete, busyId,
}) => {
  const [expandedId, setExpandedId] = useState(null);
  const [showRead, setShowRead] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const unreadCount = useMemo(
    () => reports.filter((r) => !r.read).length,
    [reports]
  );

  // Unread first, then newest — the list is a work queue, not an archive.
  const visible = useMemo(() => {
    const filtered = showRead ? reports : reports.filter((r) => !r.read);
    return [...filtered].sort((a, b) => {
      if (!!a.read !== !!b.read) return a.read ? 1 : -1;
      return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    });
  }, [reports, showRead]);

  if (isLoadingDocs) return <Loader message="Loading reports..." isDarkMode={isDarkMode} />;

  if (error) {
    return (
      <p className={`font-bold text-sm ${isDarkMode ? "text-rose-300" : "text-rose-600"}`}>
        {error}
      </p>
    );
  }

  const cardClasses = (isUnread) =>
    `rounded-2xl border-4 overflow-hidden transition-all ${
      isDarkMode
        ? isUnread ? "bg-slate-900 border-yellow-500" : "bg-slate-800 border-slate-700"
        : isUnread ? "bg-white border-yellow-500" : "bg-slate-50 border-slate-300"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          {unreadCount} unread
          <span className={`ml-2 font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            of {reports.length} total
          </span>
        </p>
        <GhostButton onClick={() => setShowRead((v) => !v)} isDarkMode={isDarkMode} className="!px-4 !py-2 !text-xs">
          {showRead ? "Hide read" : "Show read"}
        </GhostButton>
      </div>

      {visible.length === 0 && (
        <p className={`py-8 text-center font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {reports.length === 0 ? "No reports yet." : "Nothing unread. Nice."}
        </p>
      )}

      {visible.map((report) => {
        const isUnread = !report.read;
        const isExpanded = expandedId === report.id;
        const isBusy = busyId === report.id;

        return (
          <div key={report.id} className={cardClasses(isUnread)}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : report.id)}
              className="w-full p-4 flex items-start gap-3 text-left"
            >
              <span
                className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                  isUnread ? CATEGORY_TONES[report.category] ?? "bg-slate-500" : "bg-transparent border-2 border-slate-500"
                }`}
                aria-hidden="true"
              />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className={`font-black text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {report.category || "Uncategorized"}
                  </span>
                  {isUnread && (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-400 text-slate-900 text-[10px] font-black uppercase tracking-widest">
                      New
                    </span>
                  )}
                </span>
                <span className={`block text-sm font-bold truncate ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  {report.message}
                </span>
                <span className={`block text-xs font-bold mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  {formatDate(report.createdAt)}
                  {report.context ? ` · ${report.context}` : ""}
                  {report.reporterEmail ? ` · ${report.reporterEmail}` : " · anonymous"}
                </span>
              </span>
              {isExpanded ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
            </button>

            {isExpanded && (
              <div className={`px-4 pb-4 border-t-2 ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
                <p className={`mt-4 mb-4 text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {report.message}
                </p>

                <dl className={`mb-4 text-xs font-bold space-y-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  <div><dt className="inline">Reporter: </dt><dd className="inline">{report.reporterName || "—"} ({report.reporterEmail || "anonymous"})</dd></div>
                  <div><dt className="inline">UID: </dt><dd className="inline font-mono">{report.reporterUid || "—"}</dd></div>
                  <div><dt className="inline">Context: </dt><dd className="inline">{report.context || "—"}</dd></div>
                  <div><dt className="inline">Report ID: </dt><dd className="inline font-mono">{report.id}</dd></div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <GhostButton
                    onClick={() => onToggleRead(report.id, !report.read)}
                    disabled={isBusy}
                    isDarkMode={isDarkMode}
                    className="!px-4 !py-2 !text-xs"
                  >
                    {isBusy ? <Loader2 size={14} className="animate-spin" />
                      : report.read ? <Mail size={14} /> : <MailOpen size={14} />}
                    {report.read ? "Mark unread" : "Mark read"}
                  </GhostButton>

                  {confirmDeleteId === report.id ? (
                    <>
                      <button
                        onClick={() => { onDelete(report.id); setConfirmDeleteId(null); }}
                        disabled={isBusy}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border-4 border-rose-600 bg-rose-600 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> Confirm delete
                      </button>
                      <GhostButton onClick={() => setConfirmDeleteId(null)} isDarkMode={isDarkMode} className="!px-4 !py-2 !text-xs">
                        Cancel
                      </GhostButton>
                    </>
                  ) : (
                    <GhostButton
                      onClick={() => setConfirmDeleteId(report.id)}
                      disabled={isBusy}
                      isDarkMode={isDarkMode}
                      className="!px-4 !py-2 !text-xs !border-rose-500 !text-rose-500"
                    >
                      <Trash2 size={14} /> Delete
                    </GhostButton>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {reports.length > 0 && (
        <p className={`pt-2 text-xs font-bold flex items-center gap-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          <Flag size={12} />
          A nightly cron emails you the unread count when there is one.
        </p>
      )}
    </div>
  );
};

ReportsSection.propTypes = {
  reports: PropTypes.array.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool,
  error: PropTypes.string,
  onToggleRead: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  busyId: PropTypes.string,
};

export default ReportsSection;
