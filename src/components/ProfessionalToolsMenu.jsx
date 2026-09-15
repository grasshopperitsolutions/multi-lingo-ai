import PropTypes from "prop-types";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { PROFESSIONAL_SECTIONS as SECTIONS } from "../config/professionalTools";
import { useTierAccess } from "../hooks/useTierAccess";
import { Breadcrumb, FeatureHeader, AiNotice } from "./ui";

/**
 * ProfessionalToolsMenu
 *
 * The hub behind /dashboard/professional-tools, replacing the Coming Soon
 * stub that stood there since launch.
 *
 * Modelled on GrammarMenu, with one deliberate difference: the sub-tools are
 * not separately gated. They share the `professional_tools` key, so if you can
 * reach this hub you can use all three — there is no per-card badge to show.
 * That keeps the Admin surface to one row rather than four.
 */
const ToolCard = ({ title, description, icon: Icon, color, onClick, isDarkMode }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all hover:-translate-y-1 active:scale-95 ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}
  >
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-4 border-slate-900 flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={20} className="text-slate-900" />
    </div>
    <div className="min-w-0">
      <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${
        isDarkMode ? "text-white" : "text-slate-900"
      }`}>{title}</h3>
      <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${
        isDarkMode ? "text-slate-400" : "text-slate-500"
      }`}>{description}</p>
    </div>
  </button>
);

ToolCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  color: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const ProfessionalToolsMenu = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAppContext();
  const { canAccess, isReady } = useTierAccess();

  // Only a loaded config can lock the route — redirecting on the first render
  // would bounce every user out before their access is known.
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
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="indigo"
        items={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
      />

      <FeatureHeader
        title={t("dashboard.professional_tools")}
        isDarkMode={isDarkMode}
        accentColor="indigo"
        favouriteId="professional_tools"
        reportContext="ProfessionalToolsMenu"
      />

      <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {t("professional.intro")}
      </p>

      <AiNotice isDarkMode={isDarkMode} variant="input" />

      <div className="grid grid-cols-1 gap-3">
        {SECTIONS.map((section) => (
          <ToolCard
            key={section.id}
            title={t(section.titleKey)}
            description={t(section.descKey)}
            icon={section.icon}
            color={section.color}
            onClick={() => navigate(section.route)}
            isDarkMode={isDarkMode}
          />
        ))}
      </div>
    </div>
  );
};

ProfessionalToolsMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default ProfessionalToolsMenu;
