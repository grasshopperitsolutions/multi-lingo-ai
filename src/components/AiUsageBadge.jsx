import { useTranslation } from "react-i18next";
import { useTierAccess } from "../hooks/useTierAccess";
import { Star } from "lucide-react";
import PropTypes from "prop-types";

/**
 * Small badge showing remaining AI calls for the current tier.
 * Reuses the StatCard visual pattern from DashboardPage.
 */
const AiUsageBadge = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { tier, limits, aiCallsRemaining } = useTierAccess();

  const isUnlimited = limits.aiCallsPerDay === Infinity;
  const callsToday = limits.aiCallsPerDay === Infinity ? 0 : limits.aiCallsPerDay;

  // Calculate percentage used (for progress bar)
  const percentUsed =
    isUnlimited
      ? 100
      : Math.min(100, Math.round((1 - aiCallsRemaining / callsToday) * 100));

  return (
    <div
      className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border-4 flex flex-col gap-1.5 sm:gap-2 transition-all ${
        isDarkMode
          ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]"
          : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] sm:text-xs font-black uppercase tracking-widest">
            {t("ai_usage.label")}
          </span>
          {tier === "maestro" && (
            <Star size={12} className="text-yellow-500 fill-yellow-500" />
          )}
        </div>
        <span
          className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full border-2 ${
            tier === "explorer"
              ? isDarkMode
                ? "border-slate-600 text-slate-400"
                : "border-slate-300 text-slate-500"
              : tier === "voyager"
                ? "border-blue-500 text-blue-600"
                : "border-yellow-500 text-yellow-500"
          }`}
        >
          {limits.label}
        </span>
      </div>

      {/* Value */}
      {isUnlimited ? (
        <p className="text-lg sm:text-2xl font-black tracking-tighter text-emerald-500">
          {t("ai_usage.unlimited")}
        </p>
      ) : (
        <p
          className={`text-lg sm:text-2xl font-black tracking-tighter ${
            aiCallsRemaining <= 3 ? "text-rose-500" : isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {aiCallsRemaining === 0
            ? t("ai_usage.depleted")
            : t("ai_usage.remaining", {
                count: aiCallsRemaining,
                total: limits.aiCallsPerDay,
              })}
        </p>
      )}

      {/* Progress bar (only for non-unlimited) */}
      {!isUnlimited && (
        <div
          className={`w-full h-2 rounded-full overflow-hidden border ${
            isDarkMode ? "bg-slate-700 border-slate-600" : "bg-slate-200 border-slate-300"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentUsed >= 80
                ? "bg-rose-500"
                : percentUsed >= 50
                  ? "bg-yellow-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      )}
    </div>
  );
};

AiUsageBadge.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default AiUsageBadge;