import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Briefcase } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const ProfessionalToolsPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("dashboard.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={Briefcase}
        title={t("dashboard.professional_tools")}
        description={t("dashboard.professional_tools_desc")}
        color="text-indigo-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default ProfessionalToolsPage;
