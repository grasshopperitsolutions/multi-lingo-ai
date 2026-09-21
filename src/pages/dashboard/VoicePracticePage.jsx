import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mic, Square, Sparkles, ShieldCheck } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import { useTts } from "../../hooks/useTts";
import { useVoiceRecorder, MAX_RECORDING_MS } from "../../hooks/useVoiceRecorder";
import { isAiDeclined } from "../../services/aiService";
import { getPassage, gradePronunciation } from "../../services/pronunciationService";
import { markPassageSeen } from "../../services/userService";
import { getCefrLevelOptions } from "../../config/examLevels";
import { saveTake, loadTake, clearTake } from "../../utils/recordingStore";
import Loader from "../../components/Loader";
import NeoDropdown from "../../components/NeoDropdown";
import {
  FeaturePageShell,
  Card,
  ErrorBanner,
  PrimaryButton,
  GhostButton,
  LevelBadge,
  TtsControls,
  AiNotice,
} from "../../components/ui";

/**
 * VoicePracticePage
 *
 * Read a passage aloud, hear yourself, hear how it should sound, and ask for
 * feedback. Four steps, deliberately separate: the AI call is the last one and
 * the only one that costs anything, so nobody spends it by accident.
 *
 * **The recording never leaves the page except as part of that one request.**
 * `useVoiceRecorder` holds it as a Blob, playback is a local object URL, and
 * asking for feedback attaches it inline to `askAI`. Nothing is uploaded,
 * nothing is written to Firestore, and the note saying so is on screen rather
 * than only in the privacy policy — §2.6 promises exactly this, and a promise
 * people cannot see is one they cannot rely on.
 *
 * The passage comes from a shared pool and is free; only the feedback is
 * generated per person. See pronunciationService for why those halves differ.
 */
