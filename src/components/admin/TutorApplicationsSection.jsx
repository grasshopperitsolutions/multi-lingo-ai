import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { AtSign, ExternalLink, Loader2, Mail, MailOpen, Trash2, UserRound } from "lucide-react";
import Loader from "../Loader";

/**
 * Applications to be listed in the tutor directory, stored at
 * `appConfig/config/tutorApplications`.
 *
 * There is no Approve button on purpose. Approval means granting the applicant
 * the `vip` tier in the Users section, which is what the server-side tier gate
 * on the `tutors` collection actually checks — an `approved` flag here would be
 * a second source of truth that could disagree with the tier and silently
 * decide nothing.
 *
 * Admin copy is hardcoded English, matching the rest of the admin panel.
 */

/** ISO string -> a readable local timestamp; falls back to the raw value. */
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

const TutorApplicationsSection = ({
  applications = [], isDarkMode, isLoadingDocs, error, onToggleRead, onDelete, busyId,
}) => {
  const [showRead, setShowRead] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const unreadCount = useMemo(
    () => applications.filter((a) => !a.read).length,
    [applications],
  );

  // Unread first, then newest — this is a work queue, not an archive.
  const visible = useMemo(() => {
    const filtered = showRead ? applications : applications.filter((a) => !a.read);
    return [...filtered].sort((a, b) => {
      if (!!a.read !== !!b.read) return a.read ? 1 : -1;
      return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    });
  }, [applications, showRead]);

  if (isLoadingDocs) return <Loader message="Loading applications..." isDarkMode={isDarkMode} />;

  if (error) {
    return (
      <p className={`font-bold text-sm ${isDarkMode ? "text-rose-300" : "text-rose-600"}`}>
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
          {unreadCount} unread. To approve, set the applicant to the <strong>vip</strong> tier in
          the Users section — that is what unlocks publishing.
        </p>
        <button
          type="button"
          onClick={() => setShowRead(!showRead)}
          className={`px-4 py-2 rounded-full border-2 text-xs font-black uppercase tracking-widest
            ${isDarkMode ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}
        >
          {showRead ? "Hide read" : "Show read"}
        </button>
      </div>

      {visible.length === 0 && (
        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          Nothing to review.
        </p>
      )}

      {visible.map((application) => (
        <div
          key={application.id}
          className={`p-5 rounded-2xl border-4 ${
            isDarkMode
              ? application.read ? "bg-slate-900/40 border-slate-800" : "bg-slate-800 border-slate-700"
              : application.read ? "bg-slate-50 border-slate-200" : "bg-white border-slate-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className={`font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                <UserRound size={14} className="inline mr-2" />
                {application.applicantName || application.applicantEmail || application.applicantUid}
              </p>
              <p className={`text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {application.applicantEmail} · {formatDate(application.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleRead(application.id, !application.read)}
                disabled={busyId === application.id}
                className={`p-2 rounded-xl border-2 ${isDarkMode ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}
                title={application.read ? "Mark unread" : "Mark read"}
              >
                {busyId === application.id
                  ? <Loader2 size={16} className="animate-spin" />
                  : application.read ? <MailOpen size={16} /> : <Mail size={16} />}
              </button>

              {confirmDeleteId === application.id ? (
                <button
                  type="button"
                  onClick={() => { onDelete(application.id); setConfirmDeleteId(null); }}
                  className="px-3 py-2 rounded-xl border-2 border-rose-600 text-rose-600 text-xs font-black uppercase"
                >
                  Confirm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(application.id)}
                  className={`p-2 rounded-xl border-2 ${isDarkMode ? "border-slate-600 text-rose-400" : "border-slate-300 text-rose-600"}`}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {application.instagram && (
              <p className={`text-sm font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                <AtSign size={14} className="inline mr-2" />
                {application.instagram}
              </p>
            )}
            {application.postUrl && (
              <a
                href={application.postUrl}
                target="_blank"
                // An admin clicking a URL a stranger submitted: same
                // precautions as any other user-supplied link.
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 text-sm font-bold underline decoration-2 underline-offset-2 break-all
                  ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}
              >
                <ExternalLink size={14} className="shrink-0" />
                {application.postUrl}
              </a>
            )}
            {application.message && (
              <p className={`text-sm font-bold whitespace-pre-line ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                {application.message}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

TutorApplicationsSection.propTypes = {
  applications: PropTypes.array,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool,
  error: PropTypes.string,
  onToggleRead: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  busyId: PropTypes.string,
};

export default TutorApplicationsSection;
