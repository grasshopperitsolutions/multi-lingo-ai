import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeAnswer,
  checkTypedAnswer,
  checkSelection,
  VERDICT,
} from "../../src/utils/grammarAnswerCheck";
import {
  fingerprint,
  similarity,
  dropDuplicates,
  DUPLICATE_THRESHOLD,
} from "../../src/utils/grammarDuplicates";
import { sanitizeExercise } from "../../src/utils/grammarExerciseValidators";
import {
  availablePracticeTypes,
  isOpenAnswerType,
  RENDERABLE_TYPES,
} from "../../src/config/grammarPracticeTypes";
import { isStructuredPracticeSupported } from "../../src/config/structuredPracticeSupport";
import { isGrammarSectionAvailable } from "../../src/config/grammarSupport";
import { GRAMMAR_SECTIONS } from "../../src/config/favouritableFeatures";

/**
 * Stand-ins for the Firestore prompt documents. The real templates live in
 * appConfig/config/prompts and are edited in Admin; these only need to carry
 * the variables so the service's rendering can be checked.
 */
const VARS = "{{targetLang}} {{explanationLang}} {{level}} {{topic}} {{knownTopics}} {{commonTopics}} {{itemCount}} {{interests}} {{avoid}}";
const PROMPT_SEEDS = [
  {
    id: "grammar-practice-prompt",
    model: "",
    variants: ["choose-option", "multi-select", "judge-correct", "classify", "word-order", "conjugate",
      "conjugate-contrast", "gap-by-cue", "inflect", "fill-from-bank", "transform", "build-sentence",
      "translate", "open-completion"].map((key) => ({ key, template: `${key}: ${VARS}` })),
  },
  { id: "grammar-practice-gloss-prompt", model: "", template: "{{sourceLang}} {{targetLocale}} {{fieldsJson}}" },
  {
    id: "grammar-practice-check-prompt",
    model: "",
    template: "{{targetLang}} {{level}} Task: {{task}} Item: {{item}} Accepted: {{acceptedAnswers}} Learner: {{learnerAnswer}} {{explanationLang}}",
  },
];

/**
 * Grammar Practice. The pieces that decide whether a learner is marked right,
 * what counts as a repeat, and what survives from a model's JSON — all pure,
 * all worth pinning, because each fails silently: a too-strict checker just
 * marks right answers wrong, a too-loose duplicate check just serves the same
 * sentence twice.
 */

// ── Marking ─────────────────────────────────────────────────────────────────

describe("normalizeAnswer", () => {
  it("forgives case, spacing, final punctuation and quote/dash variants", () => {
    expect(normalizeAnswer("  Ela  Ama-te. ")).toBe("ela ama-te");
    expect(normalizeAnswer("ama – te")).toBe("ama-te");
    expect(normalizeAnswer("d’água!")).toBe("d'água");
  });

  it("keeps accents", () => {
    expect(normalizeAnswer("Falámos")).toBe("falámos");
  });
});

describe("checkTypedAnswer", () => {
  it("accepts any listed answer", () => {
    expect(checkTypedAnswer("Viajarei", ["vou viajar", "viajarei"]).verdict).toBe(VERDICT.CORRECT);
  });

  it("gives an accent verdict when only the accents are off", () => {
    expect(checkTypedAnswer("falamos", ["falámos"]).verdict).toBe(VERDICT.ACCENT);
    expect(checkTypedAnswer("esta", ["está"]).verdict).toBe(VERDICT.ACCENT);
  });

  it("marks anything else, and an empty answer, wrong", () => {
    expect(checkTypedAnswer("falei", ["falámos"]).verdict).toBe(VERDICT.WRONG);
    expect(checkTypedAnswer("   ", ["x"]).verdict).toBe(VERDICT.WRONG);
    expect(checkTypedAnswer("x", undefined).verdict).toBe(VERDICT.WRONG);
  });
});

describe("checkSelection", () => {
  it("needs exactly the accepted set", () => {
    expect(checkSelection(["b", "a"], ["a", "b"])).toBe(true);
    expect(checkSelection(["a"], ["a", "b"])).toBe(false);
    expect(checkSelection(["a", "b", "c"], ["a", "b"])).toBe(false);
  });
});

