import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dumbbell } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell, ComingSoonContent } from "../../../components/ui";

/**
 * Grammar drills are built but held back until the library and tips have been
 * tested in production. The hub card is disabled, so this route is only
 * reachable by typing the URL — same arrangement as the crosswords stub.
 */
const GrammarPracticeComingSoonPage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="amber"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("dashboard.grammar"), onClick: () => navigate("/dashboard/grammar") },
        { label: t("grammar.practice") },
      ]}
    >
      <ComingSoonContent
        icon={Dumbbell}
        title={t("grammar.practice")}
        description={t("grammar.practice_desc")}
        color="text-emerald-500"
        isDarkMode={isDarkMode}
      />
    </FeaturePageShell>
  );
};

export default GrammarPracticeComingSoonPage;
