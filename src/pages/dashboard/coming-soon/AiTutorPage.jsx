import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BotMessageSquare } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const AiTutorPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("dashboard.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={BotMessageSquare}
        title={t("dashboard.ai_tutor")}
        description={t("dashboard.ai_tutor_desc")}
        color="text-blue-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default AiTutorPage;
