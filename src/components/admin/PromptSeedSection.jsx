import PropTypes from "prop-types";
import { Sprout } from "lucide-react";
import { PrimaryButton } from "../ui";

/**
 * PromptSeedSection
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ TEMPORARY — remove once the prompts are in Firestore.                 │
 * │ Delete this file, src/data/promptSeeds.js, and the handler + banner   │
 * │ in src/pages/AdminPage.jsx.                                           │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Admin-only, one-shot writer for new prompt documents. Idempotent: a prompt
 * whose ID already exists is skipped, never overwritten, so re-running after a
 * hand edit in the prompt editor can't clobber your tuning.
 */
const PromptSeedSection = ({ isDarkMode, onSeed, isSeeding, summary }) => (
  <div className={`flex flex-col gap-3 p-4 mb-6 rounded-xl border-2 border-dashed ${
    isDarkMode ? "border-amber-700 bg-amber-900/20" : "border-amber-400 bg-amber-50"
  }`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className={`flex items-center gap-2 text-sm font-black uppercase tracking-widest ${
          isDarkMode ? "text-amber-300" : "text-amber-800"
        }`}>
          <Sprout size={16} />
          Seed New Prompts
        </h3>
        <p className={`text-xs font-bold mt-1 ${isDarkMode ? "text-amber-400/80" : "text-amber-700"}`}>
          Temporary. Writes any prompt from src/data/promptSeeds.js whose ID isn&apos;t already in Firestore.
          Existing prompts are skipped, never overwritten — safe to re-run.
        </p>
      </div>
      <PrimaryButton
        onClick={onSeed}
        disabled={isSeeding}
        loading={isSeeding}
        isDarkMode={isDarkMode}
        color="amber"
        className="!px-4 !py-2 shrink-0"
      >
        <Sprout size={16} />
        Seed Prompts
      </PrimaryButton>
    </div>

    {summary && (
      <div className={`text-xs font-bold p-3 rounded-lg ${
        isDarkMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-700"
      }`}>
        Created {summary.created} · Skipped {summary.skipped} (already present)
      </div>
    )}
  </div>
);

PromptSeedSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onSeed: PropTypes.func.isRequired,
  isSeeding: PropTypes.bool,
  summary: PropTypes.object,
};

export default PromptSeedSection;
