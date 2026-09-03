import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trophy, RotateCcw, Eraser, ChevronDown, Lock } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import {
  getUserGameProgress,
  markConceptSeenGlobal,
  getGlobalSeenIds,
  recordPlay,
  resetAllSeenWords,
} from "../services/userService";
import { getWord, getWordPoolCount } from "../services/getWordService";
import { loadConceptIcons } from "../services/conceptIconService";
import { useInterestTopics } from "../hooks/useInterestTopics";
import { useChallengeTheme } from "../hooks/useChallengeTheme";
import { buildCrossword, checkEntry, CELL } from "../utils/crosswordUtils";
import { resolveLetterKeys, letterKey } from "../utils/letterKeys";
import { sanitizeSvg } from "../utils/sanitizeSvg";
import ChallengeSidebar from "./ChallengeSidebar";
import ChallengeThemePicker from "./ChallengeThemePicker";
import Loader from "./Loader";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_ID = "crosswords";

/**
 * Board size. These three are the dials — change them and everything else
 * follows, the same way GRID_COLS / GRID_ROWS / WORD_COUNT work in
 * WordSearchGame. The board is always exactly GRID_COLS x GRID_ROWS; it is not
 * cropped to whatever the words happened to fill.
 *
 * Answers actually placed, measured over 60 builds from the same pool:
 *
 *   7x7   with 12 words ->  ~4   (current)
 *   9x9   with 16 words ->  ~6
 *   9x11  with 14 words ->  ~7
 *   11x11 with 20 words ->  ~9
 *   13x13 with 26 words -> ~14
 *
 * WORD_COUNT is deliberately just above what fits: placement is competitive —
 * an answer needs a free clue cell, a stop after it, and no parallel neighbour
 * — so roughly a third of the words are dropped. Raising it far beyond the
 * numbers above buys almost nothing, because density plateaus near 50% on the
 * interlock constraints rather than on vocabulary.
 */
const GRID_COLS = 10;
const GRID_ROWS = 15;
const WORD_COUNT = 15;

/** Longest answer that can still fit with its clue cell. */
const MAX_LENGTH = Math.max(GRID_COLS, GRID_ROWS) - 1;

/** How long a wrong answer stays red before it clears. */
const WRONG_FLASH_MS = 700;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isSessionExpiredError = (err) => {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("expired token") || msg.includes("invalid or expired");
};

const cellKey = (row, col) => `${row}-${col}`;

// ---------------------------------------------------------------------------
// ClueIcon — the little picture, when the concept has one
// ---------------------------------------------------------------------------

const ClueIcon = ({ icon }) => {
  // Sanitised here, at the point of injection, because this is the only place
  // that can guarantee it happened. See utils/sanitizeSvg.
  const safeSvg = useMemo(() => sanitizeSvg(icon?.iconSvg), [icon?.iconSvg]);

  if (safeSvg) {
    return (
      <span
        aria-hidden="true"
        className="block w-4 h-4 sm:w-5 sm:h-5 mx-auto shrink-0 [&>svg]:w-full [&>svg]:h-full"
        dangerouslySetInnerHTML={{ __html: safeSvg }}
      />
    );
  }
  if (icon?.emoji) {
    return (
      <span aria-hidden="true" className="block text-sm sm:text-base leading-none text-center shrink-0">
        {icon.emoji}
      </span>
    );
  }
  return null;
};

ClueIcon.propTypes = {
  icon: PropTypes.shape({ emoji: PropTypes.string, iconSvg: PropTypes.string }),
};

// ---------------------------------------------------------------------------
// ClueCell — one or two clues, each with an arrow at the answer's edge
// ---------------------------------------------------------------------------

