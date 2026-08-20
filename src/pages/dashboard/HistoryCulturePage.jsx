import { useState, useEffect } from "react";
import { isAiDeclined } from "../../services/aiService";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Landmark, Sparkles } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import { useInterestTopics } from "../../hooks/useInterestTopics";
import { getFact, getFactPoolStatus } from "../../services/historyCultureService";
import { markHistoryFactSeen } from "../../services/userService";
import CustomRequestInput from "../../components/CustomRequestInput";
import Loader from "../../components/Loader";
import { FeaturePageShell, Card, ErrorBanner, PrimaryButton } from "../../components/ui";

/**
 * HistoryCulturePage
 *
 * Short AI-written pieces about the country behind the language being learned,
 * read in the user's own interface language.
 *
 * Cache-first: the random path draws from a shared pool and costs nothing.
 * Typing a subject generates to order and is tier-gated by CustomRequestInput.
 * Interests theme newly generated facts only — they never filter the pool.
 */
const HistoryCulturePage = () => {
  const { isDarkMode, user, setUser, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { topics } = useInterestTopics();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [description, setDescription] = useState("");
  const [cacheExhausted, setCacheExhausted] = useState(false);
  const [fact, setFact] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const targetLang = user?.learningDialect;

  useEffect(() => {
    if (!user?.token || !targetLang) return;
    let cancelled = false;

    getFactPoolStatus({
      token: user.token,
      targetLang,
      seenFactIds: user?.seenHistoryFactsIds ?? [],
    })
      .then((status) => { if (!cancelled) setCacheExhausted(status.exhausted); })
      .catch(() => { /* leaving the box locked on failure is the safe default */ });

    return () => { cancelled = true; };
  }, [user, targetLang]);

  const handleDiscover = async () => {
    if (!canUseAI) {
      showAlert("warning", t("ai_usage.limit_reached"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const seenFactIds = user?.seenHistoryFactsIds ?? [];
      const result = await getFact({
        token: user.token,
        targetLang,
        locale: interfaceLang,
        interests: topics,
        seenFactIds,
        description,
      });
      setFact(result);

      markHistoryFactSeen(user.token, user.uid, result.factId, seenFactIds)
        .then(() => {
          setUser((prev) => ({
            ...prev,
            seenHistoryFactsIds: [...new Set([...seenFactIds, result.factId])],
          }));
        })
        .catch(() => { /* seen-tracking is best-effort; a repeat later is a minor inconvenience */ });
    } catch (err) {
      // The user chose not to spend an AI call — not an error worth a banner.
      if (isAiDeclined(err)) return;
      const message = err.message ?? t("common.error", "Something went wrong. Please try again.");
      setError(message);
      showAlert("error", message, { label: t("common.try_again", "Try Again"), onClick: handleDiscover });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="rose"
      title={t("dashboard.history_culture")}
      reportContext="HistoryCulturePage"
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <div className="flex flex-col gap-3">
        <CustomRequestInput
          value={description}
          onChange={setDescription}
          placeholder={t("history_culture.description_placeholder")}
          cacheExhausted={cacheExhausted}
          disabled={isLoading}
          isDarkMode={isDarkMode}
        />
        <PrimaryButton
          onClick={handleDiscover}
          disabled={isLoading}
          loading={isLoading}
          isDarkMode={isDarkMode}
          color="amber"
          className="self-start"
        >
          <Sparkles size={16} />
          {fact ? t("history_culture.discover_another") : t("history_culture.discover")}
        </PrimaryButton>
      </div>

      {isLoading && <Loader message={t("history_culture.loading")} isDarkMode={isDarkMode} />}

      {!isLoading && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {!isLoading && !error && !fact && (
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("history_culture.empty_state")}
          </p>
        </Card>
      )}

      {!isLoading && fact && (
        <Card isDarkMode={isDarkMode}>
          <div className="flex items-start gap-3 mb-3">
            <div className={`shrink-0 p-2 rounded-lg border-2 ${
              isDarkMode ? "border-orange-500/50 text-orange-400" : "border-orange-400 text-orange-600"
            }`}>
              <Landmark size={16} />
            </div>
            <h2 className={`text-xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {fact.title}
            </h2>
          </div>

          {fact.paragraphs.map((paragraph, i) => (
            <p key={i} className={`mb-3 last:mb-0 leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              {paragraph}
            </p>
          ))}

          {/* Translation into the reader's language can fail (quota, network);
              the service falls back to the source language rather than showing
              nothing, so say which language they're actually looking at. */}
          {fact.locale !== interfaceLang && (
            <p className={`mt-4 text-xs font-bold uppercase tracking-widest ${
              isDarkMode ? "text-amber-400" : "text-amber-600"
            }`}>
              {t("grammar.shown_in_locale", { locale: fact.locale })}
            </p>
          )}
        </Card>
      )}
    </FeaturePageShell>
  );
};

export default HistoryCulturePage;
