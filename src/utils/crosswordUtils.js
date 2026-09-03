/**
 * crosswordUtils.js
 *
 * Builds an arrowword: a crossword whose clues sit inside the grid, each in the
 * cell immediately before its answer, with an arrow pointing at where the
 * answer runs. No numbering, no separate clue list.
 *
 * Sibling of wordSearchUtils.js and deliberately the same shape — buildGrid /
 * checkSelection there, buildCrossword / checkEntry here — so the two games
 * read alike.
 *
 * The important difference from a word search: there, every word can always be
 * placed somewhere because letters may overlap freely and filler hides the
 * rest. Here a placement has to earn its space. Each answer needs a free cell
 * in front of it for its clue, a stop after it so it does not run into the next
 * word, and it must not sit alongside a parallel word and accidentally spell
 * two-letter nonsense in the other direction. Words that cannot satisfy that
 * are dropped, exactly as buildGrid drops words it cannot place.
 */

/** Cell kinds. A grid position is exactly one of these. */
export const CELL = Object.freeze({
  LETTER: "letter",
  CLUE: "clue",
  BLOCK: "block",
});

/** Shortest answer worth a clue cell of its own. */
const MIN_LENGTH = 3;

/** Only whole single words can interlock. */
const PLACEABLE = /^[\p{L}]+$/u;

const DELTAS = {
  H: { dr: 0, dc: 1 },
  V: { dr: 1, dc: 0 },
};

const PERPENDICULAR = { H: "V", V: "H" };

/**
 * Prepare the raw word list: upper-case, drop anything that cannot interlock.
 *
 * Multi-word and hyphenated answers are rejected rather than squashed — an
 * answer the player cannot type as a single run of letters is unfair.
 */
function _normalize(words, cols, rows) {
  const longest = Math.max(cols, rows) - 1; // -1 leaves room for the clue cell
  return words
    .map((w) => ({ ...w, answer: String(w.word ?? "").trim().toUpperCase() }))
    .filter(
      (w) =>
        w.answer.length >= MIN_LENGTH &&
        w.answer.length <= longest &&
        PLACEABLE.test(w.answer)
    )
    .sort((a, b) => b.answer.length - a.answer.length);
}

const makeGrid = (cols, rows) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

const inBounds = (r, c, cols, rows) => r >= 0 && c >= 0 && r < rows && c < cols;

/**
 * Can this answer sit at (row, col) running `direction`?
 *
 * @returns {{ crossings: number, clueCell: {row,col} }|null}
 */
function _validate(grid, answer, row, col, direction, cols, rows) {
  const { dr, dc } = DELTAS[direction];

  // The clue has to go somewhere: one cell back along the run.
  const clueRow = row - dr;
  const clueCol = col - dc;
  if (!inBounds(clueRow, clueCol, cols, rows)) return null;

  const clueTarget = grid[clueRow][clueCol];
  // A clue cell may host a second clue (one across, one down) — that is what
  // produces the stacked-clue cells. A reserved stop can also become a clue,
  // since both stop a run. Only a letter is fatal: it would be overwritten.
  if (clueTarget && clueTarget.kind === CELL.LETTER) return null;

  let crossings = 0;

  for (let i = 0; i < answer.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (!inBounds(r, c, cols, rows)) return null;

    const cell = grid[r][c];

    if (cell) {
      if (cell.kind !== CELL.LETTER || cell.letter !== answer[i]) return null;
      crossings++;
      continue;
    }

    // Empty cell: check it will not sit beside a parallel word and create a
    // stray two-letter run reading the other way. Crossing cells are exempt —
    // there the neighbours are that word's own letters, which is the point.
    const perp = DELTAS[PERPENDICULAR[direction]];
    for (const sign of [-1, 1]) {
      const nr = r + perp.dr * sign;
      const nc = c + perp.dc * sign;
      if (!inBounds(nr, nc, cols, rows)) continue;
      if (grid[nr][nc]?.kind === CELL.LETTER) return null;
    }
  }

  // A stop after the last letter, so the answer does not read on into a
  // neighbouring word. Out of bounds counts; so does an existing clue cell.
  const endRow = row + dr * answer.length;
  const endCol = col + dc * answer.length;
  if (inBounds(endRow, endCol, cols, rows)) {
    const endCell = grid[endRow][endCol];
    if (endCell && endCell.kind === CELL.LETTER) return null;
  }

  return { crossings, clueCell: { row: clueRow, col: clueCol } };
}

