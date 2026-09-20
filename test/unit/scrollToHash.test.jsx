import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useScrollToHash } from "../../src/hooks/useScrollToHash";

/**
 * useScrollToHash — landing on the card a link promised.
 *
 * This used to live inside TutorProfileSection, which meant only one of
 * Settings' four `#hash` cards actually scrolled. Moving it to the page made
 * it general; these are the two things that make it work at all.
 *
 * **It retries.** The component most linked to from elsewhere is also the one
 * that renders last — TutorProfileSection paints nothing until its fetch
 * settles — so looking once on mount finds no element precisely where it
 * matters most.
 *
 * **It gives up.** A card that never appears is a tier the viewer does not
 * have. A retry loop with no ceiling would keep hijacking the scroll position
 * for as long as the page stayed open.
 */

const Harness = ({ hash }) => {
  useScrollToHash(hash);
  return null;
};

let scrollTo;

beforeEach(() => {
  scrollTo = vi.fn();
  window.scrollTo = scrollTo;
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function addCard(id) {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

describe("when the target is already there", () => {
  it("scrolls to it", async () => {
    addCard("practiceLanguage");
    render(<Harness hash="#practiceLanguage" />);

    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
  });

  it("leaves a gap rather than sitting flush against the viewport edge", async () => {
    addCard("practiceLanguage");
    render(<Harness hash="#practiceLanguage" />);

    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    // jsdom reports every rect as zero, so the gap is all that can show up —
    // which is the part worth pinning: scrollIntoView takes no offset, and
    // that is the whole reason this does the arithmetic itself.
    expect(scrollTo.mock.calls[0][0].top).toBe(0);
    expect(scrollTo.mock.calls[0][0]).toHaveProperty("behavior");
  });

  it("animates, unless the viewer asked it not to", async () => {
    addCard("practiceLanguage");
    render(<Harness hash="#practiceLanguage" />);
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    expect(scrollTo.mock.calls[0][0].behavior).toBe("smooth");

    scrollTo.mockClear();
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true });
    render(<Harness hash="#practiceLanguage" />);

    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    expect(scrollTo.mock.calls[0][0].behavior).toBe("auto");
  });
});

describe("when the target renders late", () => {
  it("waits for it", async () => {
    render(<Harness hash="#tutorSettings" />);
    expect(scrollTo).not.toHaveBeenCalled();

    // What TutorProfileSection does: nothing at all until its fetch settles.
    addCard("tutorSettings");

    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
  });
});

describe("when there is nothing to scroll to", () => {
  it("does nothing without a hash", async () => {
    addCard("practiceLanguage");
    render(<Harness hash="" />);

    await new Promise((r) => setTimeout(r, 40));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does nothing for a hash naming no card", async () => {
    addCard("practiceLanguage");
    render(<Harness hash="#somewhere-else" />);

    await new Promise((r) => setTimeout(r, 40));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("stops retrying when the component unmounts", async () => {
    const { unmount } = render(<Harness hash="#tutorSettings" />);
    unmount();

    // The card arrives after the page has gone. Scrolling now would yank a
    // viewer who has already navigated somewhere else.
    addCard("tutorSettings");
    await new Promise((r) => setTimeout(r, 60));

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
