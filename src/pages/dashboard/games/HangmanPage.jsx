import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell } from "../../../components/ui";
import Loader from "../../../components/Loader";

const HangmanGame = lazy(() => import("../../../components/HangmanGame"));

const HangmanPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="rose"
      title={t("challenges.hangman")}
      reportContext="HangmanPage"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("challenges.title", "Challenges"), onClick: () => navigate("/dashboard/challenges") },
        { label: t("challenges.hangman") },
      ]}
    >
      <Suspense fallback={<Loader isDarkMode={isDarkMode} />}>
        <HangmanGame isDarkMode={isDarkMode} />
      </Suspense>
    </FeaturePageShell>
  );
};

export default HangmanPage;
