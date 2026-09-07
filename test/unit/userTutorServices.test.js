import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * userService's seen-id family, and the tutor services.
 *
 * The seen-id helpers are the mechanism CLAUDE.md contrasts with favourites:
 * append-only progress, one id in at a time, and a wholesale reset — with
 * deliberately no "remove one". They are near-identical across six content
 * types, so they are covered as a table; a new one that breaks the pattern
 * fails here rather than quietly diverging.
 */

const currentUser = {
  uid: "u1",
  displayName: "Nuno",
  email: "nuno@example.com",
  getIdToken: vi.fn(async () => "tok"),
};

vi.mock("../../src/firebase", () => ({
  auth: { get currentUser() { return currentUser.value; } },
  default: {},
  getMessagingIfSupported: vi.fn(async () => null),
}));

vi.mock("../../src/services/firestoreService", () => ({
  getDocument: vi.fn(async () => null),
  queryCollection: vi.fn(async () => ({ documents: [], hasMore: false })),
  createDocument: vi.fn(async () => ({ id: "u1" })),
  updateDocument: vi.fn(async () => ({})),
  patchDocument: vi.fn(async () => ({})),
  deleteDocument: vi.fn(async () => ({})),
  getTokenOrAnonymous: vi.fn(async () => "anon-tok"),
}));

beforeEach(() => {
  currentUser.value = currentUser;
  vi.clearAllMocks();
});

describe("userService seen-id family", () => {
  /**
   * [name, getter, marker, resetter, field]
   *
   * Each row is one content type's progress list. The field name matters:
   * `seen*` and `fav*` are different mechanisms on the same document and must
   * never share storage.
   */
  const FAMILIES = [
    ["concepts", "getGlobalSeenIds", "markConceptSeenGlobal", "resetAllSeenWords", "seenConceptIds"],
    [
      "word link",
      "getSeenWordLinkPuzzleIds",
      "markWordLinkPuzzleSeen",
      "resetSeenWordLinkPuzzles",
      "seenWordLinkPuzzleIds",
    ],
    [
      "word ladder",
      "getSeenWordLadderPuzzleIds",
      "markWordLadderPuzzleSeen",
      "resetSeenWordLadderPuzzles",
      "seenWordLadderPuzzleIds",
    ],
    ["stories", "getSeenStoryIds", "markStorySeen", "resetSeenStories", "seenStoryIds"],
    [
      "history facts",
      "getSeenHistoryFactsIds",
      "markHistoryFactSeen",
      "resetSeenHistoryFacts",
      "seenHistoryFactsIds",
    ],
  ];

  /**
   * userService talks to /api/firestore with raw fetch rather than through
   * apiFetch, so the seam is fetch itself. Spying on the module namespace does
   * not work here: the seen-getters call getUserProfile through a module-local
   * binding, which a namespace spy never sees.
   *
   * `writes` collects the PUT bodies so a test can assert what was persisted.
   */
  const harness = (profile = {}) => {
    const writes = [];

    globalThis.fetch = vi.fn(async (url, init = {}) => {
      if ((init.method ?? "GET") === "GET") {
        return { ok: true, status: 200, json: async () => ({ data: { data: profile } }) };
      }
      writes.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });

    return { writes };
  };

  const load = () => import("../../src/services/userService");

  it.each(FAMILIES)("%s: reads an empty list when nothing is stored", async (_n, getter) => {
    harness({});
    const mod = await load();
    expect(await mod[getter]("tok", "u1")).toEqual([]);
  });

  it.each(FAMILIES)("%s: reads stored ids back", async (_n, getter, _m, _r, field) => {
    harness({ [field]: ["a", "b"] });
    const mod = await load();
    expect(await mod[getter]("tok", "u1")).toEqual(["a", "b"]);
  });

  it.each(FAMILIES)("%s: appends without duplicating", async (_n, _g, marker, _r, field) => {
    const { writes } = harness({});
    const mod = await load();

    await mod[marker]("tok", "u1", "x", ["a"]);
    expect(writes[0].data).toEqual({ [field]: ["a", "x"] });

    await mod[marker]("tok", "u1", "a", ["a"]);
    expect(writes[1].data).toEqual({ [field]: ["a"] });
  });

  it.each(FAMILIES)("%s: reset clears the whole list", async (_n, _g, _m, resetter, field) => {
    const { writes } = harness({});
    const mod = await load();

    await mod[resetter]("tok", "u1");
    expect(writes[0].data[field]).toEqual([]);
  });

  it.each(FAMILIES)("%s: writes to the users collection under the given uid", async (_n, _g, marker) => {
    const { writes } = harness({});
    const mod = await load();

    await mod[marker]("tok", "u1", "x", []);
    expect(writes[0].collection).toBe("users");
    expect(writes[0].id).toBe("u1");
  });

  it("stores progress in seen* fields, never in a fav* field", async () => {
    const { writes } = harness({});
    const mod = await load();

    for (const [, , marker] of FAMILIES) {
      await mod[marker]("tok", "u1", "x", []);
    }

    // seen* and fav* live on the same document and are different mechanisms;
    // sharing storage between them is the bug this guards.
    for (const write of writes) {
      for (const key of Object.keys(write.data)) {
        expect(key.startsWith("fav")).toBe(false);
      }
    }
  });

  it("offers no way to un-see a single id", async () => {
    // Deliberate: un-seeing one item is meaningless, and the absence of this
    // is the reason favourites is a separate service.
    const mod = await load();
    const removers = Object.keys(mod).filter((k) => /^(remove|unmark|unsee)/i.test(k));
    expect(removers).toEqual([]);
  });
});

