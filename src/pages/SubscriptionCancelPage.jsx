import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "../hooks/useTierAccess";
import { ArrowLeft } from "lucide-react";

// Which "enjoy being a ___" line to show — reflects whatever tier the user
// actually still has (abandoning an upgrade attempt doesn't change it),
// not an assumption that everyone who lands here is on the free tier.
const ENJOY_KEY_BY_TIER = {
  voyager: "enjoy_voyager",
  maestro: "enjoy_maestro",
};

const SubscriptionCancelPage = () => {
  const { isDarkMode } = useAppContext();
  const { tier } = useTierAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const enjoyKey = ENJOY_KEY_BY_TIER[tier] ?? "enjoy_explorer";

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div
        className={`max-w-md w-full p-10 rounded-[2rem] border-4 text-center ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 shadow-[8px_8px_0px_0px_#1e293b]"
            : "bg-white border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
        }`}
      >
        <div className="text-5xl mb-6" aria-hidden="true">
          🤷
        </div>
        <h1
          className={`text-3xl font-black uppercase tracking-tighter mb-4 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {t("subscription.cancel.title")}
        </h1>
        <p
          className={`font-bold mb-6 ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {t("subscription.cancel.message")}
        </p>

        <div
          className={`p-4 rounded-xl border-4 mb-8 ${
            isDarkMode
              ? "bg-slate-900 border-slate-700"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <p className={`font-black uppercase tracking-wider text-sm mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {t("subscription.cancel.sorry_title")}
          </p>
          <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {t(`subscription.cancel.${enjoyKey}`)}
          </p>
        </div>

        <button
          onClick={() => navigate("/pricing")}
          className={`flex items-center justify-center gap-2 mx-auto px-8 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 ${
            isDarkMode
              ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#ca8a04] hover:-translate-y-0.5"
              : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
          }`}
        >
          <ArrowLeft size={16} />
          {t("subscription.cancel.back")}
        </button>
      </div>
    </main>
  );
};

export default SubscriptionCancelPage;
