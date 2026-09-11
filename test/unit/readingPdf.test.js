import { describe, it, expect } from "vitest";

/**
 * The PDF export for stories and history/culture pieces.
 *
 * The interesting part is not the drawing — it is the font's reach. jsPDF's
 * built-in Helvetica encodes WinAnsi and nothing else, so a reader practising
 * Russian or Thai would get a file full of blanks. These assert that the
 * limit is detected up front rather than discovered in a downloaded file.
 */

const latinStory = {
  title: "A Viagem para o Rio",
  paragraphs: [
    "A Ana quer ver a água e as árvores. Ela viaja de autocarro para o rio com o seu cão.",
    "Junto ao rio, o cão corre na relva verde — e bebe a água fresca.",
  ],
  level: "A1",
  languageLabel: "Português (Portugal)",
};

describe("what the built-in font can print", () => {
  it("accepts Latin scripts, accents and typographic punctuation", async () => {
    const { findUnsupportedCharacters } = await import("../../src/utils/readingPdf");

    // Portuguese, Spanish, French, German and the curly quotes and dashes the
    // AI writes with are all inside WinAnsi.
    expect(findUnsupportedCharacters("Olá, é uma canção — “aspas” e ñ, ü, ç")).toEqual([]);
  });

  it("reports every character it cannot draw, once each", async () => {
    const { findUnsupportedCharacters } = await import("../../src/utils/readingPdf");

    expect(findUnsupportedCharacters("Привет")).toEqual(["П", "р", "и", "в", "е", "т"]);
    // De-duplicated and in first-seen order, so the message can list a few.
    expect(findUnsupportedCharacters("あああい")).toEqual(["あ", "い"]);
  });

  it("answers for a whole piece, title included", async () => {
    const { canExportPdf } = await import("../../src/utils/readingPdf");

    expect(canExportPdf(latinStory)).toBe(true);
    expect(canExportPdf({ title: "Привет", paragraphs: ["мир"] })).toBe(false);
    // A clean body does not rescue a title the font cannot draw.
    expect(canExportPdf({ title: "Привет", paragraphs: ["ola"] })).toBe(false);
  });
});

describe("building the document", () => {
  it("produces a real PDF", async () => {
    const { buildReadingPdf } = await import("../../src/utils/readingPdf");

    const { doc, filename } = await buildReadingPdf(latinStory);

    expect(doc.output("datauristring")).toMatch(/^data:application\/pdf/);
    expect(filename).toBe("a-viagem-para-o-rio.pdf");
  });

  it("names the file from the title, stripped to ASCII", async () => {
    const { buildReadingPdf } = await import("../../src/utils/readingPdf");

    const { filename } = await buildReadingPdf({
      title: "Ação, Café & Pão!",
      paragraphs: ["texto"],
    });

    // Accents are folded rather than dropped, so the name stays readable.
    expect(filename).toBe("acao-cafe-pao.pdf");
  });

  it("falls back to a usable name when the title has nothing ASCII in it", async () => {
    const { buildReadingPdf } = await import("../../src/utils/readingPdf");

    const { filename } = await buildReadingPdf({ title: "!!!", paragraphs: ["texto"] });
    expect(filename).toBe("reading.pdf");
  });

  it("flows onto more pages rather than running off the first", async () => {
    const { buildReadingPdf } = await import("../../src/utils/readingPdf");

    const long = Array.from({ length: 40 }, (_, i) =>
      `Parágrafo ${i}. ${"Uma frase bastante longa para encher a linha toda. ".repeat(4)}`,
    );

    const { doc } = await buildReadingPdf({ title: "Longa", paragraphs: long });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it("builds without the logo when it cannot be fetched", async () => {
    const { buildReadingPdf } = await import("../../src/utils/readingPdf");

    // jsdom has no fetch for the icon, which is the point: a missing mark
    // must degrade to a PDF without one, never to a failed export.
    const { doc } = await buildReadingPdf(latinStory);
    expect(doc.output("datauristring")).toMatch(/^data:application\/pdf/);
  });

  it("sets a paragraph plainly when it cannot start it with a capital", async () => {
    const { buildReadingPdf } = await import("../../src/utils/readingPdf");

    // Opens on punctuation, so there is no letter to enlarge. The paragraph
    // still has to appear — declining the flourish is not declining the text.
    const { doc } = await buildReadingPdf({
      title: "Citação",
      paragraphs: ["«Bom dia», disse ela, e saiu porta fora sem olhar para trás."],
    });

    expect(doc.output("datauristring")).toMatch(/^data:application\/pdf/);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("refuses a script it cannot draw instead of emitting blanks", async () => {
    const { buildReadingPdf } = await import("../../src/utils/readingPdf");

    await expect(
      buildReadingPdf({ title: "Привет", paragraphs: ["мир"] }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_SCRIPT" });
  });
});
