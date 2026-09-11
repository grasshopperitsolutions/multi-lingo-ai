import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { FileDown, Loader2 } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { canExportPdf, exportReadingPdf } from "../utils/readingPdf";
import TooltipButton from "./TooltipButton";

/**
 * DownloadPdfButton
 *
 * Saves a story or a history/culture piece as a PDF. Both hand over the same
 * {title, paragraphs} shape, so one control serves both.
 *
 * The button knows before it is pressed whether the piece can be exported:
 * the built-in PDF font covers Latin scripts only (see utils/readingPdf), and
 * a reader practising Russian or Thai would otherwise get a file full of
 * blanks. When it can't, the control stays visible but disabled and says why
 * — a missing button reads as a bug, a disabled one with a reason reads as a
 * limit.
 *
 * Generation is local: no AI call, no request, nothing billed. It is offered
 * to every tier for exactly that reason.
 */
const DownloadPdfButton = ({ title, paragraphs, level, languageLabel, isDarkMode }) => {
  const { t } = useTranslation();
  const { showAlert } = useAppContext();
  const [isBusy, setIsBusy] = useState(false);

  const exportable = canExportPdf({ title, paragraphs });

  const handleDownload = async () => {
    if (!exportable || isBusy) return;
    setIsBusy(true);
    try {
      await exportReadingPdf({ title, paragraphs, level, languageLabel });
    } catch (err) {
      console.error("[DownloadPdfButton] PDF export failed:", err.message);
      showAlert(
        "error",
        err.code === "UNSUPPORTED_SCRIPT" ? t("pdf.unsupported_script") : t("pdf.failed"),
      );
    } finally {
      setIsBusy(false);
    }
  };

  const label = exportable ? t("pdf.download") : t("pdf.unsupported_script");

  return (
    <TooltipButton tooltip={label} isDarkMode={isDarkMode}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!exportable || isBusy}
        aria-label={label}
        aria-busy={isBusy}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 ${
          isDarkMode
            ? "border-slate-600 text-slate-300 hover:border-yellow-400 hover:text-yellow-400"
            : "border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600"
        } ${!exportable || isBusy ? "opacity-40 cursor-not-allowed hover:border-inherit" : ""}`}
      >
        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
        {isBusy ? t("pdf.preparing") : t("pdf.download")}
      </button>
    </TooltipButton>
  );
};

DownloadPdfButton.propTypes = {
  title: PropTypes.string.isRequired,
  paragraphs: PropTypes.arrayOf(PropTypes.string).isRequired,
  /** CEFR badge — stories have one, history/culture pieces don't. */
  level: PropTypes.string,
  /** Printed under the title, e.g. "Português (Portugal)". */
  languageLabel: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
};

export default DownloadPdfButton;
