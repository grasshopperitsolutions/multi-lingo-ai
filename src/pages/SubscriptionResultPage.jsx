import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import Loader from "../components/Loader";
import { Rocket, Compass, ArrowRight } from "lucide-react";

// Single landing page for every Stripe redirect: new-subscribe success,
// upgrade/downgrade via the Billing Portal's plan-change flow, an abandoned
// checkout, and a scheduled cancellation. Stripe's Checkout gives us two
// distinct URLs (success/cancel), but its Billing Portal only ever has ONE
// return_url no matter what happened inside — cancel, update a card, switch
// plans, or nothing. Since the Portal-driven outcomes already require
// reading Firestore state to know what happened, every flow points here and
// gets the same treatment for consistency.
const TIER_PRESENTATION = {
  voyager: { iconBg: "bg-blue-100 border-blue-500", iconText: "text-blue-600" },
  maestro: { iconBg: "bg-yellow-100 border-yellow-500", iconText: "text-yellow-600" },
};

const SubscriptionResultPage = () => {
  const { isDarkMode, user, isLoadingUser, refreshUser } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(true);

  // Guests must not land here directly.
  useEffect(() => {
    if (!isLoadingUser && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, isLoadingUser, navigate]);

  useEffect(() => {
    (async () => {
      // Pick up whatever just happened on Stripe's side — new subscription,
      // plan change, or cancellation. The webhook that sets these fields
      // usually beats us here; if not, the neutral fallback covers it.
      await refreshUser();
      setIsRefreshing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoadingUser || isRefreshing) {
    return <Loader fullScreen message={t("common.loading")} isDarkMode={isDarkMode} />;
  }

  if (!user) return null;

  const isPaidTier = user.subscriptionTier === "voyager" || user.subscriptionTier === "maestro";
  const isCanceling = isPaidTier && Boolean(user.cancelAtPeriodEnd);
  const presentation = !isCanceling ? TIER_PRESENTATION[user.subscriptionTier] : null;

  let title;
  let message;
  if (isCanceling) {
    const tierLabel = user.subscriptionTier === "maestro" ? "Maestro" : "Voyager";
    const date = user.currentPeriodEnd
      ? new Date(user.currentPeriodEnd * 1000).toLocaleDateString()
      : "";
    title = t("subscription.cancel_scheduled_title");
    message = t("subscription.cancel_scheduled_message", { date, tier: tierLabel });
  } else if (isPaidTier) {
    title = t(`subscription.success.title_${user.subscriptionTier}`);
    message = t(`subscription.success.message_${user.subscriptionTier}`);
  } else {
    title = t("subscription.success.title_generic");
    message = t("subscription.success.message_generic");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div
        className={`max-w-md w-full p-10 rounded-[2rem] border-4 text-center ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 shadow-[8px_8px_0px_0px_#1e293b]"
            : "bg-white border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
        }`}
      >
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 ${
            isCanceling
              ? isDarkMode
                ? "bg-slate-900 border-slate-600"
                : "bg-slate-100 border-slate-400"
              : (presentation?.iconBg ?? "bg-emerald-100 border-emerald-500")
          }`}
        >
          {isCanceling ? (
            <Compass size={40} className={isDarkMode ? "text-slate-400" : "text-slate-500"} />
          ) : (
            <Rocket size={40} className={presentation?.iconText ?? "text-emerald-500"} />
          )}
        </div>

        <h1
          className={`text-3xl font-black uppercase tracking-tighter mb-4 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {title}
        </h1>

        <p className={`font-bold mb-10 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {message}
        </p>

        <button
          onClick={() => navigate("/dashboard", { replace: true })}
          className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 hover:-translate-y-1 ${
            isDarkMode
              ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[6px_6px_0px_0px_#854d0e]"
              : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
          }`}
        >
          {t("subscription.success.cta")}
          <ArrowRight size={18} />
        </button>

        {!isPaidTier && (
          <button
            onClick={() => navigate("/pricing")}
            className={`mt-4 font-black uppercase tracking-widest text-xs transition-colors ${
              isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t("subscription.success.browse_plans")}
          </button>
        )}
      </div>
    </main>
  );
};

export default SubscriptionResultPage;
