import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserRound } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const RealPersonTutorPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("dashboard.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={UserRound}
        title={t("dashboard.real_person_tutor")}
        description={t("dashboard.real_person_tutor_desc")}
        color="text-emerald-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default RealPersonTutorPage;
