import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * What may, and may not, join the shared clip cache.
 *
 * Generated speech is now kept compressed in Firestore and shared by every
 * user of the app, so the same sentence is paid for once rather than once per
 * listener per reload. That is right for a story, a culture piece or a
 * challenge word. It is wrong for whatever somebody pasted into the
 * translator, and the server cannot tell the two apart by looking at the
 * text — the caller says, with `cacheable`.
 *
 * Which makes this a privacy invariant carried by a boolean default, and the
 * failure mode is silent in both directions: forget it on a shared surface
 * and the app quietly keeps paying; forget it on a private one and one user's
 * sentence becomes another user's cache hit. Hence a test rather than a
 * comment.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const askAI = vi.fn(async () => ({ audioData: "AAAA", mimeType: "audio/mpeg" }));
vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  registerAiConfirmHandler: vi.fn(),
  isAiDeclined: () => false,
}));

/** Every field GrammarTextPage reads — a missing one throws mid-render. */
const generatePracticeText = vi.fn(async () => ({
  title: "O passado",
  paragraphs: ["Ontem fui ao mercado.", "Comprei pao e fruta."],
  highlights: [],
  focusNote: "",
  targetLang: "pt-PT",
  level: "A1",
}));
vi.mock("../../src/services/grammarTextService", () => ({
  generatePracticeText: (...a) => generatePracticeText(...a),
}));

vi.mock("../../src/services/promptService", () => ({
  getPrompt: vi.fn(async () => ({ template: "Read this: {{text}}", model: "tts-model" })),
  renderTemplate: (template, vars) => template.replace("{{text}}", vars.text),
}));

/** Enough of a fact for HistoryCulturePage: title, paragraphs and a locale. */
const getFact = vi.fn(async () => ({
  factId: "f1",
  title: "Os Descobrimentos",
  paragraphs: ["Foi uma epoca de expansao maritima.", "Portugal chegou a varios continentes."],
  locale: "pt-PT",
  source: "ai",
}));
vi.mock("../../src/services/historyCultureService", () => ({
  getFact: (...a) => getFact(...a),
  getFactPoolStatus: vi.fn(async () => ({ total: 5, unseen: 5, exhausted: false })),
  getFactContent: vi.fn(async () => ({ title: "t", paragraphs: [], locale: "pt-PT" })),
}));
vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  markHistoryFactSeen: vi.fn(async () => ({})),
}));

/**
 * Enough of a listening exercise for ListeningExercise. It is button-driven,
 * not fetched on mount, and `content` is a required nested field per
 * examExerciseService's own ExerciseResult typedef — a flat shape leaves
 * `exercise` undefined and the component stuck on its setup screen.
 */
const getExercise = vi.fn(async () => ({
  exerciseId: "l1",
  type: "listening",
  level: "A1",
  source: "ai",
  content: {
    exerciseType: "multiple-choice",
    transcript: "Bom dia. Como esta?",
    questions: [{ id: "q1", text: "O que diz?", options: ["Bom dia", "Boa noite"], correctAnswer: "Bom dia" }],
  },
}));
vi.mock("../../src/services/examExerciseService", () => ({
  getExercise: (...a) => getExercise(...a),
  getExercisePoolCount: vi.fn(async () => 5),
}));

/**
 * Every TtsControls in the tree, with the props it was handed.
 *
 * Recording the props rather than clicking the button: the real control is
 * disabled until there is text, so a click test would have to drive each
 * page's input first — three different inputs, none of which is what is
 * actually under test here.
 */
const rendered = [];
vi.mock("../../src/components/ui", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TtsControls: (props) => {
      rendered.push(props);
      return <button type="button" data-testid={`tts-${props.ttsKey}`} />;
    },
  };
});

const byKey = (ttsKey) => rendered.find((p) => p.ttsKey === ttsKey);

