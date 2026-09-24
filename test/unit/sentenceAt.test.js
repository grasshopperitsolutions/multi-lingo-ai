import { describe, it, expect } from "vitest";
import { sentenceAt } from "../../src/utils/sentenceAt";
import { tokenizeWords } from "../../src/utils/tokenizeWords";

/**
 * The sentence a tapped word sits in — sent with the lookup, because the
 * sentence is what says which sense the reader met. "foram" is a form of both
 * "ir" and "ser"; out of context a dictionary can only guess.
 */
describe("sentenceAt", () => {
  const PARAGRAPH = "O gato dormia ao sol. Depois, eles foram ao mercado. A tarde acabou cedo.";

  it("returns the sentence containing the position", () => {
    const offset = PARAGRAPH.indexOf("foram");
    expect(sentenceAt(PARAGRAPH, offset, "pt-PT")).toBe("Depois, eles foram ao mercado.");
  });

  it("finds the first and the last sentence too", () => {
    expect(sentenceAt(PARAGRAPH, 2, "pt-PT")).toBe("O gato dormia ao sol.");
    expect(sentenceAt(PARAGRAPH, PARAGRAPH.indexOf("cedo"), "pt-PT")).toBe("A tarde acabou cedo.");
  });

  it("breaks sentences the way the language does, not on a full stop", () => {
    // 。 ends a Japanese sentence; a split on "." would return the paragraph.
    const text = "私は学生です。あなたは先生ですか。";
    expect(sentenceAt(text, text.indexOf("あなた"), "ja-JP")).toBe("あなたは先生ですか。");
  });

  it("keeps a paragraph with no sentence breaks to a window around the word", () => {
    const filler = "palavra ".repeat(120);
    const text = `${filler}alvo ${filler}`;
    const sentence = sentenceAt(text, text.indexOf("alvo"), "pt-PT");

    expect(sentence.length).toBeLessThanOrEqual(400);
    expect(sentence).toContain("alvo");
  });

  it("returns nothing for empty text", () => {
    expect(sentenceAt("", 0, "pt-PT")).toBe("");
    expect(sentenceAt(null, 0, "pt-PT")).toBe("");
  });
});

describe("tokenizeWords — where each token starts", () => {
  it("records each token's position in the paragraph", () => {
    // Which is what lets a tapped word be placed back in its sentence.
    const text = "«Olá»,  eles foram — cedo.";
    for (const token of tokenizeWords(text)) {
      expect(text.slice(token.start, token.start + token.text.length)).toBe(token.text);
    }
  });
});
