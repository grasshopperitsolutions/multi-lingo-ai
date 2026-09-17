import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Camera, Loader2 } from "lucide-react";
import { auth } from "../../../firebase";
import { useAppContext } from "../../../contexts/AppContext";
import { analysePhoto } from "../../../services/photoCaptureService";
import { isAiDeclined } from "../../../services/aiService";
import PersonalWidgetCard from "../PersonalWidgetCard";
import { AiNotice, GhostButton } from "../../ui";

/**
 * PhotoCaptureWidget
 *
 * Photograph a page of your own notes and have the words, phrases, mistakes
 * and questions on it filed into the rest of this dashboard.
 *
 * It reads the student's **own** material — a notebook page, an exercise,
 * corrected homework. That is what makes a "mistake" possible: a wrong→right
 * pair has to come from something they wrote. A menu would yield vocabulary
 * and nothing else, and the prompt says as much.
 *
 * **Nothing is written from here.** This widget produces proposals and hands
 * them up; the review screen is where a person decides. A model reading
 * handwriting will misread some of it, and the cost of a wrong guess has to
 * be a glance and a delete, never a silent write into somebody's own notes.
 *
 * The photo is never stored — it goes into the request, is read, and is gone.
 * `capture="environment"` asks a phone for the rear camera, so the common
 * case is point-and-shoot rather than a trip through the gallery.
 */
const PhotoCaptureWidget = ({ onAnalysed, isDarkMode }) => {
  const { t } = useTranslation();
  const { user, showAlert } = useAppContext();

  const inputRef = useRef(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately, so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file || isBusy) return;

    setIsBusy(true);
    try {
      const result = await analysePhoto({
        token: await auth.currentUser.getIdToken(),
        file,
        learningLang: user?.learningDialect || "",
        interfaceLang: user?.interfaceLang || "",
      });

      if (result.proposals.length === 0) {
        showAlert("info", t("personal.photo_nothing_found"));
        return;
      }
      onAnalysed(result);
    } catch (err) {
      // Declining the spend prompt is an answer, not a failure — alerting on
      // it would tell someone their own decision went wrong.
      if (isAiDeclined(err)) return;
      showAlert("error", err.message || t("personal.photo_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <PersonalWidgetCard widgetId="photo" isDarkMode={isDarkMode}>
      <AiNotice isDarkMode={isDarkMode} variant="input" className="mb-3" />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      <GhostButton
        onClick={() => inputRef.current?.click()}
        disabled={isBusy}
        isDarkMode={isDarkMode}
        className="w-full min-h-[44px]"
      >
        {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
        {isBusy ? t("personal.photo_reading") : t("personal.photo_cta")}
      </GhostButton>

      <p className={`mt-3 text-xs font-semibold leading-relaxed break-words ${
        isDarkMode ? "text-slate-400" : "text-slate-500"
      }`}>
        {t("personal.photo_hint")}
      </p>
    </PersonalWidgetCard>
  );
};

PhotoCaptureWidget.propTypes = {
  onAnalysed: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default PhotoCaptureWidget;
