import PropTypes from "prop-types";
import { Pencil, Infinity as InfinityIcon, EyeOff, Sparkles } from "lucide-react";
import Loader from "../Loader";
import { GhostButton, PrimaryButton } from "../ui";
import { FEATURE_KEYS } from "../../config/features";

/**
 * TiersSection — admin list of subscription tiers
 * (appConfig/config/tiersConfig). Backed by tiersConfigService.js.
 *
 * Shows each tier's daily AI allowance and how many features it can reach, with
 * an editor behind the pencil. "Seed missing" writes the code defaults for any
 * tier that has no document yet, so an empty subcollection can be populated in
 * one click rather than by hand.
 */
const TiersSection = ({ tiers, isDarkMode, isLoadingDocs, error, isSeeding, onEditTier, onSeedMissing }) => {
  const rows = Object.values(tiers ?? {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const mutedClasses = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton
          onClick={onSeedMissing}
          isDarkMode={isDarkMode}
          color="emerald"
          className="!px-4 !py-2"
          disabled={isSeeding}
        >
          <Sparkles size={16} />
          {isSeeding ? "Seeding..." : "Seed Missing Tiers"}
        </PrimaryButton>
        <p className={`text-xs font-bold ${mutedClasses}`}>
          Writes code defaults for any tier with no document yet. Existing documents are left alone.
        </p>
      </div>

      {isLoadingDocs && <Loader message="Loading tiers..." isDarkMode={isDarkMode} />}

      {!isLoadingDocs && error && <p className="font-bold text-rose-500">{error}</p>}

      {!isLoadingDocs && !error && rows.length === 0 && (
        <p className={`font-bold ${mutedClasses}`}>No tiers configured.</p>
      )}

      {!isLoadingDocs && !error && rows.map((tier) => {
        const unlimited = tier.aiCallsPerDay === Infinity;
        const grantedCount = (tier.features ?? []).length;
        const isAdminTier = tier.id === "admin";

        return (
          <div
            key={tier.id}
            className={`p-5 rounded-2xl border-4 flex flex-col gap-3 ${
              isDarkMode
                ? "bg-slate-900 border-slate-700"
                : "bg-slate-50 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {tier.label}
                </h3>
                <code className={`text-xs font-bold ${mutedClasses}`}>{tier.id}</code>
                {tier.hidden && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                  }`}>
                    <EyeOff size={11} /> Hidden
                  </span>
                )}
                {tier.isFree && (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    isDarkMode ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    Free
                  </span>
                )}
              </div>

              <GhostButton onClick={() => onEditTier(tier)} isDarkMode={isDarkMode} className="!px-3 !py-1.5">
                <Pencil size={14} /> Edit
              </GhostButton>
            </div>

            <div className="flex flex-wrap gap-6">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClasses}`}>AI calls / day</p>
                <p className={`text-xl font-black tabular-nums flex items-center gap-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {unlimited ? <><InfinityIcon size={20} /> Unlimited</> : tier.aiCallsPerDay}
                </p>
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClasses}`}>Features</p>
                <p className={`text-xl font-black tabular-nums ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {isAdminTier ? "All" : `${grantedCount} / ${FEATURE_KEYS.length}`}
                </p>
              </div>
            </div>

            {isAdminTier && (
              <p className={`text-xs font-semibold ${mutedClasses}`}>
                Admin bypasses feature gating in code — this list is informational only.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

TiersSection.propTypes = {
  tiers: PropTypes.object,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool,
  error: PropTypes.string,
  isSeeding: PropTypes.bool,
  onEditTier: PropTypes.func.isRequired,
  onSeedMissing: PropTypes.func.isRequired,
};

TiersSection.defaultProps = {
  tiers: {},
  isLoadingDocs: false,
  error: null,
  isSeeding: false,
};

export default TiersSection;
