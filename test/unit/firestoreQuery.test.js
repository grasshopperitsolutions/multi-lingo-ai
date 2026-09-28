import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/firebase", () => ({ auth: { currentUser: null } }));

const { queryCollection } = await import("../../src/services/firestoreService");

const okResponse = () =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { documents: [] } }) });

describe("queryCollection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends select as a JSON array when asked for fields", async () => {
    const fetchMock = vi.fn(okResponse);
    vi.stubGlobal("fetch", fetchMock);

    await queryCollection("ttsClips", {}, { select: ["voice", "bytes"] }, "token");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(JSON.parse(url.searchParams.get("select"))).toEqual(["voice", "bytes"]);
  });

  it("leaves select out when no fields are asked for, so whole documents come back", async () => {
    const fetchMock = vi.fn(okResponse);
    vi.stubGlobal("fetch", fetchMock);

    await queryCollection("stories", {}, {}, "token");
    await queryCollection("stories", {}, { select: [] }, "token");

    for (const [url] of fetchMock.mock.calls) {
      expect(new URL(url).searchParams.has("select")).toBe(false);
    }
  });
});
