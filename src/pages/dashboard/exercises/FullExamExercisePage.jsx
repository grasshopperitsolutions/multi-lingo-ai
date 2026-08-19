import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { FeaturePageShell } from "../../../components/ui";
import Loader from "../../../components/Loader";

const FullExamExercise = lazy(() => import("../../../components/FullExamExercise"));

const FullExamExercisePage = () => {
  const { isDarkMode, showAlert } = useAppContext();
  const { canAccess } = useTierAccess();
  const isLocked = !canAccess("full_exam");
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Access is configured in Admin > Tiers & Features. Guard the route directly
  // so it can't be bypassed by visiting the URL, not just the menu card.
  useEffect(() => {
    if (isLocked) {
      navigate("/dashboard/exam-training", { replace: true });
      showAlert("warning", t("subscription.errors.upgrade_required"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  if (isLocked) return null;

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="teal"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("exam.training", "Exam Training"), onClick: () => navigate("/dashboard/exam-training") },
        { label: t("exam.full_exam") },
      ]}
    >
      <Suspense fallback={<Loader isDarkMode={isDarkMode} />}>
        <FullExamExercise
          isDarkMode={isDarkMode}
          onBack={() => navigate("/dashboard/exam-training")}
        />
      </Suspense>
    </FeaturePageShell>
  );
};

export default FullExamExercisePage;
