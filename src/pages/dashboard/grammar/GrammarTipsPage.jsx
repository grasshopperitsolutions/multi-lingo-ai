import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles, Lightbulb } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { isGrammarSupported } from "../../../config/grammarSupport";
import { getTips, generateTip, TIP_CATEGORIES } from "../../../services/grammarService";
import GrammarExampleList from "../../../components/GrammarExampleList";
import Loader from "../../../components/Loader";
import NeoDropdown from "../../../components/NeoDropdown";
import { FeaturePageShell, Card, ErrorBanner, PrimaryButton } from "../../../components/ui";

/**
 * GrammarTipsPage
 *
 * Language-specific tips — pronunciation laws, expressions, proverbs,
 * mnemonics — seeded from hand-written material and extendable on demand by
 * the "ask AI for a new tip" button.
 *
 * Tips are matched to the reader's interface language by its 2-letter prefix
 * (see grammarService.getTips) — an "en-GB" reader sees tips written for
 * "en-US" and vice versa, since region variants of the reader's own language
 * are the same content. The grammar being described (targetLang) still has
 * to match exactly: different countries' Portuguese genuinely differ.
 */
const GrammarTipsPage = () => {
  const { isDarkMode, user, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tips, setTips] = useState([]);
  const [category, setCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const targetLang = user?.learningDialect;
  const supported = isGrammarSupported(targetLang);

  const loadTips = useCallback(async () => {
    if (!user?.token || !supported) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const list = await getTips({
        token: user.token,
        targetLang,
        explanationLocale: interfaceLang,
      });
      setTips(list);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, targetLang, interfaceLang, supported]);

  useEffect(() => { loadTips(); }, [loadTips]);

  // ── Ask AI for a new tip ───────────────────────────────────────────────────
  const handleGenerateTip = async () => {
    if (!canUseAI) {
      showAlert("warning", t("ai_usage.limit_reached"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
      return;
    }

    // A tip is generated for one category. "all" means no category is chosen,
    // so pick one at random rather than refusing — the point of the button is
    // to produce something new without making the user decide first.
    const targetCategory = category === "all"
      ? TIP_CATEGORIES[Math.floor(Math.random() * TIP_CATEGORIES.length)]
      : category;

    setIsGenerating(true);
    try {
      const created = await generateTip({
        token: user.token,
        targetLang,
        explanationLocale: interfaceLang,
        category: targetCategory,
        // Pass what's already there so the model writes something new rather
        // than rewording a tip the user can already see.
        knownTitles: tips.map((tip) => tip.title),
      });
      setTips((prev) => [created, ...prev]);
      showAlert("success", t("grammar.tip_created"));
    } catch (err) {
      showAlert("error", err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const breadcrumbItems = [
    { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
    { label: t("dashboard.grammar"), onClick: () => navigate("/dashboard/grammar") },
    { label: t("grammar.tips") },
  ];

  if (!supported) {
    return (
      <FeaturePageShell isDarkMode={isDarkMode} accentColor="amber" breadcrumbItems={breadcrumbItems}>
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("grammar.not_available_for_language")}
          </p>
        </Card>
      </FeaturePageShell>
    );
  }

  const categoryOptions = [
    { value: "all", label: t("grammar.category.all", "All") },
    ...TIP_CATEGORIES.map((c) => ({ value: c, label: t(`grammar.category.${c}`, c) })),
  ];

  const visibleTips = category === "all" ? tips : tips.filter((tip) => tip.category === category);

  return (
    <FeaturePageShell isDarkMode={isDarkMode} accentColor="amber" breadcrumbItems={breadcrumbItems}>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <NeoDropdown
          options={categoryOptions}
          value={category}
          onChange={setCategory}
          isDarkMode={isDarkMode}
          label={t("grammar.filter_by_category")}
          className="flex-1"
        />
        <PrimaryButton
          onClick={handleGenerateTip}
          disabled={isGenerating}
          loading={isGenerating}
          isDarkMode={isDarkMode}
          color="amber"
        >
          <Sparkles size={16} />
          {t("grammar.ask_for_tip")}
        </PrimaryButton>
      </div>

      {isLoading && <Loader message={t("grammar.loading_tips")} isDarkMode={isDarkMode} />}

      {!isLoading && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {!isLoading && !error && visibleTips.length === 0 && (
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("grammar.no_tips")}
          </p>
        </Card>
      )}

      {!isLoading && visibleTips.length > 0 && (
        <div className="flex flex-col gap-4">
          {visibleTips.map((tip) => (
            <Card key={tip.id} isDarkMode={isDarkMode}>
              <div className="flex items-start gap-3 mb-2">
                <div className={`shrink-0 p-2 rounded-lg border-2 ${
                  isDarkMode ? "border-yellow-500/50 text-yellow-400" : "border-yellow-400 text-yellow-600"
                }`}>
                  <Lightbulb size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className={`font-black uppercase tracking-tight ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}>
                    {tip.title}
                  </h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${
                    isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"
                  }`}>
                    {t(`grammar.category.${tip.category}`, tip.category)}
                  </span>
                </div>
              </div>

              <p className={`mb-3 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                {tip.body}
              </p>

              <GrammarExampleList
                examples={tip.examples}
                targetLang={targetLang}
                isDarkMode={isDarkMode}
                keyPrefix={`tip-${tip.id}`}
              />
            </Card>
          ))}
        </div>
      )}
    </FeaturePageShell>
  );
};

export default GrammarTipsPage;
