import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { isGrammarSupported } from "../../../config/grammarSupport";
import { getTips, generateTip, TIP_CATEGORIES } from "../../../services/grammarService";
import {
  FAVOURITE_KINDS,
  getFavouriteIds,
  toggleFavourite,
  favouriteFieldFor,
} from "../../../services/favouritesService";
import GrammarExampleList from "../../../components/GrammarExampleList";
import Loader from "../../../components/Loader";
import NeoDropdown from "../../../components/NeoDropdown";
import {
  FeaturePageShell,
  Card,
  ErrorBanner,
  PrimaryButton,
  CollapsibleCard,
  FavouriteButton,
} from "../../../components/ui";

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
  const { isDarkMode, user, setUser, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tips, setTips] = useState([]);
  const [category, setCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  // Ids mid-write, so a double-click can't fire two toggles for the same tip.
  const [pendingFavIds, setPendingFavIds] = useState([]);

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

  // ── Favourite / unfavourite a tip ──────────────────────────────────────────
  // Optimistic: the heart flips immediately and the AppContext user is updated
  // in place, so the state survives navigating away and back without a re-read.
  // On failure the context is left untouched and the alert explains why.
  const handleToggleFavourite = async (tipId) => {
    if (!user?.token || !user?.uid || pendingFavIds.includes(tipId)) return;

    const currentIds = getFavouriteIds(user, FAVOURITE_KINDS.GRAMMAR_TIP);
    setPendingFavIds((prev) => [...prev, tipId]);

    try {
      const { ids } = await toggleFavourite({
        token: user.token,
        uid: user.uid,
        kind: FAVOURITE_KINDS.GRAMMAR_TIP,
        id: tipId,
        currentIds,
      });
      setUser((prev) => ({ ...prev, [favouriteFieldFor(FAVOURITE_KINDS.GRAMMAR_TIP)]: ids }));
    } catch (err) {
      showAlert("error", err.message);
    } finally {
      setPendingFavIds((prev) => prev.filter((id) => id !== tipId));
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
  const favouriteTipIds = getFavouriteIds(user, FAVOURITE_KINDS.GRAMMAR_TIP);

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

      {/* Collapsed by default: the page is a list to scan for the tip you want,
          and a dozen fully-expanded tips buried the filter above them. The
          heart rides in headerAction so tapping it doesn't also toggle open. */}
      {!isLoading && visibleTips.length > 0 && (
        <div className="flex flex-col gap-4">
          {visibleTips.map((tip) => {
            const isFav = favouriteTipIds.includes(tip.id);
            return (
              <CollapsibleCard
                key={tip.id}
                title={tip.title}
                isDarkMode={isDarkMode}
                defaultOpen={false}
                headerAction={
                  <FavouriteButton
                    isFavourite={isFav}
                    onToggle={() => handleToggleFavourite(tip.id)}
                    disabled={pendingFavIds.includes(tip.id)}
                    isDarkMode={isDarkMode}
                  />
                }
              >
                <div className="mt-3">
                  <span className={`inline-block mb-3 px-2 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${
                    isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"
                  }`}>
                    {t(`grammar.category.${tip.category}`, tip.category)}
                  </span>

                  <p className={`mb-3 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {tip.body}
                  </p>

                  <GrammarExampleList
                    examples={tip.examples}
                    targetLang={targetLang}
                    isDarkMode={isDarkMode}
                    keyPrefix={`tip-${tip.id}`}
                  />
                </div>
              </CollapsibleCard>
            );
          })}
        </div>
      )}
    </FeaturePageShell>
  );
};

export default GrammarTipsPage;
