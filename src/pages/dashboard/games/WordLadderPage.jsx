import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell } from "../../../components/ui";
import Loader from "../../../components/Loader";

const WordLadderGame = lazy(() => import("../../../components/WordLadderGame"));

const WordLadderPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="rose"
      title={t("challenges.word_ladder")}
      reportContext="WordLadderPage"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("challenges.title", "Challenges"), onClick: () => navigate("/dashboard/challenges") },
        { label: t("challenges.word_ladder") },
      ]}
    >
      <Suspense fallback={<Loader isDarkMode={isDarkMode} />}>
        <WordLadderGame isDarkMode={isDarkMode} />
      </Suspense>
    </FeaturePageShell>
  );
};

export default WordLadderPage;