// ── Duplicates ──────────────────────────────────────────────────────────────

const item = (prompt, answer, cue) => ({ prompt, answers: [answer], ...(cue ? { cue } : {}) });
const score = (a, b) => similarity(fingerprint(a), fingerprint(b));

describe("duplicate detection", () => {
  it("drops the repeats the threshold is meant to catch", () => {
    const pairs = [
      [item("O Rui apanha o autocarro às oito.", "apanha"), item("A Rita apanha o autocarro às oito.", "apanha")],
      [item("Ontem ___ cedo.", "acordei", "acordar"), item("Ontem ___ tarde.", "acordei", "acordar")],
      [item("O João lavou [[o carro]].", "O João lavou-o."), item("O João lavou [[o carro]] ontem.", "O João lavou-o ontem.")],
    ];
    for (const [a, b] of pairs) expect(score(a, b)).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it("keeps the same frame in another tense, and new sentences", () => {
    const pairs = [
      [item("Ontem ___ cedo.", "acordei", "acordar"), item("Amanhã ___ cedo.", "vou acordar", "acordar")],
      [item("Eu ___ um carro novo ontem.", "comprei"), item("Ela ___ pão na padaria.", "comprou")],
      [item("Eu ___ um carro novo.", "comprei"), item("Nós ___ a casa antiga.", "vendemos")],
    ];
    for (const [a, b] of pairs) expect(score(a, b)).toBeLessThan(DUPLICATE_THRESHOLD);
  });

  it("drops within the exercise and against the pool", () => {
    const pool = [fingerprint(item("A Ana está cansada hoje.", "está"))];
    const { kept, dropped } = dropDuplicates(
      [
        item("O Rui apanha o autocarro às oito.", "apanha"),
        item("A Rita apanha o autocarro às oito.", "apanha"),
        item("A Ana está cansada hoje.", "está"),
        item("Nós vendemos a casa antiga.", "vendemos"),
      ],
      pool
    );
    expect(kept.map((i) => i.answers[0])).toEqual(["apanha", "vendemos"]);
    expect(dropped).toHaveLength(2);
  });
});

// ── Validation ──────────────────────────────────────────────────────────────

describe("sanitizeExercise", () => {
  const base = { topicKey: "verbs-past", focus: "preterite", instructions: "Conjuga." };

  it("keeps good conjugate items and drops broken ones", () => {
    const { exercise, problems } = sanitizeExercise("conjugate", {
      ...base,
      items: [
        { id: "i1", prompt: "Ontem ___ cedo.", cue: "acordar", answers: ["acordei"], explanation: "…" },
        { id: "i2", prompt: "Sem lacuna.", cue: "ir", answers: ["fui"] },
        { id: "i3", prompt: "Ele ___ ontem.", cue: "", answers: ["foi"] },
        { id: "i4", prompt: "Eu acordei ___ cedo.", cue: "acordar", answers: ["acordei"] },
      ],
    });
    expect(exercise.items.map((i) => i.id)).toEqual(["i1"]);
    expect(exercise.items[0].explanation).toBe("…");
    expect(problems.length).toBe(3);
  });

  it("requires the choose-option answer to be one of the options", () => {
    const { exercise } = sanitizeExercise("choose-option", {
      ...base,
      items: [
        { id: "a", prompt: "Ontem ___.", options: ["fui", "ia"], answers: ["fui"] },
        { id: "b", prompt: "Ontem ___.", options: ["fui", "ia"], answers: ["vou"] },
      ],
    });
    expect(exercise.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("checks that word-order fragments make the answer, and shuffles an ordered list", () => {
    const { exercise } = sanitizeExercise("word-order", {
      ...base,
      items: [
        { id: "a", fragments: ["estes", "meus", "livros"], answers: ["estes meus livros"] },
        { id: "b", fragments: ["estes", "livros"], answers: ["os meus livros"] },
      ],
    });
    expect(exercise.items).toHaveLength(1);
    expect(exercise.items[0].fragments.join(" ")).not.toBe("estes meus livros");
  });

  it("rejects a word bank passage whose gaps and items disagree", () => {
    const { exercise } = sanitizeExercise("fill-from-bank", {
      ...base,
      passage: "A Ana ___ cansada e ___ calma.",
      wordBank: ["está", "é", "tem"],
      items: [{ id: "a", position: 1, answers: ["está"] }],
    });
    expect(exercise).toBeNull();
  });

  it("returns null for junk", () => {
    expect(sanitizeExercise("conjugate", null).exercise).toBeNull();
    expect(sanitizeExercise("nope", {}).exercise).toBeNull();
  });
});

// ── Access ──────────────────────────────────────────────────────────────────

describe("types and guards", () => {
  it("keeps open-answer types from learners without the Maestro feature", () => {
    expect(availablePracticeTypes({ canOpenAnswer: false }).some(isOpenAnswerType)).toBe(false);
  });

  it("only offers types that have a renderer", () => {
    for (const key of availablePracticeTypes({ canOpenAnswer: true })) {
      expect(RENDERABLE_TYPES.has(key)).toBe(true);
    }
  });

  it("follows the exam switch for the practice section", () => {
    const langs = [{ code: "pt-PT", examSupported: true }, { code: "pt-BR", examSupported: false }];
    const practice = GRAMMAR_SECTIONS.find((s) => s.id === "practice");
    expect(isStructuredPracticeSupported("pt-PT", langs)).toBe(true);
    expect(isStructuredPracticeSupported("pt-BR", langs)).toBe(false);
    expect(isGrammarSectionAvailable(practice, "pt-BR", langs)).toBe(false);
    expect(isGrammarSectionAvailable(practice, "pt-PT", langs)).toBe(true);
    expect(isGrammarSectionAvailable(practice, "pt-PT", undefined)).toBe(false);
  });
});

// ── Service: empty collections are normal ───────────────────────────────────

const queryCollection = vi.fn();
const getDocument = vi.fn();
const createDocument = vi.fn();
const updateDocument = vi.fn();
const askAI = vi.fn();

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  getDocument: (...a) => getDocument(...a),
  createDocument: (...a) => createDocument(...a),
  updateDocument: (...a) => updateDocument(...a),
}));
vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  isAiDeclined: () => false,
}));
vi.mock("../../src/services/promptService", () => ({
  getPrompt: async (id) => {
    const seed = PROMPT_SEEDS.find((p) => p.id === id);
    if (!seed) throw new Error(`[promptService] Prompt "${id}" not found in x`);
    return seed;
  },
  renderTemplate: (template, vars) =>
    String(template).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)),
}));