describe("tutorService", () => {
  beforeEach(() => {
    vi.resetModules();
    currentUser.value = currentUser;
  });

  it("only lets the tiers the server accepts call themselves tutors", async () => {
    const { canBeTutor, TUTOR_TIERS } = await import("../../src/services/tutorService");

    for (const tier of TUTOR_TIERS) expect(canBeTutor(tier)).toBe(true);
    for (const tier of ["explorer", "voyager", undefined, null, ""]) {
      expect(canBeTutor(tier)).toBe(false);
    }
  });

  it("mirrors the server's tier list exactly", async () => {
    const { TUTOR_TIERS } = await import("../../src/services/tutorService");
    // The server gate is writeTiers on the `tutors` policy. This list is UI
    // only; if it drifts wider, users get a form that always fails to save.
    expect([...TUTOR_TIERS].sort()).toEqual(["admin", "maestro", "vip"]);
  });

  it("unwraps the queryCollection envelope rather than mapping it directly", async () => {
    const fs = await import("../../src/services/firestoreService");
    fs.queryCollection.mockResolvedValue({
      documents: [{ id: "t1", data: { displayName: "Ana", published: true } }],
      hasMore: false,
    });

    const { listTutors } = await import("../../src/services/tutorService");
    const tutors = await listTutors();

    // `docs.map is not a function` shipped once because this returns an
    // envelope, not an array.
    expect(Array.isArray(tutors)).toBe(true);
    expect(tutors).toHaveLength(1);
  });

  it("refuses to save a profile carrying an unvalidated link", async () => {
    const { saveTutorProfile } = await import("../../src/services/tutorService");

    // Re-checked here as well as in the form, so stale component state cannot
    // publish an unvalidated URL onto a public page.
    await expect(
      saveTutorProfile({
        description: "Teacher",
        links: [{ url: "https://unknown-host.example", label: "My site" }],
      }),
    ).rejects.toThrow(/validated/i);
  });

  it("takes the display name and email from the account, never the form", async () => {
    const fs = await import("../../src/services/firestoreService");
    const { saveTutorProfile } = await import("../../src/services/tutorService");

    const payload = await saveTutorProfile({
      displayName: "Someone Else",
      email: "spoofed@example.com",
      description: "Teacher",
      links: [],
    });

    expect(payload.displayName).toBe("Nuno");
    expect(payload.email).toBe("nuno@example.com");

    // And it writes to the caller's own uid — the server enforces this too
    // via the own-doc-id policy, but sending anything else just 403s.
    const [, , docId] = fs.createDocument.mock.calls[0];
    expect(docId).toBe("u1");
  });

  it("only marks whatsapp when there is a phone number to reach", async () => {
    const { saveTutorProfile } = await import("../../src/services/tutorService");

    const withPhone = await saveTutorProfile({
      description: "d",
      phone: "912345678",
      whatsapp: true,
      links: [],
    });
    expect(withPhone.whatsapp).toBe(true);

    const withoutPhone = await saveTutorProfile({
      description: "d",
      phone: "  ",
      whatsapp: true,
      links: [],
    });
    expect(withoutPhone.whatsapp).toBe(false);
    expect(withoutPhone.phone).toBeNull();
  });

  it("requires a signed-in user", async () => {
    currentUser.value = null;
    const { saveTutorProfile } = await import("../../src/services/tutorService");

    await expect(saveTutorProfile({ description: "d", links: [] })).rejects.toThrow(/signed in/i);
  });

  it("never throws when mirroring a display name", async () => {
    const fs = await import("../../src/services/firestoreService");
    fs.updateDocument.mockRejectedValue(new Error("network"));

    const { syncTutorDisplayName } = await import("../../src/services/tutorService");

    // Failing to mirror a name must not fail the settings save that triggered
    // it.
    await expect(syncTutorDisplayName("u1", "Nuno")).resolves.toBeUndefined();
  });

  it("skips mirroring when there is nothing to mirror", async () => {
    const fs = await import("../../src/services/firestoreService");
    const { syncTutorDisplayName } = await import("../../src/services/tutorService");

    await syncTutorDisplayName("", "Nuno");
    await syncTutorDisplayName("u1", "   ");

    expect(fs.updateDocument).not.toHaveBeenCalled();
  });
});

