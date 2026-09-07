import { describe, it, expect, vi, beforeEach } from "vitest";

import { BASE_KEYS, normalizeChar, resolveLetterKeys, letterKey } from "../../src/utils/letterKeys";
import { tokenizeWords } from "../../src/utils/tokenizeWords";
import { normalizeCode } from "../../src/utils/languageCode";
import { parseAIJSON } from "../../src/utils/parseAIJSON";
import { sanitizeAIError, RateLimitError, authFetch } from "../../src/utils/errorUtils";

/**
 * Pure utilities. These carry real rules — the easy/hard accent rule, what
 * counts as a clickable word, which error text is safe to show a user — and
 * none of them need a browser, a network or a context to exercise.
 */

describe("letterKeys", () => {
  const ptSystem = {
    supportedLanguageCodes: ["pt-PT", "pt-BR"],
    characters: { default: ["a", "b", "c"], special: ["á", "ç"] },
  };

  describe("normalizeChar", () => {
    it("strips diacritics and upper-cases", () => {
      expect(normalizeChar("á")).toBe("A");
      expect(normalizeChar("ç")).toBe("C");
      expect(normalizeChar("õ")).toBe("O");
    });

    it("leaves an unaccented letter alone apart from case", () => {
      expect(normalizeChar("e")).toBe("E");
    });

    it("accepts non-string input without throwing", () => {
      expect(normalizeChar(5)).toBe("5");
    });
  });

  describe("letterKey — the whole easy/hard rule", () => {
    it("easy mode makes an accented and unaccented letter the same key", () => {
      // The point of the shared helper: Hangman and Crosswords must never
      // disagree about whether "E" satisfies "É".
      expect(letterKey("é", false)).toBe(letterKey("E", false));
    });

    it("hard mode keeps them distinct", () => {
      expect(letterKey("é", true)).not.toBe(letterKey("E", true));
    });

    it("hard mode still ignores case", () => {
      expect(letterKey("é", true)).toBe(letterKey("É", true));
    });
  });

  describe("resolveLetterKeys", () => {
    it("uses the writing system's alphabet when one matches the dialect", () => {
      const { base, accented } = resolveLetterKeys([ptSystem], "pt-PT");
      expect(base).toEqual(["A", "B", "C"]);
      expect(accented).toEqual(["Á", "Ç"]);
    });

    it("falls back to A-Z when no system matches", () => {
      const { base, accented } = resolveLetterKeys([ptSystem], "ja-JP");
      expect(base).toEqual(BASE_KEYS);
      expect(accented).toEqual([]);
    });

    it("falls back when the writing systems list is empty or missing", () => {
      expect(resolveLetterKeys([], "pt-PT").base).toEqual(BASE_KEYS);
      expect(resolveLetterKeys(undefined, "pt-PT").base).toEqual(BASE_KEYS);
    });

    it("returns an empty accented list for a system with no specials", () => {
      // Callers must tolerate this — hard mode does not always add keys.
      const plain = { supportedLanguageCodes: ["en-US"], characters: { default: ["a"] } };
      expect(resolveLetterKeys([plain], "en-US").accented).toEqual([]);
    });

    it("ignores a system whose supportedLanguageCodes is not an array", () => {
      const malformed = { supportedLanguageCodes: "pt-PT", characters: { default: ["z"] } };
      expect(resolveLetterKeys([malformed], "pt-PT").base).toEqual(BASE_KEYS);
    });

    it("falls back when the configured default alphabet is empty", () => {
      const empty = { supportedLanguageCodes: ["pt-PT"], characters: { default: [] } };
      expect(resolveLetterKeys([empty], "pt-PT").base).toEqual(BASE_KEYS);
    });
  });
});

describe("tokenizeWords", () => {
  it("returns an empty array for empty input", () => {
    expect(tokenizeWords("")).toEqual([]);
    expect(tokenizeWords(null)).toEqual([]);
    expect(tokenizeWords(undefined)).toEqual([]);
  });

  it("preserves original spacing as its own non-clickable token", () => {
    const tokens = tokenizeWords("olá  mundo");
    expect(tokens.map((t) => t.text).join("")).toBe("olá  mundo");
    expect(tokens.find((t) => t.text === "  ").word).toBeNull();
  });

  it("strips surrounding punctuation into the lookup word", () => {
    const [first] = tokenizeWords("«olá»,");
    expect(first.text).toBe("«olá»,");
    expect(first.word).toBe("olá");
  });

  it("treats accented characters as word characters", () => {
    // The reason for \p{L} rather than \w — \w would strip these to nothing.
    const words = tokenizeWords("ação coração português").map((t) => t.word);
    expect(words).toContain("ação");
    expect(words).toContain("coração");
  });

  it("marks a pure-punctuation token as not clickable", () => {
    const [token] = tokenizeWords("—");
    expect(token.word).toBeNull();
  });

  it("keeps interior punctuation inside the word", () => {
    const [token] = tokenizeWords("bem-vindo");
    expect(token.word).toBe("bem-vindo");
  });
});

