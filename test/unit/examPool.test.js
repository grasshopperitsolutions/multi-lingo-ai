import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Exam Training on the shared practice data model: one exercise at language
 * level, content per dialect (plans/multi-dialect-practice.md). What matters
 * is where things are written and read, and that an exercise too close to one
 * already in the pool never gets in.
 */

const queryCollection = vi.fn();
const getDocument = vi.fn();
const createDocument = vi.fn();
const generateReadingExercise = vi.fn();

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  getDocument: (...a) => getDocument(...a),
  createDocument: (...a) => createDocument(...a),
}));
vi.mock("../../src/services/examReadingExerciseService", () => ({
  generateReadingExercise: (...a) => generateReadingExercise(...a),
}));
vi.mock("../../src/services/examListeningExerciseService", () => ({ generateListeningExercise: vi.fn() }));
vi.mock("../../src/services/examWritingExerciseService", () => ({ generateWritingExercise: vi.fn() }));

const PASSAGE = "A Maria vive em Lisboa com a família. Todos os dias apanha o elétrico para o trabalho.";
const READING = { questionType: "multiple-choice", passage: PASSAGE, questions: [{ id: "q1", text: "Onde?", correctAnswer: "Lisboa" }] };
const CALL = { token: "t", level: "A2", type: "reading", targetLang: "pt-PT", seenExerciseIds: [] };

let service;
beforeEach(async () => {
  vi.clearAllMocks();
  createDocument.mockResolvedValue({ id: "x" });
  getDocument.mockResolvedValue(null);
  generateReadingExercise.mockResolvedValue(READING);
  service = await import("../../src/services/examExerciseService");
});

describe("exam pool", () => {
  it("queries at language level with equality filters only", async () => {
    queryCollection.mockResolvedValue({ documents: [] });
    await service.getExercise({ ...CALL, questionType: "true-false" });

    const [collection, filters] = queryCollection.mock.calls[0];
    expect(collection).toBe("examExercises");
    expect(filters).toEqual({ language: "pt", level: "A2", type: "reading", status: "ready", questionType: "true-false" });
  });

  it("generates into a missing pool, content before the root", async () => {
    queryCollection.mockResolvedValue({ documents: [] });
    const result = await service.getExercise(CALL);

    expect(result.source).toBe("ai");
    expect(result.exerciseId).toMatch(/^[a-z0-9]+$/);
    const [contentCall, rootCall] = createDocument.mock.calls;
    expect(contentCall[0]).toBe(`examExercises/${result.exerciseId}/content`);
    expect(contentCall[2]).toBe("pt-PT");
    expect(contentCall[1]).toMatchObject({ dialect: "pt-PT", type: "reading", reading: READING });
    expect(rootCall[0]).toBe("examExercises");
    expect(rootCall[2]).toBe(result.exerciseId);
    expect(rootCall[1]).toMatchObject({
      language: "pt", originDialect: "pt-PT", dialects: ["pt-PT"], portability: "unknown",
      type: "reading", questionType: "multiple-choice", level: "A2", status: "ready",
    });
    expect(rootCall[1].fingerprint).toBe(service.examFingerprint(READING));
  });

  it("serves an unseen exercise for this dialect without generating", async () => {
    queryCollection.mockResolvedValue({
      documents: [
        { id: "br", type: "reading", level: "A2", dialects: ["pt-BR"] },
        { id: "seen", type: "reading", level: "A2", dialects: ["pt-PT"] },
        { id: "pt", type: "reading", level: "A2", questionType: "multiple-choice", dialects: ["pt-PT"] },
      ],
    });
    getDocument.mockResolvedValue({ id: "pt-PT", data: { type: "reading", questionType: "multiple-choice", reading: READING } });

    const result = await service.getExercise({ ...CALL, seenExerciseIds: ["seen"] });
    expect(result).toMatchObject({ exerciseId: "pt", source: "db" });
    expect(result.content.passage).toBe(PASSAGE);
    expect(generateReadingExercise).not.toHaveBeenCalled();
    expect(getDocument).toHaveBeenCalledTimes(1);
    expect(getDocument).toHaveBeenCalledWith("examExercises/pt/content", "pt-PT", "t");
  });

  it("generates when the only match has lost its content", async () => {
    queryCollection.mockResolvedValue({ documents: [{ id: "gone", type: "reading", level: "A2", dialects: ["pt-PT"] }] });
    const result = await service.getExercise(CALL);
    expect(result.source).toBe("ai");
  });

  it("serves a near-duplicate but keeps it out of the pool", async () => {
    queryCollection.mockResolvedValue({
      documents: [{ id: "old", type: "reading", level: "A2", dialects: ["pt-PT"], fingerprint: service.examFingerprint(READING) }],
    });
    // Seen, so it must generate — and the model writes the same passage again.
    const result = await service.getExercise({ ...CALL, seenExerciseIds: ["old"] });

    expect(result.source).toBe("ai");
    expect(result.exerciseId).toBeNull();
    expect(result.content.passage).toBe(PASSAGE);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("still serves the exercise when storing it fails", async () => {
    queryCollection.mockResolvedValue({ documents: [] });
    createDocument.mockRejectedValue(new Error("write failed"));
    const result = await service.getExercise(CALL);
    expect(result.exerciseId).toBeNull();
    expect(result.content.passage).toBe(PASSAGE);
  });

  it("counts only what this dialect can read", async () => {
    queryCollection.mockResolvedValue({ documents: [{ id: "a", dialects: ["pt-PT"] }, { id: "b", dialects: ["pt-BR"] }] });
    await expect(service.getExercisePoolCount("t", "reading", "A2", "pt-PT")).resolves.toBe(1);
  });
});