const VoicePracticePage = () => {
  const { isDarkMode, user, setUser, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { ttsState, playTts, pauseTts, stopTts } = useTts();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const recorder = useVoiceRecorder();
  // The blob restored on mount. Without this the restore would immediately
  // write back what it just read — harmless, but a pointless round trip on
  // every page load.
  const restoredBlobRef = useRef(null);

  const [level, setLevel] = useState("A1");
  const [passage, setPassage] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isLoadingPassage, setIsLoadingPassage] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState(null);

  const targetLang = user?.learningDialect;
  const cefrLevelOptions = getCefrLevelOptions(t);

  // Bring back the last take, so a reload — or a request that failed and a
  // page left in frustration — does not cost somebody the reading they did.
  // The passage comes back with it: a recording with nothing to compare it
  // against is no use, and there would be nothing left to read either.
  useEffect(() => {
    let cancelled = false;
    loadTake().then((take) => {
      if (cancelled || !take?.passage) return;
      setPassage(take.passage);
      setLevel(take.passage.level ?? "A1");
      restoredBlobRef.current = take.blob;
      recorder.adopt(take.blob, take.mimeType);
    });
    return () => { cancelled = true; };
    // Mount only: this restores a starting state, and re-running it would
    // overwrite whatever the reader has done since.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetPassage = async () => {
    setIsLoadingPassage(true);
    setError(null);
    setFeedback(null);
    recorder.reset();
    // The old take belongs to the old passage; keeping it would offer a
    // recording of something no longer on screen.
    clearTake();
    try {
      const seenPassageIds = user?.seenPassageIds ?? [];
      const result = await getPassage({ token: user.token, level, targetLang, seenPassageIds });
      setPassage(result);

      // Remembered on the profile so the pool keeps handing out something new
      // across sessions — the same contract the story and fact pools use, and
      // fire-and-forget for the same reason: seeing a passage twice is a minor
      // annoyance, not worth blocking the reading on a write.
      markPassageSeen(user.token, user.uid, result.passageId, seenPassageIds)
        .then(() => {
          setUser((prev) => ({
            ...prev,
            seenPassageIds: [...new Set([...seenPassageIds, result.passageId])],
          }));
        })
        .catch(() => { /* a repeat later is a minor inconvenience */ });
    } catch (err) {
      if (isAiDeclined(err)) return;
      const message = err.message ?? t("common.error", "Something went wrong. Please try again.");
      setError(message);
      showAlert("error", message, { label: t("common.try_again", "Try Again"), onClick: handleGetPassage });
    } finally {
      setIsLoadingPassage(false);
    }
  };

  // Kept on the device as soon as a take exists, so the reading survives a
  // reload or a failed request. Only ever the most recent one — see
  // utils/recordingStore for why a history would be the wrong thing to hold.
  useEffect(() => {
    const take = recorder.recording;
    if (!take?.blob || !passage) return;
    if (take.blob === restoredBlobRef.current) return; // just restored it
    saveTake({ blob: take.blob, mimeType: take.mimeType, passage });
  }, [recorder.recording, passage]);

  const handleClear = () => {
    recorder.reset();
    clearTake();
  };

  const handleSubmit = async () => {
    if (!canUseAI) {
      showAlert("warning", t("ai_usage.limit_reached"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
      return;
    }

    setIsGrading(true);
    setError(null);
    try {
      const audio = await recorder.toInlineAudio();
      if (!audio) {
        setError(t("pronunciation.mic_empty"));
        return;
      }
      const result = await gradePronunciation({
        token: user.token,
        audio,
        text: passage.text,
        targetLang,
        explanationLang: interfaceLang,
        level: passage.level,
      });
      setFeedback(result);
    } catch (err) {
      if (isAiDeclined(err)) return;
      const message = err.message ?? t("common.error", "Something went wrong. Please try again.");
      setError(message);
      showAlert("error", message, { label: t("common.try_again", "Try Again"), onClick: handleSubmit });
    } finally {
      setIsGrading(false);
    }
  };

  const recorderMessage = {
    permission: t("pronunciation.mic_denied"),
    unsupported: t("pronunciation.mic_unsupported"),
    empty: t("pronunciation.mic_empty"),
  }[recorder.error];

  const seconds = Math.floor(recorder.elapsedMs / 1000);
  const remaining = Math.max(0, Math.ceil(MAX_RECORDING_MS / 1000) - seconds);

  const mutedText = isDarkMode ? "text-slate-400" : "text-slate-500";
  const labelClasses = `text-[11px] font-black uppercase tracking-widest ${mutedText}`;

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      showPracticeLanguage
      accentColor="violet"
      title={t("dashboard.voice_practice")}
      reportContext="VoicePracticePage"
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <NeoDropdown
            options={cefrLevelOptions}
            value={level}
            onChange={setLevel}
            isDarkMode={isDarkMode}
            label={t("exam.sidebar.level", "Level")}
            className="flex-1"
          />
          <PrimaryButton
            onClick={handleGetPassage}
            disabled={isLoadingPassage || isGrading}
            loading={isLoadingPassage}
            isDarkMode={isDarkMode}
            color="sky"
          >
            <Sparkles size={16} />
            {passage ? t("pronunciation.new_passage") : t("pronunciation.get_passage")}
          </PrimaryButton>
        </div>

        {/* Before anything is generated, per Terms §3.3. */}
        <AiNotice isDarkMode={isDarkMode} variant="input" />

        {isLoadingPassage && (
          <Loader message={t("pronunciation.loading_passage")} isDarkMode={isDarkMode} />
        )}

        {!isLoadingPassage && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

        {!isLoadingPassage && !passage && !error && (
          <Card isDarkMode={isDarkMode}>
            <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              {t("pronunciation.empty_state")}
            </p>
          </Card>
        )}

        {!isLoadingPassage && passage && (
          <Card isDarkMode={isDarkMode}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <LevelBadge level={passage.level} isDarkMode={isDarkMode} color="violet" />
                <span className={labelClasses}>{t("pronunciation.read_aloud")}</span>
              </div>

              {/* Hearing it done properly is half the exercise, and it is the
                  one control here that costs nothing per press after the
                  first — TTS clips are cached by key. */}
              <TtsControls
                ttsKey={`pronunciation-${passage.passageId}`}
                text={passage.text}
                lang={passage.targetLang}
                token={user?.token}
                accent="violet"
                ttsState={ttsState}
                playTts={playTts}
                pauseTts={pauseTts}
                stopTts={stopTts}
                isDarkMode={isDarkMode}
              />
            </div>

            {/* Larger than body text and generously spaced: this is meant to be
                read aloud from, possibly at arm's length. */}
            <p
              className={`text-lg sm:text-xl font-bold leading-relaxed ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              {passage.text}
            </p>

            {passage.focus.length > 0 && (
              <div className="mt-4">
                <p className={`${labelClasses} mb-2`}>{t("pronunciation.focus_label")}</p>
                <div className="flex flex-wrap gap-2">
                  {passage.focus.map((sound) => (
                    <span
                      key={sound}
                      className={`px-2.5 py-1 rounded-full border-2 text-xs font-bold ${
                        isDarkMode
                          ? "bg-slate-900 border-violet-700 text-violet-200"
                          : "bg-violet-50 border-violet-300 text-violet-800"
                      }`}
                    >
                      {sound}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {passage && (
          <Card isDarkMode={isDarkMode}>
            <div className="flex flex-wrap items-center gap-3">
              {recorder.isRecording ? (
                <PrimaryButton onClick={recorder.stop} isDarkMode={isDarkMode} color="rose">
                  <Square size={16} />
                  {t("pronunciation.stop")} · {seconds}s
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  onClick={recorder.start}
                  disabled={isGrading || !recorder.isSupported}
                  isDarkMode={isDarkMode}
                  color="violet"
                >
                  <Mic size={16} />
                  {recorder.recording ? t("pronunciation.rerecord") : t("pronunciation.record")}
                </PrimaryButton>
              )}

              {/* Only while it matters. A countdown from the first second would
                  rush a reading that has ages left. */}
              {recorder.isRecording && remaining <= 15 && (
                <span className={`text-xs font-black ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
                  {remaining}s
                </span>
              )}
            </div>

            {recorderMessage && (
              <p className={`mt-3 text-sm font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
                {recorderMessage}
              </p>
            )}

            {recorder.recording && !recorder.isRecording && (
              <div className="mt-4 flex flex-col gap-3">
                <p className={labelClasses}>{t("pronunciation.your_take")}</p>
                {/* The browser's own player. Nothing here is uploaded — the src
                    is an object URL over a Blob held in memory. */}
                <audio src={recorder.recording.url} controls className="w-full" />

                <div className="flex flex-wrap items-center gap-3">
                  <PrimaryButton
                    onClick={handleSubmit}
                    disabled={isGrading}
                    loading={isGrading}
                    isDarkMode={isDarkMode}
                    color="sky"
                  >
                    <Sparkles size={16} />
                    {t("pronunciation.submit")}
                  </PrimaryButton>
                  <GhostButton onClick={handleClear} disabled={isGrading} isDarkMode={isDarkMode}>
                    {t("common.clear")}
                  </GhostButton>
                </div>
              </div>
            )}

            {/* On screen, not only in the policy. A promise nobody can see is
                one nobody can rely on. */}
            <p className={`mt-4 flex items-start gap-2 text-xs font-semibold ${mutedText}`}>
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              {t("pronunciation.privacy_note")}
            </p>
          </Card>
        )}

        {isGrading && <Loader message={t("pronunciation.grading")} isDarkMode={isDarkMode} />}

        {feedback && !isGrading && (
          <Card isDarkMode={isDarkMode}>
            {feedback.score !== null && (
              <div className="flex items-baseline gap-3 mb-1">
                <span className={`text-4xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}>
                  {feedback.score}
                </span>
                <span className={labelClasses}>{t("pronunciation.score_label")}</span>
              </div>
            )}
            {/* Said once, next to the number, because a score from one short
                reading carries less than a number implies. */}
            {feedback.score !== null && (
              <p className={`text-xs font-semibold italic mb-4 ${mutedText}`}>
                {t("pronunciation.score_caveat")}
              </p>
            )}

            {feedback.summary && (
              <p className={`font-bold mb-4 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                {feedback.summary}
              </p>
            )}

            {feedback.transcript && (
              <div className="mb-4">
                <p className={`${labelClasses} mb-1`}>{t("pronunciation.transcript_label")}</p>
                <p className={`text-sm font-semibold italic leading-relaxed ${
                  isDarkMode ? "text-slate-300" : "text-slate-600"
                }`}>
                  {feedback.transcript}
                </p>
              </div>
            )}

            <p className={`${labelClasses} mb-2`}>{t("pronunciation.issues_label")}</p>
            {feedback.issues.length === 0 ? (
              <p className={`font-bold ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>
                {t("pronunciation.no_issues")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {feedback.issues.map((issue) => (
                  <li
                    key={`${issue.word}-${issue.tip}`}
                    className={`border-l-4 pl-3 ${isDarkMode ? "border-violet-600" : "border-violet-400"}`}
                  >
                    <p className={`font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                      {issue.word}
                      {issue.heard && (
                        <span className={`ml-2 text-xs font-semibold italic ${mutedText}`}>
                          {t("pronunciation.heard_as", { heard: issue.heard })}
                        </span>
                      )}
                    </p>
                    <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                      {issue.tip}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </FeaturePageShell>
  );
};

export default VoicePracticePage;
