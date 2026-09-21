import PropTypes from "prop-types";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import { FeaturePageShell, ToneChoice, AiNotice } from "../ui";

/**
 * ProToolShell
 *
 * Everything the three professional tool pages share: the route gate, the
 * breadcrumb trail back through the hub, the formal/informal toggle, and the
 * AI notice that has to be on screen before anything is generated.
 *
 * The gate is here rather than in each page because forgetting it on one page
 * would leave a Maestro-only tool reachable by URL for anyone. One
 * implementation, three pages, no way to omit it.
 *
 * The tone value itself lives in the caller (useToneChoice), because the page
 * has to pass it to its service call — the shell only renders the control.
 */
const ProToolShell = ({
  title,
  isDarkMode,
  tone,
  onToneChange,
  toneDisabled = false,
  reportContext,
  children,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAppContext();
  const { canAccess, isReady } = useTierAccess();

  const isLocked = isReady && !canAccess("professional_tools");

  useEffect(() => {
    if (!isLocked) return;
    navigate("/dashboard", { replace: true });
    showAlert("warning", t("subscription.errors.upgrade_required"), {
      label: t("pricing.upgrade"),
      onClick: () => navigate("/pricing"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  if (isLocked) return null;

  return (
    // All three tools take `targetLang = user.learningDialect` and offer no
    // picker of their own, so the practice language silently decides which
    // market a CV is judged against and which language an email comes out in.
    // That is the strongest case in the app for naming it on screen.
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="indigo"
      title={title}
      showPracticeLanguage
      reportContext={reportContext}
      showFavourite={false}
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        {
          label: t("dashboard.professional_tools"),
          onClick: () => navigate("/dashboard/professional-tools"),
        },
        { label: title },
      ]}
    >
      <div className="flex flex-col gap-3">
        {/* The label lives inside the control now — it is a fieldset with a
            legend, so repeating it out here would announce it twice. Capped
            in width because three stacked options across a wide page read as
            a list of content rather than as one setting. */}
        <ToneChoice
          value={tone}
          onChange={onToneChange}
          isDarkMode={isDarkMode}
          disabled={toneDisabled}
          className="max-w-md"
        />
        {/* Before anything is generated, so the promise in the Terms holds for
            a reader who never presses the button. */}
        <AiNotice isDarkMode={isDarkMode} variant="input" />
      </div>

      {children}
    </FeaturePageShell>
  );
};

ProToolShell.propTypes = {
  title: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  tone: PropTypes.string.isRequired,
  onToneChange: PropTypes.func.isRequired,
  /** True while a request is in flight — the register must not change mid-call. */
  toneDisabled: PropTypes.bool,
  reportContext: PropTypes.string,
  children: PropTypes.node,
};

export default ProToolShell;
