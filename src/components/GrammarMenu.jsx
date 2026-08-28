import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { GRAMMAR_SECTIONS as SECTIONS } from "../config/favouritableFeatures";
import { isGrammarSupported } from "../config/grammarSupport";
import { useTierAccess } from "../hooks/useTierAccess";
import { FEATURE_STATUS, PURCHASABLE_STATUSES, getStatusBadge } from "../utils/featureAccess";
import StatusBadge from "./StatusBadge";
import { Breadcrumb, FeatureHeader } from "./ui";

// ── Sub-components ────────────────────────────────────────────────────────────
const GrammarCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, locked, badgeLabel }) => (
  <button
    onClick={onClick}
    disabled={locked}
    className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all ${
      locked
        ? "opacity-60 cursor-not-allowed"
        : "hover:-translate-y-1 active:scale-95"
    } ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}
  >
    {badgeLabel && <StatusBadge label={badgeLabel} isDarkMode={isDarkMode} />}
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
  locked:          PropTypes.bool,
  badgeLabel:      PropTypes.string,
};

// ── GrammarMenu ───────────────────────────────────────────────────────────────
const GrammarMenu = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const { featureStatus, isReady } = useTierAccess();

  const supported = isGrammarSupported(user?.learningDialect);

  // Section ids are namespaced as grammar_* feature keys (see
  // appConfig/config/features); access is configured on the Admin page.
  // Sections are never hidden — each carries a badge explaining why it isn't
  // usable yet, and a purchasable one routes to pricing.
  const sectionCards = isReady
    ? SECTIONS.map((section) => {
        const status = featureStatus(`grammar_${section.id}`);
        const badge = getStatusBadge(status);
        return {
          ...section,
          status,
          badgeLabel: badge && t(badge.key, badge.fallback),
          locked:
            status !== FEATURE_STATUS.AVAILABLE && !PURCHASABLE_STATUSES.includes(status),
        };
      })
    : [];

  const handleSectionSelect = (section) => {
    if (PURCHASABLE_STATUSES.includes(section.status)) {
      navigate("/pricing");
      return;
    }
    if (section.locked) return;
    navigate(section.route);
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="amber"
        items={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
      />

      <FeatureHeader
        title={t("dashboard.grammar")}
        isDarkMode={isDarkMode}
        accentColor="amber"
        favouriteId="grammar"
        reportContext="GrammarMenu"
      />

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
          {sectionCards.map((section) => (
            <GrammarCard
              key={section.id}
              title={t(section.titleKey)}
              description={t(section.descKey)}
              icon={section.icon}
              color={section.color}
              onClick={() => handleSectionSelect(section)}
              isDarkMode={isDarkMode}
              locked={section.locked}
              badgeLabel={section.badgeLabel}
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
