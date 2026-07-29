import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "../hooks/useTierAccess";
import Loader from "../components/Loader";
import { CONFIG_SECTIONS, getConfigSectionDocs } from "../services/adminConfigService";
import { ArrowLeft, ShieldCheck, FileJson } from "lucide-react";

// ── Admin Page ───────────────────────────────────────────────────────────────
// Read-only viewer for the appConfig/config/* Firestore subcollections.
const AdminPage = () => {
  const { isDarkMode, user, isLoadingUser } = useAppContext();
  const { isAdmin } = useTierAccess();
  const navigate = useNavigate();

  const [activeSectionId, setActiveSectionId] = useState(CONFIG_SECTIONS[0].id);
  const [docsBySection, setDocsBySection] = useState({});
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [error, setError] = useState(null);

  const activeSection = CONFIG_SECTIONS.find((s) => s.id === activeSectionId);

  const loadSection = useCallback(async (section) => {
    setIsLoadingDocs(true);
    setError(null);
    try {
      const docs = await getConfigSectionDocs(section.collection);
      setDocsBySection((prev) => ({ ...prev, [section.id]: docs }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || docsBySection[activeSectionId]) return;
    loadSection(activeSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, isAdmin]);

  if (isLoadingUser) {
    return <Loader fullScreen message="Loading..." isDarkMode={isDarkMode} />;
  }

  if (!user || !isAdmin) {
    return null;
  }

  const sectionClasses = `p-8 rounded-[2rem] border-4 mb-6
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  const docs = docsBySection[activeSectionId] ?? [];

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">
      <button
        onClick={() => navigate("/dashboard")}
        className={`flex items-center gap-2 mb-8 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1
          ${isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <h1
        className={`flex items-center gap-3 text-4xl font-black uppercase tracking-tighter mb-8
          ${isDarkMode ? "text-white" : "text-slate-900"}`}
      >
        <ShieldCheck size={32} />
        App Config
      </h1>

      <div className="flex flex-wrap gap-3 mb-6">
        {CONFIG_SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSectionId(section.id)}
            className={`px-4 py-2 rounded-full border-2 font-black uppercase text-xs tracking-widest transition-all active:scale-95
              ${
                section.id === activeSectionId
                  ? isDarkMode
                    ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[3px_3px_0px_0px_#854d0e]"
                    : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                  : isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-300"
                    : "bg-white border-slate-300 text-slate-600"
              }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className={sectionClasses}>
        <div className="flex items-center justify-between mb-4">
          <h2
            className={`flex items-center gap-2 text-lg font-black uppercase tracking-widest
              ${isDarkMode ? "text-white" : "text-slate-900"}`}
          >
            <FileJson size={20} />
            {activeSection.label}
          </h2>
          <span className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {activeSection.collection}
          </span>
        </div>

        {isLoadingDocs && <Loader message="Loading..." isDarkMode={isDarkMode} />}

        {!isLoadingDocs && error && (
          <p className="font-bold text-rose-500">{error}</p>
        )}

        {!isLoadingDocs && !error && docs.length === 0 && (
          <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            No documents in this section yet.
          </p>
        )}

        {!isLoadingDocs && !error && docs.length > 0 && (
          <div className="flex flex-col gap-4">
            {docs.map((doc, i) => (
              <div
                key={doc.id ?? i}
                className={`p-4 rounded-xl border-2 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"}`}
              >
                <p className={`mb-2 font-black text-sm ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}>
                  {doc.id ?? `#${i}`}
                </p>
                <pre className={`text-xs whitespace-pre-wrap break-words font-mono ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  {JSON.stringify(doc, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminPage;
