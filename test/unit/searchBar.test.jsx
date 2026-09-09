import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";

/**
 * SearchBar — the shared search + filter control (admin panels and the
 * tutor directory). Covers the threshold that turns a filter group into a
 * dropdown, multiple independent groups, and the clear-everything button.
 */

const mount = async (props) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: SearchBar } = await import("../../src/components/ui/SearchBar");

  return render(
    <I18nextProvider i18n={i18n}>
      <SearchBar isDarkMode={false} {...props} />
    </I18nextProvider>,
  );
};

const options = (n) =>
  Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));

describe("the search input", () => {
  it("reports every keystroke", async () => {
    const onSearchChange = vi.fn();
    const { getByPlaceholderText } = await mount({
      searchValue: "",
      onSearchChange,
      searchPlaceholder: "Search…",
    });

    fireEvent.change(getByPlaceholderText("Search…"), { target: { value: "ana" } });
    expect(onSearchChange).toHaveBeenCalledWith("ana");
  });

  it("can be hidden for a filter-only bar", async () => {
    const { queryByRole } = await mount({ showSearch: false });
    expect(queryByRole("textbox")).toBeNull();
  });
});

describe("a group with five or fewer options", () => {
  it("renders as chips, not a dropdown", async () => {
    const onToggle = vi.fn();
    const { queryByRole, getByText } = await mount({
      filterGroups: [{ id: "g", label: "Group", options: options(5), activeValues: [], onToggle }],
    });

    expect(queryByRole("listbox")).toBeNull();
    fireEvent.click(getByText("Option 2"));
    expect(onToggle).toHaveBeenCalledWith("v2");
  });

  it("shows no group label when it's the only group", async () => {
    const { queryByText } = await mount({
      filterGroups: [{ id: "g", label: "Only Group", options: options(3), activeValues: [], onToggle: vi.fn() }],
    });

    expect(queryByText("Only Group")).toBeNull();
  });

  it("marks an active chip as pressed", async () => {
    const { getByText } = await mount({
      filterGroups: [{ id: "g", label: "Group", options: options(3), activeValues: ["v1"], onToggle: vi.fn() }],
    });

    expect(getByText("Option 1")).toHaveAttribute("aria-pressed", "true");
    expect(getByText("Option 0")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("a group with more than five options", () => {
  it("collapses into a dropdown instead of six-plus chips", async () => {
    const { getByRole, queryByRole } = await mount({
      filterGroups: [{ id: "g", label: "Language", options: options(6), activeValues: [], onToggle: vi.fn() }],
    });

    // Closed: nothing but the trigger button is on screen yet.
    expect(queryByRole("listbox")).toBeNull();
    expect(getByRole("button", { name: /Language/ })).toBeInTheDocument();
  });

  it("opens on click and lists every option", async () => {
    const { getByRole, getByText } = await mount({
      filterGroups: [{ id: "g", label: "Language", options: options(6), activeValues: [], onToggle: vi.fn() }],
    });

    fireEvent.click(getByRole("button", { name: /Language/ }));

    expect(getByRole("listbox")).toBeInTheDocument();
    expect(getByText("Option 5")).toBeInTheDocument();
  });

  it("toggles an option through onToggle and closes on outside click", async () => {
    const onToggle = vi.fn();
    const { getByRole, getByText, container } = await mount({
      filterGroups: [{ id: "g", label: "Language", options: options(6), activeValues: [], onToggle }],
    });

    fireEvent.click(getByRole("button", { name: /Language/ }));
    fireEvent.click(getByText("Option 3"));
    expect(onToggle).toHaveBeenCalledWith("v3");

    fireEvent.mouseDown(document.body);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("shows a count on the trigger once something is active", async () => {
    const { getByRole } = await mount({
      filterGroups: [
        { id: "g", label: "Language", options: options(6), activeValues: ["v0", "v2"], onToggle: vi.fn() },
      ],
    });

    expect(getByRole("button", { name: /Language/ }).textContent).toContain("(2)");
  });

  it("switches from chips to a dropdown right at the boundary", async () => {
    const five = await mount({
      filterGroups: [{ id: "g", label: "G", options: options(5), activeValues: [], onToggle: vi.fn() }],
    });
    expect(five.queryByRole("listbox", { hidden: true })).toBeNull();
    expect(five.container.querySelector('[aria-haspopup="listbox"]')).toBeNull();

    const six = await mount({
      filterGroups: [{ id: "g", label: "G", options: options(6), activeValues: [], onToggle: vi.fn() }],
    });
    expect(six.container.querySelector('[aria-haspopup="listbox"]')).not.toBeNull();
  });
});

describe("multiple filter groups", () => {
  it("shows each group's label once there's more than one", async () => {
    const { getByText } = await mount({
      filterGroups: [
        { id: "a", label: "Tier", options: options(2), activeValues: [], onToggle: vi.fn() },
        { id: "b", label: "Status", options: options(2), activeValues: [], onToggle: vi.fn() },
      ],
    });

    expect(getByText("Tier")).toBeInTheDocument();
    expect(getByText("Status")).toBeInTheDocument();
  });

  it("keeps each group's toggle independent of the other", async () => {
    const onToggleA = vi.fn();
    const onToggleB = vi.fn();
    const { getAllByText } = await mount({
      filterGroups: [
        { id: "a", label: "Tier", options: options(2), activeValues: [], onToggle: onToggleA },
        { id: "b", label: "Status", options: options(2), activeValues: [], onToggle: onToggleB },
      ],
    });

    // Both groups use the same option labels ("Option 0"/"Option 1") — the
    // first match belongs to the first group rendered.
    fireEvent.click(getAllByText("Option 0")[0]);
    expect(onToggleA).toHaveBeenCalledWith("v0");
    expect(onToggleB).not.toHaveBeenCalled();
  });

  it("mixes a chip group and a dropdown group in the same bar", async () => {
    const { getByRole, getByText } = await mount({
      filterGroups: [
        { id: "small", label: "Small", options: options(3), activeValues: [], onToggle: vi.fn() },
        { id: "big", label: "Big", options: options(8), activeValues: [], onToggle: vi.fn() },
      ],
    });

    expect(getByText("Option 0")).toBeInTheDocument(); // a chip from the small group
    expect(getByRole("button", { name: /Big/ })).toBeInTheDocument(); // the big group's dropdown trigger
  });
});

describe("the clear button", () => {
  it("is absent when there is nothing to clear", async () => {
    const { queryByLabelText } = await mount({ searchValue: "", filterGroups: [] });
    expect(queryByLabelText("Limpar")).toBeNull();
  });

  it("appears once there is search text", async () => {
    const { getByLabelText } = await mount({ searchValue: "ana", onSearchChange: vi.fn() });
    expect(getByLabelText("Limpar")).toBeInTheDocument();
  });

  it("appears once a filter is active, even with no search text", async () => {
    const { getByLabelText } = await mount({
      searchValue: "",
      filterGroups: [{ id: "g", label: "G", options: options(2), activeValues: ["v0"], onToggle: vi.fn() }],
    });
    expect(getByLabelText("Limpar")).toBeInTheDocument();
  });

  it("clears the search text and toggles every active filter off", async () => {
    const onSearchChange = vi.fn();
    const onToggle = vi.fn();
    const { getByLabelText } = await mount({
      searchValue: "ana",
      onSearchChange,
      filterGroups: [
        { id: "g", label: "G", options: options(3), activeValues: ["v0", "v2"], onToggle },
      ],
    });

    fireEvent.click(getByLabelText("Limpar"));

    expect(onSearchChange).toHaveBeenCalledWith("");
    expect(onToggle).toHaveBeenCalledWith("v0");
    expect(onToggle).toHaveBeenCalledWith("v2");
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("clears every group, not just the first", async () => {
    const onToggleA = vi.fn();
    const onToggleB = vi.fn();
    const { getByLabelText } = await mount({
      searchValue: "",
      filterGroups: [
        { id: "a", label: "A", options: options(2), activeValues: ["v0"], onToggle: onToggleA },
        { id: "b", label: "B", options: options(2), activeValues: ["v1"], onToggle: onToggleB },
      ],
    });

    fireEvent.click(getByLabelText("Limpar"));

    expect(onToggleA).toHaveBeenCalledWith("v0");
    expect(onToggleB).toHaveBeenCalledWith("v1");
  });
});
