import { describe, it, expect } from "vitest";
import {
  DIAL_CODES,
  DEFAULT_DIAL_ISO,
  SUGGESTED_ISOS,
  countryName,
  dialCodeOptions,
  splitPhone,
  joinPhone,
} from "../../src/config/dialCodes";

/**
 * The phone field stores one E.164 string but edits it as two controls, so
 * every keystroke goes through joinPhone and every render through splitPhone.
 * A round-trip that loses digits silently publishes an unreachable number.
 */

describe("dialCodes list", () => {
  it("has a default country that exists in the list", () => {
    expect(DIAL_CODES.some((c) => c.iso === DEFAULT_DIAL_ISO)).toBe(true);
  });

  it("uses unique ISO codes, since that is the key", () => {
    const isos = DIAL_CODES.map((c) => c.iso);
    expect(new Set(isos).size).toBe(isos.length);
  });

  it("allows a shared dial code across countries", () => {
    // +1 is the US and Canada. This is why the ISO code is the key and the
    // dial code is not.
    const plusOne = DIAL_CODES.filter((c) => c.dial === "+1");
    expect(plusOne.length).toBeGreaterThan(1);
  });

  it("writes every dial code in the same shape", () => {
    for (const country of DIAL_CODES) {
      expect(country.dial).toMatch(/^\+\d{1,4}$/);
      expect(country.iso).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("covers the world, not a shortlist", () => {
    // The first version shipped 27 countries chosen around Portuguese, so a
    // tutor elsewhere could not publish a dialable number at all.
    expect(DIAL_CODES.length).toBeGreaterThan(200);
  });

  it("carries no country names — those come from Intl", () => {
    // A hardcoded name list would need re-translating for every locale, which
    // is the thing Intl.DisplayNames exists to avoid.
    for (const country of DIAL_CODES) expect(country.name).toBeUndefined();
  });

  it("marks exactly one primary territory per shared dial code", () => {
    const byDial = new Map();
    for (const country of DIAL_CODES) {
      byDial.set(country.dial, [...(byDial.get(country.dial) ?? []), country]);
    }

    for (const [dial, group] of byDial) {
      if (group.length === 1) continue;
      const primaries = group.filter((c) => c.primary);
      expect(primaries, `${dial} needs one primary`).toHaveLength(1);
    }
  });

  it("suggests only countries that exist in the list", () => {
    for (const iso of SUGGESTED_ISOS) {
      expect(DIAL_CODES.some((c) => c.iso === iso)).toBe(true);
    }
  });
});

describe("localized names", () => {
  it("names a country in the interface language", () => {
    expect(countryName("DE", "pt-PT")).toBe("Alemanha");
    expect(countryName("DE", "en-US")).toBe("Germany");
  });

  it("falls back to the code rather than throwing on a malformed region", () => {
    // Intl throws RangeError on a code that is not two letters. It does NOT
    // throw on a well-formed but unassigned one — "ZZ" comes back as
    // "Região desconhecida" — so the catch is for the malformed case and for
    // engines with no Intl.DisplayNames at all.
    expect(countryName("Z", "pt-PT")).toBe("Z");
    expect(countryName("", "pt-PT")).toBe("");
  });

  it("never returns an empty label for a country actually in the list", () => {
    // The real guarantee: every option in the picker has something readable
    // beside its dial code.
    for (const { iso } of DIAL_CODES) {
      expect(countryName(iso, "pt-PT").trim().length).toBeGreaterThan(0);
    }
  });
});

describe("dialCodeOptions", () => {
  it("puts the suggested countries first, in the order given", () => {
    const { suggested } = dialCodeOptions("pt-PT");
    expect(suggested.map((c) => c.iso)).toEqual([...SUGGESTED_ISOS]);
  });

  it("lists every country in the full group", () => {
    const { rest } = dialCodeOptions("pt-PT");
    expect(rest).toHaveLength(DIAL_CODES.length);
  });

  it("sorts by localized name with a collator, not by code point", () => {
    const { rest } = dialCodeOptions("pt-PT");
    const names = rest.map((c) => c.name);

    const collator = new Intl.Collator("pt-PT");
    expect(names).toEqual([...names].sort(collator.compare));

    // The reason a collator is needed: accented names sort after "Z" under
    // the default comparison, which strands them at the end of the list.
    expect(names.some((n) => /[áàâãéêíóôõúç]/i.test(n))).toBe(true);
  });

  it("re-sorts for a different language", () => {
    const pt = dialCodeOptions("pt-PT").rest.map((c) => c.iso);
    const en = dialCodeOptions("en-US").rest.map((c) => c.iso);

    // Same countries, different order — Alemanha sorts near the top in pt,
    // Germany in the middle in en.
    expect(new Set(pt)).toEqual(new Set(en));
    expect(pt).not.toEqual(en);
  });
});

describe("splitPhone", () => {
  it("splits a stored number into country and national parts", () => {
    expect(splitPhone("+351912345678")).toEqual({ iso: "PT", national: "912345678" });
  });

  it("resolves a shared dial code to its primary territory", () => {
    // +1 is 25 territories. Without the primary flag this returns whichever
    // island happens to come first in the array.
    expect(splitPhone("+15551234567").iso).toBe("US");
    expect(splitPhone("+79161234567").iso).toBe("RU");
    expect(splitPhone("+442071234567").iso).toBe("GB");
  });

  it("prefers the longest matching dial code", () => {
    // +351 must not be read as +3 then "51", and +1 must not swallow a longer
    // code that happens to start the same way.
    expect(splitPhone("+351912345678").iso).toBe("PT");
    expect(splitPhone("+3519").iso).toBe("PT");
  });

  it("ignores spacing in a stored value", () => {
    expect(splitPhone("+351 912 345 678")).toEqual({ iso: "PT", national: "912345678" });
  });

  it("falls back to the default country for an empty value", () => {
    for (const empty of ["", null, undefined]) {
      expect(splitPhone(empty)).toEqual({ iso: DEFAULT_DIAL_ISO, national: "" });
    }
  });

  it("keeps the digits of an unrecognised prefix rather than dropping them", () => {
    // Somebody typed this by hand. Rewriting it silently would lose their
    // only contact detail.
    const { national } = splitPhone("+999123456");
    expect(national).toBe("999123456");
  });
});

describe("joinPhone", () => {
  it("prefixes the dial code of the chosen country", () => {
    expect(joinPhone("PT", "912345678")).toBe("+351912345678");
    expect(joinPhone("BR", "11987654321")).toBe("+5511987654321");
    expect(joinPhone("JP", "9012345678")).toBe("+819012345678");
    expect(joinPhone("NG", "8031234567")).toBe("+2348031234567");
  });

  it("strips anything that is not a digit from what was typed", () => {
    expect(joinPhone("PT", "912 345 678")).toBe("+351912345678");
    expect(joinPhone("PT", "(912) 345-678")).toBe("+351912345678");
  });

  it("returns an empty string when there is no national number", () => {
    // A bare "+351" is not a contact detail, and saving one would render a
    // phone row on the public card that nobody can call.
    expect(joinPhone("PT", "")).toBe("");
    expect(joinPhone("PT", "   ")).toBe("");
    expect(joinPhone("PT", undefined)).toBe("");
  });
});

describe("round trip", () => {
  it.each(DIAL_CODES.map((c) => c.iso))("survives split/join for %s", (iso) => {
    const stored = joinPhone(iso, "912345678");
    const split = splitPhone(stored);

    expect(split.national).toBe("912345678");
    // Not asserting the ISO comes back identical: +1 is both US and CA, so
    // splitPhone can only return one of them. What must hold is that the
    // stored string is stable across another round trip.
    expect(joinPhone(split.iso, split.national)).toBe(stored);
  });
});
