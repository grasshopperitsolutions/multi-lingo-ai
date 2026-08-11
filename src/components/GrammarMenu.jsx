import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Library, Lightbulb, MessageCircleQuestion, Dumbbell } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { isGrammarSupported } from "../config/grammarSupport";
import StatusBadge from "./StatusBadge";
import ReportButton from "./ReportButton";
import { Breadcrumb } from "./ui";

// ── Section Registry ──────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "structures",
    route: "/dashboard/grammar/structures",
    icon: Library,
    color: "bg-amber-400",
    titleKey: "grammar.structures",
    descKey: "grammar.structures_desc",
    comingSoon: false,
  },
  {
    id: "tips",
    route: "/dashboard/grammar/tips",
    icon: Lightbulb,
    color: "bg-yellow-400",
    titleKey: "grammar.tips",
    descKey: "grammar.tips_desc",
    comingSoon: false,
  },
  {
    id: "ask",
    route: "/dashboard/grammar/ask",
    icon: MessageCircleQuestion,
    color: "bg-sky-400",
    titleKey: "grammar.ask",
    descKey: "grammar.ask_desc",
    comingSoon: false,
  },
  {
    id: "practice",
    route: "/dashboard/grammar/practice",
    icon: Dumbbell,
    color: "bg-emerald-400",
    titleKey: "grammar.practice",
    descKey: "grammar.practice_desc",
    comingSoon: true,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
const GrammarCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, comingSoon, comingSoonLabel }) => (
  <button
    onClick={onClick}
    disabled={comingSoon}
    className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all ${
      comingSoon
        ? "opacity-60 cursor-not-allowed"
        : "hover:-translate-y-1 active:scale-95"
    } ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}
  >
    {comingSoon && <StatusBadge label={comingSoonLabel} isDarkMode={isDarkMode} />}
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-4 border-slate-900 flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={20} className="text-slate-900" />
    </div>
    <div>
      <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${
        isDarkMode ? "text-white" : "text-slate-900"
      }`}>{title}</h3>
      <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${
        isDarkMode ? "text-slate-400" : "text-slate-500"
      }`}>{description}</p>
    </div>
  </button>
);
GrammarCard.propTypes = {
  title:           PropTypes.string.isRequired,
  description:     PropTypes.string.isRequired,
  icon:            PropTypes.elementType.isRequired,
  color:           PropTypes.string.isRequired,
  onClick:         PropTypes.func.isRequired,
  isDarkMode:      PropTypes.bool.isRequired,
  comingSoon:      PropTypes.bool,
  comingSoonLabel: PropTypes.string,
};

// ── GrammarMenu ───────────────────────────────────────────────────────────────
const GrammarMenu = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAppContext();

  const supported = isGrammarSupported(user?.learningDialect);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="amber"
        items={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
      />

      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}>
          {t("dashboard.grammar")}
        </h1>
        <ReportButton isDarkMode={isDarkMode} context="GrammarMenu" />
      </div>

      {/* The dashboard card is already disabled for unsupported languages, but a
          user can still reach this route directly — say why rather than showing
          an empty library. */}
      {!supported && (
        <div className={`rounded-xl border-4 p-4 ${
          isDarkMode
            ? "bg-slate-900 border-amber-700 text-amber-300"
            : "bg-amber-50 border-amber-400 text-amber-800"
        }`}>
          <p className="font-bold text-sm">
            {t("grammar.not_available_for_language")}
          </p>
        </div>
      )}

      {supported && (
        <div className="grid grid-cols-1 gap-3 mt-2">
          {SECTIONS.map((section) => (
            <GrammarCard
              key={section.id}
              title={t(section.titleKey)}
              description={t(section.descKey)}
              icon={section.icon}
              color={section.color}
              onClick={() => !section.comingSoon && navigate(section.route)}
              isDarkMode={isDarkMode}
              comingSoon={section.comingSoon}
              comingSoonLabel={t("challenges.coming_soon", "Coming Soon")}
            />
          ))}
        </div>
      )}
    </div>
  );
};

GrammarMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default GrammarMenu;
