import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { makeAppContext } from "../helpers/appContext";
import { pictureUrl } from "../helpers/pictureFixtures";

/**
 * Admin › Pictures: the reported pictures, with Regenerate and Mark as not
 * drawable.
 *
 * Admin copy is English on purpose (the panel is exempt from translation), so
 * these assert on its own words.
 */

const ctx = { current: makeAppContext({ user: { uid: "admin1", token: "tok", subscriptionTier: "admin" } }) };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/firebase", () => ({
  auth: { currentUser: { uid: "admin1", getIdToken: async () => "admin-token" } },
}));

const docs = { current: [] };
const queryCollection = vi.fn(async () => ({ documents: docs.current }));
const patchDocument = vi.fn(async () => ({}));
vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  patchDocument: (...a) => patchDocument(...a),
}));

const regeneratePicture = vi.fn();
vi.mock("../../src/services/getImageService", async (importOriginal) => ({
  ...(await importOriginal()),
  regeneratePicture: (...a) => regeneratePicture(...a),
  clearPictureCache: vi.fn(),
  isOwnPictureUrl: (url) => typeof url === "string" && url.includes("/conceptPictures/"),
}));

const section = async () => {
  const { default: PicturesSection } = await import("../../src/components/admin/PicturesSection");
  return render(<PicturesSection isDarkMode={false} />);
};

beforeEach(() => {
  ctx.current = makeAppContext({ user: { uid: "admin1", token: "tok", subscriptionTier: "admin" } });
  docs.current = [
    { id: "a", status: "ready", url: pictureUrl("a"), sourceWord: "apple", reports: 2 },
    { id: "b", status: "ready", url: pictureUrl("b"), sourceWord: "bat", reports: 7 },
    { id: "c", status: "ready", url: pictureUrl("c"), sourceWord: "cup" },
    { id: "d", status: "ready", url: pictureUrl("d"), sourceWord: "dog", reports: 0 },
    { id: "e", status: "skipped", sourceWord: "ease", reports: 9 },
    { id: "f", status: "failed", sourceWord: "fun" },
    { id: "g", status: "pending", sourceWord: "gap" },
  ];
  for (const mock of [queryCollection, patchDocument, regeneratePicture]) mock.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Admin › Pictures", () => {
  it("counts every status, so a pool that is mostly not drawable is visible at a glance", async () => {
    await section();
    await screen.findByText("Reported pictures");
    const stat = (label) => screen.getByText(label).parentElement.textContent;
    expect(stat("Ready")).toContain("4");
    expect(stat("Not drawable")).toContain("1");
    expect(stat("Declined")).toContain("1");
    expect(stat("Being drawn")).toContain("1");
    expect(stat("Reported")).toContain("2");
  });

  it("lists reported pictures, the most reported first, and no others", async () => {
    await section();
    const list = await screen.findByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector("p").textContent)).toEqual(["bat", "apple"]);
    // Not an unreported one, and not a skipped one whose count is high.
    expect(screen.queryByText("cup")).toBeNull();
    expect(screen.queryByText("ease")).toBeNull();
    expect(rows[0]).toHaveTextContent("7 reports");
  });

  it("sorts in code and asks for no ordering: a query would silently drop a picture with no count", async () => {
    await section();
    await screen.findByText("Reported pictures");
    expect(queryCollection.mock.calls[0][2]).not.toHaveProperty("orderBy");
  });

  it("says so when nothing has been reported", async () => {
    docs.current = [{ id: "a", status: "ready", url: pictureUrl("a"), sourceWord: "apple" }];
    await section();
    expect(await screen.findByText("No picture has been reported.")).toBeTruthy();
  });

  it("regenerates a picture, and says the old one is still in place if it cannot", async () => {
    regeneratePicture.mockResolvedValueOnce(pictureUrl("b"));
    await section();
    const bat = (await screen.findByText("bat")).closest("li");

    fireEvent.click(within(bat).getByRole("button", { name: /Regenerate/ }));

    await waitFor(() => expect(regeneratePicture).toHaveBeenCalledWith("b", "admin-token"));
    await waitFor(() => expect(ctx.current.showAlert).toHaveBeenCalledWith("success", 'Redrew "bat".'));

    regeneratePicture.mockResolvedValueOnce(null);
    fireEvent.click(within(bat).getByRole("button", { name: /Regenerate/ }));
    await waitFor(() =>
      expect(ctx.current.showAlert).toHaveBeenCalledWith("error", expect.stringContaining("The old picture is still in place")),
    );
  });

  it("marks a picture as not drawable, so the games never use the word again", async () => {
    await section();
    const bat = (await screen.findByText("bat")).closest("li");

    fireEvent.click(within(bat).getByRole("button", { name: /Mark as not drawable/ }));

    await waitFor(() =>
      expect(patchDocument).toHaveBeenCalledWith(
        "conceptPictures",
        "b",
        { status: "skipped", picturable: false, skippedBy: "admin" },
        "admin-token",
      ),
    );
    expect(ctx.current.showAlert).toHaveBeenCalledWith("success", expect.stringContaining("bat"));
  });

  it("shows the picture on white, and only one that is on our own bucket", async () => {
    docs.current = [
      { id: "a", status: "ready", url: pictureUrl("a"), sourceWord: "apple", reports: 1 },
      { id: "x", status: "ready", url: "https://evil.example/x.webp", sourceWord: "xylophone", reports: 1 },
    ];
    await section();
    const apple = (await screen.findByText("apple")).closest("li");
    const xylophone = screen.getByText("xylophone").closest("li");
    expect(apple.querySelector("img")).toBeTruthy();
    expect(apple.querySelector("img").parentElement.className).toContain("bg-white");
    expect(xylophone.querySelector("img")).toBeNull();
  });

  it("shows a read error instead of an empty list", async () => {
    queryCollection.mockRejectedValueOnce(new Error("no access"));
    await section();
    expect(await screen.findByText("no access")).toBeTruthy();
  });
});
