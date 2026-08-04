import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Languages,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Loader from "../Loader";
import ConfirmModal from "../ConfirmModal";
import { PrimaryButton, GhostButton, ErrorBanner } from "../ui";

function matchesSearch(doc, term) {
  if (!term) return true;
  return String(doc.id ?? "").toLowerCase().includes(term.toLowerCase());
}

/**
 * LocalesSection — admin panel for the appConfig/config/locales Firestore
 * collection. Lets an admin force-retranslate-and-overwrite every known
 * language's UI strings from the current local en-US source in one batch
 * (sequential, one language at a time, to avoid concurrent AI calls), or
 * refresh a single language on demand. Each locale's translation JSON is
 * large, so entries are collapsed by default and filterable by locale code.
 */
const LocalesSection = ({ docs, isDarkMode, isLoadingDocs, error, onForceOverwrite, onRefreshLocale }) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [queueItems, setQueueItems] = useState({});
  const [summary, setSummary] = useState(null);
  const [runError, setRunError] = useState(null);
  const [refreshingCode, setRefreshingCode] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const isBusy = isRunning || Boolean(refreshingCode);

  const filteredDocs = useMemo(
    () => docs.filter((d) => matchesSearch(d, searchTerm)),
    [docs, searchTerm]
  );

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Warn the browser itself, not just the UI, if the admin tries to close or
  // navigate away while a translation sync is in flight — a closed tab
  // abandons whatever's mid-request and everything still queued after it.
  useEffect(() => {
    if (!isBusy) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isBusy]);

  const handleProgress = (update) => {
    setQueueItems((prev) => ({ ...prev, [update.code]: update }));
  };

  const handleConfirmRun = () => {
    setIsConfirmOpen(false);
    setIsRunning(true);
    setQueueItems({});
    setSummary(null);
    setRunError(null);

    onForceOverwrite(handleProgress)
      .then((result) => setSummary(result))
      .catch((err) => setRunError(err.message))
      .finally(() => setIsRunning(false));
  };

  const handleRefreshSingle = async (code) => {
    setRefreshingCode(code);
    try {
      await onRefreshLocale(code);
    } finally {
      setRefreshingCode(null);
    }
  };

  const items = Object.values(queueItems);
  const completed = items.filter((i) => i.status === "success" || i.status === "error").length;
  const total = items.length;

  return (
    <div className="flex flex-col gap-6">
      <div
        className={`p-5 rounded-2xl border-2 flex flex-col gap-4 ${
          isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`font-black text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Force Overwrite All Translations
            </p>
            <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Re-translates the full English source via AI and replaces every language&apos;s strings from scratch.
            </p>
          </div>
          <PrimaryButton
            onClick={() => setIsConfirmOpen(true)}
            disabled={isBusy}
            loading={isRunning}
            isDarkMode={isDarkMode}
            color="amber"
          >
            <Languages size={16} />
            Force Overwrite All
          </PrimaryButton>
        </div>

        {isBusy && (
          <div
            className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
              isDarkMode ? "bg-amber-900/30 border-amber-700 text-amber-300" : "bg-amber-50 border-amber-300 text-amber-700"
            }`}
          >
            <AlertTriangle size={16} className="shrink-0" />
            <p className="text-sm font-bold">
              Translation sync in progress — do not close or navigate away from this page until it finishes.
            </p>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {completed} of {total} languages processed
              </p>
            </div>
            <div className={`w-full h-3 rounded-full border-2 overflow-hidden ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-300"}`}>
              <div
                className="h-full bg-yellow-400 transition-all duration-300"
                style={{ width: `${total === 0 ? 0 : (completed / total) * 100}%` }}
              />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              {items.map((item) => (
                <div
                  key={item.code}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border-2 ${
                    isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
                  }`}
                >
                  {item.status === "pending" && (
                    <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${isDarkMode ? "border-slate-600" : "border-slate-300"}`} />
                  )}
                  {item.status === "in-progress" && (
                    <Loader2 size={16} className={`shrink-0 animate-spin ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`} />
                  )}
                  {item.status === "success" && (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  )}
                  {item.status === "error" && (
                    <XCircle size={16} className="shrink-0 text-rose-500" />
                  )}

                  <p className={`font-bold text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {item.label} <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>({item.code})</span>
                  </p>

                  <span className={`text-xs font-bold uppercase tracking-widest ml-auto ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {item.status === "pending" && "Pending"}
                    {item.status === "in-progress" && "Translating…"}
                    {item.status === "success" && (item.resultType === "created" ? "Created" : "Overwritten")}
                    {item.status === "error" && "Failed"}
                  </span>

                  {item.status === "error" && item.errorMessage && (
                    <p className="basis-full text-xs text-rose-500 font-semibold">{item.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {summary && (
          <p
            className={`text-sm font-bold ${
              summary.failed === 0 ? "text-emerald-500" : "text-amber-500"
            }`}
          >
            {summary.total === 0
              ? "No languages to process."
              : `${summary.succeeded} succeeded, ${summary.failed} failed (of ${summary.total}).`}
          </p>
        )}

        <ErrorBanner error={runError} isDarkMode={isDarkMode} />
      </div>

      {isLoadingDocs && <Loader message="Loading locales..." isDarkMode={isDarkMode} />}

      {!isLoadingDocs && error && <p className="font-bold text-rose-500">{error}</p>}

      {!isLoadingDocs && !error && docs.length > 0 && (
        <>
          <div className="relative">
            <Search
              size={16}
              className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by locale code..."
              className={`w-full pl-11 pr-4 py-2.5 rounded-xl border-2 font-semibold text-sm outline-none transition-colors ${
                isDarkMode
                  ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-blue-400"
                  : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
              }`}
            />
          </div>

          <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {filteredDocs.length} of {docs.length} locale{docs.length === 1 ? "" : "s"}
          </p>
        </>
      )}

      {!isLoadingDocs && !error && docs.length === 0 && (
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          No documents in this section yet.
        </p>
      )}

      {!isLoadingDocs && !error && docs.length > 0 && filteredDocs.length === 0 && (
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          No locales match &quot;{searchTerm}&quot;.
        </p>
      )}

      {!isLoadingDocs && !error && filteredDocs.length > 0 && (
        <div className="flex flex-col gap-4">
          {filteredDocs.map((doc, i) => {
            const id = doc.id ?? `#${i}`;
            const isExpanded = expandedIds.has(id);
            return (
              <div
                key={id}
                className={`rounded-xl border-2 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpanded(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpanded(id);
                    }
                  }}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown size={16} className={`shrink-0 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                    ) : (
                      <ChevronRight size={16} className={`shrink-0 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                    )}
                    <span className={`font-black text-sm truncate ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}>
                      {id}
                    </span>
                  </span>
                  <GhostButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshSingle(doc.id);
                    }}
                    disabled={isBusy}
                    isDarkMode={isDarkMode}
                    className="!px-3 !py-2 shrink-0"
                  >
                    {refreshingCode === doc.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    Overwrite
                  </GhostButton>
                </div>
                {isExpanded && (
                  <pre className={`text-xs whitespace-pre-wrap break-words font-mono px-4 pb-4 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isConfirmOpen && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title="Force Overwrite All Translations?"
          message="This re-translates the entire English source via AI and overwrites every language's existing translations in Firestore — created or replaced from scratch. Languages are processed one at a time, so this can take several minutes. Keep this tab open until it finishes."
          warning="This uses AI credits and cannot be undone"
          confirmLabel="Force Overwrite"
          confirmColor="yellow"
          icon={<Languages size={24} />}
          isLoading={false}
          onConfirm={handleConfirmRun}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </div>
  );
};

LocalesSection.propTypes = {
  docs: PropTypes.array.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onForceOverwrite: PropTypes.func.isRequired,
  onRefreshLocale: PropTypes.func.isRequired,
};

export default LocalesSection;
