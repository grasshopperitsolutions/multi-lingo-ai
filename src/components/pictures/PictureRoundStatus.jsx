import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ImageOff, Loader2 } from "lucide-react";
import Loader from "../Loader";
import { PrimaryButton } from "../ui";

/**
 * PictureRoundStatus
 *
 * What a picture game shows instead of a board: the round loading, a pool too
 * thin to play, or a read that failed. One component, so all three games say it
 * the same way.
 *
 * "Thin" is not an error and says so. A language is new, or the pictures are
 * still being drawn, and the honest answer is "not enough pictures yet", with
 * the one thing that helps: it is being worked on, and the player can come back
 * or try again.
 */
const PictureRoundStatus = ({ status, isFilling, error, onRetry, isDarkMode }) => {
  const { t } = useTranslation();

  if (status === "loading") {
    return <Loader isDarkMode={isDarkMode} message={t("picture_games.loading")} />;
  }

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-rose-500 font-semibold px-4">{error || t("picture_games.error")}</p>
        <PrimaryButton onClick={onRetry} isDarkMode={isDarkMode}>
          {t("picture_games.try_again")}
        </PrimaryButton>
      </div>
    );
  }

  // thin
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center max-w-md mx-auto">
      <ImageOff size={40} className={muted} aria-hidden="true" />
      <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {t("picture_games.thin.title")}
      </h2>
      <p className={`text-sm font-semibold px-4 ${muted}`}>{t("picture_games.thin.body")}</p>
      {isFilling && (
        <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${muted}`}>
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {t("picture_games.thin.filling")}
        </p>
      )}
      <PrimaryButton onClick={onRetry} isDarkMode={isDarkMode}>
        {t("picture_games.try_again")}
      </PrimaryButton>
    </div>
  );
};

PictureRoundStatus.propTypes = {
  status: PropTypes.oneOf(["loading", "thin", "error"]).isRequired,
  isFilling: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default PictureRoundStatus;
