import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { createCheckoutSession, openPlanChangePortal } from "../services/stripeService";
import { PRICING, getYearlySavingsPercent } from "../config/pricing";
import { FEATURE_STATUS, getFeatureStatus } from "../utils/featureAccess";
import { auth } from "../firebase";
import { CheckCircle, Lock, Clock, ArrowRight, ChevronDown } from "lucide-react";
import PropTypes from "prop-types";

// ── Rows shown before the list collapses ──────────────────────────────────────
const COLLAPSED_ROW_COUNT = 7;

// The cheapest paid plan carries the "most popular" flag. Read from the tier's
// own display order so renaming or reordering plans in the Admin page doesn't
// need a code change here.
const MOST_POPULAR_ORDER = 2;

// ── FeatureRow ────────────────────────────────────────────────────────────────
const FeatureRow = ({ label, status, isDarkMode, t }) => {
  // Four states, not two. A feature that isn't built yet is neither included
  // (it can't be used) nor withheld by the plan (nothing is being sold), so it
  // gets its own icon and badge rather than being struck through like a
  // genuinely locked one.
  const included = status === FEATURE_STATUS.AVAILABLE;
  const unreleased =
    status === FEATURE_STATUS.COMING_SOON || status === FEATURE_STATUS.INCOMING;

  return (
    <div className="flex items-center gap-2 py-2">
      {unreleased ? (
        <Clock size={14} className="text-amber-500 shrink-0" />
      ) : included ? (
        <CheckCircle size={16} className="text-emerald-500 shrink-0" />
      ) : (
        <Lock size={14} className="text-slate-400 shrink-0" />
      )}
      <span
        className={`text-xs font-bold uppercase tracking-wider ${
          included
            ? isDarkMode ? "text-slate-300" : "text-slate-700"
            : isDarkMode ? "text-slate-500" : "text-slate-400"
        } ${!included && !unreleased ? "line-through opacity-60" : ""}`}
      >
        {label}
      </span>
      {unreleased && (
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
            isDarkMode ? "border-amber-600 text-amber-400" : "border-amber-400 text-amber-700"
          }`}
        >
          {status === FEATURE_STATUS.INCOMING
            ? t("features.incoming", "Incoming")
            : t("pricing.badge_coming_soon")}
        </span>
      )}
    </div>
  );
};

FeatureRow.propTypes = {
  label: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  t: PropTypes.func.isRequired,
};

// ── AiCallsRow — the allowance, which is a limit rather than a feature ────────
const AiCallsRow = ({ aiCallsPerDay, isDarkMode, t }) => (
  <div className="flex items-center gap-2 py-2">
    <CheckCircle size={16} className="text-emerald-500 shrink-0" />
    <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
      {t("pricing.features.ai_calls", {
        count: aiCallsPerDay === Infinity ? t("pricing.unlimited", "Unlimited") : aiCallsPerDay,
        suffix: aiCallsPerDay === Infinity ? "" : t("pricing.per_day_suffix", "/day"),
      })}
    </span>
  </div>
);

AiCallsRow.propTypes = {
  aiCallsPerDay: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  t: PropTypes.func.isRequired,
};

// ── TierCard ──────────────────────────────────────────────────────────────────
const TierCard = ({
  tierKey,
  tierLabel,
  price,
  rows,
  aiCallsPerDay,
  isDarkMode,
  isCurrentTier,
  isMostPopular,
  onSelect,
  loadingPlan,
  t,
}) => {
  const [isYearly, setIsYearly] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const currentPrice = price ? (isYearly ? price.yearly : price.monthly) : null;
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_ROW_COUNT);
  const hiddenCount = Math.max(0, rows.length - COLLAPSED_ROW_COUNT);
  const isFree = tierKey === "explorer";
  const isLoading = loadingPlan === `${tierKey}-${currentPrice?.interval ?? "monthly"}`;

  return (
    <div
      className={`relative flex flex-col rounded-[2rem] border-4 transition-all duration-300 ${
        isMostPopular
          ? "md:scale-105 z-10 shadow-[12px_12px_0px_0px_#facc15]"
          : "shadow-[6px_6px_0px_0px_#0f172a]"
      } ${
        isCurrentTier
          ? isDarkMode
            ? "bg-slate-800 border-yellow-400"
            : "bg-white border-yellow-400"
          : isDarkMode
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-900"
      }`}
    >
      {/* Most Popular Badge */}
      {isMostPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
          <span className="bg-yellow-400 text-slate-900 px-6 py-1.5 rounded-full border-2 border-slate-900 font-black uppercase text-xs tracking-widest shadow-[3px_3px_0px_0px_#0f172a]">
            {t("pricing.most_popular")}
          </span>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentTier && (
        <div className="absolute -top-4 right-4 z-20">
          <span className="bg-emerald-500 text-white px-4 py-1 rounded-full border-2 border-slate-900 font-black uppercase text-xs tracking-widest">
            {t("pricing.current_plan")}
          </span>
        </div>
      )}

      <div className="p-8 flex flex-col flex-1">
        {/* Tier Name */}
        <h3
          className={`text-2xl font-black uppercase tracking-tighter mb-2 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {tierLabel}
        </h3>

        {/* Free tier */}
        {isFree && (
          <>
            <p className="text-5xl font-black tracking-tighter text-emerald-500 mb-1">
              $0.00
            </p>
            <p className={`text-sm font-bold uppercase tracking-wider mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {t("pricing.free_forever")}
            </p>
          </>
        )}

        {/* Paid tier — monthly/yearly toggle */}
        {!isFree && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-4 py-2 rounded-full border-2 font-black uppercase text-xs tracking-widest transition-all ${
                  !isYearly
                    ? isDarkMode
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-blue-600 border-slate-900 text-white"
                    : isDarkMode
                      ? "bg-transparent border-slate-600 text-slate-400"
                      : "bg-transparent border-slate-300 text-slate-500"
                }`}
              >
                {t("pricing.monthly")}
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-4 py-2 rounded-full border-2 font-black uppercase text-xs tracking-widest transition-all ${
                  isYearly
                    ? isDarkMode
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-blue-600 border-slate-900 text-white"
                    : isDarkMode
                      ? "bg-transparent border-slate-600 text-slate-400"
                      : "bg-transparent border-slate-300 text-slate-500"
                }`}
              >
                {t("pricing.yearly")}
              </button>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black tracking-tighter">
                ${currentPrice.amount}
              </span>
              <span
                className={`text-sm font-bold uppercase tracking-wider ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                /{isYearly ? t("pricing.per_year") : t("pricing.per_month")}
              </span>
            </div>

            {/* Yearly Savings Badge */}
            {isYearly && (
              <div className="inline-block bg-rose-500 text-white px-3 py-1 rounded-full border-2 border-slate-900 font-black uppercase text-xs tracking-widest mb-6 shadow-[2px_2px_0px_0px_#0f172a]">
                {t("pricing.save_x", {
                  percent: getYearlySavingsPercent(price.monthly.amount, price.yearly.amount),
                })}
              </div>
            )}

            {/* No plan offers a free trial — the free Explorer tier is the
                trial. Spacer keeps card rhythm consistent with the block that
                used to live here. */}
            <div className="mb-6" />
          </>
        )}

        {/* CTA Button */}
        <button
          onClick={() => onSelect(tierKey, currentPrice?.interval ?? "monthly")}
          disabled={isCurrentTier || isLoading}
          className={`w-full py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 mb-8 flex items-center justify-center gap-2 ${
            isCurrentTier
              ? isDarkMode
                ? "bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
              : isFree
                ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
                : "bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
          }`}
        >
          {isLoading
            ? t("pricing.redirecting")
            : isCurrentTier
              ? t("pricing.current_plan")
              : isFree
                ? t("pricing.get_started")
                : t("pricing.upgrade")}
          {!isCurrentTier && !isLoading && <ArrowRight size={16} />}
        </button>

        {/* Feature List — every feature is listed, but the tail is collapsed so
            the cards stay comparable at a glance. */}
        <div className="flex-1 space-y-1">
          <AiCallsRow aiCallsPerDay={aiCallsPerDay} isDarkMode={isDarkMode} t={t} />

          {visibleRows.map((row) => (
            <FeatureRow
              key={row.id}
              label={row.label}
              status={row.status}
              isDarkMode={isDarkMode}
              t={t}
            />
          ))}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className={`mt-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
                isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded
                ? t("pricing.show_less", "Show less")
                : t("pricing.show_all_features", "Show all {{count}} features", { count: rows.length })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

TierCard.propTypes = {
  tierKey: PropTypes.string.isRequired,
  tierLabel: PropTypes.string.isRequired,
  price: PropTypes.object,
  rows: PropTypes.array.isRequired,
  aiCallsPerDay: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isCurrentTier: PropTypes.bool.isRequired,
  isMostPopular: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  loadingPlan: PropTypes.string,
  t: PropTypes.func.isRequired,
};

// ── PricingPage ───────────────────────────────────────────────────────────────
const PricingPage = () => {
  const { isDarkMode, user, showAlert, tiersConfig, features: featureRegistry } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState(null);

  const currentTier = user?.subscriptionTier ?? "explorer";

  const handleSelect = async (plan, interval) => {
    if (!user) {
      // Not logged in yet — carry the picked plan through to LoginPage,
      // which resumes straight into Stripe Checkout after a successful
      // login instead of just landing on /dashboard.
      navigate("/login", { state: { plan, interval } });
      return;
    }

    if (plan === "explorer") {
      navigate("/dashboard");
      return;
    }

    setLoadingPlan(`${plan}-${interval}`);
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) {
        showAlert("error", t("common.error"));
        setLoadingPlan(null);
        return;
      }
      const token = await firebaseUser.getIdToken();
      const isExistingSubscriber = currentTier === "voyager" || currentTier === "maestro";
      if (isExistingSubscriber) {
        // Already paying for the other tier — deep-link into Stripe's own
        // plan-change confirmation instead of starting a second subscription.
        await openPlanChangePortal(token, plan, interval);
      } else {
        await createCheckoutSession(token, plan, interval);
      }
    } catch (err) {
      showAlert("error", err.message || t("common.error"));
      setLoadingPlan(null);
    }
  };

  // Plans and their contents come straight from appConfig/config/tiersConfig
  // and appConfig/config/features, so this page can't drift from what the app
  // actually grants. Hidden tiers (VIP, Admin) are excluded by definition.
  const tiers = useMemo(() => {
    if (!tiersConfig || !featureRegistry) return [];

    return Object.values(tiersConfig)
      .filter((tier) => !tier.hidden)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((tier) => ({
        key: tier.id,
        label: tier.label,
        price: PRICING[tier.id] ?? null,
        aiCallsPerDay: tier.aiCallsPerDay,
        // Voyager is the recommended plan: the cheapest paid one.
        isMostPopular: !tier.isFree && tier.order === MOST_POPULAR_ORDER,
        rows: featureRegistry.map((feature) => ({
          id: feature.id,
          // The user-facing name comes from the translation key stored on the
          // feature; the admin label is the fallback when none is set.
          label: feature.labelKey ? t(feature.labelKey, feature.label) : feature.label,
          status: getFeatureStatus(feature.id, tier.id, tiersConfig),
        })),
      }));
  }, [tiersConfig, featureRegistry, t]);

  return (
    <>
      <main className="flex-1 pb-24">
        {/* Header */}
        <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
          <h1
            className={`text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter mb-6 ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {t("pricing.title")}
          </h1>
          <p
            className={`text-lg sm:text-xl font-bold max-w-2xl mx-auto ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {t("pricing.subtitle")}
          </p>
        </section>

        {/* Tier Cards */}
        <section className="max-w-6xl mx-auto px-4">
          <h2 className="sr-only">{t("pricing.plans_heading")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {tiers.map((tier) => (
              <TierCard
                key={tier.key}
                tierKey={tier.key}
                tierLabel={tier.label}
                price={tier.price}
                rows={tier.rows}
                aiCallsPerDay={tier.aiCallsPerDay}
                isDarkMode={isDarkMode}
                isCurrentTier={currentTier === tier.key}
                isMostPopular={tier.isMostPopular}
                onSelect={handleSelect}
                loadingPlan={loadingPlan}
                t={t}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
};

export default PricingPage;