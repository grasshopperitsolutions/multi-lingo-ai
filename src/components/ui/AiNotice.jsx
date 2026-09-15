import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

/**
 * AiNotice.jsx
 *
 * Says, on screen, that what you are looking at came from a machine.
 *
 * This exists because the Terms already promise it. Section 3.3 states that
 * "as funcionalidades assentes em IA estão identificadas como tal na
 * interface" and that output "pode conter erros… O Utilizador é responsável
 * por rever os resultados antes de os utilizar." Until now the only thing
 * backing that promise was a sentence on a dashboard tile.
 *
 * Two variants, because the two moments are different:
 *
 *   input  — shown before anything is generated, so the promise holds for
 *            someone who reads the page and never presses the button.
 *   output — shown directly ABOVE a result, never below. It has to be read
 *            before the text is, not discovered after it has been copied into
 *            an email to an employer.
 *
 * Deliberately quiet: this is a standing fact about the tool, not an alert.
 * It is not dismissible — a notice you can turn off is not a notice.
 *
 * Do NOT put this on pages with no AI. A notice on a page that never calls a
 * model teaches people to skip it on the pages that do.
 */
const AiNotice = ({ isDarkMode, variant = "output", className = "" }) => {
  const { t } = useTranslation();

  const text =
    variant === "input"
      ? t("ai_notice.input_hint")
      : `${t("ai_notice.generated")} ${t("ai_notice.review_before_use")}`;

  return (
    <p
      className={`flex items-start gap-2 text-xs font-bold leading-relaxed ${
        isDarkMode ? "text-slate-400" : "text-slate-500"
      } ${className}`}
    >
      <Sparkles size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
};

AiNotice.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  /** "input" before generating, "output" above a result. */
  variant: PropTypes.oneOf(["input", "output"]),
  className: PropTypes.string,
};

export default AiNotice;
