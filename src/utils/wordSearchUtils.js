/**
 * wordSearchUtils.js
 *
 * Pure grid-generation utilities for the Word Search game.
 * No React, no services — fully testable in isolation.
 *
 * Exports:
 *   buildGrid(words, gridSize, hardMode) → { grid, placements, placedWords }
 *   checkSelection(placements, selectedCells) → Placement | null
 *
 * Grid cell shape:
 *   { letter: string, conceptId: string | null, wordIndex: number | null }
 *
 * Placement shape:
 *   { word: string, conceptId: string, cells: {row, col}[], direction: string }
 *
 * Direction codes:
 *   Easy (hardMode=false): H, V only — horizontal left→right and vertical top→bottom.
 *   Hard (hardMode=true):  all 8 directions including diagonals and reversed.
 *
 *   'H'  = left → right
 *   'V'  = top  → bottom
 *   'DR' = diagonal down-right  (hard only)
 *   'DL' = diagonal down-left   (hard only)
 *   'RH' = right → left         (hard only)
 *   'RV' = bottom → top         (hard only)
 *   'RL' = diagonal up-left     (hard only)
 *   'RR' = diagonal up-right    (hard only)
 *
 * TODO: Wire hardMode=true via a difficulty toggle in WordSearchGame when
 * the Hard mode feature is added. The buildGrid param is already ready.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Easy: horizontal + vertical only — natural reading directions, no diagonals.
const EASY_DIRECTIONS = ['H', 'V'];

// Hard: all 8 directions including diagonals and reversed words.
const ALL_DIRECTIONS  = ['H', 'V', 'DR', 'DL', 'RH', 'RV', 'RL', 'RR'];

// Direction deltas: [rowDelta, colDelta]
const DELTAS = {
  H:  [0,  1],
  V:  [1,  0],
  DR: [1,  1],
  DL: [1, -1],
  RH: [0, -1],
  RV: [-1, 0],
  RL: [-1, -1],
  RR: [-1,  1],
};

// ---------------------------------------------------------------------------
// Public: buildGrid
// ---------------------------------------------------------------------------

/**
 * Build a word-search grid.
 *
 * @param {Array<{word: string, conceptId: string}>} words  — already filtered to maxLength
 * @param {number} gridSize   - e.g. 12
 * @param {boolean} hardMode  - false = H+V only; true = all 8 directions
 * @param {string} [script]   - BCP-47 script hint for filler alphabet (see _buildAlphabet)
 * @returns {{ grid: Cell[][], placements: Placement[], placedWords: {word,hint,conceptId}[] }}
 *
 * NOTE — placedWords is the subset of `words` that were successfully placed.
 * Callers MUST use placedWords (not the original words array) to drive win
 * condition and word-list display, so that unplaceable words never make the
 * game unwinnable.
 */
export function buildGrid(words, gridSize, hardMode = false, script = 'latin') {
  const directions = hardMode ? ALL_DIRECTIONS : EASY_DIRECTIONS;

  // Initialize empty grid
  const grid = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({ letter: '', conceptId: null, wordIndex: null }))
  );

  const placements  = [];
  const placedWords = []; // only words that were actually placed (see NOTE above)

  for (let wi = 0; wi < words.length; wi++) {
    const entry = words[wi];
    // Always uppercase for consistent comparison in checkSelection
    const upper = entry.word.toUpperCase();
    const placed = _placeWord(grid, upper, entry.conceptId, wi, directions, gridSize);
    if (placed) {
      placements.push(placed);
      placedWords.push({ ...entry, word: upper }); // store uppercase to match placement
    }
    // If _placeWord returns null the word is silently skipped.
    // placedWords will not include it, so win condition remains reachable.
  }

  // Fill empty cells with random filler letters from the appropriate script.
  // Currently only Latin (A–Z) is supported as filler.
  // TODO: When adding non-Latin language support (e.g. Japanese hiragana/katakana,
  // Arabic, Cyrillic, Hebrew, Korean Hangul, etc.) extend _buildAlphabet() to
  // accept the script/language code and return the correct character set.
  // Without this, non-Latin words stand out visually against Latin filler,
  // making the game trivially easy for those languages.
  const alphabet = _buildAlphabet(script);
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!grid[r][c].letter) {
        grid[r][c].letter = alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
  }

  return { grid, placements, placedWords };
}