const signedIn = () =>
  makeAppContext({
    user: {
      uid: "u1",
      token: "tok",
      displayName: "Test",
      subscriptionTier: "maestro",
      learningDialect: "pt-PT",
      interfaceLang: "pt-PT",
      level: "A1",
      aiCallsToday: 0,
    },
    token: "tok",
    supportedLanguages: [
      { code: "pt-PT", name: "Português", flag: "pt" },
      { code: "en-US", name: "English", flag: "us" },
    ],
  });

const mount = async (loader, props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: Component } = await loader();

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Component isDarkMode={false} {...props} />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  rendered.length = 0;
  ctx.current = signedIn();
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { documents: [], hasMore: false } }),
  }));
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }

  // jsdom has neither the Web Speech API nor a working <audio>, so a clip
  // that "plays" fails and speak() does the right thing — falls back to the
  // synthesizer. Without these that fallback throws a ReferenceError as an
  // unhandled rejection, which Vitest rightly warns can turn a passing run
  // into a false positive. Stubbing them makes the fallback inert rather than
  // explosive; nothing here asserts on it.
  window.speechSynthesis = { speak: vi.fn(), cancel: vi.fn(), paused: false, speaking: false };
  window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
  };
});

describe("speak() and the cacheable flag", () => {
  /**
   * Distinct text per call, on purpose. getTtsService keeps its own in-memory
   * LRU of generated clips, which lives as long as the module does — so
   * asking twice for the same words inside one file is served from that cache
   * and never reaches askAI at all.
   */
  let counter = 0;
  const speakWith = async (options) => {
    const { speak } = await import("../../src/services/getTtsService");
    counter += 1;
    await speak(`passaporte ${counter}`, "pt-PT", { token: "tok", preferFallback: false, ...options });
    return askAI.mock.calls[0]?.[2];
  };

  it("marks a clip cacheable by default", async () => {
    // App-generated content is the overwhelming majority of what this app
    // reads aloud, so the default is the one that saves the calls.
    expect(await speakWith({})).toMatchObject({ cacheable: true });
  });

  it("passes the opt-out through to the request", async () => {
    expect(await speakWith({ cacheable: false })).toMatchObject({ cacheable: false });
  });

  it("still asks for TTS with a voice and a language either way", async () => {
    // The flag rides alongside the parameters the cache key is built from;
    // dropping one of those would silently change what a clip is keyed on.
    const params = await speakWith({ cacheable: false });
    expect(params).toMatchObject({ provider: "gemini", tts: true });
    expect(params.voice).toBeTruthy();
    expect(params.language).toBe("pt-PT");
  });
});

describe("the learner's voice", () => {
  /**
   * The voice used to be hashed from the text, so different exercises sounded
   * like different people. It is now the one the learner chose in Settings,
   * for every clip. Distinct text per call for the same reason as above: the
   * in-memory LRU would otherwise serve a repeat without reaching askAI.
   */
  let n = 0;
  const voiceFor = async (chosen, text) => {
    const tts = await import("../../src/services/getTtsService");
    tts.setPreferredVoice(chosen);
    n += 1;
    await tts.speak(text ?? `voz ${n}`, "pt-PT", { token: "tok", preferFallback: false });
    const voice = askAI.mock.calls.at(-1)?.[2]?.voice;
    tts.setPreferredVoice(undefined);
    return voice;
  };

  it("reads a clip in the voice the learner chose", async () => {
    expect(await voiceFor("Charon")).toBe("Charon");
  });

  it("reads different texts in the same voice, rather than varying by text", async () => {
    expect(await voiceFor("Kore", "primeiro texto")).toBe("Kore");
    expect(await voiceFor("Kore", "um texto completamente diferente")).toBe("Kore");
  });

  it("uses Sulafat with no choice, or one that is not offered", async () => {
    expect(await voiceFor(undefined)).toBe("Sulafat");
    expect(await voiceFor("NotARealVoice")).toBe("Sulafat");
  });
});

