import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";

import Avatar from "../../src/components/Avatar";

/**
 * Avatar — a picture that will not load shows the app's own placeholder.
 *
 * A profile keeps the sign-in provider's picture as a link to the provider's
 * server, and nothing notices when that link stops working. Without the
 * fallback, a dead link rendered as a broken image in the header, the menu,
 * Settings and the tutor directory.
 */

const renderAvatar = async (props) => {
  const { default: i18n } = await import("../../src/i18n");
  return render(
    <I18nextProvider i18n={i18n}>
      <Avatar alt="Ana" {...props} />
    </I18nextProvider>,
  );
};

const GOOGLE = "https://lh3.googleusercontent.com/a/dead-link";
const STORAGE = "https://storage.googleapis.com/bucket/avatars/u1/1_me.png";

describe("Avatar", () => {
  it("shows the picture without sending the page's address", async () => {
    const { container } = await renderAvatar({ src: STORAGE });
    const img = container.querySelector("img");
    expect(img.getAttribute("src")).toBe(STORAGE);
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("shows the placeholder when there is no picture", async () => {
    const { container } = await renderAvatar({ src: undefined });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("swaps a picture that fails to load for the placeholder", async () => {
    const { container } = await renderAvatar({ src: GOOGLE });
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("treats Google's no-photo picture as no picture", async () => {
    // It loads fine, so the load-failure fallback never sees it: a Workspace
    // account with no photo showed Google's blue figure instead of ours.
    for (const size of ["s96-c", "s256-c"]) {
      const { container, unmount } = await renderAvatar({
        src: `https://lh3.googleusercontent.com/a/default-user=${size}`,
      });
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("still shows a real Google photo", async () => {
    const real = "https://lh3.googleusercontent.com/a/ACg8ocL-real-photo=s96-c";
    const { container } = await renderAvatar({ src: real });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(real);
  });

  it("tries a new picture afresh after an old one failed", async () => {
    // Uploading a photo in Settings changes the link; the failure of the old
    // one must not hide the new one.
    const { container, rerender } = await renderAvatar({ src: GOOGLE });
    fireEvent.error(container.querySelector("img"));

    const { default: i18n } = await import("../../src/i18n");
    rerender(
      <I18nextProvider i18n={i18n}>
        <Avatar alt="Ana" src={STORAGE} />
      </I18nextProvider>,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(STORAGE);
  });
});
