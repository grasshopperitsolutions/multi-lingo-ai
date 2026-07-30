import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Video } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const VoicePracticePage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("dashboard.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={Video}
        title={t("dashboard.voice_practice")}
        description={t("dashboard.voice_practice_desc")}
        color="text-purple-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default VoicePracticePage;
