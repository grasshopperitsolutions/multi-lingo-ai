import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * personalService — the three rules that are easy to get wrong, and that fail
 * quietly rather than loudly when they are.
 *
 * A dropped document, a lost first-visit save, or a write that races itself
 * all look like "it just didn't save" to the person using it.
 */

const queryCollection = vi.fn(async () => ({ documents: [] }));
const createDocument = vi.fn(async () => ({ id: "new" }));
const patchDocument = vi.fn(async () => ({}));
const deleteDocument = vi.fn(async () => ({}));
const getDocument = vi.fn(async () => null);

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  createDocument: (...a) => createDocument(...a),
  patchDocument: (...a) => patchDocument(...a),
  deleteDocument: (...a) => deleteDocument(...a),
  getDocument: (...a) => getDocument(...a),
  getTokenOrAnonymous: vi.fn(async () => "anon"),
}));

beforeEach(() => vi.clearAllMocks());

describe("where the items live", () => {
  it("writes under the user's own document", async () => {
    const { addPersonalItem, PERSONAL_KINDS } = await import("../../src/services/personalService");

    await addPersonalItem({
      token: "tok",
      uid: "u1",
      kind: PERSONAL_KINDS.QUESTION,
      data: { text: "a" },
    });

    // Owner-gated by the API without any policy entry, and cleaned up on
    // account deletion for free.
    expect(createDocument).toHaveBeenCalledWith(
      "users/u1/personalQuestions",
      { text: "a" },
      undefined,
      "tok",
    );
  });

  it("refuses a kind it does not know rather than inventing a path", async () => {
    const { addPersonalItem } = await import("../../src/services/personalService");

    await expect(
      addPersonalItem({ token: "tok", uid: "u1", kind: "somethingElse", data: {} }),
    ).rejects.toThrow(/Unknown kind/);
  });

  it("never sends createdAt — the server stamps it", async () => {
    const { addPersonalItem, PERSONAL_KINDS } = await import("../../src/services/personalService");

    await addPersonalItem({
      token: "tok",
      uid: "u1",
      kind: PERSONAL_KINDS.PHRASE,
      data: { phrase: "p", translation: "t" },
    });

    expect(createDocument.mock.calls[0][1]).not.toHaveProperty("createdAt");
  });
});

describe("listing", () => {
  it("sorts newest first in code, with no orderBy in the query", async () => {
    queryCollection.mockResolvedValue({
      documents: [
        { id: "old", title: "old", createdAt: { _seconds: 1000 } },
        { id: "new", title: "new", createdAt: { _seconds: 9000 } },
      ],
    });

    const { listPersonalItems, PERSONAL_KINDS } = await import("../../src/services/personalService");
    const { items } = await listPersonalItems({ token: "tok", uid: "u1", kind: PERSONAL_KINDS.PHRASE });

    expect(items.map((i) => i.id)).toEqual(["new", "old"]);

    // An orderBy would drop any document missing createdAt entirely, which is
    // why the sort is here and not in the query.
    const options = queryCollection.mock.calls[0][2];
    expect(options.orderBy).toBeUndefined();
  });

  it("keeps a document that has no timestamp at all", async () => {
    queryCollection.mockResolvedValue({
      documents: [
        { id: "stamped", createdAt: { _seconds: 9000 } },
        { id: "unstamped" },
      ],
    });

    const { listPersonalItems, PERSONAL_KINDS } = await import("../../src/services/personalService");
    const { items } = await listPersonalItems({ token: "tok", uid: "u1", kind: PERSONAL_KINDS.PHRASE });

    expect(items.map((i) => i.id)).toContain("unstamped");
  });

  it("reports when the page is full, rather than silently truncating", async () => {
    const { PERSONAL_PAGE_LIMIT, listPersonalItems, PERSONAL_KINDS } = await import(
      "../../src/services/personalService"
    );
    queryCollection.mockResolvedValue({
      documents: Array.from({ length: PERSONAL_PAGE_LIMIT }, (_, i) => ({ id: `n${i}` })),
    });

    const { atLimit } = await listPersonalItems({ token: "tok", uid: "u1", kind: PERSONAL_KINDS.PHRASE });
    expect(atLimit).toBe(true);
  });
});

describe("the settings document", () => {
  it("is created with POST and an explicit id, not PUT", async () => {
    const { savePersonalSettings } = await import("../../src/services/personalService");

    await savePersonalSettings({ token: "tok", uid: "u1", patch: { lessonsRemaining: 7 } });

    // PUT and PATCH both 404 on a document that does not exist yet, and it
    // will not exist on a user's first visit. POST-with-an-id merges.
    expect(createDocument).toHaveBeenCalledWith(
      "users/u1/personalSettings",
      { lessonsRemaining: 7 },
      "main",
      "tok",
    );
    expect(patchDocument).not.toHaveBeenCalled();
  });

  it("returns usable defaults when nothing has been saved", async () => {
    getDocument.mockResolvedValue(null);

    const { getPersonalSettings } = await import("../../src/services/personalService");
    const settings = await getPersonalSettings({ token: "tok", uid: "u1" });

    expect(settings).toEqual({
      lessonsRemaining: 0,
      goalLabel: "",
      goalDate: "",
      weeklyTarget: 0,
    });
  });

  it("keeps a stored zero rather than falling back over it", async () => {
    getDocument.mockResolvedValue({ data: { lessonsRemaining: 0, goalLabel: "Lisboa" } });

    const { getPersonalSettings } = await import("../../src/services/personalService");
    const settings = await getPersonalSettings({ token: "tok", uid: "u1" });

    // Zero lessons left is a real, meaningful answer — not a missing value.
    expect(settings.lessonsRemaining).toBe(0);
    expect(settings.goalLabel).toBe("Lisboa");
  });
});

describe("removing", () => {
  it("deletes by id under the right subcollection", async () => {
    const { removePersonalItem, PERSONAL_KINDS } = await import("../../src/services/personalService");

    await removePersonalItem({ token: "tok", uid: "u1", kind: PERSONAL_KINDS.MISTAKE, id: "m1" });

    expect(deleteDocument).toHaveBeenCalledWith("users/u1/personalMistakes", "m1", "tok");
  });
});

describe("the note board", () => {
  it("is one document at a fixed id, not a note per thought", async () => {
    const { saveNoteBoard } = await import("../../src/services/personalService");

    await saveNoteBoard({ token: "tok", uid: "u1", text: "hello" });

    // Same POST-with-an-id upsert as the settings document, and for the same
    // reason: PUT and PATCH 404 until somebody has typed something.
    expect(createDocument).toHaveBeenCalledWith(
      "users/u1/personalNotes",
      { text: "hello" },
      "board",
      "tok",
    );
    expect(patchDocument).not.toHaveBeenCalled();
  });

  it("reads back an empty board before anything has been written", async () => {
    getDocument.mockResolvedValue(null);

    const { getNoteBoard } = await import("../../src/services/personalService");
    const board = await getNoteBoard({ token: "tok", uid: "u1" });

    // An empty string, not null — the textarea is controlled and React warns
    // the moment its value goes undefined.
    expect(board.text).toBe("");
  });

  it("caps what it sends rather than letting the server reject the write", async () => {
    const { saveNoteBoard, NOTE_BOARD_MAX_CHARS } = await import(
      "../../src/services/personalService"
    );

    await saveNoteBoard({ token: "tok", uid: "u1", text: "x".repeat(NOTE_BOARD_MAX_CHARS + 500) });

    expect(createDocument.mock.calls[0][1].text).toHaveLength(NOTE_BOARD_MAX_CHARS);
  });
});
