import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makePool, translationsFor, wordOf, idFromUrl, signedInContext, pictureUrl, sceneUrl } from "../helpers/pictureFixtures";

/**
 * The picture games, mounted directly with their services stubbed.
 *
 * What is under test is what a player does: pick the right picture, pick a wrong
 * one, play a round to its end, flip cards to a win, collect a sticker, describe
 * a scene. The services are the seam: the pool, the translations and the album
 * are what they return, so a round is built from real rules over known data.
 */

const ctx = { current: signedInContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const getPicturePool = vi.fn();
const fillPictures = vi.fn(async () => 0);
const reportPicture = vi.fn(async () => true);
const getScenes = vi.fn(async () => []);
const requestScene = vi.fn();
const requestDescribeFeedback = vi.fn();

vi.mock("../../src/services/getImageService", async (importOriginal) => ({
  ...(await importOriginal()),
  getPicturePool: (...a) => getPicturePool(...a),
  fillPictures: (...a) => fillPictures(...a),
  reportPicture: (...a) => reportPicture(...a),
  getScenes: (...a) => getScenes(...a),
  requestScene: (...a) => requestScene(...a),
  requestDescribeFeedback: (...a) => requestDescribeFeedback(...a),
}));

const translations = { current: new Map() };
vi.mock("../../src/services/getWordService", () => ({
  getConceptTranslations: vi.fn(async (ids) => new Map([...translations.current].filter(([id]) => ids.includes(id)))),
  getWord: vi.fn(),
  getWordPoolCount: vi.fn(async () => 0),
}));

const getAlbumStickers = vi.fn(async () => []);
const saveAlbumStickers = vi.fn(async () => {});
const getSeenSceneIds = vi.fn(async () => []);
const markSceneSeen = vi.fn(async () => {});
const resetSeenScenes = vi.fn(async () => {});

vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  getAlbumStickers: (...a) => getAlbumStickers(...a),
  saveAlbumStickers: (...a) => saveAlbumStickers(...a),
  getSeenSceneIds: (...a) => getSeenSceneIds(...a),
  markSceneSeen: (...a) => markSceneSeen(...a),
  resetSeenScenes: (...a) => resetSeenScenes(...a),
}));

const speak = vi.fn();
vi.mock("../../src/services/getTtsService", () => ({
  speak: (...a) => speak(...a),
  pauseSpeaking: vi.fn(),
  resumeSpeaking: vi.fn(),
  stopSpeaking: vi.fn(),
  SPEECH_PACE: { NATURAL: "natural", SLOW: "slow" },
}));

const reportLockedAttempt = vi.fn();
vi.mock("../../src/services/pulseReportService", async (importOriginal) => ({
  ...(await importOriginal()),
  reportLockedAttempt: (...a) => reportLockedAttempt(...a),
}));

let i18n;

/** A pool where every concept has a picture and a practice-language word. */
const setUpWorld = ({ count = 10, topics = [], skip = [], unpictured = [] } = {}) => {
  const pool = makePool(count, { topics });
  getPicturePool.mockResolvedValue({ pictured: pool, unpictured });
  translations.current = translationsFor(pool, { skip });
  return pool;
};

const show = async (Component, props = {}, { route = "/" } = {}) => {
  const view = render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>
        <Component isDarkMode={false} {...props} />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return view;
};

beforeEach(async () => {
  i18n = (await import("../../src/i18n")).default;
  ctx.current = signedInContext();
  for (const mock of [getPicturePool, fillPictures, reportPicture, getScenes, requestScene, requestDescribeFeedback, getAlbumStickers, saveAlbumStickers, getSeenSceneIds, markSceneSeen, resetSeenScenes, speak, reportLockedAttempt]) {
    mock.mockClear();
  }
  getAlbumStickers.mockResolvedValue([]);
  getSeenSceneIds.mockResolvedValue([]);
  getScenes.mockResolvedValue([]);
  fillPictures.mockResolvedValue(0);
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { documents: [], hasMore: false } }),
  }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const t = (key, options) => i18n.t(key, options);

// ── PictureTile ──────────────────────────────────────────────────────────────

