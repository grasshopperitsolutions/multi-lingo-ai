import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UtensilsCrossed } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const FoodPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={UtensilsCrossed}
        title={t("dashboard.food")}
        description={t("dashboard.food_desc")}
        color="text-lime-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default FoodPage;
