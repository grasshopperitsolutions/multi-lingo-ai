import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PenLine } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

const GrammarPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      breadcrumbItems={[{ label: t("dashboard.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <ComingSoonContent
        icon={PenLine}
        title={t("dashboard.grammar")}
        description={t("dashboard.grammar_desc")}
        color="text-amber-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default GrammarPage;
