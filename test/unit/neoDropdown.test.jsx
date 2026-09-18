import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { sortLanguages } from "../../src/services/supportedLanguagesService";

/**
 * NeoDropdown — the app's one value picker, now that it has to cope with lists
 * of 25 languages, 102 dial codes and 418 timezones rather than six CEFR
 * levels.
 *
 * Three behaviours here are decisions rather than details, and each fails
 * quietly if it regresses: the filter box appears on its own past a threshold
 * (so nobody has to remember to ask for it on the next long list), "Other" is
 * exempt from filtering (it is what you need precisely when a search found
 * nothing), and a multiple picker keeps its panel open (otherwise picking four
 * languages is four round trips).
 */

const mount = async (props) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: NeoDropdown } = await import("../../src/components/NeoDropdown");

  return render(
    <I18nextProvider i18n={i18n}>
      <NeoDropdown isDarkMode={false} onChange={() => {}} {...props} />
    </I18nextProvider>,
  );
};

const options = (n) =>
  Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));

const LANGUAGES = [
  { value: "pt-PT", label: "Portuguese (Portugal)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Castilian)" },
  { value: "th-TH", label: "Thai (Thailand)" },
  { value: "ru-RU", label: "Russian (Russia)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "it-IT", label: "Italian" },
  { value: "ca-ES", label: "Açores (test accent)" },
];

/**
 * Open the panel and hand back the listbox.
 *
 * Scoped to this render's own container rather than to `document.body`, which
 * is what the default queries search. Two dropdowns mounted in one test would
 * otherwise both answer to `getAllByRole("button")[0]` and the second would
 * quietly drive the first.
 */
function open(result) {
  const scope = within(result.container);
  fireEvent.click(scope.getAllByRole("button")[0]);
  return scope.getByRole("listbox");
}

describe("when the filter box appears", () => {
  it("stays away on a short list", async () => {
    const result = await mount({ options: options(6), value: "v0" });
    open(result);

    // Six rows do not need a search box; it would be furniture.
    expect(result.queryByRole("textbox")).toBeNull();
  });

  it("appears on its own past the threshold", async () => {
    const result = await mount({ options: options(20), value: "v0" });
    open(result);

    // Automatic rather than opt-in: the lists that most needed this were the
    // ones nobody thought to ask for it on.
    expect(result.getByRole("textbox")).toBeTruthy();
  });

  it("can be forced on below the threshold", async () => {
    const result = await mount({ options: options(3), value: "v0", searchable: true });
    open(result);

    expect(within(result.container).getByRole("textbox")).toBeTruthy();
  });

  it("can be forced off above it", async () => {
    const result = await mount({ options: options(50), value: "v0", searchable: false });
    open(result);

    expect(within(result.container).queryByRole("textbox")).toBeNull();
  });
});

describe("filtering", () => {
  it("narrows the list as you type", async () => {
    const result = await mount({ options: LANGUAGES, value: "pt-PT" });
    const list = open(result);

    fireEvent.change(result.getByRole("textbox"), { target: { value: "portug" } });

    const rows = within(list).getAllByRole("option");
    expect(rows.map((r) => r.textContent)).toEqual([
      "Portuguese (Portugal)",
      "Portuguese (Brazil)",
    ]);
  });

  it("matches the code as well as the label", async () => {
    const result = await mount({ options: LANGUAGES, value: "pt-PT" });
    const list = open(result);

    // A reader who knows the code types the code; one who does not types the
    // name. Both happen on the language pickers.
    fireEvent.change(result.getByRole("textbox"), { target: { value: "pt-BR" } });

    expect(within(list).getAllByRole("option").map((r) => r.textContent)).toEqual([
      "Portuguese (Brazil)",
    ]);
  });

  it("ignores accents in both directions", async () => {
    const result = await mount({ options: LANGUAGES, value: "pt-PT" });
    const list = open(result);

    fireEvent.change(result.getByRole("textbox"), { target: { value: "acores" } });

    expect(within(list).getAllByRole("option").map((r) => r.textContent)).toEqual([
      "Açores (test accent)",
    ]);
  });

  it("says so when nothing matches", async () => {
    const result = await mount({ options: LANGUAGES, value: "pt-PT" });
    open(result);

    fireEvent.change(result.getByRole("textbox"), { target: { value: "klingon" } });

    expect(result.container.textContent.toLowerCase()).toContain("nada encontrado");
  });

  it("keeps Other visible when the search found nothing", async () => {
    const onOtherSelect = vi.fn();
    const result = await mount({
      options: LANGUAGES,
      value: "pt-PT",
      showOtherOption: true,
      otherLabel: "Other",
      onOtherSelect,
    });
    const list = open(result);

    fireEvent.change(result.getByRole("textbox"), { target: { value: "klingon" } });

    // The whole point: an empty search is exactly the moment somebody needs to
    // add the language they were looking for.
    const other = within(list).getByRole("option", { name: "Other" });
    fireEvent.click(other);
    expect(onOtherSelect).toHaveBeenCalled();
  });

  it("forgets the query when the panel closes", async () => {
    const result = await mount({ options: LANGUAGES, value: "pt-PT" });
    open(result);
    fireEvent.change(result.getByRole("textbox"), { target: { value: "portug" } });

    const trigger = result.getAllByRole("button")[0];
    fireEvent.click(trigger); // close
    fireEvent.click(trigger); // reopen

    // A stale filter reads as a list that has lost most of its entries.
    expect(result.getByRole("textbox").value).toBe("");
  });

  it("picks the first match on Enter", async () => {
    const onChange = vi.fn();
    const result = await mount({ options: LANGUAGES, value: "pt-PT", onChange });
    open(result);

    const box = result.getByRole("textbox");
    fireEvent.change(box, { target: { value: "brazil" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("pt-BR");
  });

  it("commits nothing on Enter when nothing matched", async () => {
    const onChange = vi.fn();
    const result = await mount({ options: LANGUAGES, value: "pt-PT", onChange });
    open(result);

    const box = result.getByRole("textbox");
    fireEvent.change(box, { target: { value: "klingon" } });
    fireEvent.keyDown(box, { key: "Enter" });

    // "Other" is a different decision and has to be chosen on purpose.
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("multiple", () => {
  it("hands back the whole array, and toggles", async () => {
    const onChange = vi.fn();
    const result = await mount({
      options: LANGUAGES,
      value: ["pt-PT"],
      multiple: true,
      onChange,
    });
    const list = open(result);

    fireEvent.click(within(list).getByRole("option", { name: /Brazil/ }));
    expect(onChange).toHaveBeenCalledWith(["pt-PT", "pt-BR"]);

    onChange.mockClear();
    fireEvent.click(within(list).getByRole("option", { name: /Portugal/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("stays open so several can be picked in one go", async () => {
    const result = await mount({
      options: LANGUAGES,
      value: ["pt-PT"],
      multiple: true,
    });
    const list = open(result);

    fireEvent.click(within(list).getByRole("option", { name: /Brazil/ }));

    expect(result.queryByRole("listbox")).toBeTruthy();
  });

  it("closes on a single-value pick, unlike multiple", async () => {
    const result = await mount({ options: LANGUAGES, value: "pt-PT" });
    const list = open(result);

    fireEvent.click(within(list).getByRole("option", { name: /Brazil/ }));

    expect(result.queryByRole("listbox")).toBeNull();
  });

  it("summarises the selection when the button is the only view of it", async () => {
    const result = await mount({
      options: LANGUAGES,
      value: ["pt-PT", "fr-FR", "th-TH"],
      multiple: true,
    });

    expect(within(result.container).getAllByRole("button")[0].textContent).toContain("+2");
  });

  it("keeps a given placeholder even once things are selected", async () => {
    const result = await mount({
      options: LANGUAGES,
      value: ["pt-PT", "fr-FR"],
      multiple: true,
      placeholder: "Add a language",
    });

    // A placeholder means the selection is displayed elsewhere — the tutor
    // profile's chips — so repeating it here would cost the button the only
    // text that says what it does.
    const trigger = within(result.container).getAllByRole("button")[0];
    expect(trigger.textContent).toContain("Add a language");
    expect(trigger.textContent).not.toContain("+1");
  });

  it("shows the placeholder rather than Other when nothing is chosen", async () => {
    const result = await mount({
      options: LANGUAGES,
      value: [],
      multiple: true,
      placeholder: "Add a language",
      showOtherOption: true,
      otherLabel: "Other",
    });

    // Without a placeholder this would read "Other", which is the resting
    // label bug the tutor picker used a fake empty option to work around.
    expect(within(result.container).getAllByRole("button")[0].textContent).toContain(
      "Add a language"
    );
  });

  it("marks the listbox as multi-selectable", async () => {
    const result = await mount({ options: LANGUAGES, value: ["pt-PT"], multiple: true });

    expect(open(result).getAttribute("aria-multiselectable")).toBe("true");
  });
});

describe("sortLanguages", () => {
  it("orders by the label a reader actually sees", async () => {
    // Firestore hands these back in document-id order, which is the BCP-47
    // code — so "Swiss German" lands next to "Irish" because `gsw` sorts
    // there, nowhere near German.
    const sorted = sortLanguages([
      { code: "gsw-CH", label: "Swiss German" },
      { code: "ga-IE", label: "Irish (Ireland)" },
      { code: "de-DE", label: "German (Germany)" },
    ]);

    expect(sorted.map((l) => l.code)).toEqual(["de-DE", "ga-IE", "gsw-CH"]);
  });

  it("puts a language's dialects next to each other", async () => {
    // This is what buys the grouping without any headings: the labels are
    // already "Language (Country)", so sorting by them clusters the variants.
    const sorted = sortLanguages([
      { code: "pt-BR", label: "Portuguese (Brazil)" },
      { code: "fr-CA", label: "French (Canada)" },
      { code: "pt-PT", label: "Portuguese (Portugal)" },
      { code: "fr-BE", label: "French (Belgium)" },
    ]);

    expect(sorted.map((l) => l.code)).toEqual(["fr-BE", "fr-CA", "pt-BR", "pt-PT"]);
  });

  it("falls back to the code when a document has no label", async () => {
    const sorted = sortLanguages([{ code: "zz-ZZ" }, { code: "aa-AA" }]);

    expect(sorted.map((l) => l.code)).toEqual(["aa-AA", "zz-ZZ"]);
  });

  it("leaves the input array alone", async () => {
    const input = [{ code: "b", label: "B" }, { code: "a", label: "A" }];
    sortLanguages(input);

    expect(input.map((l) => l.code)).toEqual(["b", "a"]);
  });
});
