import { useState, useEffect, useCallback, useRef } from "react";
import { isAiDeclined } from "../../services/aiService";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Landmark, Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import { useTts } from "../../hooks/useTts";
import { useInterestTopics } from "../../hooks/useInterestTopics";
import { getFact, getFactContent, getFactPoolStatus } from "../../services/historyCultureService";
import { markHistoryFactSeen, resetSeenHistoryFacts } from "../../services/userService";
import CustomRequestInput from "../../components/CustomRequestInput";
import InterestPicker from "../../components/InterestPicker";
import SeenProgressCard from "../../components/SeenProgressCard";
import DownloadPdfButton from "../../components/DownloadPdfButton";
import TappableParagraph from "../../components/TappableParagraph";
import WordLookupSheet from "../../components/WordLookupSheet";
import { useWordLookup } from "../../hooks/useWordLookup";
import Loader from "../../components/Loader";
import { FeaturePageShell, Card, ErrorBanner, PrimaryButton, TtsControls } from "../../components/ui";

/**
 * HistoryCulturePage
 *
 * Short AI-written pieces about the country behind the language being learned,
 * read in the user's own interface language.
 *
 * Cache-first: the random path draws from a shared pool and costs nothing.
 * Typing a subject, or choosing one of the reader's interests in the sidebar,
 * generates to order; both are custom requests, gated the same way. Otherwise
 * interests only theme newly generated facts — they never filter the pool.
 */
