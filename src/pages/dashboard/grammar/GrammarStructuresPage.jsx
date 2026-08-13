import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { isGrammarSupported } from "../../../config/grammarSupport";
import { getTopics, getTopicContent } from "../../../services/grammarService";
import GrammarExampleList from "../../../components/GrammarExampleList";
import GrammarTable from "../../../components/GrammarTable";
import Loader from "../../../components/Loader";
import { FeaturePageShell, Card, ErrorBanner, GhostButton, SearchBar } from "../../../components/ui";

/**
 * GrammarStructuresPage
 *
 * The structure library: topics grouped by family, with a detail view showing
 * the explanation, its tables, examples and common pitfalls.
 *
 * Content is fetched per explanation locale and generated on demand when that
 * locale is missing (see grammarService.getTopicContent), so a learner reading
 * in French sees French explanations of the same Portuguese grammar.
 */
const GrammarStructuresPage = () => {
  const { isDarkMode, user, interfaceLang, showAlert } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [contentLocale, setContentLocale] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState(null);

  const targetLang = user?.learningDialect;
  const supported = isGrammarSupported(targetLang);

  // ── Load the topic list ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.token || !supported) {
      setIsLoadingTopics(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const list = await getTopics({ token: user.token, targetLang });
        if (!cancelled) setTopics(list);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoadingTopics(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, targetLang, supported]);

  // ── Open a topic ───────────────────────────────────────────────────────────
  const handleSelectTopic = useCallback(async (topic) => {
    setSelectedTopic(topic);
    setContent(null);
    setContentLocale(null);
    setIsLoadingContent(true);
    setError(null);

    try {
      const result = await getTopicContent({
        token: user.token,
        topic,
        explanationLocale: interfaceLang,
      });
      setContent(result.content);
      setContentLocale(result.locale);
      // Be honest when we had to fall back to a language they didn't ask for.
      if (result.source === "fallback" && result.locale !== interfaceLang) {
        showAlert("info", t("grammar.content_fallback_locale", { locale: result.locale }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingContent(false);
    }
  }, [user, interfaceLang, showAlert, t]);

  const breadcrumbItems = [
    { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
    { label: t("dashboard.grammar"), onClick: () => navigate("/dashboard/grammar") },
    { label: t("grammar.structures") },
  ];

  // ── Guard: unsupported learning language ───────────────────────────────────
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

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selectedTopic) {
    return (
      <FeaturePageShell isDarkMode={isDarkMode} accentColor="amber" breadcrumbItems={breadcrumbItems}>
        <GhostButton onClick={() => setSelectedTopic(null)} isDarkMode={isDarkMode} className="self-start">
          <ArrowLeft size={16} />
          {t("grammar.all_topics")}
        </GhostButton>

        {isLoadingContent && <Loader message={t("grammar.loading_topic")} isDarkMode={isDarkMode} />}

        {!isLoadingContent && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

        {!isLoadingContent && content && (
          <div className="flex flex-col gap-4">
            <Card isDarkMode={isDarkMode}>
              <h2 className={`text-2xl font-black uppercase tracking-tighter mb-2 ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                {content.title}
              </h2>
              {content.summary && (
                <p className={`font-bold mb-4 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  {content.summary}
                </p>
              )}
              {content.explanation.split("\n").filter(Boolean).map((paragraph, i) => (
                <p key={i} className={`mb-3 last:mb-0 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  {paragraph}
                </p>
              ))}
              {contentLocale && contentLocale !== interfaceLang && (
                <p className={`mt-4 text-xs font-bold uppercase tracking-widest ${
                  isDarkMode ? "text-amber-400" : "text-amber-600"
                }`}>
                  {t("grammar.shown_in_locale", { locale: contentLocale })}
                </p>
              )}
            </Card>

            {content.tables?.length > 0 && (
              <Card isDarkMode={isDarkMode}>
                <div className="flex flex-col gap-6">
                  {content.tables.map((table, i) => (
                    <GrammarTable
                      key={i}
                      caption={table.caption}
                      headers={table.headers}
                      rows={table.rows}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              </Card>
            )}

            {content.examples?.length > 0 && (
              <Card isDarkMode={isDarkMode}>
                <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}>
                  {t("grammar.examples")}
                </h3>
                <GrammarExampleList
                  examples={content.examples}
                  targetLang={targetLang}
                  isDarkMode={isDarkMode}
                  keyPrefix="topic"
                />
              </Card>
            )}

            {content.pitfalls?.length > 0 && (
              <Card isDarkMode={isDarkMode}>
                <h3 className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-3 ${
                  isDarkMode ? "text-rose-400" : "text-rose-600"
                }`}>
                  <AlertTriangle size={14} />
                  {t("grammar.pitfalls")}
                </h3>
                <ul className="flex flex-col gap-2">
                  {content.pitfalls.map((pitfall, i) => (
                    <li key={i} className={`text-sm font-semibold ${
                      isDarkMode ? "text-slate-300" : "text-slate-700"
                    }`}>
                      • {pitfall}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </FeaturePageShell>
    );
  }

  // ── List view, grouped by family ───────────────────────────────────────────
  // Match against what the user can actually see (the translated topic and
  // family names) as well as the raw key, so searching "verb" finds the family
  // and searching "estar" finds ser-estar regardless of interface language.
  const term = searchTerm.trim().toLowerCase();
  const visibleTopics = term
    ? topics.filter((topic) =>
        [
          t(`grammar.topic.${topic.key}`, topic.key.replace(/-/g, " ")),
          t(`grammar.family.${topic.family}`, topic.family),
          topic.key.replace(/-/g, " "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
    : topics;

  const families = visibleTopics.reduce((acc, topic) => {
    (acc[topic.family] ??= []).push(topic);
    return acc;
  }, {});

  return (
    <FeaturePageShell isDarkMode={isDarkMode} accentColor="amber" breadcrumbItems={breadcrumbItems}>
      {isLoadingTopics && <Loader message={t("grammar.loading_topics")} isDarkMode={isDarkMode} />}

      {!isLoadingTopics && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {!isLoadingTopics && !error && topics.length === 0 && (
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("grammar.no_topics")}
          </p>
        </Card>
      )}

      {!isLoadingTopics && !error && topics.length > 0 && (
        <SearchBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t("grammar.search_placeholder")}
          isDarkMode={isDarkMode}
        />
      )}

      {!isLoadingTopics && !error && topics.length > 0 && visibleTopics.length === 0 && (
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("grammar.no_search_results")}
          </p>
        </Card>
      )}

      {!isLoadingTopics && visibleTopics.length > 0 && (
        <div className="flex flex-col gap-6">
          {Object.entries(families).map(([family, familyTopics]) => (
            <section key={family}>
              <h2 className={`text-xs font-black uppercase tracking-widest mb-3 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}>
                {t(`grammar.family.${family}`, family)}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {familyTopics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => handleSelectTopic(topic)}
                    className={`p-4 rounded-xl border-4 text-left transition-all hover:-translate-y-1 active:scale-95 ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]"
                        : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
                    }`}
                  >
                    <span className={`font-black text-sm uppercase tracking-tight ${
                      isDarkMode ? "text-white" : "text-slate-900"
                    }`}>
                      {t(`grammar.topic.${topic.key}`, topic.key.replace(/-/g, " "))}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </FeaturePageShell>
  );
};

export default GrammarStructuresPage;
