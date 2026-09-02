import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { AlertTriangle, Loader2, Mail, Monitor, Send } from "lucide-react";
import { auth } from "../../firebase";
import { sendBroadcast } from "../../services/notificationService";

/**
 * Admin notification composer.
 *
 * Sends an announcement over email, web push, or both. Recipients who opted
 * out of announcements are skipped by the backend, not by this UI — the
 * counts returned after a send report exactly how many were reached and how
 * many were skipped.
 *
 * Admin-only copy is intentionally hardcoded English: the admin panel is
 * exempt from the app's translation rules, and running admin strings through
 * the AI-fill pipeline would add noise to every locale document.
 */

/** Matches the tiers in appConfig/config/tiersConfig. */
const TIERS = ["explorer", "voyager", "maestro", "vip", "admin"];

const MAX_SUBJECT = 200;
const MAX_BODY = 10000;

const NotificationsSection = ({ isDarkMode, users = [] }) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState("user");
  const [tier, setTier] = useState("voyager");
  const [targetUid, setTargetUid] = useState("");
  const [channels, setChannels] = useState({ email: true, push: false });
  const [confirmText, setConfirmText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // listAllUserProfiles() returns { uid, ... } — there is no `id` field.
  // Using u.id gave every <option> an undefined value, so React omitted the
  // attribute entirely and the browser fell back to the option's text as its
  // value; the backend then looked up a display name as a document id and
  // 404'd for every user.
  const sortedUsers = useMemo(
    // Sorted in code, not via a Firestore orderBy: a user document missing
    // the sort field would be dropped from the query entirely.
    () => [...users].sort((a, b) =>
      (a.displayName || a.email || a.uid || "").localeCompare(b.displayName || b.email || b.uid || "")
    ),
    [users]
  );

  const needsConfirm = mode === "all";
  const confirmOk = !needsConfirm || confirmText === "ALL";
  const hasChannel = channels.email || channels.push;
  const canSend =
    subject.trim() && body.trim() && hasChannel && confirmOk && !isSending &&
    (mode !== "user" || targetUid);

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    setResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const payload = {
        subject: subject.trim(),
        body: body.trim(),
        mode,
        channels,
        ...(mode === "tier" && { tier }),
        ...(mode === "user" && { uid: targetUid }),
        ...(mode === "all" && { confirm: "ALL" }),
      };
      const stats = await sendBroadcast(token, payload);
      setResult(stats);
      setSubject("");
      setBody("");
      setConfirmText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold outline-none transition-all
    ${isDarkMode
      ? "bg-slate-900 border-slate-700 text-white focus:border-yellow-400 placeholder-slate-500"
      : "bg-white border-slate-300 text-slate-900 focus:border-blue-600 placeholder-slate-400"}`;

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2
    ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  const pill = (active) =>
    `px-4 py-2 rounded-full border-2 font-black uppercase text-xs tracking-widest transition-all active:scale-95
     ${active
       ? isDarkMode
         ? "bg-yellow-400 border-yellow-400 text-slate-900"
         : "bg-yellow-400 border-slate-900 text-slate-900"
       : isDarkMode
         ? "bg-slate-900 border-slate-700 text-slate-300"
         : "bg-white border-slate-300 text-slate-600"}`;

  return (
    <div className="space-y-6">
      <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        Sends an announcement. Users who turned off announcement notifications are skipped
        automatically — the counts below show how many were actually reached.
      </p>

      {/* Audience */}
      <div>
        <span className={labelClasses}>Audience</span>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => setMode("user")} className={pill(mode === "user")}>One user</button>
          <button type="button" onClick={() => setMode("tier")} className={pill(mode === "tier")}>By tier</button>
          <button type="button" onClick={() => setMode("all")} className={pill(mode === "all")}>All users</button>
        </div>

        {mode === "user" && (
          <select value={targetUid} onChange={(e) => setTargetUid(e.target.value)} className={inputClasses}>
            <option value="">Pick a user…</option>
            {sortedUsers.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName || u.email || u.uid}{u.email && u.displayName ? ` — ${u.email}` : ""}
              </option>
            ))}
          </select>
        )}

        {mode === "tier" && (
          <select value={tier} onChange={(e) => setTier(e.target.value)} className={inputClasses}>
            {TIERS.map((tierId) => <option key={tierId} value={tierId}>{tierId}</option>)}
          </select>
        )}
      </div>

      {/* Channels */}
      <div>
        <span className={labelClasses}>Channels</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChannels((c) => ({ ...c, email: !c.email }))}
            className={pill(channels.email)}
          >
            <Mail size={12} className="inline mr-1" /> Email
          </button>
          <button
            type="button"
            onClick={() => setChannels((c) => ({ ...c, push: !c.push }))}
            className={pill(channels.push)}
          >
            <Monitor size={12} className="inline mr-1" /> Web push
          </button>
        </div>
        {!hasChannel && (
          <p className="mt-2 text-xs font-bold text-rose-500">Pick at least one channel.</p>
        )}
      </div>

      {/* Message */}
      <div>
        <label className={labelClasses} htmlFor="broadcast-subject">
          Subject ({subject.length}/{MAX_SUBJECT})
        </label>
        <input
          id="broadcast-subject"
          type="text"
          value={subject}
          maxLength={MAX_SUBJECT}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="New grammar drills are live"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses} htmlFor="broadcast-body">
          Message ({body.length}/{MAX_BODY})
        </label>
        <textarea
          id="broadcast-body"
          rows={6}
          value={body}
          maxLength={MAX_BODY}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Plain text. A blank line starts a new paragraph.\n\nPush notifications show the first 300 characters."}
          className={`${inputClasses} resize-none`}
        />
      </div>

      {/* Blast-radius interlock */}
      {needsConfirm && (
        <div className={`p-4 rounded-xl border-4 ${isDarkMode ? "bg-rose-950/40 border-rose-800" : "bg-rose-50 border-rose-500"}`}>
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-rose-500 mb-2">
            <AlertTriangle size={16} /> This reaches every user
          </p>
          <p className={`text-xs font-bold mb-3 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            Type <code className="font-mono font-black">ALL</code> to confirm. Note the free Resend tier
            allows 100 emails/day — a larger audience will fail partway.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ALL"
            className={inputClasses}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className={`w-full py-4 rounded-2xl border-4 font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all
          ${!canSend ? "opacity-40 cursor-not-allowed" : "active:scale-95"}
          ${isDarkMode
            ? "bg-yellow-400 border-slate-900 text-slate-900"
            : "bg-blue-600 border-slate-900 text-white"}`}
      >
        {isSending ? <><Loader2 size={20} className="animate-spin" /> Sending…</> : <><Send size={20} /> Send notification</>}
      </button>

      {error && (
        <div className={`p-4 rounded-xl border-4 font-bold text-sm ${isDarkMode ? "bg-rose-950/40 border-rose-800 text-rose-300" : "bg-rose-50 border-rose-500 text-rose-700"}`}>
          {error}
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-xl border-4 ${isDarkMode ? "bg-emerald-950/40 border-emerald-800" : "bg-emerald-50 border-emerald-600"}`}>
          <p className={`text-sm font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>
            Sent to {result.total} {result.total === 1 ? "user" : "users"}
          </p>
          <ul className={`text-xs font-bold space-y-1 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            <li>Email — {result.emailSent} delivered, {result.emailSkipped} skipped</li>
            <li>Push — {result.pushSent} delivered, {result.pushSkipped} skipped</li>
          </ul>
        </div>
      )}
    </div>
  );
};

NotificationsSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  users: PropTypes.array,
};

export default NotificationsSection;