describe("the surfaces that read back a user's own words", () => {
  it("keeps both translator panes out of the shared cache", async () => {
    // The output pane is a translation *of* what the user typed, which is no
    // less theirs than the input.
    await mount(() => import("../../src/components/TranslatorPanel"), {
      onBack: vi.fn(),
      onLookupInDictionary: vi.fn(),
    });

    await waitFor(() => expect(byKey("translator-input")).toBeTruthy());
    expect(byKey("translator-input").cacheable).toBe(false);
    expect(byKey("translator-output").cacheable).toBe(false);
  });

  it("keeps the dictionary's input box out, and leaves its definitions in", async () => {
    // The one mixed page: what the user typed is private, the generated
    // definition of a dictionary word is app content everybody may hear.
    await mount(() => import("../../src/components/DictionaryPanel"), { onBack: vi.fn() });

    await waitFor(() => expect(byKey("dictionary-input")).toBeTruthy());
    expect(byKey("dictionary-input").cacheable).toBe(false);
  });

  it("keeps the grammar practice text out", async () => {
    // Written around this user's own word bank and the focus they typed, and
    // grammarTextService persists nothing — so a cached clip could never be
    // hit twice even if it were shareable.
    //
    // The passage has to be generated first: the control does not exist until
    // there is something to read, so asserting on an ungenerated page would
    // pass against an empty list.
    const { container } = await mount(() =>
      import("../../src/pages/dashboard/grammar/GrammarTextPage"),
    );
    const { default: i18n } = await import("../../src/i18n");

    const focus = container.querySelector("input[type='text'], textarea");
    expect(focus, "no focus input on the page").toBeTruthy();
    fireEvent.change(focus, { target: { value: "preterito perfeito" } });

    const label = i18n.t("grammar.text_generate");
    const generate = [...container.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === label,
    );
    expect(generate, `no button labelled "${label}"`).toBeTruthy();
    fireEvent.click(generate);

    await waitFor(() => expect(byKey("grammar-practice-text")).toBeTruthy());
    expect(byKey("grammar-practice-text").cacheable).toBe(false);
  });
});

describe("the surfaces excluded for size, not privacy", () => {
  /**
   * Culture/History and exam listening send the *whole* piece as one TTS
   * request — unlike StoryReader, which is per-paragraph. At the cache's
   * compression rate that is roughly 8KB of stored audio per second of
   * speech, and the write cap is 900KB — about two minutes. A clip over that
   * still plays, it just silently never gets cached, which would quietly buy
   * nothing for exactly the content most expensive to regenerate. Until these
   * are chunked the way StoryReader is, they stay opted out rather than
   * gamble on staying under a limit nobody enforces on the writing side.
   */

  it("keeps a Culture/History piece out, even though it is app-generated", async () => {
    const { container } = await mount(() =>
      import("../../src/pages/dashboard/HistoryCulturePage"),
    );
    const { default: i18n } = await import("../../src/i18n");

    const label = i18n.t("history_culture.discover");
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === label,
    );
    expect(button, `no button labelled "${label}"`).toBeTruthy();
    fireEvent.click(button);

    await waitFor(() => expect(getFact).toHaveBeenCalled());
    await waitFor(() => expect(byKey("history-fact")).toBeTruthy());
    expect(byKey("history-fact").cacheable).toBe(false);
  });

  it("keeps an exam listening transcript out", async () => {
    // ListeningExercise uses TTSPlayer, not TtsControls, so the rendered-props
    // spy used elsewhere in this file does not see it — drive the real button
    // and check what actually reached askAI. It is also button-driven rather
    // than fetched on mount, so the exercise has to be generated first.
    const { default: i18n } = await import("../../src/i18n");
    const { container } = await mount(() => import("../../src/components/ListeningExercise"));

    const generateLabel = i18n.t("exam.sidebar.generate", "Generate");
    const generate = [...container.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === generateLabel,
    );
    expect(generate, `no button labelled "${generateLabel}"`).toBeTruthy();
    fireEvent.click(generate);

    await waitFor(() => expect(getExercise).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toContain("Bom dia"));

    const playLabel = i18n.t("exam.audio_play", "Play audio");
    const play = [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === playLabel,
    );
    expect(play, `no button labelled "${playLabel}"`).toBeTruthy();
    fireEvent.click(play);

    await waitFor(() => expect(askAI).toHaveBeenCalled());
    expect(askAI.mock.calls[0][2]).toMatchObject({ cacheable: false });
  });
});

