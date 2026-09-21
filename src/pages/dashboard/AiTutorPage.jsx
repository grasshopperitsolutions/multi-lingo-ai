import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mic, Square, Loader2, ShieldCheck } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import { useLiveTutor, LIVE_STATUS, END_REASON } from "../../hooks/useLiveTutor";
import { getCefrLevelOptions } from "../../config/examLevels";
import NeoDropdown from "../../components/NeoDropdown";
import LiveTutorBlob from "../../components/LiveTutorBlob";
import {
  FeaturePageShell,
  Card,
  ErrorBanner,
  PrimaryButton,
  AiNotice,
} from "../../components/ui";

/**
 * AiTutorPage — "Fala com a IA"
 *
 * A spoken conversation with a tutor that corrects as you go.
 *
 * **Two controls and no more**: the level, and one round button that starts the
 * conversation and ends it. Everything else on screen is output. A voice
 * interface with a row of buttons is asking to be operated instead of talked
 * to, and the thing being practised is the talking.
 *
 * **The stage is dark in both themes.** Same decision as the practice-language
 * flag field: white on a dark ground is one contrast judgement that covers
 * light mode and dark mode at once, where a field that changes ground needs
 * two — and the blob's colours are chosen against a night sky.
 *
 * **The level stops being a control once the conversation starts.** It is
 * baked into the session at connect time, so changing it mid-way would mean
 * reconnecting; it becomes a chip that says what was chosen rather than a
 * picker that silently does nothing.
 *
 * **Nothing is recorded.** The microphone streams straight through the session
 * and the transcript is React state that dies with the page — no Blob, no
 * IndexedDB, nothing written anywhere. The note saying so is on screen, as it
 * is on the pronunciation page, because a promise nobody can see is one nobody
 * can rely on.
 *
 * Gated by `ai_tutor` in Admin. The server checks the same grant before
 * minting a token, so the lock here is a courtesy rather than the enforcement.
 */

/**
 * How close to the end the countdown appears.
 *
 * Deliberately not from the start. A clock running for the whole conversation
 * turns practice into an exam, and the number is only actionable once there is
 * something to wrap up — two minutes is enough to finish a thought.
 */
const SHOW_COUNTDOWN_UNDER_SECONDS = 120;

function formatClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const AiTutorPage = () => {
  const { isDarkMode, user, interfaceLang } = useAppContext();
  const { canAccess, isReady } = useTierAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [level, setLevel] = useState("A1");
  const cefrLevelOptions = getCefrLevelOptions(t);

  const {
    status,
    error,
    isSpeaking,
    turns,
    secondsLeft,
    endedBy,
    getAudioLevels,
    start,
    stop,
  } = useLiveTutor({
    user,
    targetLang: user?.learningDialect,
    explanationLang: interfaceLang,
    level,
  });

  const isLive = status === LIVE_STATUS.LIVE;
  const isConnecting = status === LIVE_STATUS.CONNECTING;
  const isEnded = status === LIVE_STATUS.ENDED;
  const isOpen = isLive || isConnecting;
  const allowed = isReady && canAccess("ai_tutor");

  // The transcript grows from the bottom, like every conversation people have
  // read before. Scrolling the container rather than calling `scrollIntoView`,
  // which would take the whole page with it.
  const listRef = useRef(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns, status]);

  const endedMessage =
    endedBy === END_REASON.IDLE
      ? `${t("live_tutor.ended_idle")} ${t("live_tutor.ended_hint")}`
      : endedBy === END_REASON.LIMIT
        ? `${t("live_tutor.ended_limit")} ${t("live_tutor.ended_hint")}`
        : `${t("live_tutor.ended")} ${t("live_tutor.ended_hint")}`;

  const statusLabel = isConnecting
    ? t("live_tutor.connecting")
    : isSpeaking
      ? t("live_tutor.speaking")
      : t("live_tutor.listening");

  const showCountdown =
    isLive && secondsLeft !== null && secondsLeft <= SHOW_COUNTDOWN_UNDER_SECONDS;

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      showPracticeLanguage
      accentColor="sky"
      title={t("dashboard.ai_tutor")}
      reportContext="AiTutorPage"
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <div className="flex flex-col gap-4">
        {isReady && !allowed && (
          <Card isDarkMode={isDarkMode}>
            <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              {t("live_tutor.locked")}
            </p>
            <PrimaryButton
              onClick={() => navigate("/pricing")}
              isDarkMode={isDarkMode}
              color="sky"
              className="mt-4 self-start"
            >
              {t("pricing.upgrade")}
            </PrimaryButton>
          </Card>
        )}

        {allowed && (
          <>
            {/* Before anything is generated, per Terms §3.3. */}
            <AiNotice isDarkMode={isDarkMode} variant="input" />

            {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

            <div
              className={`relative overflow-hidden rounded-3xl border-4 ${
                isDarkMode
                  ? "border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
                  : "border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
              }`}
            >
              <div className="absolute inset-0">
                <LiveTutorBlob getAudioLevels={getAudioLevels} isActive={isLive} />
              </div>

              <div className="relative grid min-h-[26rem] md:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                <div className="flex flex-col justify-between gap-5 p-4 sm:p-5">
                  {/* Only while a session is open. Once it has ended the level
                      is a choice again, for the next one. */}
                  {isOpen ? (
                    <span className="inline-flex items-center gap-2 self-start rounded-full border-2 border-slate-400/40 bg-slate-950/60 px-3 py-1.5 backdrop-blur-md">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {t("live_tutor.level_label")}
                      </span>
                      <span className="text-xs font-black text-slate-100">{level}</span>
                    </span>
                  ) : (
                    // Dark-mode styling regardless of the theme: this control
                    // sits on the stage, and the stage is always night.
                    <div className="max-w-[13rem] text-slate-200">
                      <NeoDropdown
                        options={cefrLevelOptions}
                        value={level}
                        onChange={setLevel}
                        isDarkMode
                        label={t("live_tutor.level_label")}
                        searchable={false}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={isOpen ? () => stop() : start}
                      aria-label={isOpen ? t("live_tutor.stop") : t("live_tutor.start")}
                      className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-4 text-white backdrop-blur-md transition-all active:scale-95 ${
                        isOpen
                          ? "border-rose-200 bg-rose-500 hover:bg-rose-400"
                          : "border-white/80 bg-white/10 hover:bg-white/25"
                      }`}
                    >
                      {isConnecting ? (
                        <Loader2 size={26} className="animate-spin" />
                      ) : isLive ? (
                        <Square size={24} />
                      ) : (
                        <Mic size={28} />
                      )}
                    </button>

                    {isOpen && (
                      <div className="min-w-0">
                        <span
                          className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest ${
                            isConnecting
                              ? "text-slate-300"
                              : isSpeaking
                                ? "text-sky-300"
                                : "text-emerald-300"
                          }`}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-current" />
                          {statusLabel}
                        </span>
                        {showCountdown && (
                          <span className="mt-1 block text-xs font-bold text-amber-200">
                            {t("live_tutor.time_left", { time: formatClock(secondsLeft) })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex p-4 sm:p-5 md:pl-0">
                  <div className="flex min-w-0 flex-1 flex-col rounded-2xl border-2 border-slate-400/30 bg-slate-950/60 p-3 backdrop-blur-md">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {t("live_tutor.transcript")}
                    </span>

                    <div
                      ref={listRef}
                      className="scrollbar-hidden flex max-h-[18rem] min-h-[11rem] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain"
                    >
                      {turns.length === 0 && !isEnded && (
                        <p className="text-[13px] font-bold leading-relaxed text-slate-400">
                          {isConnecting ? t("live_tutor.connecting") : t("live_tutor.empty_state")}
                        </p>
                      )}

                      {turns.map((turn) => (
                        <div
                          key={turn.id}
                          className={`max-w-[92%] break-words rounded-2xl border px-3 py-2 text-[13px] font-semibold leading-relaxed ${
                            turn.isUser
                              ? "self-end border-slate-300/30 bg-white/10 text-slate-100"
                              : "self-start border-sky-300/40 bg-sky-400/15 text-sky-50"
                          }`}
                        >
                          <span className="mb-0.5 block text-[9px] font-black uppercase tracking-[0.18em] opacity-70">
                            {turn.isUser ? t("live_tutor.you") : t("live_tutor.tutor")}
                          </span>
                          {turn.text}
                        </div>
                      ))}

                      {isEnded && (
                        <p className="mt-1 text-[13px] font-bold leading-relaxed text-slate-400">
                          {endedMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p
              className={`flex items-start gap-2 text-xs font-semibold ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              {t("live_tutor.privacy_note")}
            </p>
          </>
        )}
      </div>
    </FeaturePageShell>
  );
};

export default AiTutorPage;
