import { describe, it, expect } from "vitest";

import { buildCrossword, checkEntry, CELL } from "../../src/utils/crosswordUtils";
import { buildGrid, checkSelection } from "../../src/utils/wordSearchUtils";
import { letterKey } from "../../src/utils/letterKeys";

/**
 * Puzzle generation.
 *
 * Both builders are randomised, so these assert the invariants that must hold
 * for every layout rather than one golden grid: words interlock, letters agree
 * wherever two entries cross, nothing runs off the board, and a word that
 * cannot be placed costs only itself rather than the whole puzzle.
 */

const words = (...list) => list.map((word, i) => ({ word, conceptId: `c${i}`, clue: `clue ${i}` }));

describe("buildCrossword", () => {
  it("returns an empty puzzle for no usable words", () => {
    expect(buildCrossword([], 10, 10).entries).toEqual([]);
    expect(buildCrossword(undefined, 10, 10).entries).toEqual([]);
  });

  it("rejects answers that cannot interlock as a single run of letters", () => {
    // Multi-word and hyphenated answers are unfair: the player cannot type
    // them into a straight run of cells.
    const built = buildCrossword(words("bem vindo", "bem-vindo", "ok"), 12, 12);
    expect(built.entries).toEqual([]);
  });

  it("drops answers too long for the board but keeps the rest", () => {
    // The regression this guards: one oversized word used to return an empty
    // puzzle, losing the whole board to a single entry.
    const built = buildCrossword(words("CASA", "EXTRAORDINARIAMENTE"), 8, 8);
    const answers = built.entries.map((e) => e.answer);
    expect(answers).toContain("CASA");
    expect(answers).not.toContain("EXTRAORDINARIAMENTE");
  });

  it("upper-cases answers regardless of input case", () => {
    const built = buildCrossword(words("casa"), 10, 10);
    expect(built.entries[0].answer).toBe("CASA");
  });

  it("places every entry inside the board", () => {
    const built = buildCrossword(words("CASA", "SOL", "MAR", "LUA", "RATO"), 14, 14);
    expect(built.entries.length).toBeGreaterThan(0);

    for (const entry of built.entries) {
      for (const cell of entry.cells) {
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.col).toBeGreaterThanOrEqual(0);
        expect(cell.row).toBeLessThan(built.rows);
        expect(cell.col).toBeLessThan(built.cols);
      }
    }
  });

  it("agrees with the rendered grid on every letter it placed", () => {
    // The invariant that makes a crossword a crossword: where two entries
    // cross, both must read the same letter out of the same cell.
    const built = buildCrossword(words("CASA", "SOL", "MAR", "LUA", "RATO", "PATO"), 14, 14);

    for (const entry of built.entries) {
      entry.cells.forEach((cell, i) => {
        const rendered = built.cells[cell.row][cell.col];
        expect(rendered.kind).toBe(CELL.LETTER);
        expect(rendered.letter).toBe(entry.answer[i]);
      });
    }
  });

  it("gives every entry a clue cell on the board", () => {
    const built = buildCrossword(words("CASA", "SOL", "MAR"), 12, 12);
    for (const entry of built.entries) {
      const { row, col } = entry.clueCell;
      expect(row).toBeGreaterThanOrEqual(0);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(built.cells[row][col].kind).toBe(CELL.CLUE);
    }
  });

  it("lays entries out horizontally or vertically only", () => {
    const built = buildCrossword(words("CASA", "SOL", "MAR", "LUA"), 12, 12);
    for (const entry of built.entries) {
      expect(["H", "V"]).toContain(entry.direction);
    }
  });

  it("produces a full grid of the requested size", () => {
    const built = buildCrossword(words("CASA", "SOL"), 11, 9);
    expect(built.cells).toHaveLength(9);
    for (const row of built.cells) expect(row).toHaveLength(11);
  });
});

