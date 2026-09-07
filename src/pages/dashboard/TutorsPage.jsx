import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Info, Loader2 } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { FeaturePageShell, ErrorBanner } from "../../components/ui";
import TutorCard from "../../components/TutorCard";
import { listTutors } from "../../services/tutorService";

/**
 * The tutor directory.
 *
 * Replaces the "Coming Soon" placeholder this route used to render. Live
 * entries come from the public `tutors` collection; the placeholder cards are
 * a constant here because they advertise languages nobody teaches yet — there
 * is no data behind them and inventing a Firestore document to hold "no
 * tutor" would be worse than a two-line list.
 */
const PLACEHOLDER_LANGUAGES = ["Español", "Français"];

const TutorsPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tutors, setTutors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setTutors(await listTutors());
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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

      {isLoading ? (
        <div className="flex items-center gap-3 py-12 justify-center">
          <Loader2 size={22} className="animate-spin" />
          <span className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("common.loading", "Loading…")}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {tutors.map((tutor) => (
            <TutorCard key={tutor.uid} tutor={tutor} isDarkMode={isDarkMode} />
          ))}
          {PLACEHOLDER_LANGUAGES.map((language) => (
            <TutorCard key={language} comingSoon language={language} isDarkMode={isDarkMode} />
          ))}
        </div>
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
    </FeaturePageShell>
  );
};

export default TutorsPage;
