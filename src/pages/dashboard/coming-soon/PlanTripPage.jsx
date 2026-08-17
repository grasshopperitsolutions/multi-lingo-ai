import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plane } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const PlanTripPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={Plane}
        title={t("dashboard.plan_trip")}
        description={t("dashboard.plan_trip_desc")}
        color="text-pink-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default PlanTripPage;
