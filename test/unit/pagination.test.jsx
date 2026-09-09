import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";

/**
 * Pagination — generic page controls, built for the tutor directory but
 * deliberately free of anything tutor-specific (see the component's own
 * header). Purely presentational: page/totalPages in, onChange out.
 */

const mount = async (props) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: Pagination } = await import("../../src/components/ui/Pagination");

  return render(
    <I18nextProvider i18n={i18n}>
      <Pagination isDarkMode={false} {...props} />
    </I18nextProvider>,
  );
};

describe("Pagination", () => {
  it("renders nothing for a single page", async () => {
    const { container } = await mount({ page: 1, totalPages: 1, onChange: vi.fn() });
    expect(container.textContent.trim()).toBe("");
  });

  it("renders nothing for zero pages", async () => {
    const { container } = await mount({ page: 1, totalPages: 0, onChange: vi.fn() });
    expect(container.textContent.trim()).toBe("");
  });

  it("disables the previous arrow on the first page", async () => {
    const { container } = await mount({ page: 1, totalPages: 5, onChange: vi.fn() });
    const [prev] = container.querySelectorAll("button");
    expect(prev.disabled).toBe(true);
  });

  it("disables the next arrow on the last page", async () => {
    const { container } = await mount({ page: 5, totalPages: 5, onChange: vi.fn() });
    const buttons = [...container.querySelectorAll("button")];
    const next = buttons[buttons.length - 1];
    expect(next.disabled).toBe(true);
  });

  it("marks the current page with aria-current", async () => {
    const { container } = await mount({ page: 3, totalPages: 5, onChange: vi.fn() });
    const current = container.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe("3");
  });

  it("reports the next page number when the arrow is clicked", async () => {
    const onChange = vi.fn();
    const { container } = await mount({ page: 2, totalPages: 5, onChange });

    const buttons = [...container.querySelectorAll("button")];
    buttons[buttons.length - 1].click();

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("reports the previous page number when that arrow is clicked", async () => {
    const onChange = vi.fn();
    const { container } = await mount({ page: 2, totalPages: 5, onChange });

    const [prev] = container.querySelectorAll("button");
    prev.click();

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("jumps straight to a clicked page number", async () => {
    const onChange = vi.fn();
    // page 1 of 5: 1, 2 and 5 are all visible (edges + the current page's
    // neighbour) without needing to reason about which are collapsed.
    const { getByText } = await mount({ page: 1, totalPages: 5, onChange });

    getByText("2").click();

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("collapses a long run of pages with an ellipsis", async () => {
    const { container } = await mount({ page: 1, totalPages: 20, onChange: vi.fn() });

    expect(container.textContent).toContain("…");
    // First and last stay on screen — the middle is elided, not truncated.
    const pageNumbers = [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(pageNumbers).toContain("1");
    expect(pageNumbers).toContain("20");
    expect(pageNumbers).not.toContain("10");
  });

  it("shows every page with no ellipsis when there are few", async () => {
    const { container } = await mount({ page: 2, totalPages: 4, onChange: vi.fn() });
    expect(container.textContent).not.toContain("…");
    for (const n of ["1", "2", "3", "4"]) {
      expect([...container.querySelectorAll("button")].some((b) => b.textContent === n)).toBe(true);
    }
  });
});
