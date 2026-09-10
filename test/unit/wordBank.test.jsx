import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The word bank: the tap/hold gesture that fills it, and the sidebar that
 * spends and empties it.
 *
 * The gesture is the part worth guarding. Tap and hold share one target, and
 * the whole design rests on a hold never also firing the tap — a reader who
 * saves a word must not get the dictionary sheet on top of it.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const updateUserProfile = vi.fn(async () => ({}));
vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  updateUserProfile: (...a) => updateUserProfile(...a),
  getUserProfile: vi.fn(async () => ({})),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  ctx.current = makeAppContext({ user: { uid: "u1", token: "tok", favWordIds: [] } });
});

const mount = async (ui) => {
  const { default: i18n } = await import("../../src/i18n");
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe("the tap-and-hold gesture", () => {
  it("treats a quick press as a tap", async () => {
    const { useLongPress } = await import("../../src/hooks/useLongPress");
    const onClick = vi.fn();
    const onLongPress = vi.fn();

    const Word = () => {
      const handlers = useLongPress({ onClick, onLongPress, delay: 500 });
      return <span data-testid="word" {...handlers}>casa</span>;
    };

    const { getByTestId } = await mount(<Word />);
    fireEvent.pointerDown(getByTestId("word"), { button: 0 });
    fireEvent.pointerUp(getByTestId("word"), { button: 0 });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("fires the hold, and then NOT the tap, on release", async () => {
    vi.useFakeTimers();
    const { useLongPress } = await import("../../src/hooks/useLongPress");
    const onClick = vi.fn();
    const onLongPress = vi.fn();

    const Word = () => {
      const handlers = useLongPress({ onClick, onLongPress, delay: 500 });
      return <span data-testid="word" {...handlers}>casa</span>;
    };

    const { getByTestId } = await mount(<Word />);
    fireEvent.pointerDown(getByTestId("word"), { button: 0 });
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.pointerUp(getByTestId("word"), { button: 0 });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    // The reader saved a word; they did not also ask to look it up.
    expect(onClick).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("cancels both when the pointer leaves before release", async () => {
    vi.useFakeTimers();
    const { useLongPress } = await import("../../src/hooks/useLongPress");
    const onClick = vi.fn();
    const onLongPress = vi.fn();

    const Word = () => {
      const handlers = useLongPress({ onClick, onLongPress, delay: 500 });
      return <span data-testid="word" {...handlers}>casa</span>;
    };

    const { getByTestId } = await mount(<Word />);
    fireEvent.pointerDown(getByTestId("word"), { button: 0 });
    fireEvent.pointerLeave(getByTestId("word"));
    act(() => { vi.advanceTimersByTime(600); });

    // A drag off the word is a scroll, not a gesture.
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("ignores a secondary button", async () => {
    const { useLongPress } = await import("../../src/hooks/useLongPress");
    const onClick = vi.fn();
    const onLongPress = vi.fn();

    const Word = () => {
      const handlers = useLongPress({ onClick, onLongPress, delay: 500 });
      return <span data-testid="word" {...handlers}>casa</span>;
    };

    const { getByTestId } = await mount(<Word />);
    fireEvent.pointerDown(getByTestId("word"), { button: 2 });
    fireEvent.pointerUp(getByTestId("word"), { button: 2 });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});

describe("word normalisation", () => {
  it("folds case and spacing so one word is one entry", async () => {
    const { normaliseWord } = await import("../../src/hooks/useWordFavourites");
    expect(normaliseWord("  Casa ")).toBe("casa");
    expect(normaliseWord("Bom   dia")).toBe("bom dia");
    expect(normaliseWord(null)).toBe("");
  });
});

describe("the word bank sidebar", () => {
  const mountSidebar = async (props) => {
    const { default: WordBankSidebar } = await import("../../src/components/WordBankSidebar");
    return mount(
      <WordBankSidebar
        words={["casa", "cão"]}
        selected={[]}
        onToggleSelect={vi.fn()}
        onRemove={vi.fn()}
        maxSelected={5}
        canSelect
        isDarkMode={false}
        {...props}
      />,
    );
  };

  it("explains how to fill it when empty", async () => {
    const { getAllByText, queryByText } = await mountSidebar({ words: [] });
    expect(getAllByText(/Mantém premida/).length).toBeGreaterThan(0);
    expect(queryByText("0/5")).toBeNull();
  });

  it("selects a word without removing it", async () => {
    const onToggleSelect = vi.fn();
    const onRemove = vi.fn();
    const { getAllByText } = await mountSidebar({ onToggleSelect, onRemove });

    fireEvent.click(getAllByText("casa")[0]);

    expect(onToggleSelect).toHaveBeenCalledWith("casa");
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("removes from the corner X, which is not the chip", async () => {
    const onToggleSelect = vi.fn();
    const onRemove = vi.fn();
    const { getAllByLabelText } = await mountSidebar({ onToggleSelect, onRemove });

    fireEvent.click(getAllByLabelText(/Remover "casa"/)[0]);

    expect(onRemove).toHaveBeenCalledWith("casa");
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it("stops accepting new words at the cap", async () => {
    const { getAllByText } = await mountSidebar({
      words: ["a", "b", "c"],
      selected: ["a", "b"],
      maxSelected: 2,
    });

    // Already selected: still pressable, so the cap can be undone.
    expect(getAllByText("a")[0].disabled).toBe(false);
    // Not selected and no room left: inert rather than a click that does nothing.
    expect(getAllByText("c")[0].disabled).toBe(true);
  });

  it("goes read-only for a tier that cannot generate, but still removes", async () => {
    const { getAllByText, getAllByLabelText, queryByText } = await mountSidebar({ canSelect: false });

    expect(getAllByText("casa")[0].disabled).toBe(true);
    expect(queryByText("0/5")).toBeNull();
    // Removing is housekeeping — it has nothing to do with the tier.
    expect(getAllByLabelText(/Remover "casa"/)[0].disabled).toBe(false);
  });
});
