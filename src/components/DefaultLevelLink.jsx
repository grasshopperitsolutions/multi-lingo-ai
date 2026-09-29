import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { resolvePracticeLevel } from "../config/examLevels";

/**
 * "Default level · B1 · Change", under every level picker.
 *
 * A picker inside a feature changes the level for that visit only. This line
 * says what it starts from and where that is set, so a learner who keeps
 * moving it from A1 to B2 finds the one place to say so once. It links to
 * the practice-language card in Settings, which opens itself from the hash.
 *
 * Same shape as the spoken tutor's voice line, which it sits under there.
 */
const DefaultLevelLink = ({ isDarkMode = false }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const level = resolvePracticeLevel(user?.practiceLevels, user?.learningDialect);

  return (
    <p className="flex flex-wrap items-center gap-x-2">
      <span
        className={`text-[10px] font-black uppercase tracking-widest ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {t("practice_level.default_label")}
      </span>
      <span className={`text-xs font-black ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
        {level}
      </span>
      <Link
        to="/settings#practiceLanguage"
        className={`inline-flex min-h-[44px] items-center rounded px-1 text-xs font-black underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 ${
          isDarkMode
            ? "text-sky-300 hover:text-sky-200 focus-visible:ring-sky-300"
            : "text-blue-700 hover:text-blue-600 focus-visible:ring-blue-600"
        }`}
      >
        {t("practice_level.change")}
      </Link>
    </p>
  );
};

DefaultLevelLink.propTypes = {
  isDarkMode: PropTypes.bool,
};

export default DefaultLevelLink;
