import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { RefreshCw, Trophy, RotateCcw } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import {
  getUserGameProgress,
  markConceptSeen,
  recordPlay,
  resetSeenWords,
} from "../services/userService";
import { getWord, getWordPoolCount } from "../services/getWordService";
import { buildGrid, checkSelection } from "../utils/wordSearchUtils";
import ChallengeSidebar from "./ChallengeSidebar";
import ReportButton from "./ReportButton";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_ID    = "word_search";
const GRID_SIZE  = 12;
const WORD_COUNT = 6;
const MAX_LENGTH = GRID_SIZE;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isSessionExpiredError = (err) => {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("expired token") || msg.includes("invalid or expired");
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const GridCell = ({ letter, isSelected, isFound, onClick, isDarkMode }) => {
  let bg, text, border;

  if (isFound) {
    bg     = "bg-emerald-400";
    text   = "text-slate-900";
    border = "border-emerald-500";
  } else if (isSelected) {
    bg     = isDarkMode ? "bg-yellow-400"  : "bg-yellow-300";
    text   = "text-slate-900";
    border = "border-yellow-500";
  } else {
    bg     = isDarkMode ? "bg-slate-700"   : "bg-white";
    text   = isDarkMode ? "text-slate-100" : "text-slate-900";
    border = isDarkMode ? "border-slate-600" : "border-slate-300";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-6 h-6 sm:w-8 sm:h-8 rounded-md border-2 flex items-center justify-center
        font-black text-xs sm:text-sm uppercase select-none transition-all active:scale-90
        ${bg} ${text} ${border}
      `}
      aria-label={`Letter ${letter}`}
    >
      {letter}
    </button>
  );
};

GridCell.propTypes = {
  letter:     PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  isFound:    PropTypes.bool.isRequired,
  onClick:    PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const WordListPanel = ({ words, foundWords, isDarkMode, t }) => (
  <div className={`rounded-2xl border-4 p-4 flex flex-col gap-3 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700"
      : "bg-white border-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
  }`}>
    <p className={`font-black uppercase text-xs tracking-widest mb-1 ${
      isDarkMode ? "text-slate-400" : "text-slate-500"
    }`}>
      {t("challenges.word_search_panel")}
    </p>
    {words.map(({ word, hint, conceptId }) => {
      const found = foundWords.has(conceptId);
      return (
        <div key={conceptId} className="flex flex-col gap-0.5">
          <span className={`font-black text-sm sm:text-base uppercase tracking-tight transition-all ${
            found
              ? "line-through text-emerald-500"
              : isDarkMode ? "text-white" : "text-slate-900"
          }`}>
            {found ? "✓ " : ""}{word.toUpperCase()}
          </span>
          <span className={`text-xs italic ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}>
            {hint}
          </span>
        </div>
      );
    })}
  </div>
);

