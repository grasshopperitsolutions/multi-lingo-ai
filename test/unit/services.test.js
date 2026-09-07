import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Service layer.
 *
 * Everything here goes through `apiFetch`, which unwraps the API's
 * `{ success, data }` envelope. That envelope is the single most repeated
 * source of bugs in this codebase — reading `json.url` instead of
 * `json.data.url` silently broke checkout once, and treating
 * `queryCollection`'s result as an array threw `docs.map is not a function`
 * in the tutor directory. These tests pin the shape at both levels.
 */

const mockFetch = (payload, { ok = true, status = 200 } = {}) => {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
  }));
};

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("apiFetch envelope handling", () => {
  it("returns the inner data, not the envelope", async () => {
    const { apiFetch } = await import("../../src/services/apiClient");
    mockFetch({ success: true, data: { url: "https://checkout" } });

    const out = await apiFetch("/api/stripe");

    expect(out).toEqual({ url: "https://checkout" });
  });

  it("returns undefined when the API sends no data", async () => {
    const { apiFetch } = await import("../../src/services/apiClient");
    mockFetch({ success: true });

    expect(await apiFetch("/api/thing")).toBeUndefined();
  });

  it("throws the API's own error text when the envelope reports failure", async () => {
    const { apiFetch } = await import("../../src/services/apiClient");
    mockFetch({ success: false, error: "Tier does not allow this" });

    await expect(apiFetch("/api/thing")).rejects.toThrow("Tier does not allow this");
  });

  it("throws on a non-ok response even when the body parses", async () => {
    const { apiFetch } = await import("../../src/services/apiClient");
    mockFetch({ error: "Bad request" }, { ok: false, status: 400 });

    await expect(apiFetch("/api/thing")).rejects.toThrow("Bad request");
  });

  it("falls back to the supplied message when the API sends no error text", async () => {
    const { apiFetch } = await import("../../src/services/apiClient");
    mockFetch(null, { ok: false, status: 500 });

    await expect(apiFetch("/api/thing", {}, "Could not load")).rejects.toThrow("Could not load");
  });

  it("JSON-stringifies a plain object body and sets the content type", async () => {
    const { apiFetch } = await import("../../src/services/apiClient");
    mockFetch({ success: true, data: null });

    await apiFetch("/api/thing", { method: "POST", body: { a: 1 } });

    const [, init] = globalThis.fetch.mock.calls[0];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("passes FormData through untouched, without forcing a JSON content type", async () => {
    const { apiFetch } = await import("../../src/services/apiClient");
    mockFetch({ success: true, data: null });

    const form = new FormData();
    form.append("file", "x");
    await apiFetch("/api/storage", { method: "POST", body: form });

    const [, init] = globalThis.fetch.mock.calls[0];
    expect(init.body).toBe(form);
    // Letting fetch set its own multipart boundary is the whole point.
    expect(init.headers?.["Content-Type"]).toBeUndefined();
  });

  it("survives a response body that is not JSON at all", async () => {
    const { apiFetch } = await import("../../src/services/apiClient");
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    }));

    // A Vercel platform 500 returns an HTML page. This must surface as a
    // clean error rather than an unhandled parse rejection.
    await expect(apiFetch("/api/thing", {}, "Upstream down")).rejects.toThrow("Upstream down");
  });
});

describe("firestoreService result shapes", () => {
  it("queryCollection resolves to an envelope with documents, not a bare array", async () => {
    const { queryCollection } = await import("../../src/services/firestoreService");
    mockFetch({ success: true, data: { documents: [{ id: "a", data: {} }], hasMore: false } });

    const result = await queryCollection("tutors", {}, {}, "tok");

    // The tutor directory shipped with `docs.map(...)` against this.
    expect(Array.isArray(result)).toBe(false);
    expect(result.documents).toHaveLength(1);
  });

  it("getDocument resolves to { id, data }, not the fields directly", async () => {
    const { getDocument } = await import("../../src/services/firestoreService");
    mockFetch({ success: true, data: { id: "u1", data: { displayName: "Ana" }, collection: "users" } });

    const doc = await getDocument("users", "u1", "tok");

    expect(doc.id).toBe("u1");
    expect(doc.data.displayName).toBe("Ana");
  });

  it("sends the auth token as a bearer header", async () => {
    const { getDocument } = await import("../../src/services/firestoreService");
    mockFetch({ success: true, data: { id: "u1", data: {} } });

    await getDocument("users", "u1", "tok-123");

    const [, init] = globalThis.fetch.mock.calls[0];
    expect(JSON.stringify(init.headers)).toContain("tok-123");
  });
});

