/**
 * wordSearchUtils.js
 *
 * Pure grid-generation utilities for the Word Search game.
 * No React, no services — fully testable in isolation.
 *
 * Exports:
 *   splitLetters(word) → string[]   (one entry per grid cell, see below)
 *   buildGrid(words, gridCols, gridRows, hardMode) → { grid, placements, placedWords }
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
 * The letters of a word as a reader sees them — one per grid cell.
 *
 * **Not `word[i]`.** A JavaScript string indexes UTF-16 units, and in many
 * scripts a letter is several of them: Tamil கா is க plus the vowel sign ா,
 * and indexing split the sign into a cell of its own, where it renders as a
 * broken glyph beside a dotted circle — every Tamil word was garbled before
 * a single filler letter was drawn. `Intl.Segmenter` in grapheme mode keeps a
 * consonant with its vowel sign, a letter with its accent, and a Korean
 * syllable block whole, in any script the browser knows.
 *
 * @param {string} word
 * @returns {string[]}
 */
export function splitLetters(word) {
  const text = String(word ?? '');
  try {
    _graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(_graphemes.segment(text), ({ segment }) => segment);
  } catch {
    // Code points: still keeps surrogate pairs whole, which UTF-16 does not.
    return Array.from(text);
  }
}

/** Grapheme segmentation does not depend on language, so one instance serves all. */
let _graphemes;

/** A letter or digit in any script — what may occupy a cell. */
function _isPlayable(grapheme) {
  return /[\p{L}\p{N}]/u.test(grapheme);
}

/**
 * Build a word-search grid.
 *
 * @param {Array<{word: string, conceptId: string}>} words  — already filtered to maxLength
 * @param {number} gridCols   - number of columns (horizontal extent), e.g. 10
 * @param {number} gridRows   - number of rows    (vertical extent),   e.g. 15
 * @param {boolean} hardMode  - false = H+V only; true = all 8 directions
 * @returns {{ grid: Cell[][], placements: Placement[], placedWords: {word,hint,conceptId}[] }}
 *
 * NOTE — placedWords is the subset of `words` that were successfully placed.
 * Callers MUST use placedWords (not the original words array) to drive win
 * condition and word-list display, so that unplaceable words never make the
 * game unwinnable.
 */
export function buildGrid(words, gridCols, gridRows, hardMode = false) {
  const directions = hardMode ? ALL_DIRECTIONS : EASY_DIRECTIONS;

  // Initialize empty grid — rows × cols
  const grid = Array.from({ length: gridRows }, () =>
    Array.from({ length: gridCols }, () => ({ letter: '', conceptId: null, wordIndex: null }))
  );

  const placements  = [];
  const placedWords = []; // only words that were actually placed (see NOTE above)
  // Every letter of every word, repeats included — the filler is drawn from
  // this, so its letters come in the words' own proportions.
  const letterBag = [];

  for (let wi = 0; wi < words.length; wi++) {
    const entry = words[wi];
    // Always uppercase for consistent comparison in checkSelection
    const upper = entry.word.toUpperCase();
    // Letters and digits only. A pooled answer can be two words — Tamil
    // விமான நிலையம் is "airport" — and a space or a hyphen in a cell is a
    // blank the player cannot read; worse, drawn into the filler, it put empty
    // cells in the grid. Placed joined up, the way word searches print them;
    // the word list still shows the answer as written.
    const letters = splitLetters(upper).filter(_isPlayable);
    letterBag.push(...letters);

    // A one-letter word fills one cell, and a selection needs two — it could
    // never be found, so placing it would make the puzzle unwinnable. Tamil
    // பூ ("flower") is one letter. Skipped like an unplaceable word.
    if (letters.length < 2) continue;

    const placed = _placeWord(grid, letters, entry.conceptId, wi, directions, gridCols, gridRows);
    if (placed) {
      placements.push(placed);
      placedWords.push({ ...entry, word: upper }); // store uppercase to match placement
    }
    // If _placeWord returns null the word is silently skipped.
    // placedWords will not include it, so win condition remains reachable.
  }

  // Fill empty cells from the words' own letters. That is the practice
  // language's alphabet by construction — Tamil fills with Tamil, Japanese
  // with kana — with no table per script to write or keep current, and it
  // keeps a word from standing out: an A–Z filler left every ã and ç in a
  // Portuguese grid visibly belonging to an answer.
  const filler = letterBag.length > 0 ? letterBag : LATIN_FALLBACK;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (!grid[r][c].letter) {
        grid[r][c].letter = filler[Math.floor(Math.random() * filler.length)];
      }
    }
  }

  return { grid, placements, placedWords };
}

/** Only for a grid with no words at all, where there is nothing to draw from. */
const LATIN_FALLBACK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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

/**
 * @param {string[]} letters - the word as splitLetters returns it, one per cell
 */
function _placeWord(grid, letters, conceptId, wordIndex, directions, gridCols, gridRows) {
  const word = letters.join('');
  // Shuffle directions to avoid always preferring the same first
  const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt < 150; attempt++) {
    const dir = shuffledDirs[attempt % shuffledDirs.length];
    const [dr, dc] = DELTAS[dir];
    const startRow = Math.floor(Math.random() * gridRows);
    const startCol = Math.floor(Math.random() * gridCols);

    // Check bounds for all letters using the correct axis limits
    const endRow = startRow + dr * (letters.length - 1);
    const endCol = startCol + dc * (letters.length - 1);
    if (endRow < 0 || endRow >= gridRows || endCol < 0 || endCol >= gridCols) continue;

    // Check collisions — allow overlap only when the same letter occupies the cell
    let canPlace = true;
    for (let i = 0; i < letters.length; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      const existing = grid[r][c].letter;
      if (existing && existing !== letters[i]) {
        canPlace = false;
        break;
      }
    }
    if (!canPlace) continue;

    // Place the word
    const cells = [];
    for (let i = 0; i < letters.length; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      grid[r][c] = { letter: letters[i], conceptId, wordIndex };
      cells.push({ row: r, col: c });
    }

    return { word, conceptId, cells, direction: dir };
  }

  // Could not place after 150 attempts — caller decides how to handle
  console.warn(`[wordSearchUtils] Could not place word: "${word}" — skipped.`);
  return null;
}