describe("the surfaces that share", () => {
  it("lets a caller that says nothing cache, which is most of them", async () => {
    // StoryReader, GrammarExampleList and WordLookupSheet call playTts
    // directly rather than through TtsControls, so the hook's own default is
    // what decides for them — and all three read pooled content that the next
    // learner should not pay to hear again.
    const { renderHook, act } = await import("@testing-library/react");
    const { useTts } = await import("../../src/hooks/useTts");

    const { result } = renderHook(() => useTts());
    act(() => {
      result.current.playTts({ key: "k", text: "uma historia partilhada", lang: "pt-PT", token: "tok" });
    });

    await waitFor(() => expect(askAI).toHaveBeenCalled());
    expect(askAI.mock.calls[0][2]).toMatchObject({ cacheable: true });
  });
});

describe("TtsControls forwards what it is given", () => {
  const renderControls = async (props) => {
    const { default: i18n } = await import("../../src/i18n");
    const actual = await vi.importActual("../../src/components/ui/TtsControls");
    const TtsControls = actual.default;
    const playTts = vi.fn();

    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TtsControls
          ttsKey="k"
          text="olá"
          lang="pt-PT"
          token="tok"
          ttsState={{ activeKey: null, isPaused: false, isGenerating: false }}
          playTts={playTts}
          pauseTts={vi.fn()}
          stopTts={vi.fn()}
          isDarkMode={false}
          {...props}
        />
      </I18nextProvider>,
    );

    fireEvent.click(container.querySelector("button"));
    return playTts;
  };

  it("defaults to cacheable", async () => {
    const playTts = await renderControls({});
    expect(playTts).toHaveBeenCalledWith(expect.objectContaining({ cacheable: true }));
  });

  it("passes an opt-out on to the hook", async () => {
    const playTts = await renderControls({ cacheable: false });
    expect(playTts).toHaveBeenCalledWith(expect.objectContaining({ cacheable: false }));
  });

  it("carries the opt-out on the single-speaker variant too", async () => {
    // The variant used on the challenge boards and the reading pages — it has
    // its own onClick, which is exactly how one of these gets missed.
    const playTts = await renderControls({ cacheable: false, variant: "single" });
    expect(playTts).toHaveBeenCalledWith(expect.objectContaining({ cacheable: false }));
  });
});

describe("the speaker inside a form", () => {
  // Settings puts the voice sample inside the Settings form, and a bare
  // <button> in a form is a submit button: pressing the speaker saved the
  // whole form. Every button this component renders must say type="button".
  const renderInForm = async (variant) => {
    const { default: i18n } = await import("../../src/i18n");
    const { default: TtsControls } = await import("../../src/components/ui/TtsControls");
    const onSubmit = vi.fn((event) => event.preventDefault());
    const view = render(
      <I18nextProvider i18n={i18n}>
        <form onSubmit={onSubmit}>
          <TtsControls
            ttsKey="sample"
            text="Olá"
            lang="pt-PT"
            token="tok"
            variant={variant}
            ttsState={{ activeKey: "sample", isPaused: false, isGenerating: false }}
            playTts={vi.fn()}
            pauseTts={vi.fn()}
            stopTts={vi.fn()}
            isDarkMode={false}
          />
        </form>
      </I18nextProvider>,
    );
    return { view, onSubmit };
  };

  for (const variant of ["single", "full"]) {
    it(`never submits the form it sits in (${variant})`, async () => {
      const { view, onSubmit } = await renderInForm(variant);
      const buttons = view.container.querySelectorAll("button");

      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.getAttribute("type")).toBe("button");
        fireEvent.click(button);
      }
      expect(onSubmit).not.toHaveBeenCalled();
    });
  }
});
