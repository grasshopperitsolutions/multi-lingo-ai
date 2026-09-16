import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The personal dashboard.
 *
 * Nine widgets on one page is mostly a layout problem, and layout is what the
 * browser walk-through is for. What is worth pinning here is the handful of
 * things that break silently:
 *
 *   - the settings document is read **once** for the whole page, not once per
 *     widget that wants it;
 *   - a burst of taps is one write, at the right path, with the right id;
 *   - a first-time user gets somewhere to start rather than nine empty boxes.
 */

const queryCollection = vi.fn(async () => ({ documents: [] }));
const getDocument = vi.fn(async () => null);
const createDocument = vi.fn(async () => ({ id: "new" }));
const patchDocument = vi.fn(async () => ({}));
const deleteDocument = vi.fn(async () => ({}));

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  getDocument: (...a) => getDocument(...a),
  createDocument: (...a) => createDocument(...a),
  patchDocument: (...a) => patchDocument(...a),
  deleteDocument: (...a) => deleteDocument(...a),
  updateDocument: vi.fn(async () => ({})),
  getTokenOrAnonymous: vi.fn(async () => "anon"),
}));

const ctx = { current: makeAppContext() };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

/** A tier config that grants the key the page gates on. */
const GRANTED = {
  tiersConfig: { maestro: { features: ["personal_tools"] } },
  features: [{ id: "personal_tools" }],
  user: { uid: "u1", token: "tok", subscriptionTier: "maestro", favWordIds: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  queryCollection.mockResolvedValue({ documents: [] });
  getDocument.mockResolvedValue(null);
  ctx.current = makeAppContext(GRANTED);
});

const mount = async () => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: PersonalDashboard } = await import(
    "../../src/pages/dashboard/personal/PersonalDashboard"
  );
  let utils;
  await act(async () => {
    utils = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <PersonalDashboard />
        </MemoryRouter>
      </I18nextProvider>,
    );
  });
  return utils;
};

describe("a first visit", () => {
  it("offers somewhere to start instead of nine empty boxes", async () => {
    const { getByText } = await mount();

    // The three ways in, and none of them needs anything to exist first.
    expect(getByText("Começa por aqui")).toBeTruthy();
    expect(getByText("Escrever uma nota")).toBeTruthy();
    expect(getByText("Tenho aulas marcadas")).toBeTruthy();
  });

  it("still renders every widget, so nothing reflows when the first thing is added", async () => {
    const { getAllByText } = await mount();

    // getAllByText, not getByText: the board's title is also its sr-only
    // label, so "Notas" legitimately appears twice.
    for (const title of ["Aulas", "Notas", "Para a próxima aula", "O meu objetivo",
      "As minhas frases", "Os meus erros", "As minhas palavras", "Lembras-te?"]) {
      expect(getAllByText(title).length).toBeGreaterThan(0);
    }
  });
});

describe("the settings document", () => {
  it("is read once for the whole page, not once per widget that wants it", async () => {
    await mount();

    // The counter and the goal both need personalSettings/main. Two
    // usePersonalSettings() instances would mean two debounce buffers writing
    // to one document — a race built on purpose.
    const settingsReads = getDocument.mock.calls.filter(
      ([collection, id]) => collection === "users/u1/personalSettings" && id === "main",
    );
    expect(settingsReads).toHaveLength(1);
  });
});

describe("the lesson counter", () => {
  it("turns a burst of taps into one write, at the right path and id", async () => {
    vi.useFakeTimers();
    const { getByLabelText, getByText } = await mount();

    const plus = getByLabelText("Adicionar uma aula");
    // One act per click. Batched into a single act they would all read the
    // same pre-render `remaining` and land on 1 — an artifact of the test, not
    // of the widget, which re-renders between real taps.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => { fireEvent.click(plus); });
    }

    // The number moves immediately — the debounce must never be visible.
    expect(getByText("3")).toBeTruthy();
    expect(createDocument).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(createDocument).toHaveBeenCalledTimes(1);
    // POST-with-an-explicit-id, because PUT and PATCH both 404 until the
    // document exists, and it does not on a first visit.
    expect(createDocument).toHaveBeenCalledWith(
      "users/u1/personalSettings",
      { lessonsRemaining: 3 },
      "main",
      "tok",
    );
    vi.useRealTimers();
  });

  it("refuses to go below zero", async () => {
    const { getByLabelText } = await mount();
    expect(getByLabelText("Marcar uma aula como dada").disabled).toBe(true);
  });
});

