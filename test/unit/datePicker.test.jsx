import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";

/**
 * DatePicker: the calendar that replaced <input type="date">.
 *
 * The value contract is the thing worth pinning: a `YYYY-MM-DD` string in and
 * out, "" for none, so every caller that stored the native input's value keeps
 * working. The popover lives in a portal, so queries go through `screen`.
 */

const mount = async (props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: DatePicker } = await import("../../src/components/ui/DatePicker");
  const onChange = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <DatePicker id="d" value="" onChange={onChange} isDarkMode={false} {...props} />
    </I18nextProvider>,
  );
  return { onChange, trigger: screen.getByRole("button", { expanded: false }) };
};

describe("DatePicker", () => {
  it("opens a calendar on the selected month and picks a day as YYYY-MM-DD", async () => {
    const { onChange, trigger } = await mount({ value: "2026-10-15" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.querySelector('[data-date="2026-10-20"]'));

    expect(onChange).toHaveBeenCalledWith("2026-10-20");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks the selected day", async () => {
    const { trigger } = await mount({ value: "2026-10-15" });
    fireEvent.click(trigger);
    const selected = within(screen.getByRole("dialog")).getAllByRole("button", { pressed: true });
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute("data-date")).toBe("2026-10-15");
  });

  it("turns the month with the arrows", async () => {
    const { onChange, trigger } = await mount({ value: "2026-10-15" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Mês seguinte" }));
    fireEvent.click(screen.getByRole("dialog").querySelector('[data-date="2026-11-03"]'));
    expect(onChange).toHaveBeenCalledWith("2026-11-03");
  });

  it("will not pick outside min and max", async () => {
    const { onChange, trigger } = await mount({ value: "2026-10-15", min: "2026-10-10", max: "2026-10-20" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const early = dialog.querySelector('[data-date="2026-10-05"]');
    expect(early.disabled).toBe(true);
    fireEvent.click(early);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears to an empty string", async () => {
    const { onChange, trigger } = await mount({ value: "2026-10-15" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("moves by a day or a week with the arrow keys, and closes on Escape", async () => {
    const { onChange, trigger } = await mount({ value: "2026-10-15" });
    fireEvent.click(trigger);
    const day = screen.getByRole("dialog").querySelector('[data-date="2026-10-15"]');
    fireEvent.keyDown(day, { key: "ArrowDown" });
    expect(screen.getByRole("dialog").querySelector('[data-date="2026-10-22"]').tabIndex).toBe(0);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes when clicking outside", async () => {
    const { trigger } = await mount({ value: "2026-10-15" });
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