describe("tutorUrlValidation", () => {
  const load = () => import("../../src/services/tutorUrlValidation");

  it("validates a known platform instantly, with no AI call", async () => {
    const { linkValidation, VALIDATED_BY } = await load();

    const state = linkValidation({ url: "https://calendly.com/nuno/30min", label: "Book" });
    expect(state.ok).toBe(true);
    expect(state.validatedBy).toBe(VALIDATED_BY.KNOWN_PLATFORM);
  });

  it("matches a subdomain of a known platform", async () => {
    const { linkValidation } = await load();
    expect(linkValidation({ url: "https://nuno.youcanbook.me", label: "Book" }).ok).toBe(true);
  });

  it("does not match a lookalike domain", async () => {
    const { linkValidation } = await load();

    // Label-boundary matching: notpreply.com must not inherit preply.com's
    // trust.
    const state = linkValidation({ url: "https://notpreply.com/x", label: "Profile" });
    expect(state.ok).toBe(false);
    expect(state.needsAi).toBe(true);
  });

  it("rejects a non-https URL outright rather than upgrading it", async () => {
    const { linkValidation } = await load();

    const state = linkValidation({ url: "http://calendly.com/nuno", label: "Book" });
    expect(state.ok).toBe(false);
    expect(state.needsAi).toBeUndefined();
  });

  it("returns null for an empty URL, so a blank row is not an error", async () => {
    const { linkValidation } = await load();
    expect(linkValidation({ url: "", label: "" })).toBeNull();
    expect(linkValidation({})).toBeNull();
  });

  it("honours a stored AI verdict only while the URL is unchanged", async () => {
    const { linkValidation, VALIDATED_BY } = await load();

    const link = {
      url: "https://unknown-host.example/me",
      label: "Site",
      validatedAt: "2026-01-01T00:00:00Z",
      validatedUrl: "https://unknown-host.example/me",
      validatedBy: VALIDATED_BY.AI,
    };
    expect(linkValidation(link).ok).toBe(true);

    // Editing the URL must drop the tick rather than carry approval across.
    expect(linkValidation({ ...link, url: "https://somewhere-else.example" }).ok).toBe(false);
  });

  it("requires a label as well as a valid URL before a link counts", async () => {
    const { isLinkValidated } = await load();

    expect(isLinkValidated({ url: "https://calendly.com/x", label: "Book me" })).toBe(true);
    expect(isLinkValidated({ url: "https://calendly.com/x", label: "  " })).toBe(false);
    expect(isLinkValidated({ url: "https://calendly.com/x" })).toBe(false);
  });
});
