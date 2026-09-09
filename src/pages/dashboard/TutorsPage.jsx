import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Info, Loader2, UserPlus } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import { FeaturePageShell, ErrorBanner, SearchBar, Pagination } from "../../components/ui";
import TutorCard from "../../components/TutorCard";
import { canBeTutor, createTutorDraft, getTutorProfile, listTutors } from "../../services/tutorService";

/**
 * The tutor directory.
 *
 * Live entries come from the public `tutors` collection. The signed-in
 * viewer's own listing, if one exists, is pinned first regardless of the
 * search/filter state and regardless of whether it's currently published —
 * this page is also where a tutor finds their own draft again. A single
 * generic placeholder closes the grid; it used to be one card per language
 * ("Español", "Français"), which promised specific tutors that didn't exist
 * yet. It is dropped entirely while searching or filtering, since "more
 * tutors are applying" reads as a false match otherwise.
 *
 * A visitor with no tutor doc yet gets a small "become a tutor" / "apply"
 * button at the bottom of the page, not a grid card — deciding whether to
 * become a tutor isn't a listing, and a dashed placeholder card among real
 * ones overstated it.
 */

const PAGE_SIZE = 9; // three rows of the three-column grid

const TutorsPage = () => {
  const { isDarkMode, user, supportedLanguages, interfaceLanguageOptions } = useAppContext();
  const { tier } = useTierAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tutors, setTutors] = useState([]);
  // undefined = not checked yet, null = checked and there is none.
  const [myProfile, setMyProfile] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [languageFilters, setLanguageFilters] = useState([]);
  const [page, setPage] = useState(1);

  const eligible = canBeTutor(tier);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [publicList, own] = await Promise.all([
        listTutors(),
        user?.uid ? getTutorProfile(user.uid) : Promise.resolve(null),
      ]);
      setTutors(publicList);
      setMyProfile(own);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleBecomeTutor = async () => {
    setIsCreatingProfile(true);
    setError(null);
    try {
      const draft = await createTutorDraft();
      setMyProfile({ ...draft, uid: user.uid });
      navigate("/settings#tutorSettings");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleApply = () => navigate("/settings#tutorSettings");

  // Everyone except the viewer's own entry — that one is pinned separately,
  // above the search results, so filters don't hide the one card that also
  // acts as a control (the "update my profile" button lives on it).
  const others = tutors.filter((tutor) => tutor.uid !== user?.uid);

  const languageToggle = (value) =>
    setLanguageFilters((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );

  const filterGroups = useMemo(
    () => [
      {
        id: "language",
        label: t("tutors.filter_language"),
        options: (interfaceLanguageOptions ?? []).map((l) => ({ value: l.code, label: l.label || l.code })),
        activeValues: languageFilters,
        onToggle: languageToggle,
      },
    ],
    [interfaceLanguageOptions, languageFilters, t],
  );

  const isFiltering = searchValue.trim() !== "" || languageFilters.length > 0;

  const filtered = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();
    return others.filter((tutor) => {
      const matchesText =
        !needle ||
        tutor.displayName?.toLowerCase().includes(needle) ||
        tutor.description?.toLowerCase().includes(needle);

      const matchesLanguage =
        languageFilters.length === 0 ||
        languageFilters.some((code) => tutor.languages?.includes(code));

      return matchesText && matchesLanguage;
    });
  }, [others, searchValue, languageFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 whenever the result set changes shape — a stale page
  // number from a wider search would otherwise show an empty grid.
  useEffect(() => {
    setPage(1);
  }, [searchValue, languageFilters]);

  const showTrailingPlaceholder = !isFiltering && safePage === totalPages;

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="emerald"
      title={t("tutors.title")}
      reportContext="tutors"
      breadcrumbItems={[{ label: t("dashboard.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {t("tutors.subtitle")}
      </p>

      <ErrorBanner error={error} isDarkMode={isDarkMode} />

      <div className="mt-6">
        <SearchBar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder={t("tutors.search_placeholder")}
          filterGroups={filterGroups}
          isDarkMode={isDarkMode}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 py-12 justify-center">
          <Loader2 size={22} className="animate-spin" />
          <span className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("common.loading", "Loading…")}
          </span>
        </div>
      ) : (
        <>
          {user && myProfile && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              <TutorCard
                tutor={myProfile}
                isDarkMode={isDarkMode}
                isOwn
                languageOptions={supportedLanguages}
              />
            </div>
          )}

          {pageItems.length === 0 && isFiltering ? (
            <p className={`mt-8 text-sm font-bold text-center py-8 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {t("tutors.no_results")}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {pageItems.map((tutor) => (
                <TutorCard
                  key={tutor.uid}
                  tutor={tutor}
                  isDarkMode={isDarkMode}
                  languageOptions={supportedLanguages}
                />
              ))}
              {showTrailingPlaceholder && <TutorCard comingSoon isDarkMode={isDarkMode} />}
            </div>
          )}

          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} isDarkMode={isDarkMode} />
        </>
      )}

      {/* Not decoration: we take no commission and have no affiliation with
          any platform a tutor links to, and saying so plainly is the honest
          counterpart to letting them link anywhere. */}
      <div
        className={`mt-10 p-4 rounded-2xl border-2 flex items-start gap-3
          ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-600"}`}
      >
        <Info size={18} className="shrink-0 mt-0.5" />
        <p className="text-xs font-bold">{t("tutors.disclaimer")}</p>
      </div>

      {/* A small button, not another grid card — see the file header. Only
          offered once loading has settled and there's genuinely no profile
          to show instead. */}
      {user && myProfile === null && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={eligible ? handleBecomeTutor : handleApply}
            disabled={isCreatingProfile}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95
              ${isDarkMode ? "border-slate-600 text-slate-300 hover:border-yellow-400 hover:text-yellow-400" : "border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600"}
              ${isCreatingProfile ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {isCreatingProfile
              ? <Loader2 size={14} className="animate-spin" />
              : <UserPlus size={14} />}
            {eligible ? t("tutors.become_tutor") : t("tutors.apply_title")}
          </button>
        </div>
      )}
    </FeaturePageShell>
  );
};

export default TutorsPage;