WordListPanel.propTypes = {
  words:      PropTypes.arrayOf(PropTypes.shape({
    word:      PropTypes.string.isRequired,
    hint:      PropTypes.string.isRequired,
    conceptId: PropTypes.string.isRequired,
  })).isRequired,
  foundWords: PropTypes.instanceOf(Set).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  t:          PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const WordSearchGame = ({ isDarkMode }) => {
  const { t }    = useTranslation();
  const { user } = useAppContext();

  const learningDialect = user?.learningDialect ?? "pt-PT";
  const interfaceLang   = user?.interfaceLang   ?? "en-US";

  // ── Game data ─────────────────────────────────────────────────────────────
  const [words,      setWords]      = useState([]);
  const [grid,       setGrid]       = useState([]);
  const [placements, setPlacements] = useState([]);

  // ── Interaction state ─────────────────────────────────────────────────────
  const [selectedCells, setSelectedCells] = useState([]);
  const [foundCells,    setFoundCells]    = useState(new Set());
  const [foundWords,    setFoundWords]    = useState(new Set());
  const [flashCells,    setFlashCells]    = useState(new Set());

  // ── Timer ───────────────────────────────────────────────────────────────
  const [elapsed,  setElapsed]  = useState(0);
  const [gameWon,  setGameWon]  = useState(false);
  const timerRef = useRef(null);

  // ── Loading / error ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Sidebar stats ─────────────────────────────────────────────────────────
  const [progress,       setProgress]       = useState(null);
  const [totalWords,     setTotalWords]     = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const progressRef      = useRef(null);
  const markedRef        = useRef(new Set());
  const gameRecordedRef  = useRef(false);

  // Keep progressRef in sync with progress state at all times.
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // ── Timer management ─────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || gameWon) return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [loading, gameWon]);

  // ── Stats fetch ───────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    setIsLoadingStats(true);
    try {
      const [prog, count] = await Promise.all([
        getUserGameProgress(user.token, user.uid, GAME_ID, learningDialect),
        getWordPoolCount(user.token),
      ]);
      setProgress(prog);
      setTotalWords(count);
    } catch (err) {
      console.warn("[WordSearchGame] fetchStats failed:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [user, learningDialect]);

  // ── Core word fetch ───────────────────────────────────────────────────────
  const fetchAllWords = useCallback(async () => {
    if (!user) throw new Error(t("challenges.word_fetch_error"));
    const { token, uid } = user;

    const prog = await getUserGameProgress(token, uid, GAME_ID, learningDialect);
    const seenIds = new Set(prog?.seenConceptIds ?? []);
    const fetchedThisSession = [];
    const results = [];

    for (let i = 0; i < WORD_COUNT; i++) {
      const combinedSeen = [...seenIds, ...fetchedThisSession.map((r) => r.conceptId)];
      const result = await getWord({
        token,
        userDialect:     interfaceLang,
        learningDialect,
        seenConceptIds:  combinedSeen,
        maxLength:       MAX_LENGTH,
      });
      results.push(result);
      fetchedThisSession.push(result);
    }

    return { results, progress: prog };
  }, [user, learningDialect, interfaceLang, t]);

  const applyWords = useCallback((results, prog) => {
    const wordEntries = results.map((r) => ({
      word:      r.word,
      hint:      r.hint,
      conceptId: r.conceptId,
    }));

    const { grid: newGrid, placements: newPlacements, placedWords } = buildGrid(
      wordEntries,
      GRID_SIZE,
      false
    );

    setWords(placedWords);
    setGrid(newGrid);
    setPlacements(newPlacements);
    setSelectedCells([]);
    setFoundCells(new Set());
    setFoundWords(new Set());
    setFlashCells(new Set());
    setElapsed(0);
    setGameWon(false);
    setProgress(prog);
    markedRef.current       = new Set();
    gameRecordedRef.current = false;
  }, []);

  const resetGame = useCallback(() => {
    clearInterval(timerRef.current);
    setLoading(true);
    setError(null);
    setWords([]);
    setGrid([]);
    setPlacements([]);
    setSelectedCells([]);
    setFoundCells(new Set());
    setFoundWords(new Set());
    setFlashCells(new Set());
    setElapsed(0);
    setGameWon(false);
    markedRef.current       = new Set();
    gameRecordedRef.current = false;
  }, []);

  const fetchGame = useCallback(async () => {
    try {
      const { results, progress: prog } = await fetchAllWords();
      applyWords(results, prog);
    } catch (err) {
      if (isSessionExpiredError(err)) {
        alert(t("challenges.session_expired"));
        window.location.reload();
        return;
      }
      setError(err.message ?? t("challenges.word_fetch_error"));
    } finally {
      setLoading(false);
    }
  }, [fetchAllWords, applyWords, t]);

  // Initial load — also initialises stats (single fetch, no duplicate)
  useEffect(() => {
    if (!user?.token || !user?.uid) return;
    let cancelled = false;

    const init = async () => {
      try {
        const [{ results, progress: prog }, count] = await Promise.all([
          fetchAllWords(),
          getWordPoolCount(user.token),
        ]);
        if (cancelled) return;
        applyWords(results, prog);
        setTotalWords(count);
        setIsLoadingStats(false);
      } catch (err) {
        if (cancelled) return;
        if (isSessionExpiredError(err)) {
          alert(t("challenges.session_expired"));
          window.location.reload();
          return;
        }
        setError(err.message ?? t("challenges.word_fetch_error"));
        setIsLoadingStats(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [fetchAllWords, applyWords, user, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset seen words ──────────────────────────────────────────────────────
  const handleResetSeenWords = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    await resetSeenWords(user.token, user.uid, GAME_ID, learningDialect);
    await fetchStats();
  }, [user, learningDialect, fetchStats]);

  // ── Win detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (words.length === 0 || loading) return;
    if (foundWords.size < words.length) return;
    if (gameRecordedRef.current) return;
    gameRecordedRef.current = true;

    clearInterval(timerRef.current);
    Promise.resolve().then(() => setGameWon(true));

    if (!user?.token || !user?.uid) return;
    const { token, uid } = user;

    recordPlay(token, uid, GAME_ID, learningDialect, progressRef.current)
      .then(() => fetchStats())
      .catch((err) => console.warn("[WordSearchGame] recordPlay failed:", err));
  }, [foundWords, words, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cell tap handler ──────────────────────────────────────────────────────
  const handleCellTap = useCallback((row, col) => {
    if (gameWon) return;

    const key = `${row}-${col}`;
    if (foundCells.has(key)) return;

    setSelectedCells((prev) => {
      const alreadyIdx = prev.findIndex((c) => c.row === row && c.col === col);
      if (alreadyIdx !== -1) return prev.filter((_, i) => i !== alreadyIdx);

      const next = [...prev, { row, col }];

      if (next.length >= 2) {
        const dr0 = next[1].row - next[0].row;
        const dc0 = next[1].col - next[0].col;

        const firstStepValid =
          Math.abs(dr0) <= 1 && Math.abs(dc0) <= 1 && (dr0 !== 0 || dc0 !== 0);

        const allAligned = firstStepValid && next.every((cell, i) => {
          if (i === 0) return true;
          const stepR = cell.row - next[i - 1].row;
          const stepC = cell.col - next[i - 1].col;
          return stepR === dr0 && stepC === dc0;
        });

        if (!allAligned) {
          setFlashCells(new Set([key]));
          setTimeout(() => setFlashCells(new Set()), 350);
          return [];
        }
      }

      const matchedPlacement = checkSelection(placements, next);
      if (matchedPlacement) {
        const cellKeys = new Set(matchedPlacement.cells.map((c) => `${c.row}-${c.col}`));
        setFoundCells((prevFound) => new Set([...prevFound, ...cellKeys]));
        setFoundWords((prevFoundWords) => new Set([...prevFoundWords, matchedPlacement.conceptId]));

        if (!markedRef.current.has(matchedPlacement.conceptId) && user?.token && user?.uid) {
          markedRef.current.add(matchedPlacement.conceptId);
          markConceptSeen(
            user.token,
            user.uid,
            GAME_ID,
            learningDialect,
            matchedPlacement.conceptId,
            progressRef.current
          ).then((updatedProg) => {
            if (updatedProg) {
              progressRef.current = updatedProg;
              setProgress(updatedProg);
            }
          }).catch((err) => console.warn("[WordSearchGame] markConceptSeen failed:", err));
        }

        return [];
      }

      return next;
    });
  }, [gameWon, foundCells, placements, user, learningDialect]);

  // ── Shared sidebar props ────────────────────────────────────────────────────
  const sidebarProps = {
    isDarkMode,
    progress,
    totalWords,
    isLoadingStats,
    onReset:           handleResetSeenWords,
    title:             t("challenges.sidebar.title"),
    resetTitle:        t("challenges.sidebar.reset_title"),
    resetMessage:      t("challenges.sidebar.reset_message"),
    resetWarning:      t("challenges.sidebar.reset_warning"),
    resetConfirmLabel: t("challenges.sidebar.reset_confirm"),
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in">
        <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-8">
          {t("challenges.word_search")}
        </h2>
        <div className={`w-48 h-48 mb-8 rounded-2xl border-4 flex items-center justify-center ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"
        }`}>
          <RefreshCw className="w-10 h-10 animate-spin opacity-40" />
        </div>
        <p className={`text-sm italic ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
          {t("challenges.loading_word")}
        </p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in gap-4">
        <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter">
          {t("challenges.word_search")}
        </h2>
        <p className="text-rose-500 font-semibold text-center px-4">{error}</p>
        <button
          onClick={() => { resetGame(); fetchGame(); }}
          className={`px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all ${
            isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
          }`}
        >
          {t("challenges.try_again")}
        </button>
      </div>
    );
  }

  // ── Victory screen ────────────────────────────────────────────────────────
  if (gameWon) {
    return (
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center flex-1 min-w-0 w-full">
          <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-8">
            {t("challenges.word_search")}
          </h2>
          <div className={`p-10 rounded-[2rem] border-4 flex flex-col items-center gap-6 w-full max-w-md ${
            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
          }`}>
            <Trophy size={64} className="text-yellow-400" strokeWidth={2} />
            <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-center text-emerald-500">
              {t("challenges.victory_title")}
            </h3>
            <p className={`text-lg font-bold ${ isDarkMode ? "text-slate-300" : "text-slate-700" }`}>
              Time: <span className="font-black text-yellow-400">{formatTime(elapsed)}</span>
            </p>
            <p className={`text-sm ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
              {t("challenges.words_count", { count: words.length })}
            </p>
            <button
              onClick={() => { resetGame(); fetchGame(); }}
              className={`px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all ${
                isDarkMode
                  ? "bg-yellow-400 border-slate-700 text-slate-900 hover:bg-yellow-300"
                  : "bg-yellow-400 border-slate-900 text-slate-900 hover:bg-yellow-300"
              }`}
            >
              {t("challenges.next_word")}
            </button>
          </div>
        </div>
        <ChallengeSidebar {...sidebarProps} />
      </div>
    );
  }

  // ── Game render ───────────────────────────────────────────────────────────
  //
  // Desktop: [WordList (left, w-52)] [Grid (center, flex-1)] [Sidebar (right, w-64)]
  // Mobile:  [WordList] [Grid] [Sidebar] stacked vertically
  //
  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95">

      {/* ── LEFT: word list (desktop only) ── */}
      <div className="hidden lg:block w-52 shrink-0">
        <WordListPanel words={words} foundWords={foundWords} isDarkMode={isDarkMode} t={t} />
      </div>

      {/* ── CENTER: title + mobile word list + grid + controls ── */}
      <div className="flex flex-col items-center flex-1 min-w-0 w-full">

        {/* Title + Timer + Report button */}
        <div className="flex items-center justify-between w-full mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter">
              {t("challenges.word_search")}
            </h2>
            <span className={`font-black text-lg tabular-nums ${
              isDarkMode ? "text-yellow-400" : "text-yellow-600"
            }`}>
              {formatTime(elapsed)}
            </span>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="WordSearchGame" />
        </div>

        {/* Word list — above grid on mobile, hidden on desktop */}
        <div className="w-full mb-4 lg:hidden">
          <WordListPanel words={words} foundWords={foundWords} isDarkMode={isDarkMode} t={t} />
        </div>

        {/* Progress indicator */}
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          {t("challenges.words_found", { found: foundWords.size, total: words.length })}
        </p>

        {/* Grid */}
        <div
          className={`rounded-2xl border-4 p-2 sm:p-3 inline-grid gap-0.5 sm:gap-1 ${
            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
          }`}
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
        >
          {grid.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              const key     = `${rIdx}-${cIdx}`;
              const isSel   = selectedCells.some((s) => s.row === rIdx && s.col === cIdx);
              const isFnd   = foundCells.has(key);
              const isFlash = flashCells.has(key);
              return (
                <GridCell
                  key={key}
                  letter={isFlash ? "✗" : cell.letter}
                  isSelected={isSel && !isFnd}
                  isFound={isFnd}
                  onClick={() => handleCellTap(rIdx, cIdx)}
                  isDarkMode={isDarkMode}
                />
              );
            })
          )}
        </div>

        {/* Clear selection button */}
        {selectedCells.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setSelectedCells([])}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-4 font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
                isDarkMode
                  ? "bg-slate-800 border-slate-600 text-slate-300 hover:border-yellow-400 hover:text-yellow-400"
                  : "bg-white border-slate-900 text-slate-700 hover:bg-yellow-50"
              }`}
            >
              <RotateCcw size={14} />
              {t("challenges.clear_selection")}
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: sidebar (desktop only) ── */}
      <div className="hidden lg:block w-64 shrink-0">
        <ChallengeSidebar {...sidebarProps} />
      </div>

      {/* ── Mobile: sidebar below grid ── */}
      <div className="lg:hidden w-full">
        <ChallengeSidebar {...sidebarProps} />
      </div>

    </div>
  );
};

WordSearchGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default WordSearchGame;
