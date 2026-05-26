/**
 * wordSearchUtils.js
 *
 * Pure grid-generation utilities for the Word Search game.
 * No React, no services — fully testable in isolation.
 *
 * Exports:
 *   buildGrid(words, gridSize, hardMode) → { grid, placements }
 *   checkSelection(placements, selectedCells) → string | null
 *
 * Grid cell shape:
 *   { letter: string, conceptId: string | null, wordIndex: number | null }
 *
 * Placement shape:
 *   { word: string, conceptId: string, cells: {row, col}[], direction: string }
 *
 * Direction codes (hardMode=false allows only H/V; hardMode=true all 8):
 *   'H'  = left → right
 *   'V'  = top  → bottom
 *   'DL' = diagonal down-left
 *   'DR' = diagonal down-right
 *   'RH' = right → left   (hard only)
 *   'RV' = bottom → top   (hard only)
 *   'RL' = diagonal up-left  (hard only)
 *   'RR' = diagonal up-right (hard only)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EASY_DIRECTIONS = ['H', 'V', 'DR', 'DL'];
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
 * @param {Array<{word: string, conceptId: string}>} words
 * @param {number} gridSize  - e.g. 12
 * @param {boolean} hardMode - allow all 8 directions when true
 * @returns {{ grid: Cell[][], placements: Placement[] }}
 */
export function buildGrid(words, gridSize, hardMode = false) {
  const directions = hardMode ? ALL_DIRECTIONS : EASY_DIRECTIONS;

  // Initialize empty grid
  const grid = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({ letter: '', conceptId: null, wordIndex: null }))
  );

  const placements = [];

  for (let wi = 0; wi < words.length; wi++) {
    const { word, conceptId } = words[wi];
    const upper = word.toUpperCase();
    const placed = _placeWord(grid, upper, conceptId, wi, directions, gridSize);
    if (placed) placements.push(placed);
  }

  // Fill empty cells with random letters
  const alphabet = _buildAlphabet();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!grid[r][c].letter) {
        grid[r][c].letter = alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
  }

  return { grid, placements };
}

// ---------------------------------------------------------------------------
// Public: checkSelection
// ---------------------------------------------------------------------------

/**
 * Given the current tap-selection (array of {row, col}) and known placements,
 * return the matching word string if the selection exactly matches a placement,
 * or null if no match.
 *
 * Selection can be in either direction relative to the placement.
 *
 * @param {Placement[]} placements
 * @param {{ row: number, col: number }[]} selectedCells
 * @returns {string | null}
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
    if (forward) return placement.word;

    // Match reversed
    const reversed = cells.every(
      (c, i) => c.row === selectedCells[cells.length - 1 - i].row &&
                 c.col === selectedCells[cells.length - 1 - i].col
    );
    if (reversed) return placement.word;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Private: _placeWord
// ---------------------------------------------------------------------------

function _placeWord(grid, word, conceptId, wordIndex, directions, gridSize) {
  // Shuffle directions to avoid always trying the same first
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

    // Check collisions (allow overlap only if same letter)
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

  // Could not place after 150 attempts — skip word (edge case with very long words)
  console.warn(`[wordSearchUtils] Could not place word: ${word}`);
  return null;
}

// ---------------------------------------------------------------------------
// Private: _buildAlphabet
// ---------------------------------------------------------------------------

/**
 * Basic A-Z alphabet for filler letters.
 * We intentionally use plain Latin to keep the grid readable regardless
 * of the learning language — the real words already have accented characters.
 */
function _buildAlphabet() {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
}
