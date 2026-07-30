import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const StoryGeneratorPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("dashboard.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={BookOpen}
        title={t("dashboard.story_generator")}
        description={t("dashboard.story_generator_desc")}
        color="text-rose-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default StoryGeneratorPage;
