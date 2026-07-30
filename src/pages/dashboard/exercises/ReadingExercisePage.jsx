import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../../contexts/AppContext";
import { FeaturePageShell } from "../../../components/ui";
import Loader from "../../../components/Loader";

const ReadingExercise = lazy(() => import("../../../components/ReadingExercise"));

const ReadingExercisePage = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="teal"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("exam.training", "Exam Training"), onClick: () => navigate("/dashboard/exam-training") },
        { label: t("exam.reading") },
      ]}
    >
      <Suspense fallback={<Loader isDarkMode={isDarkMode} />}>
        <ReadingExercise isDarkMode={isDarkMode} />
      </Suspense>
    </FeaturePageShell>
  );
};

export default ReadingExercisePage;