describe("PictureTile", () => {
  const tile = async (props) => {
    const { default: PictureTile } = await import("../../src/components/pictures/PictureTile");
    return show(PictureTile, { url: pictureUrl("c1"), conceptId: "c1", ariaLabel: "pic", ...props });
  };

  it("shows a skeleton until the picture loads, then the picture", async () => {
    const { container } = await tile();
    const image = container.querySelector("img");
    expect(image.className).toContain("opacity-0");
    expect(container.querySelector(".animate-pulse")).toBeTruthy();

    fireEvent.load(image);

    expect(image.className).toContain("opacity-100");
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("shows a picture that has finished loading before the tile's effects ran, as a cached one does", async () => {
    // A picture already in the browser's cache fires `load` the moment `src` is
    // set, before any passive effect. The tile once reset its state in such an
    // effect, overwriting "loaded" with "loading" for good: a decoded picture
    // stuck behind its own skeleton. Found in a real browser, not by the suite.
    const property = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    const attribute = Element.prototype.setAttribute;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      get: property.get,
      set(value) {
        property.set.call(this, value);
        this.dispatchEvent(new Event("load"));
      },
    });
    Element.prototype.setAttribute = function setAttribute(name, value) {
      attribute.call(this, name, value);
      if (this instanceof HTMLImageElement && name === "src") this.dispatchEvent(new Event("load"));
    };

    try {
      const { container } = await tile();
      expect(container.querySelector("img").className).toContain("opacity-100");
      expect(container.querySelector(".animate-pulse")).toBeNull();
    } finally {
      Object.defineProperty(HTMLImageElement.prototype, "src", { configurable: true, get: property.get, set: property.set });
      Element.prototype.setAttribute = attribute;
    }
  });

  it("shows a quiet gap, not a hole, when the picture cannot be fetched", async () => {
    const { container } = await tile();
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("starts over when the picture changes: the same tile is reused as a round moves on", async () => {
    const { default: PictureTile } = await import("../../src/components/pictures/PictureTile");
    const view = await tile();
    fireEvent.load(view.container.querySelector("img"));

    view.rerender(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <PictureTile url={pictureUrl("c2")} isDarkMode={false} />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(view.container.querySelector("img").className).toContain("opacity-0");
  });

  it("is always on a white tile, in both themes", async () => {
    const { container } = await tile({ isDarkMode: true });
    expect(container.querySelector('[role="img"]').className).toContain("bg-white");
  });

  it("is a button only when it is an answer", async () => {
    const onClick = vi.fn();
    await tile({ onClick });
    fireEvent.click(screen.getByRole("button", { name: "pic" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not take clicks once answered", async () => {
    const onClick = vi.fn();
    await tile({ onClick, disabled: true });
    fireEvent.click(screen.getByRole("button", { name: "pic" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("has no report flag until it is asked for", async () => {
    await tile();
    expect(screen.queryByRole("button", { name: t("picture_games.report.label") })).toBeNull();
  });

  it("reports a picture once, and says thank you", async () => {
    await tile({ showReport: true });
    const flag = screen.getByRole("button", { name: t("picture_games.report.label") });

    fireEvent.click(flag);

    await waitFor(() => expect(reportPicture).toHaveBeenCalledWith("c1", "tok"));
    await waitFor(() => expect(ctx.current.showAlert).toHaveBeenCalledWith("success", t("picture_games.report.thanks")));
    expect(await screen.findByRole("button", { name: t("picture_games.report.sent") })).toBeDisabled();
  });

  it("never puts the flag inside an answer button: a button must not contain a button", async () => {
    const { container } = await tile({ onClick: vi.fn(), showReport: true });
    for (const outer of container.querySelectorAll("button")) {
      expect(outer.querySelector("button")).toBeNull();
    }
  });
});

// ── the menu ─────────────────────────────────────────────────────────────────

describe("PictureGamesMenu", () => {
  const menu = async () => {
    const { default: PictureGamesMenu } = await import("../../src/components/PictureGamesMenu");
    return render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/dashboard/picture-games"]}>
          <Routes>
            <Route path="/dashboard/picture-games" element={<PictureGamesMenu isDarkMode={false} />} />
            <Route path="/dashboard/picture-games/match" element={<p>MATCH PAGE</p>} />
            <Route path="/pricing" element={<p>PRICING PAGE</p>} />
            <Route path="/dashboard" element={<p>DASHBOARD</p>} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    );
  };

  it("lists the five games, by their names", async () => {
    await menu();
    for (const key of ["match", "memory", "odd", "album", "describe"]) {
      expect(await screen.findByText(t(`picture_games.${key}.title`))).toBeTruthy();
    }
  });

  it("opens a game the player has", async () => {
    await menu();
    fireEvent.click((await screen.findByText(t("picture_games.match.title"))).closest("button"));
    expect(await screen.findByText("MATCH PAGE")).toBeTruthy();
  });

  it("shows a game nobody has been given as coming soon, and does not open it", async () => {
    ctx.current = signedInContext({ tier: "explorer", unlimited: false });
    ctx.current.tiersConfig.explorer.features = [];
    await menu();
    const card = (await screen.findByText(t("picture_games.match.title"))).closest("button");
    expect(card).toBeDisabled();
    expect(within(card).getByText(t("features.coming_soon"))).toBeTruthy();
  });

  it("sends a game that is on a paid plan to pricing, and counts the attempt", async () => {
    ctx.current = signedInContext({ tier: "explorer", unlimited: false });
    ctx.current.tiersConfig.explorer.features = [];
    ctx.current.tiersConfig.maestro = {
      id: "maestro",
      label: "Maestro",
      order: 3,
      isFree: false,
      hidden: false,
      aiCallsPerDay: Infinity,
      features: ["picture_describe"],
    };
    await menu();
    fireEvent.click((await screen.findByText(t("picture_games.describe.title"))).closest("button"));
    expect(await screen.findByText("PRICING PAGE")).toBeTruthy();
    expect(reportLockedAttempt).toHaveBeenCalledWith("picture_describe");
  });

  it("carries the practice-language badge, as every picture page does", async () => {
    await menu();
    await screen.findByText(t("picture_games.match.title"));
    expect(document.body.textContent).toContain("pt-PT");
  });
});

// ── the page route and its gate ──────────────────────────────────────────────

describe("PictureGamePage", () => {
  const page = async (gameId) => {
    const { default: PictureGamePage } = await import("../../src/pages/dashboard/pictures/PictureGamePage");
    return render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/game"]}>
          <Routes>
            <Route path="/game" element={<PictureGamePage gameId={gameId} />} />
            <Route path="/dashboard/picture-games" element={<p>THE MENU</p>} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    );
  };

  it("opens a game the player's plan has, under its own title", async () => {
    setUpWorld();
    await page("picture_memory");
    expect(await screen.findByRole("heading", { name: t("picture_games.memory.title") })).toBeTruthy();
  });

  it("sends a player without the game back to the menu with the upgrade prompt, rather than letting a URL bypass the card", async () => {
    ctx.current = signedInContext({ tier: "explorer", unlimited: false });
    ctx.current.tiersConfig.explorer.features = [];
    await page("picture_describe");

    expect(await screen.findByText("THE MENU")).toBeTruthy();
    expect(reportLockedAttempt).toHaveBeenCalledWith("picture_describe");
    expect(ctx.current.showAlert).toHaveBeenCalledWith("warning", t("subscription.errors.upgrade_required"), expect.any(Object));
    expect(getPicturePool).not.toHaveBeenCalled();
  });

  it("does not lock anyone out before their plan has loaded", async () => {
    ctx.current = signedInContext({ tiersConfig: undefined });
    ctx.current.tiersConfig = null;
    await page("picture_match");
    expect(ctx.current.showAlert).not.toHaveBeenCalled();
  });
});

// ── Liga a imagem ────────────────────────────────────────────────────────────

describe("Liga a imagem", () => {
  const game = async () => {
    const { default: PictureMatchGame } = await import("../../src/components/pictures/PictureMatchGame");
    return show(PictureMatchGame);
  };

  const turnText = (n) => t("picture_games.match.turn", { current: n, total: 8 });
  const optionButtons = () => screen.getAllByRole("button", { name: /^Imagem \d$/ });
  const tileFor = (id) => optionButtons().find((b) => b.querySelector("img")?.getAttribute("src") === pictureUrl(id));

  /** What the turn on screen is, whichever way round it is. */
  const readTurn = () => {
    // Asked which picture: the word is the prompt. Asked which word: the words are the options.
    if (screen.queryByText(t("picture_games.match.which_picture"))) {
      const wordShown = screen.getByText(/^PALAVRA\d+$/);
      return { direction: "word_to_picture", id: `c${wordShown.textContent.replace("PALAVRA", "")}` };
    }
    const picture = screen.getByRole("img", { name: t("picture_games.picture") }).querySelector("img");
    return { direction: "picture_to_word", id: idFromUrl(picture.getAttribute("src")) };
  };

  const answer = (turn, { right = true } = {}) => {
    if (turn.direction === "word_to_picture") {
      const target = right ? tileFor(turn.id) : optionButtons().find((b) => b !== tileFor(turn.id));
      fireEvent.click(target);
    } else {
      const words = screen.getAllByRole("button").filter((b) => /^PALAVRA\d+$/.test(b.textContent));
      const target = right ? words.find((b) => b.textContent === wordOf(turn.id)) : words.find((b) => b.textContent !== wordOf(turn.id));
      fireEvent.click(target);
    }
  };

  it("starts with a word and four pictures", async () => {
    setUpWorld();
    await game();
    expect(await screen.findByText(turnText(1))).toBeTruthy();
    expect(screen.getByText(t("picture_games.match.which_picture"))).toBeTruthy();
    expect(optionButtons()).toHaveLength(4);
    // The word is read aloud on request.
    expect(screen.getByRole("button", { name: t("translator.listen") })).toBeTruthy();
  });

  it("says Certo and offers the next turn on the right picture", async () => {
    setUpWorld();
    await game();
    await screen.findByText(turnText(1));

    answer(readTurn());

    expect(await screen.findByText(t("picture_games.match.right"))).toBeTruthy();
    expect(screen.getByText(t("picture_games.match.score", { score: 1 }))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("picture_games.match.next") })).toBeTruthy();
    // The other pictures can no longer be picked.
    for (const button of optionButtons()) expect(button).toBeDisabled();
  });

  it("says what the answer was on a wrong picture, and does not score it", async () => {
    setUpWorld();
    await game();
    await screen.findByText(turnText(1));
    const turn = readTurn();

    answer(turn, { right: false });

    expect(await screen.findByText(t("picture_games.match.wrong", { word: wordOf(turn.id) }))).toBeTruthy();
    expect(screen.getByText(t("picture_games.match.score", { score: 0 }))).toBeTruthy();
  });

  it("reverses every other turn: one picture, four words", async () => {
    setUpWorld();
    await game();
    await screen.findByText(turnText(1));
    answer(readTurn());
    fireEvent.click(await screen.findByRole("button", { name: t("picture_games.match.next") }));

    expect(await screen.findByText(turnText(2))).toBeTruthy();
    expect(screen.getByText(t("picture_games.match.which_word"))).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Imagem \d$/ })).toHaveLength(0);
    expect(screen.getAllByRole("button").filter((b) => /^PALAVRA\d+$/.test(b.textContent))).toHaveLength(4);
    expect(readTurn().direction).toBe("picture_to_word");
  });

  it("plays eight turns to a result, then plays again with a fresh round", async () => {
    setUpWorld();
    await game();
    for (let n = 1; n <= 8; n += 1) {
      await screen.findByText(turnText(n));
      answer(readTurn());
      fireEvent.click(await screen.findByRole("button", { name: t(n === 8 ? "picture_games.match.see_result" : "picture_games.match.next") }));
    }

    expect(await screen.findByText(t("picture_games.match.result", { score: 8, total: 8 }))).toBeTruthy();
    const readsBefore = getPicturePool.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: t("picture_games.play_again") }));

    expect(await screen.findByText(turnText(1))).toBeTruthy();
    // A fresh round is a fresh read of the pool.
    expect(getPicturePool.mock.calls.length).toBeGreaterThan(readsBefore);
  });

  it("sticks the picture in the album on a right answer, and says so once", async () => {
    setUpWorld();
    await game();
    await screen.findByText(turnText(1));

    answer(readTurn());

    expect(await screen.findByText(t("picture_games.new_sticker"))).toBeTruthy();
  });

  it("says nothing about a sticker already in the album", async () => {
    setUpWorld();
    getAlbumStickers.mockResolvedValue(Array.from({ length: 10 }, (_, i) => `c${i}`));
    await game();
    await screen.findByText(turnText(1));
    await waitFor(() => expect(getAlbumStickers).toHaveBeenCalled());
    await act(async () => {});

    answer(readTurn());

    await screen.findByText(t("picture_games.match.right"));
    expect(screen.queryByText(t("picture_games.new_sticker"))).toBeNull();
  });

  it("offers a report flag on the answer once it is known, and only there", async () => {
    setUpWorld();
    await game();
    await screen.findByText(turnText(1));
    const flagName = t("picture_games.report.label");
    expect(screen.queryAllByRole("button", { name: flagName })).toHaveLength(0);

    answer(readTurn());

    await screen.findByText(t("picture_games.match.right"));
    expect(screen.getAllByRole("button", { name: flagName })).toHaveLength(1);
  });

  it("says there are not enough pictures when the pool is too thin, and asks for more in the background", async () => {
    setUpWorld({ count: 3, unpictured: [{ id: "u1", sourceWord: "x", topicIds: [], pos: null }] });
    translations.current = new Map([...translations.current, ["u1", { word: "X", baseForm: null }]]);
    await game();

    expect(await screen.findByText(t("picture_games.thin.title"))).toBeTruthy();
    await waitFor(() => expect(fillPictures).toHaveBeenCalledTimes(1));
    expect(fillPictures.mock.calls[0][0]).toEqual(["u1"]);
  });

  it("does not use a word with no word in the practice language", async () => {
    setUpWorld({ count: 5, skip: ["c0", "c1"] });
    await game();
    // Three words are left: not enough for four options.
    expect(await screen.findByText(t("picture_games.thin.title"))).toBeTruthy();
  });

  it("says so, and offers another try, when the pool cannot be read", async () => {
    getPicturePool.mockRejectedValue(new Error("down"));
    await game();
    expect(await screen.findByText(t("picture_games.try_again"))).toBeTruthy();
  });
});

// ── Jogo da memória ──────────────────────────────────────────────────────────

describe("Jogo da memória", () => {
  const game = async () => {
    const { default: PictureMemoryGame } = await import("../../src/components/pictures/PictureMemoryGame");
    return show(PictureMemoryGame);
  };

  const down = (n) => screen.queryByRole("button", { name: t("picture_games.memory.card_down", { n }) });
  const grid = (container) => container.querySelector(".grid");
  const identity = (card) => {
    const image = card.querySelector("img");
    return image ? idFromUrl(image.getAttribute("src")) : `c${card.textContent.replace("PALAVRA", "")}`;
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deals twelve face-down cards on a phone: six pairs, three by four", async () => {
    setUpWorld({ count: 10 });
    const { container } = await game();
    await screen.findByText(t("picture_games.memory.pairs", { found: 0, total: 6 }));
    expect(screen.getAllByRole("button", { name: /virada para baixo/ })).toHaveLength(12);
    expect(grid(container).className).toContain("grid-cols-3");
  });

  it("turns a card and counts a move for every pair turned", async () => {
    setUpWorld({ count: 10 });
    await game();
    await screen.findByText(t("picture_games.memory.pairs", { found: 0, total: 6 }));
    expect(screen.getByText(t("picture_games.memory.moves", { moves: 0 }))).toBeTruthy();

    fireEvent.click(down(1));
    fireEvent.click(down(2));

    expect(screen.getByText(t("picture_games.memory.moves", { moves: 1 }))).toBeTruthy();
  });

  it("reads a word card aloud as it turns", async () => {
    setUpWorld({ count: 10 });
    await game();
    await screen.findByText(t("picture_games.memory.pairs", { found: 0, total: 6 }));
    vi.useFakeTimers();

    // Turn cards two at a time (letting a wrong pair turn back) until a word card has turned.
    for (let n = 1; n <= 11 && speak.mock.calls.length === 0; n += 2) {
      fireEvent.click(down(n));
      fireEvent.click(down(n + 1));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(speak).toHaveBeenCalled();
    expect(speak.mock.calls[0][0]).toMatch(/^PALAVRA\d+$/);
    expect(speak.mock.calls[0][1]).toBe("pt-PT");
  });

  it("turns a wrong pair face down again after a moment, and ignores a third card meanwhile", async () => {
    setUpWorld({ count: 10 });
    const { container } = await game();
    await screen.findByText(t("picture_games.memory.pairs", { found: 0, total: 6 }));
    vi.useFakeTimers();

    // Find two cards that are not a pair.
    fireEvent.click(down(1));
    const first = identity(grid(container).children[0]);
    let second = 2;
    fireEvent.click(down(second));
    if (identity(grid(container).children[1]) === first) {
      // Lucky: a pair. Nothing to turn back; the point is made by the other cases.
      return;
    }

    expect(grid(container).children[0].tagName).not.toBe("BUTTON");
    fireEvent.click(down(3));
    expect(down(3)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(down(1)).toBeTruthy();
    expect(down(2)).toBeTruthy();
  });

  it("is won by finding every pair, and offers another game", async () => {
    setUpWorld({ count: 10 });
    const { container } = await game();
    await screen.findByText(t("picture_games.memory.pairs", { found: 0, total: 6 }));
    vi.useFakeTimers();

    // A solver: turn the cards two at a time to learn the deck, then pair them.
    const known = [];
    const flipBack = () => act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    for (let i = 0; i < 12; i += 2) {
      if (!grid(container).children[i] || grid(container).children[i].tagName !== "BUTTON") {
        known[i] = identity(grid(container).children[i]);
        known[i + 1] = identity(grid(container).children[i + 1]);
        continue;
      }
      fireEvent.click(down(i + 1));
      fireEvent.click(down(i + 2));
      known[i] = identity(grid(container).children[i]);
      known[i + 1] = identity(grid(container).children[i + 1]);
      if (known[i] !== known[i + 1]) await flipBack();
    }
    for (const id of new Set(known)) {
      const [a, b] = known.flatMap((value, index) => (value === id ? [index] : []));
      if (grid(container).children[a].tagName === "BUTTON" && grid(container).children[b].tagName === "BUTTON") {
        fireEvent.click(down(a + 1));
        fireEvent.click(down(b + 1));
      }
    }

    expect(screen.getByText(t("picture_games.memory.pairs", { found: 6, total: 6 }))).toBeTruthy();
    expect(screen.getByText(/Concluíste em \d+ jogadas!/)).toBeTruthy();
    expect(screen.getByRole("button", { name: t("picture_games.play_again") })).toBeTruthy();
  });

  it("says there are not enough pictures when the pool is too thin", async () => {
    setUpWorld({ count: 3 });
    await game();
    expect(await screen.findByText(t("picture_games.thin.title"))).toBeTruthy();
  });
});

// ── Qual é o intruso? ────────────────────────────────────────────────────────

describe("Qual é o intruso?", () => {
  const game = async () => {
    const { default: PictureOddOneOutGame } = await import("../../src/components/pictures/PictureOddOneOutGame");
    return show(PictureOddOneOutGame);
  };

  // c0, c2, c4… are animals; c1, c3, c5… are home.
  const topicOf = (id) => (Number(id.slice(1)) % 2 === 0 ? "animals" : "home");
  const tiles = () => screen.getAllByRole("button", { name: /^Imagem \d$/ });
  const idOf = (button) => idFromUrl(button.querySelector("img").getAttribute("src"));

  const intruderTile = () => {
    const byTopic = {};
    for (const button of tiles()) (byTopic[topicOf(idOf(button))] ??= []).push(button);
    return Object.values(byTopic).find((list) => list.length === 1)[0];
  };

  it("shows four pictures, three of one topic and one that is not", async () => {
    setUpWorld({ count: 10, topics: ["animals", "home"] });
    await game();
    await screen.findByText(t("picture_games.odd.question"));

    expect(tiles()).toHaveLength(4);
    const counts = tiles().reduce((acc, b) => ({ ...acc, [topicOf(idOf(b))]: (acc[topicOf(idOf(b))] ?? 0) + 1 }), {});
    expect(Object.values(counts).sort()).toEqual([1, 3]);
  });

  it("says Certo on the intruder, and then shows all four words", async () => {
    setUpWorld({ count: 10, topics: ["animals", "home"] });
    await game();
    await screen.findByText(t("picture_games.odd.question"));
    expect(screen.queryAllByText(/^PALAVRA\d+$/)).toHaveLength(0);

    fireEvent.click(intruderTile());

    expect(await screen.findByText(t("picture_games.odd.right"))).toBeTruthy();
    expect(screen.getAllByText(/^PALAVRA\d+$/)).toHaveLength(4);
  });

  it("names the intruder when the pick was wrong", async () => {
    setUpWorld({ count: 10, topics: ["animals", "home"] });
    await game();
    await screen.findByText(t("picture_games.odd.question"));
    const intruder = intruderTile();
    const wrong = tiles().find((b) => b !== intruder);

    fireEvent.click(wrong);

    expect(await screen.findByText(t("picture_games.odd.wrong", { word: wordOf(idOf(intruder)) }))).toBeTruthy();
  });

  it("says there are not enough pictures when none of them has a topic", async () => {
    setUpWorld({ count: 10, topics: [] });
    await game();
    // An untagged word is not known to belong anywhere, so no turn can be made fair.
    expect(await screen.findByText(t("picture_games.thin.title"))).toBeTruthy();
  });

  it("goes round to a result", async () => {
    setUpWorld({ count: 10, topics: ["animals", "home"] });
    await game();
    for (let n = 1; n <= 6; n += 1) {
      await screen.findByText(t("picture_games.odd.turn", { current: n, total: 6 }));
      fireEvent.click(intruderTile());
      fireEvent.click(await screen.findByRole("button", { name: t(n === 6 ? "picture_games.match.see_result" : "picture_games.match.next") }));
    }
    expect(await screen.findByText(t("picture_games.odd.result", { score: 6, total: 6 }))).toBeTruthy();
  });
});

// ── A Caderneta ──────────────────────────────────────────────────────────────

describe("A Caderneta", () => {
  const album = async () => {
    const { default: PictureAlbum } = await import("../../src/components/pictures/PictureAlbum");
    return show(PictureAlbum);
  };

  // c0, c2, c4 are animals; c1, c3, c5 are home.
  const world = () => setUpWorld({ count: 6, topics: ["animals", "home"] });

  it("shows a page per topic with a count, and a question mark for each sticker not yet earned", async () => {
    world();
    getAlbumStickers.mockResolvedValue(["c0", "c2"]);
    await album();

    expect(await screen.findByRole("tab", { name: "Animais · 2/3" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Casa · 0/3" })).toBeTruthy();
    expect(screen.getByText(t("picture_games.album.total", { collected: 2, total: 6 }))).toBeTruthy();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("2 / 3");
    expect(screen.getAllByRole("button", { name: t("picture_games.album.sticker") })).toHaveLength(2);
    expect(screen.getAllByRole("img", { name: t("picture_games.album.empty_slot") })).toHaveLength(1);
  });

  it("turns to another page", async () => {
    world();
    getAlbumStickers.mockResolvedValue(["c0", "c2"]);
    await album();
    fireEvent.click(await screen.findByRole("tab", { name: "Casa · 0/3" }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent("0 / 3");
    expect(screen.getAllByRole("img", { name: t("picture_games.album.empty_slot") })).toHaveLength(3);
    expect(screen.queryAllByRole("button", { name: t("picture_games.album.sticker") })).toHaveLength(0);
  });

  it("puts the player's own interests first", async () => {
    world();
    ctx.current = signedInContext({ user: { interests: ["home"] } });
    await album();
    const tabs = await screen.findAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("Casa");
  });

  it("reads one word and speaks it when a sticker is tapped, and nothing for the rest", async () => {
    world();
    getAlbumStickers.mockResolvedValue(["c0"]);
    await album();

    fireEvent.click(await screen.findByRole("button", { name: t("picture_games.album.sticker") }));

    expect(await screen.findByText(wordOf("c0"))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("translator.listen") })).toBeTruthy();
  });

  it("puts words with no topic on a last page of their own", async () => {
    const pool = makePool(4, { topics: ["animals"] });
    pool.push({ ...makePool(5)[4], topicIds: [] });
    getPicturePool.mockResolvedValue({ pictured: pool, unpictured: [] });
    await album();
    const tabs = await screen.findAllByRole("tab");
    expect(tabs[tabs.length - 1]).toHaveTextContent(t("picture_games.album.other"));
    expect(tabs[tabs.length - 1]).toHaveTextContent("0/1");
  });

  it("counts a sticker only for a word that still has a picture", async () => {
    world();
    getAlbumStickers.mockResolvedValue(["c0", "ghost1", "ghost2"]);
    await album();
    expect(await screen.findByText(t("picture_games.album.total", { collected: 1, total: 6 }))).toBeTruthy();
  });

  it("says so when there are no pictures at all", async () => {
    getPicturePool.mockResolvedValue({ pictured: [], unpictured: [] });
    await album();
    expect(await screen.findByText(t("picture_games.album.empty"))).toBeTruthy();
  });
});

// ── Descreve a imagem ────────────────────────────────────────────────────────

describe("Descreve a imagem", () => {
  const game = async () => {
    const { default: PictureDescribeGame } = await import("../../src/components/pictures/PictureDescribeGame");
    return show(PictureDescribeGame);
  };

  const scene = (id = "s1", over = {}) => ({
    id,
    url: sceneUrl(id),
    conceptIds: ["c0", "c1", "c2", "c3"],
    sourceWords: ["thing0", "thing1", "thing2", "thing3"],
    topicId: "farm",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...over,
  });

  const feedback = {
    feedback: "Muito bem! Descreveste bem a cena.",
    corrections: [{ original: "um gato", corrected: "o gato", explanation: "Artigo definido." }],
    tryNext: [{ word: wordOf("c2"), question: "Vês a bola?" }],
  };

  const write = (text) =>
    fireEvent.change(screen.getByPlaceholderText(t("picture_games.describe.placeholder")), { target: { value: text } });

  beforeEach(() => {
    setUpWorld({ count: 8, topics: ["farm"] });
    getScenes.mockResolvedValue([scene()]);
    requestDescribeFeedback.mockResolvedValue(feedback);
  });

  it("shows a scene and says how many things to find, without saying which", async () => {
    await game();
    expect(await screen.findByRole("img", { name: t("picture_games.describe.scene") })).toBeTruthy();
    expect(screen.getByText(t("picture_games.describe.to_find", { total: 4 }))).toBeTruthy();
    expect(screen.queryByText(wordOf("c0"))).toBeNull();
    // It says on screen that what comes back is from an AI.
    expect(document.body.textContent).toContain(t("ai_notice.input_hint"));
  });

  it("will not check an empty description", async () => {
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    expect(screen.getByRole("button", { name: t("picture_games.describe.check") })).toBeDisabled();
  });

  it("counts the found words in code, then asks the AI about the rest", async () => {
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });

    write(`Vejo ${wordOf("c0").toLowerCase()} e ${wordOf("c1")}.`);
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.check") }));

    expect(await screen.findByText(t("picture_games.describe.found", { found: 2, total: 4 }))).toBeTruthy();

    const call = requestDescribeFeedback.mock.calls[0][0];
    expect(call).toMatchObject({
      token: "tok",
      sceneId: "s1",
      level: "A1",
      targetLanguage: "pt-PT",
      nativeLanguage: "pt-PT",
    });
    // Decided before the model was asked, and handed over as facts.
    expect(call.found.map((w) => w.word)).toEqual([wordOf("c0"), wordOf("c1")]);
    expect(call.missed.map((w) => w.word)).toEqual([wordOf("c2"), wordOf("c3")]);
  });

  it("shows what was found, what was missed, the feedback, corrections and the next words", async () => {
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    write(`${wordOf("c0")}`);
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.check") }));

    expect(await screen.findByText(feedback.feedback)).toBeTruthy();
    const found = screen.getByRole("list", { name: t("picture_games.describe.found_words") });
    expect(within(found).getByText(wordOf("c0"))).toBeTruthy();
    expect(screen.getByText(`${wordOf("c1")}, ${wordOf("c2")}, ${wordOf("c3")}`)).toBeTruthy();
    expect(screen.getByText("um gato")).toBeTruthy();
    expect(screen.getByText("o gato")).toBeTruthy();
    expect(screen.getByText("Artigo definido.")).toBeTruthy();
    expect(screen.getByText("Vês a bola?")).toBeTruthy();
    // And, above the result, that it came from an AI.
    expect(document.body.textContent).toContain(t("ai_notice.generated"));
  });

  it("gives a sticker for each word found, and says which are new", async () => {
    getAlbumStickers.mockResolvedValue(["c0"]);
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    await waitFor(() => expect(getAlbumStickers).toHaveBeenCalled());
    await act(async () => {});
    write(`${wordOf("c0")} ${wordOf("c1")}`);
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.check") }));

    const found = await screen.findByRole("list", { name: t("picture_games.describe.found_words") });
    const items = within(found).getAllByRole("listitem");
    // c0 was already collected; c1 is new.
    expect(items[0]).not.toHaveTextContent(t("picture_games.new_sticker"));
    expect(items[1]).toHaveTextContent(t("picture_games.new_sticker"));
  });

  it("marks the scene seen once it has been described", async () => {
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    write(wordOf("c0"));
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.check") }));
    await screen.findByText(feedback.feedback);
    expect(markSceneSeen).toHaveBeenCalledWith("tok", "u1", "s1", []);
  });

  it("does not offer a scene already seen, and moves to the next unseen one", async () => {
    getScenes.mockResolvedValue([scene("s1"), scene("s2", { createdAt: "2026-09-01T00:00:00.000Z" })]);
    getSeenSceneIds.mockResolvedValue(["s1"]);
    await game();
    const image = await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    expect(image.querySelector("img").getAttribute("src")).toBe(sceneUrl("s2"));
  });

  it("skips a scene that has too few words in the player's language", async () => {
    getScenes.mockResolvedValue([scene("s1"), scene("s2", { conceptIds: ["c4", "c5", "c6", "c7"] })]);
    translations.current = translationsFor(makePool(8), { skip: ["c0", "c1"] });
    await game();
    const image = await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    expect(image.querySelector("img").getAttribute("src")).toBe(sceneUrl("s2"));
  });

  it("goes on to another scene", async () => {
    getScenes.mockResolvedValue([scene("s1"), scene("s2")]);
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    write(wordOf("c0"));
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.check") }));
    await screen.findByText(feedback.feedback);

    getSeenSceneIds.mockResolvedValue(["s1"]);
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.next_scene") }));

    await waitFor(() => expect(screen.getByRole("img", { name: t("picture_games.describe.scene") }).querySelector("img").getAttribute("src")).toBe(sceneUrl("s2")));
    expect(screen.getByPlaceholderText(t("picture_games.describe.placeholder"))).toHaveValue("");
  });

  it("stays quiet when the player declines the spend prompt", async () => {
    requestDescribeFeedback.mockRejectedValueOnce(Object.assign(new Error("declined"), { declined: true }));
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    write(wordOf("c0"));
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.check") }));

    await waitFor(() => expect(requestDescribeFeedback).toHaveBeenCalled());
    await act(async () => {});
    expect(ctx.current.showAlert).not.toHaveBeenCalled();
    // Their text is still there to try again.
    expect(screen.getByPlaceholderText(t("picture_games.describe.placeholder"))).toHaveValue(wordOf("c0"));
  });

  it("offers a retry when the feedback fails", async () => {
    requestDescribeFeedback.mockRejectedValueOnce(new Error("boom"));
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    write(wordOf("c0"));
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.check") }));

    await waitFor(() => expect(ctx.current.showAlert).toHaveBeenCalledWith("error", t("picture_games.describe.error"), expect.any(Object)));
  });

  it("points to the plans, not a retry, when the day's calls have run out", async () => {
    const today = new Date().toISOString().slice(0, 10);
    ctx.current = signedInContext({ unlimited: false, user: { aiCallsToday: 3, aiCallsDate: today } });
    ctx.current.tiersConfig.maestro.aiCallsPerDay = 3;
    await game();
    await screen.findByRole("img", { name: t("picture_games.describe.scene") });
    write(wordOf("c0"));
    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.check") }));

    await waitFor(() => expect(ctx.current.showDailyLimitAlert).toHaveBeenCalled());
    expect(requestDescribeFeedback).not.toHaveBeenCalled();
  });

  describe("with no scene to describe", () => {
    beforeEach(() => {
      getScenes.mockResolvedValue([]);
    });

    it("lets an unlimited tier draw a new one from words that already have a picture", async () => {
      requestScene.mockResolvedValue(scene("fresh"));
      await game();

      fireEvent.click(await screen.findByRole("button", { name: t("picture_games.describe.create") }));

      await screen.findByRole("img", { name: t("picture_games.describe.scene") });
      const ids = requestScene.mock.calls[0][0];
      expect(ids.length).toBeGreaterThanOrEqual(4);
      expect(ids.length).toBeLessThanOrEqual(6);
      expect(new Set(ids).size).toBe(ids.length);
      expect(requestScene.mock.calls[0][1]).toBe("tok");
    });

    it("does not offer to draw one to a tier that cannot", async () => {
      ctx.current = signedInContext({ unlimited: false });
      await game();
      expect(await screen.findByText(t("picture_games.describe.none.no_scenes"))).toBeTruthy();
      expect(screen.queryByRole("button", { name: t("picture_games.describe.create") })).toBeNull();
      expect(screen.getByText(t("picture_games.describe.none.cannot_create"))).toBeTruthy();
    });

    it("says why when the server refuses", async () => {
      requestScene.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "SCENE_TIER" }));
      await game();
      fireEvent.click(await screen.findByRole("button", { name: t("picture_games.describe.create") }));
      expect(await screen.findByText(t("picture_games.describe.create_error.tier"))).toBeTruthy();

      requestScene.mockRejectedValueOnce(Object.assign(new Error("cap"), { code: "PICTURE_CAP" }));
      fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.create") }));
      expect(await screen.findByText(t("picture_games.describe.create_error.cap"))).toBeTruthy();
    });

    it("says so when no topic has enough pictured words to make a scene from", async () => {
      setUpWorld({ count: 3, topics: ["farm"] });
      await game();
      fireEvent.click(await screen.findByRole("button", { name: t("picture_games.describe.create") }));
      expect(await screen.findByText(t("picture_games.describe.create_error.not_enough"))).toBeTruthy();
      expect(requestScene).not.toHaveBeenCalled();
    });

    it("says every scene has been seen when there are some, all seen", async () => {
      getScenes.mockResolvedValue([scene("s1")]);
      getSeenSceneIds.mockResolvedValue(["s1"]);
      await game();
      expect(await screen.findByText(t("picture_games.describe.none.seen_all"))).toBeTruthy();
    });
  });

  it("resets the scenes seen, after confirming", async () => {
    getSeenSceneIds.mockResolvedValue(["s1"]);
    getScenes.mockResolvedValue([scene("s1")]);
    await game();
    await screen.findByText(t("picture_games.describe.none.seen_all"));

    fireEvent.click(screen.getByRole("button", { name: t("picture_games.describe.reset") }));
    fireEvent.click(await screen.findByRole("button", { name: t("picture_games.describe.reset_confirm") }));

    await waitFor(() => expect(resetSeenScenes).toHaveBeenCalledWith("tok", "u1"));
  });
});
