import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The game components, mounted directly with real content.
 *
 * These are the largest components in the app — CrosswordGame alone is a
 * thousand lines — and the page-level smoke suite cannot reach them: each page
 * is a thin Suspense wrapper, so asserting on the page passes while the lazy
 * chunk is still loading. Mounting the component itself, with its content
 * services stubbed to return a real puzzle, is what actually exercises the
 * board, the keyboard and the win/lose paths.
 *
 * Every game takes only `isDarkMode` and reads everything else from context,
 * which is what makes this practical.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: vi.fn(async () => ({ documents: [], hasMore: false })),
  getDocument: vi.fn(async () => null),
  createDocument: vi.fn(async () => ({ id: "x" })),
  updateDocument: vi.fn(async () => ({})),
  deleteDocument: vi.fn(async () => ({})),
}));

vi.mock("../../src/services/aiService", () => ({
  askAI: vi.fn(async () => ""),
  registerAiConfirmHandler: vi.fn(),
}));

// Spread the real module rather than replacing it: these games call a wide
// slice of userService, and a hand-listed mock silently throws "no export
// defined" from inside an effect, which surfaces as the game hanging on its
// spinner rather than as a clear failure.
vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  updateUserProfile: vi.fn(async () => ({})),
  markConceptSeen: vi.fn(async () => ({})),
  getUserProfile: vi.fn(async () => ({})),
  updateDayStreak: vi.fn(async () => ({})),
  addWordFound: vi.fn(async () => ({})),
  getUserGameProgress: vi.fn(async () => ({})),
  saveUserGameProgress: vi.fn(async () => ({})),
}));

const WORD = { word: "CASA", hint: "Onde se vive", conceptId: "c-casa", source: "db" };

vi.mock("../../src/services/getWordService", () => ({
  getWord: vi.fn(async () => WORD),
  getWordPoolCount: vi.fn(async () => 42),
}));

vi.mock("../../src/services/conceptIconService", () => ({
  loadConceptIcons: vi.fn(async () => ({})),
}));

vi.mock("../../src/services/wordLinkService", () => ({
  fetchWordLinkPuzzle: vi.fn(async () => ({
    puzzleId: "p1",
    theme: "Casa",
    themeTranslation: "Home",
    clues: ["Onde se dorme", "Onde se come", "Onde se lava", "Onde se entra"],
    keywords: ["QUARTO", "COZINHA", "BANHO", "PORTA"],
  })),
  getWordLinkPoolCount: vi.fn(async () => 7),
}));

vi.mock("../../src/services/wordLadderService", () => ({
  MAX_STRIKES: 3,
  fetchWordLadderPuzzle: vi.fn(async () => ({
    puzzleId: "p2",
    words: ["MALA", "MALO", "MELO", "MELA"],
    clues: ["Bagagem", "Adjetivo", "Árvore", "Verbo"],
    wordLength: 4,
  })),
  getWordLadderPoolCount: vi.fn(async () => 5),
}));

/**
 * A benign default for any service this file has not explicitly stubbed.
 *
 * test/setup.js makes an unmocked fetch reject loudly, which is right for unit
 * tests — it names the call you forgot. For an integration-style render it is
 * wrong: the games catch the rejection and render their error state, so the
 * board never appears and the failure reads as "nothing rendered". Returning
 * an empty success envelope lets every unstubbed read resolve to "no data",
 * which is a state the games are built to handle.
 */
const emptyEnvelope = () =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { documents: [], hasMore: false } }),
  }));

const signedIn = () =>
  makeAppContext({
    user: {
      uid: "test-uid",
      token: "tok",
      displayName: "Test User",
      subscriptionTier: "maestro",
      learningDialect: "pt-PT",
      interfaceLang: "pt-PT",
      aiCallsToday: 0,
      seenConceptIds: [],
    },
    token: "tok",
    tiersConfig: {
      maestro: {
        id: "maestro",
        label: "Maestro",
        order: 3,
        isFree: false,
        hidden: false,
        aiCallsPerDay: Infinity,
        features: ["hangman", "crosswords", "word_search", "scrambled_word", "word_link", "word_ladder"],
      },
    },
    features: [],
    categories: [{ id: "food", name: "Comida", conceptIds: ["c1"] }],
    supportedLanguages: [{ code: "pt-PT", name: "Português", flag: "pt" }],
    writingSystems: [
      { supportedLanguageCodes: ["pt-PT"], characters: { default: [], special: ["á", "ç"] } },
    ],
  });

const mount = async (loader) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: Game } = await loader();

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Game isDarkMode={false} />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

/** Wait until the component has stopped showing only its spinner. */
const settled = async (container) =>
  waitFor(
    () => {
      expect(container.querySelectorAll("*").length).toBeGreaterThan(10);
    },
    { timeout: 8000 },
  );

const GAMES = [
  ["HangmanGame", () => import("../../src/components/HangmanGame")],
  ["ScrambledWordGame", () => import("../../src/components/ScrambledWordGame")],
  ["WordSearchGame", () => import("../../src/components/WordSearchGame")],
  ["CrosswordGame", () => import("../../src/components/CrosswordGame")],
  ["WordLadderGame", () => import("../../src/components/WordLadderGame")],
  ["WordLinkGame", () => import("../../src/components/WordLinkGame")],
];

