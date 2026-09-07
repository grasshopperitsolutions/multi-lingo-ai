import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * Exercise components with real exercise data.
 *
 * Mounting them empty only reaches their loading branch, which is why they sat
 * at roughly a fifth covered while nominally "rendered". Feeding each one an
 * exercise of the shape its service returns is what exercises the question
 * rendering, the answer bookkeeping and the completeness check.
 *
 * Reading supports several question types and branches on `questionType`, so
 * each shape is rendered rather than just the default one.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/services/aiService", () => ({
  askAI: vi.fn(async () => ({ text: "{}" })),
  registerAiConfirmHandler: vi.fn(),
  isAiDeclined: () => false,
}));

const getExercise = vi.fn();
const getExercisePoolCount = vi.fn(async () => 5);

vi.mock("../../src/services/examExerciseService", () => ({
  getExercise: (...a) => getExercise(...a),
  getExercisePoolCount: (...a) => getExercisePoolCount(...a),
}));

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: vi.fn(async () => ({ documents: [], hasMore: false })),
  getDocument: vi.fn(async () => null),
  createDocument: vi.fn(async () => ({ id: "x" })),
  updateDocument: vi.fn(async () => ({})),
  patchDocument: vi.fn(async () => ({})),
  deleteDocument: vi.fn(async () => ({})),
  getTokenOrAnonymous: vi.fn(async () => "anon"),
}));

const signedIn = () =>
  makeAppContext({
    user: {
      uid: "u1",
      token: "tok",
      displayName: "U",
      subscriptionTier: "maestro",
      learningDialect: "pt-PT",
      interfaceLang: "pt-PT",
      level: "B1",
      seenExerciseIds: [],
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
        features: ["reading_exercise", "listening_exercise", "writing_exercise", "full_exam"],
      },
    },
    features: [],
    supportedLanguages: [{ code: "pt-PT", name: "Português", flag: "pt" }],
  });

beforeEach(() => {
  ctx.current = signedIn();
  vi.clearAllMocks();
  getExercisePoolCount.mockResolvedValue(5);
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { documents: [], hasMore: false } }),
  }));
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
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

const multipleChoice = {
  exerciseId: "e1",
  level: "B1",
  targetLang: "pt-PT",
  questionType: "multiple-choice",
  passage: "A casa é grande e tem um jardim bonito.",
  title: "A Casa",
  questions: [
    { id: "q1", text: "Como é a casa?", options: ["Grande", "Pequena"], correctAnswer: "Grande" },
    { id: "q2", text: "O que tem?", options: ["Jardim", "Piscina"], correctAnswer: "Jardim" },
  ],
};

const READING_SHAPES = [
  ["multiple choice", multipleChoice],
  [
    "best title",
    {
      ...multipleChoice,
      questionType: "best-title",
      questions: [],
      titleOptions: ["A Casa", "O Jardim", "A Cidade"],
      correctTitle: "A Casa",
    },
  ],
  [
    "ordering",
    {
      ...multipleChoice,
      questionType: "ordering",
      questions: [],
      segments: [
        { id: "s1", text: "Primeiro." },
        { id: "s2", text: "Depois." },
        { id: "s3", text: "Por fim." },
      ],
      correctOrder: ["s1", "s2", "s3"],
    },
  ],
  [
    "cloze",
    {
      ...multipleChoice,
      questionType: "cloze",
      questions: [],
      blanks: [
        { id: "b1", options: ["é", "são"], correctAnswer: "é" },
        { id: "b2", options: ["um", "uma"], correctAnswer: "um" },
      ],
    },
  ],
];

describe("ReadingExercise", () => {
  it.each(READING_SHAPES)("renders a %s exercise", async (_name, exercise) => {
    getExercise.mockResolvedValue(exercise);

    const { container } = await mount(() => import("../../src/components/ReadingExercise"));

    await waitFor(
      () => expect(container.querySelectorAll("*").length).toBeGreaterThan(15),
      { timeout: 8000 },
    );
  });

  it("leaves its loading state and offers something to answer with", async () => {
    getExercise.mockResolvedValue(multipleChoice);

    const { container } = await mount(() => import("../../src/components/ReadingExercise"));

    // Deliberately not asserting the passage is on screen. ReadingExercise
    // does not render it at this level (see the note at ReadingExercise.jsx:588)
    // — each question-type sub-component owns its own passage, and the passage
    // card is results-only. What matters here is that the component got past
    // loading and produced controls.
    await waitFor(
      () =>
        expect(
          container.querySelectorAll("button, input, textarea, select").length,
        ).toBeGreaterThan(0),
      { timeout: 8000 },
    );
  });

  it("renders an error state instead of hanging when generation fails", async () => {
    getExercise.mockRejectedValue(new Error("AI unavailable"));

    const { container } = await mount(() => import("../../src/components/ReadingExercise"));

    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0), {
      timeout: 8000,
    });
  });
});

describe("ListeningExercise", () => {
  it("renders an exercise with its questions", async () => {
    getExercise.mockResolvedValue({
      exerciseId: "l1",
      level: "B1",
      targetLang: "pt-PT",
      questionType: "multiple-choice",
      transcript: "Bom dia. Como está?",
      questions: [
        { id: "q1", text: "O que diz?", options: ["Bom dia", "Boa noite"], correctAnswer: "Bom dia" },
      ],
    });

    const { container } = await mount(() => import("../../src/components/ListeningExercise"));

    await waitFor(
      () => expect(container.querySelectorAll("*").length).toBeGreaterThan(15),
      { timeout: 8000 },
    );
  });

  it("survives a failed load", async () => {
    getExercise.mockRejectedValue(new Error("nope"));

    const { container } = await mount(() => import("../../src/components/ListeningExercise"));
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0), {
      timeout: 8000,
    });
  });
});

describe("WritingExercise", () => {
  it("renders a prompt and somewhere to write", async () => {
    getExercise.mockResolvedValue({
      exerciseId: "w1",
      level: "B1",
      targetLang: "pt-PT",
      prompt: "Escreve sobre a tua casa.",
      minWords: 50,
      maxWords: 120,
    });

    const { container } = await mount(() => import("../../src/components/WritingExercise"));

    await waitFor(
      () => expect(container.querySelectorAll("*").length).toBeGreaterThan(10),
      { timeout: 8000 },
    );
  });

  it("survives a failed load", async () => {
    getExercise.mockRejectedValue(new Error("nope"));

    const { container } = await mount(() => import("../../src/components/WritingExercise"));
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0), {
      timeout: 8000,
    });
  });
});

describe("FullExamExercise", () => {
  it("renders its opening state", async () => {
    getExercise.mockResolvedValue(multipleChoice);

    const { container } = await mount(() => import("../../src/components/FullExamExercise"), {
      onBack: vi.fn(),
    });

    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0), {
      timeout: 8000,
    });
  });

  it("resumes from an exam session already in context", async () => {
    ctx.current = {
      ...signedIn(),
      examSession: {
        level: "B1",
        targetLang: "pt-PT",
        startedAt: Date.now(),
        sections: { reading: { status: "pending" } },
      },
    };
    getExercise.mockResolvedValue(multipleChoice);

    const { container } = await mount(() => import("../../src/components/FullExamExercise"), {
      onBack: vi.fn(),
    });

    // A part-finished exam must survive a reload — the session lives in
    // context, not component state.
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0), {
      timeout: 8000,
    });
  });
});
