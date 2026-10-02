import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Flag, Loader2, RefreshCw, Ban } from "lucide-react";
import { auth } from "../../firebase";
import { useAppContext } from "../../contexts/AppContext";
import { patchDocument, queryCollection } from "../../services/firestoreService";
import { PICTURES_COLLECTION, clearPictureCache, isOwnPictureUrl, regeneratePicture } from "../../services/getImageService";
import Loader from "../Loader";
import { GhostButton } from "../ui";

/**
 * Admin › Pictures
 *
 * The pictures the games show, and the ones people have flagged. A wrong picture
 * teaches the wrong word to everybody, so this is not optional for long:
 *
 * - **Reported pictures**, largest count first (sorted in code, not by the
 *   query, which would silently drop a document missing the field), each with
 *   "Regenerate" (draws the word again under a new file name, and the old
 *   picture stays on show until the new one is stored) and "Mark as not
 *   drawable" (the games never use the word again).
 * - **Counts** of every status, so a pool that is mostly "skipped" or "declined"
 *   is visible at a glance.
 *
 * Admin-only, so English copy is fine. The documents are written only by the
 * API: "Mark as not drawable" is the one direct write, allowed by the
 * collection's `write: 'admin'` policy.
 */
const FIELDS = ["status", "url", "reports", "sourceWord", "failedReason", "failedAt"];

const PicturesSection = ({ isDarkMode }) => {
  const { showAlert } = useAppContext();
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const result = await queryCollection(PICTURES_COLLECTION, {}, { select: FIELDS, limit: 100000 }, token);
      setDocs(result?.documents ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRegenerate = async (doc) => {
    setBusyId(doc.id);
    try {
      const token = await auth.currentUser.getIdToken();
      const url = await regeneratePicture(doc.id, token);
      if (url) {
        showAlert("success", `Redrew "${doc.sourceWord}".`);
        await load();
      } else {
        showAlert("error", `Could not redraw "${doc.sourceWord}". The old picture is still in place.`);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleNotDrawable = async (doc) => {
    setBusyId(doc.id);
    try {
      const token = await auth.currentUser.getIdToken();
      await patchDocument(PICTURES_COLLECTION, doc.id, { status: "skipped", picturable: false, skippedBy: "admin" }, token);
      clearPictureCache();
      showAlert("success", `"${doc.sourceWord}" will not be used by the games again.`);
      await load();
    } catch (err) {
      showAlert("error", `Could not update: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };


  if (error) return <p className="font-bold text-rose-500">{error}</p>;
  if (!docs) return <Loader message="Loading pictures..." isDarkMode={isDarkMode} />;

  const count = (status) => docs.filter((doc) => doc.status === status).length;
  const reported = docs
    .filter((doc) => doc.status === "ready" && (doc.reports ?? 0) > 0)
    // Sorted in code: the query must not drop a picture that has no count yet.
    .sort((a, b) => (b.reports ?? 0) - (a.reports ?? 0) || String(a.sourceWord).localeCompare(String(b.sourceWord)));

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const card = isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300";
  const stat = (label, value) => (
    <div className={`rounded-xl border-2 px-4 py-3 ${card}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stat("Ready", count("ready"))}
        {stat("Not drawable", count("skipped"))}
        {stat("Declined", count("failed"))}
        {stat("Being drawn", count("pending"))}
        {stat("Reported", reported.length)}
      </div>

      <div className="space-y-3">
        <h3 className="flex items-center gap-2 font-black uppercase tracking-widest text-sm">
          <Flag size={16} /> Reported pictures
        </h3>
        {reported.length === 0 ? (
          <p className={`text-sm font-bold ${muted}`}>No picture has been reported.</p>
        ) : (
          <ul className="space-y-3">
            {reported.map((doc) => (
              <li key={doc.id} className={`flex flex-wrap items-center gap-4 rounded-xl border-2 p-3 ${card}`}>
                {/* A picture is always shown on white, as in the games. */}
                <span className="w-20 h-20 shrink-0 rounded-lg border-2 border-slate-900 bg-white overflow-hidden">
                  {isOwnPictureUrl(doc.url) && (
                    <img src={doc.url} alt={doc.sourceWord} className="w-full h-full object-contain p-1" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-lg break-words">{doc.sourceWord}</p>
                  <p className={`text-xs font-bold uppercase tracking-widest ${muted}`}>
                    {doc.reports} {doc.reports === 1 ? "report" : "reports"} · {doc.id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <GhostButton onClick={() => handleRegenerate(doc)} disabled={busyId === doc.id} isDarkMode={isDarkMode} className="!px-3 !py-2 !text-xs">
                    {busyId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Regenerate
                  </GhostButton>
                  <GhostButton onClick={() => handleNotDrawable(doc)} disabled={busyId === doc.id} isDarkMode={isDarkMode} className="!px-3 !py-2 !text-xs">
                    <Ban size={14} />
                    Mark as not drawable
                  </GhostButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

PicturesSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PicturesSection;