/**
 * Write an accepted placement into the grid and return its entry.
 */
function _commit(grid, entryId, item, row, col, direction, clueCell, cols, rows) {
  const { dr, dc } = DELTAS[direction];
  const cells = [];

  for (let i = 0; i < item.answer.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = grid[r][c];
    if (existing) {
      existing.entryIds.push(entryId);
    } else {
      grid[r][c] = {
        kind: CELL.LETTER,
        letter: item.answer[i],
        entryIds: [entryId],
      };
    }
    cells.push({ row: r, col: c });
  }

  const { row: cr, col: cc } = clueCell;
  if (grid[cr][cc]?.kind !== CELL.CLUE) grid[cr][cc] = { kind: CELL.CLUE, clues: [] };
  grid[cr][cc].clues.push({
    entryId,
    hint: item.hint ?? "",
    conceptId: item.conceptId,
    direction,
  });

  // Reserve the stop so a later word cannot fill it and merge the two answers.
  const endRow = row + dr * item.answer.length;
  const endCol = col + dc * item.answer.length;
  if (inBounds(endRow, endCol, cols, rows) && !grid[endRow][endCol]) {
    grid[endRow][endCol] = { kind: CELL.BLOCK };
  }

  return {
    id: entryId,
    conceptId: item.conceptId,
    answer: item.answer,
    hint: item.hint ?? "",
    direction,
    cells,
    clueCell,
  };
}

/**
 * Turn the working grid into the finished board.
 *
 * Deliberately NOT cropped to the bounding box. The caller asks for a board of
 * a given size and gets exactly that, so the puzzle does not silently shrink to
 * whatever the words happened to fill — a 7x7 request that produced a 5x4 patch
 * looked like a bug rather than a small puzzle. Unused positions become blocks,
 * and entry coordinates stay as placed.
 */
function _materialize(grid, entries, cols, rows) {
  // Centre what was placed inside the board. The seed can land anywhere the
  // scan liked, so without this a small puzzle sits against one edge with a
  // whole empty row and column on the other side, which reads as a rendering
  // fault rather than as a small puzzle.
  let top = rows, left = cols, bottom = -1, right = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }

  const dr = bottom < 0 ? 0 : Math.floor((rows - 1 - bottom - top) / 2);
  const dc = bottom < 0 ? 0 : Math.floor((cols - 1 - right - left) / 2);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    const line = [];
    for (let c = 0; c < cols; c++) {
      const src = grid[r - dr]?.[c - dc];
      line.push(src ?? { kind: CELL.BLOCK });
    }
    cells.push(line);
  }

  const shift = ({ row, col }) => ({ row: row + dr, col: col + dc });
  const shifted = entries.map((e) => ({
    ...e,
    cells: e.cells.map(shift),
    clueCell: shift(e.clueCell),
  }));

  return { cells, entries: shifted, cols, rows };
}

/**
 * Place the first answer.
 *
 * Scans directions and start positions instead of assuming a fixed spot, and
 * falls back to the next-longest answer if the longest cannot be seeded at all.
 * The fixed "horizontal at (1,1)" this replaces meant one answer too long for
 * the grid's width returned an empty puzzle rather than a puzzle without that
 * answer — the whole board lost to a single word.
 *
 * @returns {{index: number, item: object, row: number, col: number,
 *            direction: string, check: object}|null}
 */
