import PropTypes from "prop-types";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NotebookPen, Ticket, ListChecks, Quote, CircleAlert, Target } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "../hooks/useTierAccess";
import { Breadcrumb, FeatureHeader } from "./ui";

/**
 * PersonalMenu
 *
 * The hub behind /dashboard/personal — the one part of the app that holds the
 * user's own material rather than material the app generated.
 *
 * Six cards in a single column at every width. Not two columns on a wider
 * screen: six rows is a list you scroll with a thumb, and a grid of six is
 * something you have to read.
 *
 * The sub-pages are not separately gated. They share the `personal` key, so
 * reaching this hub means all six are usable — which keeps the Admin surface
 * to one row rather than seven.
 */
const SECTIONS = [
  {
    id: "notes",
    route: "/dashboard/personal/notes",
    icon: NotebookPen,
    color: "bg-violet-400",
    titleKey: "personal.notes_title",
    descKey: "personal.notes_desc",
  },
  {
    id: "lessons",
    route: "/dashboard/personal/lessons",
    icon: Ticket,
    color: "bg-emerald-400",
    titleKey: "personal.lessons_title",
    descKey: "personal.lessons_desc",
  },
  {
    id: "plan",
    route: "/dashboard/personal/plan",
    icon: ListChecks,
    color: "bg-sky-400",
    titleKey: "personal.plan_title",
    descKey: "personal.plan_desc",
  },
  {
    id: "phrasebook",
    route: "/dashboard/personal/phrasebook",
    icon: Quote,
    color: "bg-amber-400",
    titleKey: "personal.phrasebook_title",
    descKey: "personal.phrasebook_desc",
  },
  {
    id: "mistakes",
    route: "/dashboard/personal/mistakes",
    icon: CircleAlert,
    color: "bg-rose-400",
    titleKey: "personal.mistakes_title",
    descKey: "personal.mistakes_desc",
  },
  {
    id: "goal",
    route: "/dashboard/personal/goal",
    icon: Target,
    color: "bg-yellow-400",
    titleKey: "personal.goal_title",
    descKey: "personal.goal_desc",
  },
];

const PersonalCard = ({ title, description, icon: Icon, color, onClick, isDarkMode }) => (
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

PersonalCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  color: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const PersonalMenu = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAppContext();
  const { canAccess, isReady } = useTierAccess();

  const isLocked = isReady && !canAccess("personal_tools");

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
        accentColor="violet"
        items={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
      />

      <FeatureHeader
        title={t("dashboard.personal_tools")}
        isDarkMode={isDarkMode}
        accentColor="violet"
        favouriteId="personal_tools"
        reportContext="PersonalMenu"
      />

      <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {t("personal.intro")}
      </p>

      <div className="grid grid-cols-1 gap-3">
        {SECTIONS.map((section) => (
          <PersonalCard
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

PersonalMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PersonalMenu;