// ---------------------------------------------------------------------------
// Public: checkSelection
// ---------------------------------------------------------------------------

/**
 * Given the current tap-selection (array of {row, col}) and known placements,
 * return the matching placement object if the selection exactly matches one,
 * or null if no match.
 *
 * Returns the full placement (not just the word string) so the caller can
 * access conceptId and cells without a second lookup.
 *
 * Selection can be in either direction relative to the stored placement.
 *
 * @param {Placement[]} placements
 * @param {{ row: number, col: number }[]} selectedCells
 * @returns {Placement | null}
 */
export function checkSelection(placements, selectedCells) {
  if (!selectedCells || selectedCells.length < 2) return null;

  for (const placement of placements) {
    const { cells } = placement;
    if (cells.length !== selectedCells.length) continue;

    // Match forward
    const forward = cells.every(
      (c, i) => c.row === selectedCells[i].row && c.col === selectedCells[i].col
    );
    if (forward) return placement;

    // Match reversed
    const reversed = cells.every(
      (c, i) => c.row === selectedCells[cells.length - 1 - i].row &&
                 c.col === selectedCells[cells.length - 1 - i].col
    );
    if (reversed) return placement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Private: _placeWord
// ---------------------------------------------------------------------------

function _placeWord(grid, word, conceptId, wordIndex, directions, gridSize) {
  // Shuffle directions to avoid always preferring the same first
  const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt < 150; attempt++) {
    const dir = shuffledDirs[attempt % shuffledDirs.length];
    const [dr, dc] = DELTAS[dir];
    const startRow = Math.floor(Math.random() * gridSize);
    const startCol = Math.floor(Math.random() * gridSize);

    // Check bounds for all letters
    const endRow = startRow + dr * (word.length - 1);
    const endCol = startCol + dc * (word.length - 1);
    if (endRow < 0 || endRow >= gridSize || endCol < 0 || endCol >= gridSize) continue;

    // Check collisions — allow overlap only when the same letter occupies the cell
    let canPlace = true;
    for (let i = 0; i < word.length; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      const existing = grid[r][c].letter;
      if (existing && existing !== word[i]) {
        canPlace = false;
        break;
      }
    }
    if (!canPlace) continue;

    // Place the word
    const cells = [];
    for (let i = 0; i < word.length; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      grid[r][c] = { letter: word[i], conceptId, wordIndex };
      cells.push({ row: r, col: c });
    }

    return { word, conceptId, cells, direction: dir };
  }

  // Could not place after 150 attempts — caller decides how to handle
  console.warn(`[wordSearchUtils] Could not place word: "${word}" — skipped.`);
  return null;
}

// ---------------------------------------------------------------------------
// Private: _buildAlphabet
// ---------------------------------------------------------------------------

/**
 * Returns an array of uppercase filler characters for the given script.
 *
 * Currently only 'latin' (A–Z) is implemented.
 *
 * TODO: Add cases for each non-Latin script when those languages are added:
 *
 *   case 'hiragana': return Array.from('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん');
 *   case 'katakana': return Array.from('アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン');
 *   case 'arabic':   return Array.from('ابتثجحخدذرزسشصضطظعغفقكلمنهوي');
 *   case 'cyrillic': return Array.from('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');
 *   case 'hebrew':   return Array.from('אבגדהוזחטיכלמנסעפצקרשת');
 *   case 'hangul':   — Korean syllables are too numerous; use a curated common-syllable list.
 *
 * The `script` value should be derived from the user's learningDialect BCP-47
 * tag, e.g. 'ja' → 'hiragana', 'ar' → 'arabic', 'ru' → 'cyrillic', etc.
 *
 * @param {string} script
 * @returns {string[]}
 */
function _buildAlphabet(script = 'latin') {
  switch (script) {
    // TODO: add non-Latin cases here as new languages are onboarded
    case 'latin':
    default:
      return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  }
}