function _seed(grid, items, cols, rows) {
  const midRow = (rows - 1) / 2;
  const midCol = (cols - 1) / 2;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const len = item.answer.length;
    let best = null;

    for (const direction of ["H", "V"]) {
      const rowEnd = direction === "V" ? rows - len : rows - 1;
      const colEnd = direction === "H" ? cols - len : cols - 1;

      // Both axes start at 1, never 0. A seed laid along the top row cannot be
      // crossed at all: a vertical answer through it would need its clue cell
      // at row -1. Leaving one lane free on the top and left is what makes the
      // rest of the puzzle possible.
      for (let row = 1; row <= rowEnd; row++) {
        for (let col = 1; col <= colEnd; col++) {
          const check = _validate(grid, item.answer, row, col, direction, cols, rows);
          if (!check) continue;

          // Prefer the middle, so later answers have room on every side.
          const endRow = direction === "V" ? row + len - 1 : row;
          const endCol = direction === "H" ? col + len - 1 : col;
          const dist =
            Math.abs((row + endRow) / 2 - midRow) + Math.abs((col + endCol) / 2 - midCol);
          if (!best || dist < best.dist) best = { index, item, row, col, direction, check, dist };
        }
      }
    }

    if (best) return best;
  }
  return null;
}

/**
 * Build an arrowword.
 *
 * @param {Array<{word: string, hint: string, conceptId: string}>} words
 * @param {number} cols - working width; the result is cropped to fit
 * @param {number} rows - working height
 * @returns {{
 *   cells: Array<Array<object>>,
 *   entries: Array<{id, conceptId, answer, hint, direction, cells, clueCell}>,
 *   cols: number,
 *   rows: number,
 * }}
 */
export function buildCrossword(words, cols, rows) {
  const items = _normalize(words ?? [], cols, rows);
  if (items.length === 0) return { cells: [], entries: [], cols: 0, rows: 0 };

  const grid = makeGrid(cols, rows);
  const entries = [];
  let nextId = 0;

  const seed = _seed(grid, items, cols, rows);
  if (!seed) return { cells: [], entries: [], cols: 0, rows: 0 };
  entries.push(
    _commit(grid, `e${nextId++}`, seed.item, seed.row, seed.col, seed.direction, seed.check.clueCell, cols, rows)
  );

  // Everything else must cross something already on the board, which is what
  // keeps the puzzle a single connected shape rather than scattered words.
  for (const item of items.filter((_, i) => i !== seed.index)) {
    const candidates = [];

    for (const entry of entries) {
      const direction = PERPENDICULAR[entry.direction];
      const { dr, dc } = DELTAS[direction];

      entry.cells.forEach((cell, placedIdx) => {
        const placedLetter = entry.answer[placedIdx];

        for (let i = 0; i < item.answer.length; i++) {
          if (item.answer[i] !== placedLetter) continue;

          const row = cell.row - dr * i;
          const col = cell.col - dc * i;
          const check = _validate(grid, item.answer, row, col, direction, cols, rows);
          if (check) candidates.push({ row, col, direction, ...check });
        }
      });
    }

    if (candidates.length === 0) continue;

    // More crossings makes a denser, more satisfying grid. Ties are broken at
    // random so the same set of words does not always lay out identically.
    const most = Math.max(...candidates.map((c) => c.crossings));
    const tied = candidates.filter((c) => c.crossings === most);
    const best = tied[Math.floor(Math.random() * tied.length)];
    entries.push(
      _commit(grid, `e${nextId++}`, item, best.row, best.col, best.direction, best.clueCell, cols, rows)
    );
  }

  return _materialize(grid, entries, cols, rows);
}

/**
 * Is this entry solved by what the player has typed?
 *
 * `letters` maps "row-col" to the placed character. Comparison goes through
 * `keyOf` so easy mode (accent-insensitive) and hard mode (exact) are decided
 * by the caller, in one place — see utils/letterKeys.
 *
 * @param {object} entry
 * @param {Map<string, string>} letters
 * @param {(letter: string) => string} keyOf
 * @returns {{ complete: boolean, correct: boolean }}
 */
export function checkEntry(entry, letters, keyOf) {
  let complete = true;
  let correct = true;

  entry.cells.forEach((cell, i) => {
    const placed = letters.get(`${cell.row}-${cell.col}`);
    if (!placed) {
      complete = false;
      correct = false;
      return;
    }
    if (keyOf(placed) !== keyOf(entry.answer[i])) correct = false;
  });

  return { complete, correct };
}

export default buildCrossword;