const ClueCell = ({ clues, icons, isDarkMode, activeEntryId, onSelectClue }) => (
  <div
    className={`w-full h-full flex flex-col rounded-md border-2 overflow-hidden ${
      isDarkMode ? "bg-slate-800 border-slate-600" : "bg-amber-50 border-slate-900"
    }`}
  >
    {clues.map((clue, i) => {
      const icon = icons.get(clue.conceptId);
      // A generated short clue is written to fit a cell. The pooled `hint` is a
      // dictionary definition, so it is clamped here and read in full in the
      // panel under the grid.
      const label = icon?.shortClue ?? clue.hint;
      const isActive = clue.entryId === activeEntryId;

      return (
      <button
        type="button"
        key={clue.entryId}
        onClick={() => onSelectClue(clue)}
        className={`relative flex-1 min-h-0 w-full flex flex-col items-center justify-center px-0.5 transition-colors ${
          i > 0 ? (isDarkMode ? "border-t-2 border-slate-600" : "border-t-2 border-slate-900") : ""
        } ${isActive ? (isDarkMode ? "bg-slate-700" : "bg-amber-200") : ""}`}
      >
        <ClueIcon icon={icon} />
        <span
          lang="und"
          className={`block w-full text-center font-black uppercase leading-[1.05] break-words hyphens-auto line-clamp-3 ${
            clues.length > 1 ? "text-[6px] sm:text-[7px]" : "text-[7px] sm:text-[9px]"
          } ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}
        >
          {label}
        </span>

        {/* The arrow is the whole navigation system here — it is what says
            which way this clue's answer runs. */}
        <span
          aria-hidden="true"
          className={`absolute font-black leading-none ${
            isDarkMode ? "text-yellow-400" : "text-blue-600"
          } ${
            clue.direction === "H"
              ? "right-0 top-1/2 -translate-y-1/2 text-[8px]"
              : "bottom-0 left-1/2 -translate-x-1/2 text-[8px]"
          }`}
        >
          {clue.direction === "H" ? "▶" : "▼"}
        </span>
      </button>
      );
    })}
  </div>
);

ClueCell.propTypes = {
  clues: PropTypes.array.isRequired,
  icons: PropTypes.instanceOf(Map).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  activeEntryId: PropTypes.string,
  onSelectClue: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// LetterCell
// ---------------------------------------------------------------------------

const LetterCell = ({ row, col, letter, isSolved, isWrong, isActive, onTap, isDarkMode }) => {
  let tone;
  if (isWrong) {
    tone = "bg-rose-400 border-slate-900 text-slate-900";
  } else if (isSolved) {
    tone = "bg-emerald-400 border-slate-900 text-slate-900";
  } else if (isActive) {
    tone = isDarkMode
      ? "bg-yellow-400 border-yellow-300 text-slate-900"
      : "bg-yellow-300 border-slate-900 text-slate-900";
  } else {
    tone = isDarkMode
      ? "bg-slate-700 border-slate-500 text-white"
      : "bg-white border-slate-900 text-slate-900";
  }

  return (
    <button
      type="button"
      data-cell={cellKey(row, col)}
      onClick={onTap}
      disabled={isSolved}
      className={`w-full h-full rounded-md border-2 flex items-center justify-center font-black uppercase
        text-sm sm:text-lg select-none transition-all active:scale-90 disabled:cursor-default ${tone}`}
      aria-label={letter ? `${row + 1},${col + 1}: ${letter}` : `${row + 1},${col + 1}`}
    >
      {letter ?? ""}
    </button>
  );
};

LetterCell.propTypes = {
  row: PropTypes.number.isRequired,
  col: PropTypes.number.isRequired,
  letter: PropTypes.string,
  isSolved: PropTypes.bool.isRequired,
  isWrong: PropTypes.bool.isRequired,
  isActive: PropTypes.bool.isRequired,
  onTap: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// CluePanel — every clue, readable, beside the board
// ---------------------------------------------------------------------------

/**
 * The grid cell can only ever show a few words. This is where a clue is
 * actually read, which is what lets the cells stay small — the same division of
 * labour WordSearchGame uses with its word list.
 */
/** How tall the clue list gets when open; collapse animates this down to zero. */
const CLUE_LIST_OPEN = "max-h-[min(45vh,26rem)]";

const CluePanel = ({ entries, icons, solvedIds, activeEntryId, onSelect, isDarkMode, t, isOpen, isLocked, onToggle }) => (
  <div className={`rounded-2xl border-4 flex flex-col overflow-hidden ${
    isDarkMode
      ? "bg-slate-800 border-slate-700"
      : "bg-white border-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
  }`}>
    <button
      type="button"
      onClick={onToggle}
      disabled={isLocked}
      aria-expanded={isOpen}
      className={`flex items-center justify-between gap-3 w-full px-4 py-3 text-left transition-colors ${
        isLocked
          ? "cursor-not-allowed opacity-70"
          : isDarkMode
            ? "hover:bg-slate-700/50"
            : "hover:bg-slate-50"
      }`}
    >
      <span className={`font-black uppercase text-xs tracking-widest ${
        isDarkMode ? "text-slate-400" : "text-slate-500"
      }`}>
        {t("challenges.crossword_clues")}
      </span>
      {isLocked ? (
        <Lock size={14} className={`shrink-0 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} />
      ) : (
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""} ${
            isDarkMode ? "text-slate-500" : "text-slate-400"
          }`}
        />
      )}
    </button>

    <div
      className={`transition-all duration-300 ease-in-out ${
        isOpen
          ? `opacity-100 overflow-y-auto neo-scrollbar ${CLUE_LIST_OPEN} ${isDarkMode ? "neo-scrollbar-dark" : ""}`
          : "max-h-0 opacity-0 overflow-hidden"
      }`}
    >
      <div className={`flex flex-col gap-2 pr-1 px-4 pb-4 pt-3 border-t-2 ${
        isDarkMode ? "border-slate-700" : "border-slate-200"
      }`}>
        {entries.map((entry) => {
          const solved = solvedIds.has(entry.id);
          const active = entry.id === activeEntryId;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry.id)}
              className={`w-full text-left rounded-xl px-2 py-1.5 transition-colors ${
                active ? (isDarkMode ? "bg-slate-700" : "bg-amber-100") : ""
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`font-black text-[10px] tracking-widest shrink-0 ${
                  isDarkMode ? "text-yellow-400" : "text-blue-600"
                }`}>
                  {entry.direction === "H" ? "\u25b6" : "\u25bc"} {entry.answer.length}
                </span>
                <ClueIcon icon={icons.get(entry.conceptId)} />
                {solved && (
                  <span className="font-black text-xs uppercase text-emerald-500">
                    {entry.answer}
                  </span>
                )}
              </span>
              <span className={`block text-xs leading-snug ${
                solved
                  ? "line-through opacity-60 " + (isDarkMode ? "text-slate-500" : "text-slate-400")
                  : isDarkMode ? "text-slate-300" : "text-slate-700"
              }`}>
                {entry.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

CluePanel.propTypes = {
  entries: PropTypes.array.isRequired,
  icons: PropTypes.instanceOf(Map).isRequired,
  solvedIds: PropTypes.instanceOf(Set).isRequired,
  activeEntryId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  t: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  isLocked: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// RackKey — draggable, and tappable for anyone who would rather not drag
// ---------------------------------------------------------------------------

const RackKey = ({ letter, isSelected, isDarkMode, onPointerDown, onPointerMove, onPointerUp, onTap }) => (
  <button
    type="button"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onClick={onTap}
    className={`w-8 h-9 sm:w-10 sm:h-11 rounded-lg border-4 flex items-center justify-center
      font-black text-sm sm:text-base uppercase select-none touch-none transition-all active:scale-90 ${
        isSelected
          ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
          : isDarkMode
            ? "bg-slate-700 border-slate-500 text-white"
            : "bg-white border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
      }`}
  >
    {letter}
  </button>
);

RackKey.propTypes = {
  letter: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  onPointerDown: PropTypes.func.isRequired,
  onPointerMove: PropTypes.func.isRequired,
  onPointerUp: PropTypes.func.isRequired,
  onTap: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CrosswordGame = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user, showAlert, writingSystems } = useAppContext();
  const { topics, preferTopics } = useInterestTopics();
  const challengeTheme = useChallengeTheme();

  const learningDialect = user?.learningDialect ?? "pt-PT";
  const interfaceLang = user?.interfaceLang ?? "en-US";

  // ── Puzzle ───────────────────────────────────────────────────────────────
  const [puzzle, setPuzzle] = useState({ cells: [], entries: [], cols: 0, rows: 0 });
  const [letters, setLetters] = useState(() => new Map());
  const [solvedIds, setSolvedIds] = useState(() => new Set());
  const [wrongCells, setWrongCells] = useState(() => new Set());
  const [icons, setIcons] = useState(() => new Map());

  // ── Interaction ──────────────────────────────────────────────────────────
  const [hardMode, setHardMode] = useState(false);
  // Clue list is open by default; hard mode forces it shut and locks the toggle.
  const [cluePanelOpen, setCluePanelOpen] = useState(true);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [activeEntryId, setActiveEntryId] = useState(null);
  const [ghost, setGhost] = useState(null);
  const dragLetterRef = useRef(null);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  const [gameWon, setGameWon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Sidebar stats ────────────────────────────────────────────────────────
  const [progress, setProgress] = useState(null);
  const [seenCount, setSeenCount] = useState(0);
  const [totalWords, setTotalWords] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const progressRef = useRef(null);
  const markedRef = useRef(new Set());
  const gameRecordedRef = useRef(false);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Accent handling is shared with Hangman so the two games agree on whether
  // a plain letter satisfies an accented one.
  const { base: baseKeys, accented: accentedKeys } = useMemo(
    () => resolveLetterKeys(writingSystems, learningDialect),
    [writingSystems, learningDialect]
  );

  const rackKeys = useMemo(
    () => (hardMode ? [...baseKeys, ...accentedKeys] : baseKeys),
    [hardMode, baseKeys, accentedKeys]
  );

  const keyOf = useCallback((letter) => letterKey(letter, hardMode), [hardMode]);

  // Cells belonging to an entry the player has already solved are locked.
  const solvedCells = useMemo(() => {
    const set = new Set();
    puzzle.entries.forEach((entry) => {
      if (!solvedIds.has(entry.id)) return;
      entry.cells.forEach((c) => set.add(cellKey(c.row, c.col)));
    });
    return set;
  }, [puzzle.entries, solvedIds]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const activeEntry = useMemo(
    () => puzzle.entries.find((e) => e.id === activeEntryId) ?? null,
    [puzzle.entries, activeEntryId]
  );

  const activeCells = useMemo(() => {
    if (!activeEntry) return new Set();
    return new Set(activeEntry.cells.map((c) => cellKey(c.row, c.col)));
  }, [activeEntry]);

  const fetchStats = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    setIsLoadingStats(true);
    try {
      const [prog, count, seenIds] = await Promise.all([
        getUserGameProgress(user.token, user.uid, GAME_ID, learningDialect),
        getWordPoolCount(user.token),
        getGlobalSeenIds(user.token, user.uid),
      ]);
      setProgress(prog);
      setTotalWords(count);
      setSeenCount(seenIds.length);
    } catch (err) {
      console.warn("[CrosswordGame] fetchStats failed:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [user, learningDialect]);

  // ── Word fetch ───────────────────────────────────────────────────────────
  const fetchAllWords = useCallback(async () => {
    if (!user) throw new Error(t("challenges.word_fetch_error"));
    const { token, uid } = user;

    const [prog, globalSeenIds] = await Promise.all([
      getUserGameProgress(token, uid, GAME_ID, learningDialect),
      getGlobalSeenIds(token, uid),
    ]);

    const seenIdsSet = new Set(globalSeenIds);
    const fetched = [];

    for (let i = 0; i < WORD_COUNT; i++) {
      const combinedSeen = [...seenIdsSet, ...fetched.map((r) => r.conceptId)];
      const result = await getWord({
        token,
        userDialect: interfaceLang,
        learningDialect,
        seenConceptIds: combinedSeen,
        maxLength: MAX_LENGTH,
        topics,
        preferTopics,
        filterTopicIds: challengeTheme.theme.topicIds,
        customTheme: challengeTheme.theme.isCustom ? challengeTheme.theme.label : null,
        themeLabel: challengeTheme.theme.label,
      });
      fetched.push(result);
    }

    return { results: fetched, progress: prog };
  }, [user, learningDialect, interfaceLang, t, topics, preferTopics, challengeTheme.theme]);

  const applyWords = useCallback((results, prog) => {
    const built = buildCrossword(
      results.map((r) => ({ word: r.word, hint: r.hint, conceptId: r.conceptId })),
      GRID_COLS,
      GRID_ROWS
    );

    setPuzzle(built);
    setLetters(new Map());
    setSolvedIds(new Set());
    setWrongCells(new Set());
    setIcons(new Map());
    setSelectedLetter(null);
    setActiveEntryId(null);
    setGameWon(false);
    setProgress(prog);
    markedRef.current = new Set();
    gameRecordedRef.current = false;
  }, []);

  const resetGame = useCallback(() => {
    setLoading(true);
    setError(null);
    setPuzzle({ cells: [], entries: [], cols: 0, rows: 0 });
    setLetters(new Map());
    setSolvedIds(new Set());
    setWrongCells(new Set());
    setIcons(new Map());
    setSelectedLetter(null);
    setActiveEntryId(null);
    setGameWon(false);
    markedRef.current = new Set();
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

  useEffect(() => {
    if (error) {
      showAlert("error", error, { label: t("common.try_again", "Try Again"), onClick: fetchGame });
    }
  }, [error, fetchGame, t, showAlert]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.token || !user?.uid) return;
    let cancelled = false;
    setLoading(true);

    const init = async () => {
      try {
        const [{ results, progress: prog }, count, seenIds] = await Promise.all([
          fetchAllWords(),
          getWordPoolCount(user.token),
          getGlobalSeenIds(user.token, user.uid),
        ]);
        if (cancelled) return;
        applyWords(results, prog);
        setTotalWords(count);
        setSeenCount(seenIds.length);
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
  }, [fetchAllWords, applyWords, user, t]);

  // ── Icons — strictly after the puzzle is playable ────────────────────────
  useEffect(() => {
    if (loading || !puzzle.entries.length || !user?.token) return;
    let cancelled = false;

    loadConceptIcons({
      conceptIds: puzzle.entries.map((e) => e.conceptId),
      token: user.token,
      onIcon: (conceptId, icon) => {
        if (cancelled) return;
        setIcons((prev) => new Map(prev).set(conceptId, icon));
      },
      isCancelled: () => cancelled,
    }).catch((err) => console.warn("[CrosswordGame] icon load failed:", err));

    return () => { cancelled = true; };
  }, [loading, puzzle.entries, user?.token]);

  // ── Reset seen words ─────────────────────────────────────────────────────
  const handleResetSeenWords = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    await resetAllSeenWords(user.token, user.uid);
    await fetchStats();
  }, [user, fetchStats]);

  // ── Placing a letter ─────────────────────────────────────────────────────
  const placeLetter = useCallback(
    (row, col, letter) => {
      if (gameWon || !letter) return;

      const cell = puzzle.cells[row]?.[col];
      if (!cell || cell.kind !== CELL.LETTER) return;
      if (solvedCells.has(cellKey(row, col))) return;

      const next = new Map(letters);
      next.set(cellKey(row, col), letter);
      setLetters(next);

      const newlySolved = [];
      const wrong = [];

      cell.entryIds.forEach((entryId) => {
        if (solvedIds.has(entryId)) return;
        const entry = puzzle.entries.find((e) => e.id === entryId);
        if (!entry) return;
        const { complete, correct } = checkEntry(entry, next, keyOf);
        if (!complete) return;
        if (correct) newlySolved.push(entry);
        else wrong.push(entry);
      });

      if (newlySolved.length > 0) {
        // In easy mode the player types the unaccented letter; once the answer
        // is confirmed, show the real spelling so they see the correct form.
        const corrected = new Map(next);
        newlySolved.forEach((entry) => {
          entry.cells.forEach((c, i) => corrected.set(cellKey(c.row, c.col), entry.answer[i]));
        });
        setLetters(corrected);
        setSolvedIds((prev) => new Set([...prev, ...newlySolved.map((e) => e.id)]));

        if (user?.token && user?.uid) {
          newlySolved.forEach((entry) => {
            if (markedRef.current.has(entry.conceptId)) return;
            markedRef.current.add(entry.conceptId);
            getGlobalSeenIds(user.token, user.uid)
              .then((currentSeenIds) =>
                markConceptSeenGlobal(user.token, user.uid, entry.conceptId, currentSeenIds)
              )
              .catch((err) => console.warn("[CrosswordGame] markConceptSeenGlobal failed:", err));
          });
        }
      }

      if (wrong.length > 0) {
        const flash = new Set();
        wrong.forEach((entry) =>
          entry.cells.forEach((c) => flash.add(cellKey(c.row, c.col)))
        );
        setWrongCells(flash);

        // Clear only what the player can safely lose. A cell shared with an
        // already-solved answer stays: wiping it would punish them for a
        // mistake somewhere else.
        setTimeout(() => {
          setWrongCells(new Set());
          setLetters((prev) => {
            const cleared = new Map(prev);
            flash.forEach((k) => {
              if (!solvedCells.has(k)) cleared.delete(k);
            });
            return cleared;
          });
        }, WRONG_FLASH_MS);
      }
    },
    [gameWon, puzzle, letters, solvedIds, solvedCells, keyOf, user]
  );

  const handleCellTap = useCallback(
    (row, col) => {
      if (gameWon) return;
      const key = cellKey(row, col);
      if (solvedCells.has(key)) return;

      // A selected rack letter drops in; otherwise tapping a filled cell
      // clears it, which is the only way to undo without a dedicated button.
      if (selectedLetter) {
        placeLetter(row, col, selectedLetter);
        return;
      }
      if (letters.has(key)) {
        setLetters((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [gameWon, solvedCells, selectedLetter, letters, placeLetter]
  );

  // ── Drag ─────────────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((letter) => (e) => {
    dragLetterRef.current = letter;
    setGhost({ letter, x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragLetterRef.current) return;
    setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
  }, []);

  const handlePointerUp = useCallback(
    (e) => {
      const letter = dragLetterRef.current;
      dragLetterRef.current = null;
      setGhost(null);
      if (!letter) return;

      // The pointer is captured by the key, so the drop target has to be found
      // by hit-testing rather than by a pointerup on the cell itself.
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = target?.closest?.("[data-cell]");
      if (!cellEl) return;

      const [row, col] = cellEl.getAttribute("data-cell").split("-").map(Number);
      placeLetter(row, col, letter);
    },
    [placeLetter]
  );

  // ── Win ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || puzzle.entries.length === 0) return;
    if (solvedIds.size < puzzle.entries.length) return;
    if (gameRecordedRef.current) return;
    gameRecordedRef.current = true;

    Promise.resolve().then(() => setGameWon(true));

    if (!user?.token || !user?.uid) return;
    recordPlay(user.token, user.uid, GAME_ID, learningDialect, progressRef.current)
      .then(() => fetchStats())
      .catch((err) => console.warn("[CrosswordGame] recordPlay failed:", err));
  }, [solvedIds, puzzle.entries, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const sidebarProps = {
    isDarkMode,
    seenCount,
    progress,
    totalWords,
    isLoadingStats,
    onReset: handleResetSeenWords,
    title: t("challenges.sidebar.title"),
    resetTitle: t("challenges.sidebar.reset_title"),
    resetMessage: t("challenges.sidebar.reset_message"),
    resetWarning: t("challenges.sidebar.reset_warning"),
    resetConfirmLabel: t("challenges.sidebar.reset_confirm"),
    themePicker: (
      <ChallengeThemePicker
        interests={challengeTheme.interests}
        hasInterests={challengeTheme.hasInterests}
        selectedInterestId={challengeTheme.selectedInterestId}
        onSelectInterest={challengeTheme.selectInterest}
        freeText={challengeTheme.freeText}
        onFreeTextChange={challengeTheme.setFreeText}
        canUseFreeText={challengeTheme.canUseFreeText}
        freeTextBlockedByInterest={challengeTheme.freeTextBlockedByInterest}
        isDirty={challengeTheme.isDirty}
        onApply={challengeTheme.applyTheme}
        isDarkMode={isDarkMode}
      />
    ),
  };

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return <Loader isDarkMode={isDarkMode} message={t("challenges.loading_word")} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in gap-4">
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

  // ── Victory ──────────────────────────────────────────────────────────────
  if (gameWon) {
    return (
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center flex-1 min-w-0 w-full">
          <div className={`p-10 rounded-[2rem] border-4 flex flex-col items-center gap-6 w-full max-w-md ${
            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
          }`}>
            <Trophy size={64} className="text-yellow-400" strokeWidth={2} />
            <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-center text-emerald-500">
              {t("challenges.crossword_won")}
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {t("challenges.crossword_progress", {
                solved: puzzle.entries.length,
                total: puzzle.entries.length,
              })}
            </p>
            <button
              onClick={() => { resetGame(); fetchGame(); }}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all active:scale-95 ${
                isDarkMode
                  ? "bg-yellow-400 border-yellow-400 text-slate-900"
                  : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
              }`}
            >
              <RotateCcw size={18} />
              {t("challenges.play_again")}
            </button>
          </div>
        </div>
        <ChallengeSidebar {...sidebarProps} />
      </div>
    );
  }

  // ── Board ────────────────────────────────────────────────────────────────
  const cluePanel = (
    <CluePanel
      entries={puzzle.entries}
      icons={icons}
      solvedIds={solvedIds}
      activeEntryId={activeEntryId}
      onSelect={(id) => setActiveEntryId((cur) => (cur === id ? null : id))}
      isDarkMode={isDarkMode}
      t={t}
      isOpen={!hardMode && cluePanelOpen}
      isLocked={hardMode}
      onToggle={() => setCluePanelOpen((open) => !open)}
    />
  );

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in">
      {/* Clues — a column of their own on desktop */}
      <div className="hidden lg:block w-64 shrink-0">{cluePanel}</div>

      <div className="flex flex-col items-center flex-1 min-w-0 w-full gap-4">
        {/* Clues — above the board on mobile */}
        <div className="w-full lg:hidden">{cluePanel}</div>

        {/* Difficulty — same meaning as Hangman's */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setHardMode(false)}
            className={`px-4 py-1.5 rounded-lg border-4 font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 ${
              !hardMode
                ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
                : isDarkMode
                  ? "bg-transparent border-slate-600 text-slate-400"
                  : "bg-transparent border-slate-300 text-slate-500"
            }`}
          >
            {t("challenges.easy")}
          </button>
          <button
            type="button"
            onClick={() => setHardMode(true)}
            className={`px-4 py-1.5 rounded-lg border-4 font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 ${
              hardMode
                ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
                : isDarkMode
                  ? "bg-transparent border-slate-600 text-slate-400"
                  : "bg-transparent border-slate-300 text-slate-500"
            }`}
          >
            {t("challenges.hard")}
          </button>
        </div>

        <p className={`font-black uppercase text-xs tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("challenges.crossword_progress", {
            solved: solvedIds.size,
            total: puzzle.entries.length,
          })}
        </p>

        {/* Grid */}
        <div
          className="grid gap-1 w-full max-w-[440px]"
          style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))` }}
        >
          {puzzle.cells.map((line, row) =>
            line.map((cell, col) => {
              const key = cellKey(row, col);
              if (!cell || cell.kind === CELL.BLOCK) {
                return <div key={key} className="aspect-square" />;
              }
              if (cell.kind === CELL.CLUE) {
                return (
                  <div key={key} className="aspect-square">
                    <ClueCell
                      clues={cell.clues}
                      icons={icons}
                      isDarkMode={isDarkMode}
                      activeEntryId={activeEntryId}
                      onSelectClue={(clue) =>
                        setActiveEntryId((cur) => (cur === clue.entryId ? null : clue.entryId))
                      }
                    />
                  </div>
                );
              }
              return (
                <div key={key} className="aspect-square">
                  <LetterCell
                    row={row}
                    col={col}
                    letter={letters.get(key)}
                    isSolved={solvedCells.has(key)}
                    isWrong={wrongCells.has(key)}
                    isActive={activeCells.has(key)}
                    onTap={() => handleCellTap(row, col)}
                    isDarkMode={isDarkMode}
                  />
                </div>
              );
            })
          )}
        </div>

        <p className={`text-[11px] font-bold text-center px-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("challenges.crossword_drag_hint")}
        </p>

        {/* Rack */}
        <div className="flex flex-wrap justify-center gap-1.5 px-2">
          {rackKeys.map((letter) => (
            <RackKey
              key={letter}
              letter={letter}
              isSelected={selectedLetter === letter}
              isDarkMode={isDarkMode}
              onPointerDown={handlePointerDown(letter)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onTap={() => setSelectedLetter((cur) => (cur === letter ? null : letter))}
            />
          ))}
        </div>

        {selectedLetter && (
          <button
            type="button"
            onClick={() => setSelectedLetter(null)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-4 font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 ${
              isDarkMode ? "bg-slate-800 border-slate-600 text-slate-300" : "bg-white border-slate-900 text-slate-900"
            }`}
          >
            <Eraser size={14} />
            {t("challenges.crossword_deselect")}
          </button>
        )}
      </div>

      <ChallengeSidebar {...sidebarProps} />

      {/* Drag ghost — follows the finger so the drop point is never a guess. */}
      {ghost && (
        <div
          aria-hidden="true"
          className="fixed z-50 pointer-events-none w-9 h-10 rounded-lg border-4 bg-yellow-400 border-slate-900
            text-slate-900 font-black text-base uppercase flex items-center justify-center shadow-[3px_3px_0px_0px_#0f172a]"
          style={{ left: ghost.x - 18, top: ghost.y - 46 }}
        >
          {ghost.letter}
        </div>
      )}
    </div>
  );
};

CrosswordGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default CrosswordGame;