describe("checkEntry", () => {
  const entry = {
    answer: "CAFÉ",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ],
  };

  const lettersFor = (text) =>
    new Map(entry.cells.map((cell, i) => [`${cell.row}-${cell.col}`, text[i]]).filter(([, v]) => v));

  const easy = (l) => letterKey(l, false);
  const hard = (l) => letterKey(l, true);

  it("reports incomplete while a cell is empty", () => {
    expect(checkEntry(entry, lettersFor("CAF"), easy)).toEqual({ complete: false, correct: false });
  });

  it("accepts the exact answer in both modes", () => {
    expect(checkEntry(entry, lettersFor("CAFÉ"), easy)).toEqual({ complete: true, correct: true });
    expect(checkEntry(entry, lettersFor("CAFÉ"), hard)).toEqual({ complete: true, correct: true });
  });

  it("accepts an unaccented spelling in easy mode only", () => {
    expect(checkEntry(entry, lettersFor("CAFE"), easy).correct).toBe(true);
    expect(checkEntry(entry, lettersFor("CAFE"), hard).correct).toBe(false);
  });

  it("marks a filled but wrong answer complete and incorrect", () => {
    expect(checkEntry(entry, lettersFor("CASA"), easy)).toEqual({ complete: true, correct: false });
  });
});

describe("buildGrid (word search)", () => {
  const list = words("CASA", "SOL", "MAR", "LUA");

  it("fills every cell so no blanks show through", () => {
    const { grid } = buildGrid(list, 10, 10);
    expect(grid).toHaveLength(10);
    for (const row of grid) {
      expect(row).toHaveLength(10);
      for (const cell of row) expect(cell.letter).toMatch(/\S/);
    }
  });

  it("stores placed words upper-cased so selection comparison works", () => {
    const { placedWords } = buildGrid(words("casa", "sol"), 10, 10);
    for (const w of placedWords) expect(w.word).toBe(w.word.toUpperCase());
  });

  it("spells each placed word correctly along its own cells", () => {
    const { grid, placements } = buildGrid(list, 12, 12);
    expect(placements.length).toBeGreaterThan(0);

    for (const placement of placements) {
      const spelled = placement.cells.map(({ row, col }) => grid[row][col].letter).join("");
      expect(spelled).toBe(placement.word.toUpperCase());
    }
  });

  it("keeps placements and placedWords in step, so the win condition is reachable", () => {
    // A word that cannot be placed is skipped silently; if it stayed in
    // placedWords the puzzle could never be completed.
    const { placements, placedWords } = buildGrid(
      words("CASA", "SOL", "PALAVRAEXTREMAMENTELONGA"),
      8,
      8,
    );
    expect(placements).toHaveLength(placedWords.length);
  });

  it("keeps every placement inside the grid", () => {
    const { placements } = buildGrid(list, 10, 12);
    for (const placement of placements) {
      for (const { row, col } of placement.cells) {
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(12);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(10);
      }
    }
  });

  it("uses only straight lines in easy mode", () => {
    // Easy mode must not place diagonals — they are much harder to spot.
    const { placements } = buildGrid(list, 12, 12, false);
    for (const p of placements) {
      const rowsSame = p.cells.every((c) => c.row === p.cells[0].row);
      const colsSame = p.cells.every((c) => c.col === p.cells[0].col);
      expect(rowsSame || colsSame).toBe(true);
    }
  });
});

describe("checkSelection", () => {
  const { placements } = buildGrid(words("CASA", "SOL", "MAR"), 12, 12);
  const target = placements[0];

  it("matches a selection running the same way as the placement", () => {
    expect(checkSelection(placements, target.cells)).toBe(target);
  });

  it("matches the same word selected backwards", () => {
    expect(checkSelection(placements, [...target.cells].reverse())).toBe(target);
  });

  it("returns null for a selection of the wrong length", () => {
    expect(checkSelection(placements, target.cells.slice(0, -1))).toBeNull();
  });

  it("returns null for a single cell or nothing at all", () => {
    expect(checkSelection(placements, [target.cells[0]])).toBeNull();
    expect(checkSelection(placements, [])).toBeNull();
    expect(checkSelection(placements, null)).toBeNull();
  });

  it("returns null for cells that spell nothing", () => {
    const nonsense = target.cells.map((c) => ({ row: c.row, col: (c.col + 3) % 12 }));
    const match = checkSelection(placements, nonsense);
    if (match) expect(match.cells).toEqual(nonsense);
    else expect(match).toBeNull();
  });
});