const MODEL_EXERCISE = {
  topicKey: "Verbs Past Simple",
  family: "verbs",
  focus: "preterite",
  focusLabel: "Pretérito perfeito",
  instructions: "Conjuga o verbo.",
  items: [
    ["Ontem eu ___ cedo.", "acordar", "acordei"],
    ["Ela ___ o livro todo.", "ler", "leu"],
    ["Nós ___ no restaurante novo.", "jantar", "jantámos"],
    ["Eles ___ para Lisboa em maio.", "viajar", "viajaram"],
    ["Tu ___ a janela da sala.", "abrir", "abriste"],
    ["Vocês ___ muito na festa.", "dançar", "dançaram"],
  ].map(([prompt, cue, answer], i) => ({ id: `i${i + 1}`, prompt, cue, answers: [answer], explanation: "Ação concluída." })),
};

describe("getPracticeExercise", () => {
  let service;
  beforeEach(async () => {
    vi.clearAllMocks();
    service = await import("../../src/services/grammarPracticeService");
  });

  it("generates and stores when nothing exists yet, children before the root", async () => {
    queryCollection.mockResolvedValue({ documents: [] });
    getDocument.mockResolvedValue(null);
    createDocument.mockResolvedValue({ id: "x" });
    askAI.mockResolvedValue({ text: JSON.stringify(MODEL_EXERCISE) });

    const result = await service.getPracticeExercise({
      token: "t", dialect: "pt-PT", explanationLocale: "pt-PT", level: "A2", type: "conjugate",
    });

    expect(result.source).toBe("ai");
    expect(result.topicKey).toBe("verbs-past-simple");
    expect(result.exercise.items).toHaveLength(6);
    expect(result.exercise.items[0].explanation).toBe("Ação concluída.");

    const collections = createDocument.mock.calls.map((call) => call[0]);
    expect(collections[0]).toBe("grammarTopics");
    const rootIndex = collections.indexOf("grammarExercises");
    expect(collections.findIndex((c) => c.endsWith("/content"))).toBeLessThan(rootIndex);
    expect(collections.findIndex((c) => c.endsWith("/gloss"))).toBeLessThan(rootIndex);

    const root = createDocument.mock.calls[rootIndex][1];
    expect(root).toMatchObject({ language: "pt", dialects: ["pt-PT"], type: "conjugate", status: "ready", openAnswer: false });
    expect(root.fingerprints).toHaveLength(6);
  });

  it("still serves the exercise when storing it fails", async () => {
    queryCollection.mockResolvedValue({ documents: [] });
    createDocument.mockRejectedValue(new Error("write failed"));
    askAI.mockResolvedValue({ text: JSON.stringify(MODEL_EXERCISE) });

    const result = await service.getPracticeExercise({ token: "t", dialect: "pt-PT", level: "A2", type: "conjugate" });
    expect(result.exerciseId).toBeNull();
    expect(result.exercise.items.length).toBeGreaterThan(0);
  });

  it("serves from the pool, merging the gloss back in", async () => {
    queryCollection.mockResolvedValue({
      documents: [{ id: "ex1", type: "conjugate", topicKey: "verbs-past", level: "A2", dialects: ["pt-PT"] }],
    });
    getDocument.mockImplementation(async (collection) => {
      if (collection.endsWith("/content")) return { id: "pt-PT", data: { items: [{ id: "i1", prompt: "Ontem ___.", cue: "ir", answers: ["fui"] }] } };
      if (collection.endsWith("/gloss")) return { id: "pt-PT__pt", data: { instructions: "Conjuga.", items: { i1: { explanation: "Porque sim." } } } };
      return null;
    });

    const result = await service.getPracticeExercise({ token: "t", dialect: "pt-PT", explanationLocale: "pt-PT", level: "A2" });
    expect(result.source).toBe("db");
    expect(askAI).not.toHaveBeenCalled();
    expect(result.exercise.instructions).toBe("Conjuga.");
    expect(result.exercise.items[0].explanation).toBe("Porque sim.");
  });

  it("skips a pool entry for another dialect, or with missing content", async () => {
    queryCollection.mockResolvedValue({
      documents: [
        { id: "br", type: "conjugate", topicKey: "x", level: "A2", dialects: ["pt-BR"] },
        { id: "gone", type: "conjugate", topicKey: "x", level: "A2", dialects: ["pt-PT"] },
      ],
    });
    getDocument.mockResolvedValue(null);
    createDocument.mockResolvedValue({ id: "x" });
    askAI.mockResolvedValue({ text: JSON.stringify(MODEL_EXERCISE) });

    const result = await service.getPracticeExercise({ token: "t", dialect: "pt-PT", level: "A2", type: "conjugate" });
    expect(result.source).toBe("ai");
    expect(getDocument).not.toHaveBeenCalledWith(expect.stringContaining("/br/"), expect.anything(), expect.anything());
  });

  it("gives a clear error when the model returns too little", async () => {
    queryCollection.mockResolvedValue({ documents: [] });
    askAI.mockResolvedValue({ text: JSON.stringify({ ...MODEL_EXERCISE, items: MODEL_EXERCISE.items.slice(0, 2) }) });
    await expect(
      service.getPracticeExercise({ token: "t", dialect: "pt-PT", level: "A2", type: "conjugate" })
    ).rejects.toThrow("GRAMMAR_PRACTICE_GENERATION_FAILED");
    expect(askAI).toHaveBeenCalledTimes(2);
  });

  it("returns no topics rather than throwing when the read fails", async () => {
    queryCollection.mockRejectedValue(new Error("boom"));
    await expect(service.getKnownTopics({ token: "t", dialect: "pt-PT" })).resolves.toEqual([]);
  });
});

