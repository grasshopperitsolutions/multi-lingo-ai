import PropTypes from "prop-types";
import { Sprout } from "lucide-react";
import { PrimaryButton } from "../ui";

/**
 * GrammarSeedSection
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ TEMPORARY — remove once the grammar corpus is in Firestore.           │
 * │ Delete this file, src/data/grammarSeed.ptPT.js, and the handler +     │
 * │ banner in src/pages/AdminPage.jsx.                                    │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Admin-only, one-shot writer for the hand-written pt-PT grammar corpus.
 * Idempotent: document IDs are derived from targetLang + key, so anything
 * already present is skipped and never overwritten.
 */
const GrammarSeedSection = ({ isDarkMode, onSeed, isSeeding, progress, summary }) => (
  <div className={`flex flex-col gap-3 p-4 mb-6 rounded-xl border-2 border-dashed ${
    isDarkMode ? "border-emerald-700 bg-emerald-900/20" : "border-emerald-400 bg-emerald-50"
  }`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className={`flex items-center gap-2 text-sm font-black uppercase tracking-widest ${
          isDarkMode ? "text-emerald-300" : "text-emerald-800"
        }`}>
          <Sprout size={16} />
          Seed Grammar Corpus (pt-PT)
        </h3>
        <p className={`text-xs font-bold mt-1 ${isDarkMode ? "text-emerald-400/80" : "text-emerald-700"}`}>
          Temporary. Writes the hand-written topics, content and tips from src/data/grammarSeed.ptPT.js.
          Existing documents are skipped, never overwritten — safe to re-run.
        </p>
      </div>
      <PrimaryButton
        onClick={onSeed}
        disabled={isSeeding}
        loading={isSeeding}
        isDarkMode={isDarkMode}
        color="emerald"
        className="!px-4 !py-2 shrink-0"
      >
        <Sprout size={16} />
        Seed Grammar
      </PrimaryButton>
    </div>

    {progress && (
      <p className={`text-xs font-mono ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {progress}
      </p>
    )}

    {summary && (
      <div className={`text-xs font-bold grid grid-cols-3 gap-2 p-3 rounded-lg ${
        isDarkMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-700"
      }`}>
        <span>Topics: {summary.topicsCreated} new / {summary.topicsSkipped} skipped</span>
        <span>Content: {summary.contentCreated} new / {summary.contentSkipped} skipped</span>
        <span>Tips: {summary.tipsCreated} new / {summary.tipsSkipped} skipped</span>
      </div>
    )}
  </div>
);

GrammarSeedSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onSeed: PropTypes.func.isRequired,
  isSeeding: PropTypes.bool,
  progress: PropTypes.string,
  summary: PropTypes.object,
};

export default GrammarSeedSection;
