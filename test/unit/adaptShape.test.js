import { describe, it, expect } from "vitest";
import { rebuildAdaptation } from "../../src/utils/adaptShape";
import { adaptCandidates, sourceDialectOf } from "../../src/services/practicePool";

/**
 * Adapting an exercise to a sibling dialect may change its wording and
 * nothing else. These pin what counts as "nothing else".
 */

const ORIGINAL = {
  passage: "O João apanha o autocarro às oito.",
  audioUrl: "",
  duration: 60,
  questions: [
    { id: "q1", text: "Como vai o João?", options: ["De autocarro", "A pé"], correctAnswer: "De autocarro" },
    { id: "q2", text: "Vai às oito?", correctAnswer: true },
  ],
};
const ADAPTED = {
  passage: "O João pega o ônibus às oito.",
  audioUrl: "https://nope",
  duration: 60,
  extra: "dropped",
  questions: [
    { id: "q1", text: "Como vai o João?", options: ["De ônibus", "A pé"], correctAnswer: "De ônibus" },
    { id: "q2", text: "Vai às oito?", correctAnswer: true },
  ],
};

describe("rebuildAdaptation", () => {
  it("takes the new wording in the original's exact shape", () => {
    const out = rebuildAdaptation(ORIGINAL, ADAPTED);
    expect(out.passage).toBe("O João pega o ônibus às oito.");
    expect(out.questions[0].correctAnswer).toBe("De ônibus");
    expect(out).not.toHaveProperty("extra");
    expect(out.audioUrl).toBe("");
  });

  it("rejects changed meaning: booleans, numbers, ids, list lengths", () => {
    const flip = structuredClone(ADAPTED);
    flip.questions[1].correctAnswer = false;
    const time = { ...structuredClone(ADAPTED), duration: 90 };
    const id = structuredClone(ADAPTED);
    id.questions[0].id = "x";
    const shorter = { ...structuredClone(ADAPTED), questions: ADAPTED.questions.slice(0, 1) };
    for (const bad of [flip, time, id, shorter]) expect(rebuildAdaptation(ORIGINAL, bad)).toBeNull();
  });

  it("rejects an answer that no longer matches its options, or an emptied text", () => {
    const orphan = structuredClone(ADAPTED);
    orphan.questions[0].correctAnswer = "De autocarro";
    const emptied = { ...structuredClone(ADAPTED), passage: " " };
    expect(rebuildAdaptation(ORIGINAL, orphan)).toBeNull();
    expect(rebuildAdaptation(ORIGINAL, emptied)).toBeNull();
    expect(rebuildAdaptation(ORIGINAL, null)).toBeNull();
  });

  it("checks blanks against the word bank", () => {
    const original = { passage: "Eu ___ cedo.", wordBank: ["acordo", "durmo"], blanks: [{ id: "b1", position: 1, correctAnswer: "acordo" }] };
    const good = { passage: "Eu ___ cedo.", wordBank: ["acordo", "deito"], blanks: [{ id: "b1", position: 1, correctAnswer: "acordo" }] };
    const bad = { passage: "Eu ___ cedo.", wordBank: ["levanto", "deito"], blanks: [{ id: "b1", position: 1, correctAnswer: "acordo" }] };
    expect(rebuildAdaptation(original, good)).not.toBeNull();
    expect(rebuildAdaptation(original, bad)).toBeNull();
  });
});

describe("adaptCandidates", () => {
  it("offers unseen exercises from other dialects that were not ruled out", () => {
    const docs = [
      { id: "mine", dialects: ["pt-BR"] },
      { id: "seen", dialects: ["pt-PT"] },
      { id: "no", dialects: ["pt-PT"], portability: "dialect-specific" },
      { id: "empty", dialects: [] },
      { id: "ok", dialects: ["pt-PT"], portability: "unknown" },
    ];
    expect(adaptCandidates(docs, "pt-BR", ["seen"]).map((d) => d.id)).toEqual(["ok"]);
  });

  it("adapts from where it was written when that content is listed", () => {
    expect(sourceDialectOf({ originDialect: "pt-PT", dialects: ["pt-AO", "pt-PT"] })).toBe("pt-PT");
    expect(sourceDialectOf({ originDialect: "pt-PT", dialects: ["pt-AO"] })).toBe("pt-AO");
  });
});