const HistoryCulturePage = () => {
  const { isDarkMode, user, setUser, interfaceLang, showAlert } = useAppContext();
  const { canUseAI, canAccess } = useTierAccess();
  const { topics } = useInterestTopics();
  const { ttsState, playTts, pauseTts, stopTts } = useTts();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [description, setDescription] = useState("");
  // One of the reader's interests as the subject, or null for none in particular.
  const [interestId, setInterestId] = useState(null);
  // What the pool holds in this language and how much the reader has read:
  // drives the "seen" card and the custom-request gate.
  const [poolStatus, setPoolStatus] = useState(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [fact, setFact] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // The same piece in the language being practised, fetched only when asked
  // for. The reading stays in the reader's own language — this sits beside it.
  const [practiceVersion, setPracticeVersion] = useState(null);
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);
  const [practiceError, setPracticeError] = useState(null);
  const [showPractice, setShowPractice] = useState(false);
  const practiceRequestRef = useRef(null);

  const targetLang = user?.learningDialect;
  // Tap a word to look it up, hold it to bank it — on practice-language text
  // only, since looking up words in your own language teaches nothing.
  const { activeWord, activeSentence, lookup, close: closeLookup, bank } = useWordLookup();

  const cacheExhausted = poolStatus?.exhausted ?? false;
  // A chosen interest is a custom request, gated like the description box.
  // Derived, so a lock that returns (after a reset, say) drops the choice
  // rather than sending it anyway.
  const canCustomise = canAccess("custom_requests") || cacheExhausted;
  const activeInterest = canCustomise ? topics.find((topic) => topic.id === interestId) ?? null : null;

  // An interest and a written request are both "what the piece is about", so
  // only one at a time: choosing an interest clears the request box.
  const handleSelectInterest = (id) => {
    setInterestId(id);
    if (id) setDescription("");
  };

  useEffect(() => {
    if (!user?.token || !targetLang) return;
    let cancelled = false;
    setIsLoadingPool(true);

    getFactPoolStatus({
      token: user.token,
      targetLang,
      seenFactIds: user?.seenHistoryFactsIds ?? [],
    })
      .then((status) => { if (!cancelled) setPoolStatus(status); })
      .catch(() => { /* leaving the box locked on failure is the safe default */ })
      .finally(() => { if (!cancelled) setIsLoadingPool(false); });

    return () => { cancelled = true; };
  }, [user, targetLang]);

  // Forgets every piece the reader has been shown. The effect above re-reads
  // the pool off the profile, so the card and the gate follow.
  const handleResetSeen = async () => {
    try {
      await resetSeenHistoryFacts(user.token, user.uid);
      setUser((prev) => ({ ...prev, seenHistoryFactsIds: [] }));
    } catch (err) {
      showAlert("error", err.message || t("settings.errors.save_failed"));
    }
  };

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
        interest: activeInterest,
      });
      setFact(result);
      setPracticeVersion(null);
      setPracticeError(null);
      setShowPractice(false);
      practiceRequestRef.current = null;

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

  /**
   * The piece in the language being practised, fetched the first time it is
   * asked for and never before.
   *
   * Usually free: a fact about Portugal was written in pt-PT, so the practice
   * language *is* its `sourceLocale` and this is a plain Firestore read of a
   * document that already exists. It only spends a call when the piece
   * happened to be written in some other language, and then the result is
   * cached under that locale for everybody after.
   */
  const ensurePracticeVersion = useCallback(() => {
    if (practiceVersion) return Promise.resolve(practiceVersion);
    if (practiceRequestRef.current) return practiceRequestRef.current;
    if (!fact || !targetLang || fact.locale === targetLang) return Promise.resolve(null);

    setIsLoadingPractice(true);
    setPracticeError(null);

    const request = getFactContent({
      token: user.token,
      factId: fact.factId,
      sourceLocale: fact.sourceLocale ?? fact.locale,
      locale: targetLang,
    })
      .then((result) => {
        setPracticeVersion(result);
        return result;
      })
      .catch((err) => {
        setPracticeError(err.message);
        return null;
      })
      .finally(() => {
        setIsLoadingPractice(false);
        practiceRequestRef.current = null;
      });

    practiceRequestRef.current = request;
    return request;
  }, [practiceVersion, fact, targetLang, user]);

  const togglePractice = async () => {
    if (showPractice) {
      setShowPractice(false);
      return;
    }
    const ready = await ensurePracticeVersion();
    if (ready) setShowPractice(true);
  };

  /** Nothing to offer when the piece is already in the practice language. */
  const canShowPractice = !!fact && !!targetLang && fact.locale !== targetLang;

  // One string for the whole piece, so listening plays straight through
  // instead of needing a control per paragraph.
  const spokenText = fact
    ? [fact.title, ...(fact.paragraphs ?? [])].filter(Boolean).join("\n\n")
    : "";

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      showPracticeLanguage
      accentColor="rose"
      title={t("dashboard.history_culture")}
      reportContext="HistoryCulturePage"
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <div className="flex flex-col lg:flex-row gap-5">
        {/* The controls and the "seen" card, as in the Tale Creator. On a
            phone they come first: they are what the page starts from. */}
        <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          <div className={`rounded-2xl border-4 p-4 flex flex-col gap-4 ${
            isDarkMode
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
          }`}>
            <InterestPicker
              interests={topics}
              value={activeInterest?.id ?? null}
              onChange={handleSelectInterest}
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
              className="w-full"
            >
              <Sparkles size={16} />
              {fact ? t("history_culture.discover_another") : t("history_culture.discover")}
            </PrimaryButton>
          </div>

          <SeenProgressCard
            title={t("history_culture.seen_title")}
            seenCount={poolStatus ? poolStatus.total - poolStatus.unseen : 0}
            totalCount={poolStatus?.total ?? 0}
            isLoading={isLoadingPool && !poolStatus}
            onReset={handleResetSeen}
            resetDisabled={(user?.seenHistoryFactsIds?.length ?? 0) === 0}
            resetLabel={t("history_culture.reset_seen_btn")}
            resetTitle={t("history_culture.reset_seen_title")}
            resetMessage={t("history_culture.reset_seen_message")}
            resetWarning={t("history_culture.reset_seen_warning")}
            resetConfirmLabel={t("history_culture.reset_seen_confirm")}
            isDarkMode={isDarkMode}
          />
        </aside>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <CustomRequestInput
            value={description}
            onChange={setDescription}
            placeholder={activeInterest ? t("interest_picker.description_blocked") : t("history_culture.description_placeholder")}
            cacheExhausted={cacheExhausted}
            disabled={isLoading || !!activeInterest}
            isDarkMode={isDarkMode}
          />

          {isLoading && <Loader message={t("history_culture.loading")} isDarkMode={isDarkMode} />}

          {!isLoading && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

          {!isLoading && fact && (
            <Card isDarkMode={isDarkMode}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`shrink-0 p-2 rounded-lg border-2 ${
                  isDarkMode ? "border-orange-500/50 text-orange-400" : "border-orange-400 text-orange-600"
                }`}>
                  <Landmark size={16} />
                </div>
                <h2 className={`text-xl font-black tracking-tight flex-1 min-w-0 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {fact.title}
                </h2>

                {/* Read aloud in whatever language the piece actually came back in
                    (fact.locale), not the interface language — the translation is
                    best-effort and can fall back to the source. */}
                {/* Out of the shared clip cache: title + all three paragraphs go
                    out as a single request, which can run past the cache's
                    900KB write cap (roughly two minutes of speech) once a piece
                    runs long. A clip that misses the cap still plays fine, it
                    just never gets stored — quietly paying full price on every
                    play for exactly the content most expensive to regenerate.
                    Per-paragraph caching, the way StoryReader does it, would fix
                    this properly; until that's built, this stays uncached. */}
                <TtsControls
                  cacheable={false}
                  ttsKey="history-fact"
                  text={spokenText}
                  lang={fact.locale}
                  token={user?.token}
                  accent="rose"
                  ttsState={ttsState}
                  playTts={playTts}
                  pauseTts={pauseTts}
                  stopTts={stopTts}
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* The title in the language being practised, with the paragraphs
                  it opens with, and tappable like them. Under the title, as in
                  the Tale Creator, where the translated title sits. */}
              {showPractice && practiceVersion?.title && (
                <TappableParagraph
                  text={practiceVersion.title}
                  lang={targetLang}
                  onLookup={lookup}
                  onBank={bank}
                  isDarkMode={isDarkMode}
                  className={`-mt-1 mb-3 text-sm font-bold italic ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                />
              )}

              {/* Things you do to the whole piece, in one row as in the Tale
                  Creator: save it, and see it in the language you practise.
                  The PDF is always offered; the translation only when the
                  piece isn't already in that language. */}
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <DownloadPdfButton
                    title={fact.title}
                    paragraphs={fact.paragraphs ?? []}
                    languageLabel={fact.locale}
                    isDarkMode={isDarkMode}
                  />

                  {canShowPractice && (
                    <button
                      type="button"
                      onClick={togglePractice}
                      disabled={isLoadingPractice}
                      aria-expanded={showPractice}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 disabled:opacity-40 ${
                        isDarkMode
                          ? "border-slate-600 text-slate-300 hover:border-rose-400 hover:text-rose-400"
                          : "border-slate-300 text-slate-600 hover:border-rose-600 hover:text-rose-600"
                      }`}
                    >
                      {isLoadingPractice
                        ? <Loader2 size={13} className="animate-spin" />
                        : showPractice ? <EyeOff size={13} /> : <Eye size={13} />}
                      {showPractice
                        ? t("history_culture.hide_practice", { locale: targetLang })
                        : t("history_culture.show_practice", { locale: targetLang })}
                    </button>
                  )}
                </div>

                {canShowPractice && practiceError && (
                  <p className={`mt-2 text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
                    {t("history_culture.practice_unavailable")}
                  </p>
                )}
              </div>

              {fact.paragraphs.map((paragraph, i) => {
                const practiceParagraph = showPractice ? practiceVersion?.paragraphs?.[i] : null;
                return (
                  <div
                    key={i}
                    className={`mb-3 last:mb-0 ${
                      practiceParagraph ? "grid gap-3 grid-cols-1 sm:grid-cols-2" : ""
                    }`}
                  >
                    {/* When the piece is already in the practice language (read
                        in it, or its translation fell back to it), its own words
                        are the ones worth looking up. */}
                    {fact.locale === targetLang ? (
                      <TappableParagraph
                        text={paragraph}
                        lang={fact.locale}
                        onLookup={lookup}
                        onBank={bank}
                        isDarkMode={isDarkMode}
                        className={`leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
                      />
                    ) : (
                      <p
                        lang={fact.locale}
                        className={`leading-relaxed text-justify hyphens-auto ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
                      >
                        {paragraph}
                      </p>
                    )}

                    {practiceParagraph && (
                      <TappableParagraph
                        text={practiceParagraph}
                        lang={targetLang}
                        onLookup={lookup}
                        onBank={bank}
                        isDarkMode={isDarkMode}
                        className={`leading-relaxed rounded-xl border-2 px-3 py-2 ${
                          isDarkMode
                            ? "border-slate-700 bg-slate-900/40 text-slate-200"
                            : "border-slate-200 bg-slate-50 text-slate-800"
                        }`}
                      />
                    )}
                  </div>
                );
              })}

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
        </div>
      </div>

      <WordLookupSheet
        word={activeWord}
        sentence={activeSentence ?? undefined}
        targetLang={targetLang}
        isDarkMode={isDarkMode}
        onClose={closeLookup}
      />
    </FeaturePageShell>
  );
};

export default HistoryCulturePage;
