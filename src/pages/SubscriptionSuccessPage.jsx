import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { CheckCircle } from "lucide-react";

const SubscriptionSuccessPage = () => {
  const { isDarkMode, refreshUser } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Refresh user profile to get updated subscription data
    refreshUser();

    // Redirect to dashboard after 3 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/dashboard", { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div
        className={`max-w-md w-full p-10 rounded-[2rem] border-4 text-center ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 shadow-[8px_8px_0px_0px_#1e293b]"
            : "bg-white border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
        }`}
      >
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-500">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <h1
          className={`text-3xl font-black uppercase tracking-tighter mb-4 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {t("subscription.success.title")}
        </h1>
        <p
          className={`font-bold mb-8 ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {t("subscription.success.message")}
        </p>
        <p
          className={`text-sm font-bold uppercase tracking-wider ${
            isDarkMode ? "text-slate-500" : "text-slate-400"
          }`}
        >
          {t("subscription.success.redirecting", { seconds: countdown })}
        </p>
      </div>
    </main>
  );
};

export default SubscriptionSuccessPage;