describe("what is already saved", () => {
  beforeEach(() => {
    queryCollection.mockImplementation(async (collection) => {
      if (collection.endsWith("personalQuestions")) {
        return {
          documents: [
            { id: "q1", text: "Quando se usa o conjuntivo?", createdAt: { _seconds: 9000 } },
            { id: "q2", text: "Já perguntei esta", done: true, createdAt: { _seconds: 8000 } },
          ],
        };
      }
      if (collection.endsWith("personalPhrases")) {
        return {
          documents: [
            { id: "p1", phrase: "estou a ver", translation: "I'm seeing", createdAt: { _seconds: 9000 } },
          ],
        };
      }
      return { documents: [] };
    });
  });

  it("shows open questions and counts the answered ones separately", async () => {
    const { getByText, queryByText } = await mount();

    await waitFor(() => expect(getByText("Quando se usa o conjuntivo?")).toBeTruthy());

    // Done questions are the archive; they belong on the full page.
    expect(queryByText("Já perguntei esta")).toBeNull();
    expect(getByText("1 já perguntadas.")).toBeTruthy();
  });

  it("feeds the recall widget from the lists", async () => {
    const { getAllByText } = await mount();

    // The phrase is both a phrasebook row and a recall prompt.
    await waitFor(() => expect(getAllByText("estou a ver").length).toBeGreaterThan(1));
  });
});

describe("quick add", () => {
  it("never sends createdAt — the server stamps it", async () => {
    const { getByPlaceholderText, getAllByText } = await mount();

    const input = getByPlaceholderText("Ex.: quando é que se usa o imperfeito do conjuntivo?");
    fireEvent.change(input, { target: { value: "Uma pergunta" } });

    await act(async () => { fireEvent.click(getAllByText("Adicionar")[0]); });

    expect(createDocument).toHaveBeenCalledWith(
      "users/u1/personalQuestions",
      { text: "Uma pergunta" },
      undefined,
      "tok",
    );
  });
});

describe("choosing which widgets to show", () => {
  it("hides the ones on the profile's hidden list", async () => {
    ctx.current = makeAppContext({
      ...GRANTED,
      user: { ...GRANTED.user, hiddenPersonalWidgets: ["streak", "recall"] },
    });

    const { queryByText, getAllByText } = await mount();

    expect(queryByText("A tua prática")).toBeNull();
    expect(queryByText("Lembras-te?")).toBeNull();
    // Everything not on the list is untouched.
    expect(getAllByText("Aulas").length).toBeGreaterThan(0);
  });

  it("shows a widget added later, because the stored list is what is HIDDEN", async () => {
    // A user who hid one thing a year ago must not be the last to see a new
    // widget. A stored "shown" list would have exactly that effect.
    ctx.current = makeAppContext({
      ...GRANTED,
      user: { ...GRANTED.user, hiddenPersonalWidgets: ["streak"] },
    });

    const { getAllByText } = await mount();

    expect(getAllByText("Lembras-te?").length).toBeGreaterThan(0);
    expect(getAllByText("As minhas palavras").length).toBeGreaterThan(0);
  });

  it("says so, rather than rendering a blank page, when everything is off", async () => {
    ctx.current = makeAppContext({
      ...GRANTED,
      user: {
        ...GRANTED.user,
        hiddenPersonalWidgets: [
          "lessons", "streak", "notes", "plan", "goal",
          "phrasebook", "mistakes", "words", "recall",
        ],
      },
    });

    const { getByText, queryByText } = await mount();

    expect(getByText(/Não estás a mostrar nada aqui/)).toBeTruthy();
    // And not two stacked "here's what to do" cards.
    expect(queryByText("Começa por aqui")).toBeNull();
  });
});

describe("the widget registry's own strings", () => {
  /**
   * `t(widget.titleKey)` and `t(widget.descKey)` are resolved from a variable,
   * so the i18n canary — which scans for literal t("...") calls — cannot see
   * them. A typo in the registry would render a raw key in Settings and no
   * check would fail. This is that check.
   */
  it("every title and description resolves in the base locale", async () => {
    const { PERSONAL_WIDGETS } = await import("../../src/config/personalWidgets");
    const pt = (await import("../../src/locales/pt/translation.json")).default;

    const resolve = (key) => key.split(".").reduce((node, part) => node?.[part], pt);

    for (const widget of PERSONAL_WIDGETS) {
      expect(typeof resolve(widget.titleKey), `${widget.id} titleKey`).toBe("string");
      expect(typeof resolve(widget.descKey), `${widget.id} descKey`).toBe("string");
    }
  });

  it("covers every widget the dashboard can render, with no duplicate ids", async () => {
    const { PERSONAL_WIDGETS, PERSONAL_WIDGET_IDS } = await import(
      "../../src/config/personalWidgets"
    );
    expect(new Set(PERSONAL_WIDGET_IDS).size).toBe(PERSONAL_WIDGETS.length);
  });
});