describe("favouritesService", () => {
  const load = () => import("../../src/services/favouritesService");

  it("maps every kind to a distinct fav* field", async () => {
    const { FAVOURITE_KINDS, favouriteFieldFor, ALL_FAVOURITE_FIELDS } = await load();

    const fields = Object.values(FAVOURITE_KINDS).map(favouriteFieldFor);
    expect(new Set(fields).size).toBe(fields.length);
    for (const field of fields) expect(field).toMatch(/^fav/);

    // ALL_FAVOURITE_FIELDS is what AppContext hydrates with; if it drifts from
    // the mapping, a new favourite kind silently never loads.
    expect([...ALL_FAVOURITE_FIELDS].sort()).toEqual([...fields].sort());
  });

  it("never collides with the seen* fields, which are a different mechanism", async () => {
    const { ALL_FAVOURITE_FIELDS } = await load();
    for (const field of ALL_FAVOURITE_FIELDS) expect(field.startsWith("seen")).toBe(false);
  });

  it("throws on an unknown kind rather than writing to undefined", async () => {
    const { favouriteFieldFor } = await load();
    expect(() => favouriteFieldFor("nonsense")).toThrow(/Unknown favourite kind/);
  });

  it("reads ids off a loaded user without touching the network", async () => {
    const { getFavouriteIds, isFavourite, FAVOURITE_KINDS } = await load();
    globalThis.fetch = vi.fn(() => {
      throw new Error("must not fetch");
    });

    const user = { favStoryIds: ["s1", "s2"] };
    expect(getFavouriteIds(user, FAVOURITE_KINDS.STORY)).toEqual(["s1", "s2"]);
    expect(isFavourite(user, FAVOURITE_KINDS.STORY, "s1")).toBe(true);
    expect(isFavourite(user, FAVOURITE_KINDS.STORY, "nope")).toBe(false);
  });

  it("returns an empty array for a missing or malformed field", async () => {
    const { getFavouriteIds, FAVOURITE_KINDS } = await load();

    // Fields are created lazily on first write, so absent is the normal case.
    expect(getFavouriteIds({}, FAVOURITE_KINDS.WORD)).toEqual([]);
    expect(getFavouriteIds(null, FAVOURITE_KINDS.WORD)).toEqual([]);
    expect(getFavouriteIds({ favWordIds: "oops" }, FAVOURITE_KINDS.WORD)).toEqual([]);
  });

  it("returns the profile's own array by reference, keeping the identity stable", async () => {
    const { getFavouriteIds, FAVOURITE_KINDS } = await load();
    const user = { favWordIds: ["w1"] };

    // Load-bearing: useFeatureFavourites puts this straight into a useCallback
    // dependency list, so a fresh copy per call would rebuild that callback on
    // every render. The flip side is that callers must not mutate the result —
    // the doc comment on getFavouriteIds spells that out.
    expect(getFavouriteIds(user, FAVOURITE_KINDS.WORD)).toBe(
      getFavouriteIds(user, FAVOURITE_KINDS.WORD),
    );
  });

  it("gives a distinct empty array when the field is absent", async () => {
    const { getFavouriteIds, FAVOURITE_KINDS } = await load();

    // No shared frozen constant to accidentally mutate across users.
    const a = getFavouriteIds({}, FAVOURITE_KINDS.WORD);
    const b = getFavouriteIds({}, FAVOURITE_KINDS.WORD);
    expect(a).toEqual([]);
    expect(a).not.toBe(b);
  });

  describe("add / remove / toggle", () => {
    let userService;

    beforeEach(async () => {
      vi.resetModules();
      vi.doMock("../../src/services/userService", () => ({
        updateUserProfile: vi.fn(async () => ({})),
      }));
      userService = await import("../../src/services/userService");
    });

    const args = (overrides) => ({
      token: "tok",
      uid: "u1",
      kind: "story",
      id: "s2",
      currentIds: ["s1"],
      ...overrides,
    });

    it("adds without duplicating an id already present", async () => {
      const { addFavourite } = await import("../../src/services/favouritesService");

      expect(await addFavourite(args())).toEqual(["s1", "s2"]);
      expect(await addFavourite(args({ id: "s1" }))).toEqual(["s1"]);
    });

    it("removes one id and leaves the rest", async () => {
      const { removeFavourite } = await import("../../src/services/favouritesService");

      // The half the seen-id helpers deliberately lack.
      expect(await removeFavourite(args({ id: "s1", currentIds: ["s1", "s2"] }))).toEqual(["s2"]);
    });

    it("removing an absent id is a no-op rather than an error", async () => {
      const { removeFavourite } = await import("../../src/services/favouritesService");
      expect(await removeFavourite(args({ id: "gone" }))).toEqual(["s1"]);
    });

    it("toggle adds when absent and removes when present", async () => {
      const { toggleFavourite } = await import("../../src/services/favouritesService");

      const added = await toggleFavourite(args());
      expect(added).toEqual({ ids: ["s1", "s2"], isFavourite: true });

      const removed = await toggleFavourite(args({ id: "s1" }));
      expect(removed).toEqual({ ids: [], isFavourite: false });
    });

    it("persists through updateUserProfile — no new endpoint", async () => {
      const { addFavourite } = await import("../../src/services/favouritesService");
      await addFavourite(args());

      expect(userService.updateUserProfile).toHaveBeenCalledWith("tok", "u1", {
        favStoryIds: ["s1", "s2"],
      });
    });

    it("refuses to write without an id", async () => {
      const { addFavourite, removeFavourite } = await import(
        "../../src/services/favouritesService"
      );

      await expect(addFavourite(args({ id: "" }))).rejects.toThrow(/id is required/);
      await expect(removeFavourite(args({ id: undefined }))).rejects.toThrow(/id is required/);
      expect(userService.updateUserProfile).not.toHaveBeenCalled();
    });
  });
});
