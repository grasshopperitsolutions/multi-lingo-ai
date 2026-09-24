import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";

/**
 * WordLookupSheet — a tapped word, looked up where the reader tapped it.
 *
 * The sentence goes with the word that was tapped, because it is what says
 * which sense the reader met. It must not go with a synonym tapped inside the
 * sheet: the synonym was never in that sentence, and sending it along would
 * describe the synonym as if it were.
 */

const lookupWord = vi.fn();

vi.mock("../../src/services/dictionaryService", () => ({
  lookupWord: (...a) => lookupWord(...a),
}));

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ({
    user: { uid: "u1", token: "tok", favWordIds: [] },
    setUser: vi.fn(),
    showAlert: vi.fn(),
    interfaceLang: "en-US",
  }),
}));

const ENTRIES = [
  { wordType: "verb", translation: "went", definition: "Past tense of ir.", synonyms: ["partiram"] },
];

const mount = async (props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: WordLookupSheet } = await import("../../src/components/WordLookupSheet");
  return render(
    <I18nextProvider i18n={i18n}>
      <WordLookupSheet
        word="foram"
        sentence="Eles foram ao mercado."
        targetLang="pt-PT"
        isDarkMode={false}
        onClose={vi.fn()}
        {...props}
      />
    </I18nextProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  lookupWord.mockResolvedValue({ entries: ENTRIES });
});

describe("WordLookupSheet", () => {
  it("looks the tapped word up with the sentence it was tapped in", async () => {
    await mount();

    await waitFor(() => expect(lookupWord).toHaveBeenCalled());
    expect(lookupWord.mock.calls[0][0]).toMatchObject({
      word: "foram",
      sentence: "Eles foram ao mercado.",
    });
  });

  it("does not send that sentence with a synonym tapped inside the sheet", async () => {
    await mount();
    fireEvent.click(await screen.findByText("partiram"));

    await waitFor(() => expect(lookupWord).toHaveBeenCalledTimes(2));
    expect(lookupWord.mock.calls[1][0]).toMatchObject({ word: "partiram" });
    expect(lookupWord.mock.calls[1][0].sentence).toBeUndefined();
  });

  it("sends no sentence when the caller has none, as from the word bank", async () => {
    await mount({ sentence: undefined });

    await waitFor(() => expect(lookupWord).toHaveBeenCalled());
    expect(lookupWord.mock.calls[0][0].sentence).toBeUndefined();
  });

  it("uses the shared square speaker, which can show that it is preparing", async () => {
    // The games' speaker: bordered, amber, with aria-busy while the clip is
    // generated — the hand-rolled one here went straight to a stop icon over
    // silence while Gemini was still synthesising.
    const { container } = await mount();
    const speaker = container.querySelector("button[aria-busy]");

    expect(speaker).not.toBeNull();
    expect(speaker.getAttribute("type")).toBe("button");
    expect(speaker.className).toContain("border-current");
  });
});
