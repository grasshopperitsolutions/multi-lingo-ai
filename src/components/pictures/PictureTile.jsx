import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Check, Flag, ImageOff, Loader2 } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { reportPicture } from "../../services/getImageService";
import TooltipButton from "../TooltipButton";

/**
 * How a tile looks once an answer is known.
 *
 * Colour is never the only signal (the games also say the word and play a
 * sound), but it is the quick one: green for the right picture, rose for the
 * one that was wrongly chosen, dimmed for the rest.
 */
const STATES = {
  idle: "",
  correct: "border-emerald-500 ring-4 ring-emerald-400",
  wrong: "border-rose-500 ring-4 ring-rose-400",
  dim: "opacity-50",
};

/**
 * ReportFlag
 *
 * "Esta imagem não corresponde à palavra." A wrong picture teaches the wrong
 * word to everybody, so every picture carries a way to say so. Counted once per
 * account on the server; here it only has to say thank you once.
 *
 * A sibling of the tile, never inside it: a tile that is an answer button must
 * not contain another button.
 */
const ReportFlag = ({ conceptId, isDarkMode }) => {
  const { t } = useTranslation();
  const { user, showAlert } = useAppContext();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleReport = async () => {
    if (sent || sending) return;
    setSending(true);
    await reportPicture(conceptId, user?.token);
    // Said once, whether or not it was the first report from this account: the
    // player's side of it is the same, and the server never double-counts.
    setSent(true);
    setSending(false);
    showAlert("success", t("picture_games.report.thanks"));
  };

  const label = sent ? t("picture_games.report.sent") : t("picture_games.report.label");

  return (
    // The corner is anchored here, on an element this component owns:
    // TooltipButton wraps its child in its own box, which would be the wrong
    // thing to position against.
    <div className="absolute top-1.5 right-1.5 z-10">
      <TooltipButton tooltip={label} isDarkMode={isDarkMode}>
        <button
          type="button"
          onClick={handleReport}
          disabled={sent || sending}
          aria-label={label}
          className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all active:scale-90 disabled:cursor-default ${
            sent
              ? "bg-emerald-400 border-slate-900 text-slate-900"
              : "bg-white/90 border-slate-900 text-slate-700 hover:bg-rose-100 hover:text-rose-600"
          }`}
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : sent ? <Check size={15} /> : <Flag size={15} />}
        </button>
      </TooltipButton>
    </div>
  );
};

ReportFlag.propTypes = {
  conceptId: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

/**
 * PictureTile
 *
 * One picture, on a white tile with a thick border, like a sticker.
 *
 * **The tile is always white, in both themes.** That is what keeps a picture
 * readable on a dark card: the prompts ask for a plain white background, and a
 * flat illustration dropped straight onto dark slate shows its box. A picture
 * therefore never sits directly on a card, always on this tile.
 *
 * It shows a skeleton while the picture loads, and a quiet "no picture" glyph if
 * the file cannot be fetched, so a broken URL is a visible gap and not a hole.
 *
 * With `onClick` the tile is a button (a game's answer option); without, it is a
 * plain image. The report flag is a sibling of either, shown only when asked
 * (after an answer is known, which is when a mismatch is noticed).
 */
const PictureTile = ({
  url,
  alt = "",
  conceptId,
  isDarkMode,
  state = "idle",
  onClick,
  disabled = false,
  showReport = false,
  ariaLabel,
  shape = "square",
  className = "",
}) => {
  // What happened to *this* url, keyed by the url itself. A new picture starts
  // over by being a different url, not by an effect resetting a flag.
  //
  // It used to be a flag reset in an effect, and that was a real bug: a picture
  // already in the browser's cache (every second view of a picture, with the
  // year-long immutable header) fires `load` before the mount effect runs, the
  // effect then overwrote "loaded" with "loading", and nothing ever fired again,
  // leaving a fully decoded picture hidden behind its own skeleton.
  const [outcome, setOutcome] = useState({ url: null, state: "loading" });
  const status = outcome.url === url ? outcome.state : "loading";

  const frame = `block w-full ${shape === "wide" ? "aspect-[4/3]" : "aspect-square"} overflow-hidden rounded-2xl border-4 bg-white transition-all ${
    state === "idle" || state === "dim" ? (isDarkMode ? "border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]" : "border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]") : ""
  } ${STATES[state] ?? ""}`;

  const inner = (
    <>
      {status !== "loaded" && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center bg-slate-100 ${status === "loading" ? "animate-pulse" : ""}`}
        >
          {status === "broken" && <ImageOff size={28} className="text-slate-400" />}
        </span>
      )}
      {url && status !== "broken" && (
        <img
          src={url}
          alt={alt}
          decoding="async"
          draggable={false}
          onLoad={() => setOutcome({ url, state: "loaded" })}
          onError={() => setOutcome({ url, state: "broken" })}
          className={`absolute inset-0 w-full h-full object-contain p-2 transition-opacity ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </>
  );

  return (
    <div className={`relative ${className}`}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
          className={`${frame} relative ${disabled ? "cursor-default" : "hover:-translate-y-0.5 active:scale-95"}`}
        >
          {inner}
        </button>
      ) : (
        <div className={`${frame} relative`} role={ariaLabel ? "img" : undefined} aria-label={ariaLabel}>
          {inner}
        </div>
      )}
      {showReport && conceptId && <ReportFlag conceptId={conceptId} isDarkMode={isDarkMode} />}
    </div>
  );
};

PictureTile.propTypes = {
  url: PropTypes.string,
  alt: PropTypes.string,
  conceptId: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
  state: PropTypes.oneOf(Object.keys(STATES)),
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  showReport: PropTypes.bool,
  ariaLabel: PropTypes.string,
  /** "wide" is the 4:3 of a scene; every word picture is square. */
  shape: PropTypes.oneOf(["square", "wide"]),
  className: PropTypes.string,
};

export default PictureTile;