describe("game components mount with real content", () => {
  beforeEach(() => {
    ctx.current = signedIn();
    globalThis.fetch = emptyEnvelope();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it.each(GAMES)("%s renders a board without crashing", async (_name, loader) => {
    const { container } = await mount(loader);
    await settled(container);

    expect(container.textContent.trim().length).toBeGreaterThan(0);
  });
});

describe("HangmanGame keyboard", () => {
  beforeEach(() => {
    ctx.current = signedIn();
    globalThis.fetch = emptyEnvelope();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("offers a full alphabet of letter keys", async () => {
    const { container } = await mount(() => import("../../src/components/HangmanGame"));
    await settled(container);

    // resolveLetterKeys falls back to A–Z when the writing system declares no
    // default alphabet, which is the fixture here.
    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent.trim());
    for (const letter of ["A", "E", "M", "Z"]) {
      expect(buttons).toContain(letter);
    }
  });

  it("consumes a letter key when it is pressed", async () => {
    const { container } = await mount(() => import("../../src/components/HangmanGame"));
    await settled(container);

    const findKey = (letter) =>
      [...container.querySelectorAll("button")].find((b) => b.textContent.trim() === letter);

    const before = findKey("A");
    expect(before).toBeDefined();
    before.click();

    // Whatever the game does with it — reveal, strike, or disable — the key
    // must not stay freshly clickable, or a player can spend the same guess
    // twice.
    await waitFor(() => {
      const after = findKey("A");
      expect(after === undefined || after.disabled || after.className !== before.className).toBe(
        true,
      );
    });
  });
});

/**
 * Choosing where to write, then writing there.
 *
 * Both of these games have blanks, and in both of them the blanks used to fill
 * themselves in order: the crossword took a letter wherever you dropped it but
 * offered no way to type, and Scrambled Word always put the next tile in the
 * leftmost gap. Picking the square and then typing into it is the interaction
 * these tests pin — it is invisible to a render assertion, because nothing
 * about the board looks different until a key is pressed.
 */

const setup = () => {
  ctx.current = signedIn();
  globalThis.fetch = emptyEnvelope();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
};

describe("ScrambledWordGame — typing into a chosen blank", () => {
  beforeEach(setup);

  const slotsOf = (container) => [...container.querySelectorAll("[data-slot]")];

  it("writes into the blank you picked, not the first empty one", async () => {
    const { container } = await mount(() => import("../../src/components/ScrambledWordGame"));
    await settled(container);

    const slots = slotsOf(container);
    expect(slots.length).toBe(4); // CASA

    slots[2].click();
    fireEvent.keyDown(slots[2], { key: "s" });

    await waitFor(() => {
      expect(slotsOf(container)[2].textContent.trim()).toBe("S");
    });
    // The point of the change: the leftmost gap is still a gap.
    expect(slotsOf(container)[0].textContent.trim()).toBe("");
  });

  it("takes the letter from the pool rather than inventing one", async () => {
    const { container } = await mount(() => import("../../src/components/ScrambledWordGame"));
    await settled(container);

    const slots = slotsOf(container);
    slots[0].click();
    // There is no Z in CASA, and the tiles are a finite pool.
    fireEvent.keyDown(slots[0], { key: "z" });

    await waitFor(() => {
      expect(slotsOf(container)[0].textContent.trim()).toBe("");
    });
  });

  it("clears the blank it is on with Backspace", async () => {
    const { container } = await mount(() => import("../../src/components/ScrambledWordGame"));
    await settled(container);

    const slots = slotsOf(container);
    slots[1].click();
    fireEvent.keyDown(slots[1], { key: "a" });
    await waitFor(() => expect(slotsOf(container)[1].textContent.trim()).toBe("A"));

    fireEvent.keyDown(slotsOf(container)[1], { key: "Backspace" });
    await waitFor(() => expect(slotsOf(container)[1].textContent.trim()).toBe(""));
  });
});

describe("CrosswordGame — typing into a chosen square", () => {
  beforeEach(setup);

  const cellsOf = (container) =>
    [...container.querySelectorAll("[data-cell]")].filter((el) => !el.disabled);

  it("puts a typed letter in the square that was tapped", async () => {
    const { container } = await mount(() => import("../../src/components/CrosswordGame"));
    await settled(container);

    await waitFor(() => expect(cellsOf(container).length).toBeGreaterThan(0));
    const cell = cellsOf(container)[0];
    const key = cell.getAttribute("data-cell");

    cell.click();
    fireEvent.keyDown(cell, { key: "a" });

    await waitFor(() => {
      const after = container.querySelector(`[data-cell="${key}"]`);
      expect(after.textContent.trim()).toBe("A");
    });
  });

  it("ignores a key the alphabet does not have", async () => {
    const { container } = await mount(() => import("../../src/components/CrosswordGame"));
    await settled(container);

    await waitFor(() => expect(cellsOf(container).length).toBeGreaterThan(0));
    const cell = cellsOf(container)[0];
    const key = cell.getAttribute("data-cell");

    cell.click();
    fireEvent.keyDown(cell, { key: "7" });

    const after = container.querySelector(`[data-cell="${key}"]`);
    expect(after.textContent.trim()).toBe("");
  });

  it("centres the dragged letter on a mouse pointer", async () => {
    const { container } = await mount(() => import("../../src/components/CrosswordGame"));
    await settled(container);

    const rackKey = [...container.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "A" && !b.hasAttribute("data-cell"),
    );
    expect(rackKey).toBeDefined();

    fireEvent.pointerDown(rackKey, { clientX: 300, clientY: 400, pointerType: "mouse" });

    // The ghost is 36x40, so centred means half of each subtracted and nothing
    // else. It used to sit 26px above the cursor, which is right for a
    // fingertip and wrong for a cursor that is already pointing at the target.
    await waitFor(() => {
      const ghost = document.querySelector(".fixed.z-50.pointer-events-none");
      expect(ghost).not.toBeNull();
      expect(ghost.style.left).toBe("282px");
      expect(ghost.style.top).toBe("380px");
    });
  });

  it("lifts it clear of a fingertip", async () => {
    const { container } = await mount(() => import("../../src/components/CrosswordGame"));
    await settled(container);

    const rackKey = [...container.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "A" && !b.hasAttribute("data-cell"),
    );

    fireEvent.pointerDown(rackKey, { clientX: 300, clientY: 400, pointerType: "touch" });

    // A finger is about the size of the ghost and covers it completely, which
    // is the one case where the offset earns itself. This is the other half of
    // the test above: without it, a pointerType that never arrives would make
    // both readings look centred and prove nothing.
    await waitFor(() => {
      const ghost = document.querySelector(".fixed.z-50.pointer-events-none");
      expect(ghost).not.toBeNull();
      expect(ghost.style.top).toBe("354px");
    });
  });
});

/**
 * One word, once.
 *
 * The pool holds several concepts for some words — eight for "passport" when
 * this was found — and each carries its own AI-written clue. Excluding the
 * concept ids already drawn does not stop them, because they are genuinely
 * different concepts: three of them landed in a single nine-word grid, reading
 * as three different clues for the same answer.
 */
describe("CrosswordGame — no repeated answers", () => {
  beforeEach(setup);

  it("drops a word the grid already has, however many concepts carry it", async () => {
    const { getWord } = await import("../../src/services/getWordService");
    let n = 0;
    getWord.mockImplementation(async () => {
      n += 1;
      // Distinct concepts, distinct clues, one single word — which is exactly
      // the shape of the duplicates sitting in the live pool.
      return { word: "CASA", hint: `pista numero ${n}`, conceptId: `c-${n}`, source: "db" };
    });

    try {
      const { container } = await mount(() => import("../../src/components/CrosswordGame"));
      await settled(container);

      const shown = Array.from({ length: 9 }, (_, i) => `pista numero ${i + 1}`).filter((h) =>
        container.textContent.includes(h),
      );
      expect(shown.length).toBeLessThanOrEqual(1);
    } finally {
      getWord.mockImplementation(async () => WORD);
    }
  });
});

/**
 * The wait has a ceiling.
 *
 * Twelve words at roughly two seconds a generation is the longest spinner in
 * the app, and nothing was watching the total. The loop now stops once the
 * budget is spent — but never before it has enough words to build with.
 */
describe("CrosswordGame — the collecting loop has a budget", () => {
  beforeEach(setup);

  it("stops asking once the budget is spent, and not before the floor", async () => {
    const { getWord } = await import("../../src/services/getWordService");
    const { MIN_WORDS, WORD_BUDGET_MS } = await import("../../src/utils/wordBudget");

    // A clock only the budget reads. Real time still drives the polling below,
    // so nothing in the test framework is fooled by it.
    const realNow = Date.now.bind(Date);
    let clock = realNow();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => clock);

    let calls = 0;
    getWord.mockImplementation(async () => {
      calls += 1;
      // Slower than a real generation, so the floor alone overruns the budget
      // and the two rules cannot both be satisfied — which is the case worth
      // pinning.
      clock += WORD_BUDGET_MS;
      return { word: `PALAVRA${calls}`, hint: `pista ${calls}`, conceptId: `c-${calls}`, source: "ai" };
    });

    try {
      const { container } = await mount(() => import("../../src/components/CrosswordGame"));

      // Poll on real time rather than waitFor, which measures its own timeout
      // with the Date.now that is currently lying.
      let settledCalls = -1;
      for (let i = 0; i < 200 && settledCalls !== calls; i += 1) {
        settledCalls = calls;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      expect(container).toBeTruthy();
      // Exactly the floor: the budget was blown on the very first word, so
      // every one after the fifth is refused.
      expect(calls).toBe(MIN_WORDS);
    } finally {
      nowSpy.mockRestore();
      getWord.mockImplementation(async () => WORD);
    }
  });
});
