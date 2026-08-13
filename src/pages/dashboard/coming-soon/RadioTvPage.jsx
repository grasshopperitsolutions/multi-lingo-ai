import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RadioTower } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const RadioTvPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={RadioTower}
        title={t("dashboard.radio_tv")}
        description={t("dashboard.radio_tv_desc")}
        color="text-cyan-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default RadioTvPage;
