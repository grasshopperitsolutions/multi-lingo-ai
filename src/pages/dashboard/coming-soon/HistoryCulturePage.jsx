import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Landmark } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const HistoryCulturePage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("dashboard.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={Landmark}
        title={t("dashboard.history_culture")}
        description={t("dashboard.history_culture_desc")}
        color="text-orange-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default HistoryCulturePage;
