import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { createCheckoutSession } from "../services/stripeService";
import { PRICING, TIER_FEATURES, getYearlySavingsPercent } from "../config/pricing";
import { auth } from "../firebase";
import { CheckCircle, Star, Lock, ArrowRight } from "lucide-react";
import PropTypes from "prop-types";

// ── FeatureRow ────────────────────────────────────────────────────────────────
const FeatureRow = ({ feature, tier, isDarkMode, t }) => {
  const included = feature.value === true || typeof feature.value === "number" || feature.value === "Unlimited";
  const label =
    feature.key === "ai_calls"
      ? t("pricing.features.ai_calls", {
          count: feature.raw === Infinity ? "Unlimited" : feature.value,
          suffix: feature.suffix || "",
        })
      : t(`pricing.features.${feature.key}`);

  return (
    <div className="flex items-center gap-2 py-2">
      {included ? (
        <CheckCircle
          size={16}
          className={tier === "explorer" ? "text-emerald-400" : "text-emerald-500"}
        />
      ) : (
        <Lock size={14} className="text-slate-400" />
      )}
      <span
        className={`text-xs font-bold uppercase tracking-wider ${
          included
            ? isDarkMode
              ? "text-slate-300"
              : "text-slate-700"
            : isDarkMode
              ? "text-slate-500"
              : "text-slate-400"
        } ${!included ? "line-through opacity-60" : ""}`}
      >
        {label}
      </span>
    </div>
  );
};

FeatureRow.propTypes = {
  feature: PropTypes.object.isRequired,
  tier: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  t: PropTypes.func.isRequired,
};

// ── TierCard ──────────────────────────────────────────────────────────────────
const TierCard = ({
  tierKey,
  tierLabel,
  price,
  features,
  isDarkMode,
  isCurrentTier,
  isMostPopular,
  onSelect,
  loadingPlan,
  t,
}) => {
  const [isYearly, setIsYearly] = useState(false);
  const currentPrice = price ? (isYearly ? price.yearly : price.monthly) : null;
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

            {/* 7-Day Trial Badge */}
            <div className="flex items-center gap-2 mb-6">
              <Star size={16} className="text-yellow-500" />
              <span className="text-xs font-black uppercase tracking-widest text-yellow-500">
                {t("pricing.try_free_days", { days: 7 })}
              </span>
            </div>
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

        {/* Feature List */}
        <div className="flex-1 space-y-1">
          {features.map((feat, idx) => (
            <FeatureRow
              key={idx}
              feature={feat}
              tier={tierKey}
              isDarkMode={isDarkMode}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

TierCard.propTypes = {
  tierKey: PropTypes.string.isRequired,
  tierLabel: PropTypes.string.isRequired,
  price: PropTypes.object,
  features: PropTypes.array.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isCurrentTier: PropTypes.bool.isRequired,
  isMostPopular: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  loadingPlan: PropTypes.string,
  t: PropTypes.func.isRequired,
};

// ── PricingPage ───────────────────────────────────────────────────────────────
const PricingPage = () => {
  const { isDarkMode, user, showAlert } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState(null);

  const currentTier = user?.subscriptionTier ?? "explorer";

  const handleSelect = async (plan, interval) => {
    if (!user) {
      navigate("/login");
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
      await createCheckoutSession(token, plan, interval);
    } catch (err) {
      showAlert("error", err.message || t("common.error"));
      setLoadingPlan(null);
    }
  };

  const tiers = [
    {
      key: "explorer",
      label: "Explorer",
      price: null,
      features: TIER_FEATURES.explorer,
      isMostPopular: false,
    },
    {
      key: "voyager",
      label: "Voyager",
      price: PRICING.voyager,
      features: TIER_FEATURES.voyager,
      isMostPopular: true,
    },
    {
      key: "maestro",
      label: "Maestro",
      price: PRICING.maestro,
      features: TIER_FEATURES.maestro,
      isMostPopular: false,
    },
  ];

  return (
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {tiers.map((tier) => (
            <TierCard
              key={tier.key}
              tierKey={tier.key}
              tierLabel={tier.label}
              price={tier.price}
              features={tier.features}
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
  );
};

export default PricingPage;