describe("schemaForType", () => {
  it("forces every type's own fields, answers included, and nothing else", async () => {
    const { schemaForType } = await import("../../src/services/grammarPracticeService");
    for (const key of RENDERABLE_TYPES) {
      const item = schemaForType(key).properties.items.items;
      expect(item.required, key).toEqual(Object.keys(item.properties));
      expect(item.required, key).toContain(key === "open-completion" ? "sampleAnswers" : "answers");
    }
    expect(Object.keys(schemaForType("conjugate").properties.items.items.properties)).not.toContain("options");
  });
});

describe("checkOpenAnswer", () => {
  let service;
  const item = { id: "i1", prompt: "O João lavou [[o carro]].", answers: ["O João lavou-o."] };
  beforeEach(async () => {
    vi.clearAllMocks();
    service = await import("../../src/services/grammarPracticeService");
  });

  const call = (target, answer = "Lavou-o o João.") =>
    service.checkOpenAnswer({
      token: "t", dialect: "pt-PT", explanationLocale: "en-US", level: "B1",
      exercise: { instructions: "Replace with a pronoun.", operation: "pronoun" }, item: target, answer,
    });

  it("sends the item, task, key and answer, and returns the verdict", async () => {
    askAI.mockResolvedValue({ text: JSON.stringify({ acceptable: true, correctedAnswer: "Lavou-o o João.", explanation: "Fine." }) });
    const verdict = await call(item);

    expect(verdict).toEqual({ acceptable: true, correctedAnswer: "Lavou-o o João.", explanation: "Fine." });
    const prompt = askAI.mock.calls[0][1];
    expect(prompt).toContain("O João lavou o carro.");
    expect(prompt).toContain("O João lavou-o.");
    expect(prompt).toContain("Lavou-o o João.");
    expect(prompt).toContain("Replace with a pronoun.");
  });

  it("stores nothing, whatever the verdict", async () => {
    askAI.mockResolvedValue({ text: JSON.stringify({ acceptable: true, correctedAnswer: "", explanation: "" }) });
    await call(item);
    await call({ id: "i2", prompt: "Se eu pudesse,", sampleAnswers: ["viajava."], answers: [] }, "iria à lua.");
    expect(createDocument).not.toHaveBeenCalled();
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it("refuses an empty answer without spending a call", async () => {
    await expect(call(item, "   ")).rejects.toThrow(/answer is required/);
    expect(askAI).not.toHaveBeenCalled();
  });
});

describe("getPracticeExercise with a typed topic", () => {
  let service;
  beforeEach(async () => {
    vi.clearAllMocks();
    service = await import("../../src/services/grammarPracticeService");
  });

  it("skips the pool, sends the learner's words as the topic, and keeps the model's key", async () => {
    queryCollection.mockResolvedValue({
      documents: [{ id: "ex1", type: "conjugate", topicKey: "verbs-past", level: "A2", dialects: ["pt-PT"] }],
    });
    createDocument.mockResolvedValue({ id: "x" });
    askAI.mockResolvedValue({ text: JSON.stringify(MODEL_EXERCISE) });

    const result = await service.getPracticeExercise({
      token: "t", dialect: "pt-PT", level: "A2", type: "conjugate", customTopic: "  verbos com preposição  ",
    });

    expect(getDocument).not.toHaveBeenCalledWith(expect.stringContaining("/ex1/"), expect.anything(), expect.anything());
    expect(askAI.mock.calls[0][1]).toContain("verbos com preposição");
    expect(result.source).toBe("ai");
    expect(result.topicKey).toBe("verbs-past-simple");
    const filters = queryCollection.mock.calls.find((call) => call[0] === "grammarExercises")[1];
    expect(filters).not.toHaveProperty("topicKey");
  });
});
