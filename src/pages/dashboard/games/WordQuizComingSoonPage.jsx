import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NotebookPen } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const WordQuizComingSoonPage = () => {
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
        { label: t("challenges.word_quiz") },
      ]}
    >
      <ComingSoonContent
        icon={NotebookPen}
        title={t("challenges.word_quiz")}
        description={t("challenges.word_quiz_desc")}
        color="text-emerald-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default WordQuizComingSoonPage;
