import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const PLACEMENT = {
  // Inside a card's own bottom-right corner. The top corners are taken: the
  // status badge sits top-left and the lock top-right.
  corner: "absolute bottom-2 right-2",
  // Hanging off the corner of something too small to hold it, like the 64px
  // squares on the Today rail.
  overhang: "absolute -bottom-2 -right-2",
  // In a line of text, like a pricing row.
  inline: "",
};

/**
 * "Beta" — a feature that is released and usable, but may still change.
 *
 * Set per feature in Admin › Features (`beta` on the feature document). A
 * label, never a gate: whether someone may use the feature is still the
 * tier grants and `hidden`.
 */
const BetaBadge = ({ isDarkMode = false, placement = "corner" }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`${PLACEMENT[placement] ?? PLACEMENT.corner} z-10 inline-flex shrink-0 items-center rounded-md border-2 border-slate-900 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none tracking-widest ${
        isDarkMode ? "bg-violet-500 text-white" : "bg-violet-300 text-slate-900"
      }`}
    >
      {t("features.beta")}
    </span>
  );
};

BetaBadge.propTypes = {
  isDarkMode: PropTypes.bool,
  placement: PropTypes.oneOf(["corner", "overhang", "inline"]),
};

export default BetaBadge;
