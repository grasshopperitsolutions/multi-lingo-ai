import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import Loader from "../components/Loader";
import { Rocket, ArrowRight } from "lucide-react";

// Tier-specific presentation — icon accent color and the i18n key suffix
// used to pick a title/message. Anything other than voyager/maestro (a
// stale/explorer read while the webhook is still landing) falls back to
// the generic thank-you copy rather than showing nothing.
const TIER_PRESENTATION = {
  voyager: {
    suffix: "voyager",
    iconBg: "bg-blue-100 border-blue-500",
    iconText: "text-blue-600",
  },
  maestro: {
    suffix: "maestro",
    iconBg: "bg-yellow-100 border-yellow-500",
    iconText: "text-yellow-600",
  },
};

const SubscriptionSuccessPage = () => {
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
      // Pick up the tier the checkout/upgrade just landed on — the Stripe
      // webhook that sets it usually beats us here, but this page never
      // blocks on it; TIER_PRESENTATION's fallback covers the rare race.
      await refreshUser();
      setIsRefreshing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoadingUser || isRefreshing) {
    return <Loader fullScreen message={t("common.loading")} isDarkMode={isDarkMode} />;
  }

  if (!user) return null;

  const presentation = TIER_PRESENTATION[user.subscriptionTier] ?? null;
  const suffix = presentation?.suffix ?? "generic";

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
            presentation?.iconBg ?? "bg-emerald-100 border-emerald-500"
          }`}
        >
          <Rocket size={40} className={presentation?.iconText ?? "text-emerald-500"} />
        </div>

        <h1
          className={`text-3xl font-black uppercase tracking-tighter mb-4 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {t(`subscription.success.title_${suffix}`)}
        </h1>

        <p className={`font-bold mb-10 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t(`subscription.success.message_${suffix}`)}
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
      </div>
    </main>
  );
};

export default SubscriptionSuccessPage;
