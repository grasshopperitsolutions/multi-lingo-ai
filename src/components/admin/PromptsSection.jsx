import PropTypes from "prop-types";
import { Pencil, FileText } from "lucide-react";
import Loader from "../Loader";
import { GhostButton } from "../ui";

const STATUS_STYLES = {
  active: { dark: "bg-emerald-900/40 text-emerald-300 border-emerald-700", light: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  unused: { dark: "bg-slate-700 text-slate-300 border-slate-600", light: "bg-slate-100 text-slate-500 border-slate-300" },
};

function Badge({ children, isDarkMode, tone = "neutral" }) {
  const styles = tone === "status" ? STATUS_STYLES[children] ?? STATUS_STYLES.unused : null;
  const classes = styles
    ? (isDarkMode ? styles.dark : styles.light)
    : (isDarkMode ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-slate-100 text-slate-600 border-slate-300");
  return (
    <span className={`px-2 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${classes}`}>
      {children}
    </span>
  );
}

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  tone: PropTypes.string,
};

function previewText(prompt) {
  if (prompt.template) return prompt.template;
  if (Array.isArray(prompt.variants) && prompt.variants[0]?.template) return prompt.variants[0].template;
  return "";
}

const PromptsSection = ({ prompts, isDarkMode, isLoadingDocs, error, onEditPrompt }) => {
  return (
    <div className="flex flex-col gap-4">
      {isLoadingDocs && <Loader message="Loading prompts..." isDarkMode={isDarkMode} />}

      {!isLoadingDocs && error && <p className="font-bold text-rose-500">{error}</p>}

      {!isLoadingDocs && !error && prompts.length === 0 && (
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          No prompts in Firestore yet.
        </p>
      )}

      {!isLoadingDocs && !error && prompts.length > 0 && (
        <div className="flex flex-col gap-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className={`p-4 rounded-xl border-2 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <p className={`font-black text-sm ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}>
                    {prompt.name || prompt.id}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {prompt.category && <Badge isDarkMode={isDarkMode}>{prompt.category}</Badge>}
                    {prompt.status && <Badge isDarkMode={isDarkMode} tone="status">{prompt.status}</Badge>}
                  </div>
                </div>
                <GhostButton onClick={() => onEditPrompt(prompt)} isDarkMode={isDarkMode} className="!px-3 !py-2 shrink-0">
                  <Pencil size={14} />
                  Edit
                </GhostButton>
              </div>

              {prompt.description && (
                <p className={`text-sm mb-2 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  {prompt.description}
                </p>
              )}

              {(prompt.sourceFile || prompt.sourceFunction) && (
                <p className={`flex items-center gap-1.5 text-[11px] font-mono mb-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  <FileText size={12} />
                  {prompt.sourceFile}
                  {prompt.sourceFunction ? ` → ${prompt.sourceFunction}` : ""}
                </p>
              )}

              <pre className={`text-xs whitespace-pre-wrap break-words font-mono line-clamp-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {previewText(prompt).slice(0, 240)}
                {previewText(prompt).length > 240 ? "…" : ""}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

PromptsSection.propTypes = {
  prompts: PropTypes.array.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onEditPrompt: PropTypes.func.isRequired,
};

export default PromptsSection;
