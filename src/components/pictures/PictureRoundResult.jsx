import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { GhostButton, PrimaryButton } from "../ui";

/**
 * PictureRoundResult
 *
 * The end of a round, the same for every picture game: how it went, "play
 * again", and the way back to the menu.
 *
 * It never scolds. A low score gets the same "play again" as a high one, and
 * the line above it is the game's to word (a round of eight with three right is
 * "3 / 8", not a verdict).
 */
const PictureRoundResult = ({ headline, detail, onAgain, isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      className={`flex flex-col items-center gap-5 w-full max-w-md mx-auto rounded-2xl border-4 p-8 text-center animate-in fade-in zoom-in-95 ${
        isDarkMode
          ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
          : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
      }`}
    >
      <span className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-400 border-4 border-slate-900">
        <Trophy size={28} className="text-slate-900" aria-hidden="true" />
      </span>
      <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>{headline}</h2>
      {detail && (
        <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{detail}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PrimaryButton onClick={onAgain} isDarkMode={isDarkMode} color="sky">
          {t("picture_games.play_again")}
        </PrimaryButton>
        <GhostButton onClick={() => navigate("/dashboard/picture-games")} isDarkMode={isDarkMode}>
          {t("picture_games.back_to_menu")}
        </GhostButton>
      </div>
    </div>
  );
};

PictureRoundResult.propTypes = {
  headline: PropTypes.string.isRequired,
  detail: PropTypes.string,
  onAgain: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default PictureRoundResult;