describe("normalizeCode", () => {
  it("lower-cases the language and upper-cases the region", () => {
    for (const input of ["en-gb", "EN-GB", "en-GB", " en-gb "]) {
      expect(normalizeCode(input)).toBe("en-GB");
    }
  });

  it("handles a bare language subtag", () => {
    expect(normalizeCode("PT")).toBe("pt");
  });

  it("returns an empty string for non-strings and empties", () => {
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(42)).toBe("");
    expect(normalizeCode("")).toBe("");
  });

  it("keeps a multi-part subtag together", () => {
    expect(normalizeCode("zh-hans-cn")).toBe("zh-HANS-CN");
  });
});

describe("parseAIJSON", () => {
  it("parses plain JSON", () => {
    expect(parseAIJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences models like to add", () => {
    expect(parseAIJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseAIJSON('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("decodes entities after parsing, not before", () => {
    // Decoding first would turn &quot; into a bare quote and break the parse.
    expect(parseAIJSON('{"a":"5 &amp; 6"}')).toEqual({ a: "5 & 6" });
    expect(parseAIJSON('{"a":"say &quot;hi&quot;"}')).toEqual({ a: 'say "hi"' });
  });

  it("passes an already-parsed object straight through the decoder", () => {
    expect(parseAIJSON({ a: "&amp;" })).toEqual({ a: "&" });
  });

  it("throws on empty or unparseable input", () => {
    expect(() => parseAIJSON("")).toThrow();
    expect(() => parseAIJSON("   ")).toThrow();
    expect(() => parseAIJSON("not json")).toThrow();
    expect(() => parseAIJSON(null)).toThrow();
  });
});

describe("sanitizeAIError", () => {
  it.each([
    "Gemini returned 500",
    "OpenAI rate limit",
    "anthropic timeout",
    "GPT-4 refused",
    "vertex ai unavailable",
  ])("replaces a message naming a provider: %s", (msg) => {
    // Which model sits behind the feature is not the user's business, and
    // leaking it in an error string is how it escapes.
    const out = sanitizeAIError(msg);
    expect(out).toBe("AI request failed. Please try again.");
  });

  it("passes through a message that names no provider", () => {
    expect(sanitizeAIError("The text was too long.")).toBe("The text was too long.");
  });

  it("uses the fallback for empty input", () => {
    expect(sanitizeAIError("")).toContain("Something went wrong");
    expect(sanitizeAIError(null)).toContain("Something went wrong");
    expect(sanitizeAIError(undefined, "custom")).toBe("custom");
  });

  it("matches provider names case-insensitively", () => {
    expect(sanitizeAIError("PERPLEXITY is down")).toBe("AI request failed. Please try again.");
  });
});

describe("RateLimitError", () => {
  it("is an Error with a distinguishable name", () => {
    const err = new RateLimitError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RateLimitError");
    expect(err.message).toBe("Daily AI limit reached");
  });

  it("carries a custom message when given one", () => {
    expect(new RateLimitError("nope").message).toBe("nope");
  });
});

describe("authFetch", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("passes the request through and returns the response", async () => {
    const response = { status: 200, ok: true };
    globalThis.fetch.mockResolvedValue(response);

    const onTokenExpired = vi.fn();
    const out = await authFetch("/api/thing", { method: "GET" }, onTokenExpired);

    expect(out).toBe(response);
    expect(onTokenExpired).not.toHaveBeenCalled();
  });

  it("notifies the caller when the session has expired", async () => {
    globalThis.fetch.mockResolvedValue({ status: 401, ok: false });

    const onTokenExpired = vi.fn();
    await authFetch("/api/thing", {}, onTokenExpired);

    expect(onTokenExpired).toHaveBeenCalled();
  });

  it("does not fire the expiry callback on other failures", async () => {
    globalThis.fetch.mockResolvedValue({ status: 500, ok: false });

    const onTokenExpired = vi.fn();
    await authFetch("/api/thing", {}, onTokenExpired);

    expect(onTokenExpired).not.toHaveBeenCalled();
  });
});
