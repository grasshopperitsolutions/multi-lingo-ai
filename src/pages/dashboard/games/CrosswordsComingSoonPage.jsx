import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrainCircuit } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const CrosswordsComingSoonPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="rose"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("challenges.title", "Challenges"), onClick: () => navigate("/dashboard/challenges") },
        { label: t("challenges.crosswords") },
      ]}
    >
      <ComingSoonContent
        icon={BrainCircuit}
        title={t("challenges.crosswords")}
        description={t("challenges.crosswords_desc")}
        color="text-blue-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default CrosswordsComingSoonPage;
