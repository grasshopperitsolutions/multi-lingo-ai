/**
 * readingPdf.js
 *
 * Turns a story or a history/culture piece into a PDF the reader can keep.
 *
 * Both surfaces hand over the same shape — a title and an array of paragraphs
 * — so one builder serves both rather than each page growing its own.
 *
 * ## The font, and what it can and cannot print
 *
 * This uses jsPDF's built-in Helvetica, which encodes **WinAnsi (CP1252)**.
 * That covers Latin scripts and their accents — Portuguese, Spanish, French,
 * German, Italian, Dutch, Catalan all print correctly — and nothing else.
 * Cyrillic, Greek, Thai, Japanese, Chinese and a few Central-European
 * diacritics have no glyph in it and come out blank or wrong.
 *
 * A PDF full of blanks is worse than no PDF, so `findUnsupportedCharacters`
 * exists to answer the question *before* anything is generated: the download
 * control asks it and explains itself rather than offering a button that
 * produces an unreadable file.
 *
 * Lifting that limit means embedding a real Unicode TTF (Noto Sans and
 * friends) via `addFileToVFS`/`addFont` and selecting it per script. That is a
 * deliberate piece of work — a font file per script, several hundred KB each,
 * fetched on demand rather than bundled — and the seam for it is
 * `selectFont()` below: give it a font it registered and everything else here
 * keeps working unchanged.
 */

/** A4 portrait, in the millimetres jsPDF is configured with below. */
const PAGE = { width: 210, height: 297 };
const MARGIN = 16;
/** The heavy outer rule that makes the page look like the app. */
const FRAME_INSET = 10;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
/** Where body text has to stop so the footer never collides with it. */
const BODY_BOTTOM = PAGE.height - MARGIN - 10;

const INK = [15, 23, 42];       // slate-900
const YELLOW = [250, 204, 21];  // yellow-400
const MUTED = [100, 116, 139];  // slate-500

/**
 * The printable characters of WinAnsi that sit above Latin-1. Everything at
 * or below U+00FF is already in the encoding.
 */
const WINANSI_HIGH = new Set([
  "€", "‚", "ƒ", "„", "…", "†", "‡", "ˆ",
  "‰", "Š", "‹", "Œ", "Ž", "‘", "’", "“",
  "”", "•", "–", "—", "˜", "™", "š", "›",
  "œ", "ž", "Ÿ",
]);

/**
 * Every character in `text` the built-in font cannot draw, de-duplicated and
 * in the order they first appear.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function findUnsupportedCharacters(text) {
  const missing = [];
  const seen = new Set();

  for (const character of String(text ?? "")) {
    const code = character.codePointAt(0);
    if (code <= 0xff || WINANSI_HIGH.has(character)) continue;
    if (seen.has(character)) continue;
    seen.add(character);
    missing.push(character);
  }

  return missing;
}

/**
 * Whether a piece can be exported at all with the current font.
 *
 * @param {{title?: string, paragraphs?: string[]}} piece
 * @returns {boolean}
 */
export function canExportPdf({ title = "", paragraphs = [] } = {}) {
  return findUnsupportedCharacters([title, ...paragraphs].join("\n")).length === 0;
}

/** Filename-safe slug, ASCII only, so the download name survives every OS. */
function slugify(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip the accents NFD just split off
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "reading";
}

/**
 * The single place a different font would be swapped in. See the header.
 *
 * Times rather than Helvetica: this is a story, and a serif reads like one.
 * It is built into every PDF viewer, so it costs nothing and carries exactly
 * the same WinAnsi limit the module header describes.
 *
 * `label` is the exception — small uppercase running text (the masthead, the
 * meta line, the footer) is set in the sans, because a serif at 8pt with
 * letter-spacing looks like a mistake rather than a choice.
 */
function selectFont(doc, weight, role = "body") {
  doc.setFont(role === "label" ? "helvetica" : "times", weight);
}

/**
 * Times' cap height as a fraction of its point size, used to size a drop cap
 * against the body's line height. Close enough that the capital lands on the
 * last line's baseline; jsPDF exposes no font metrics to read it from.
 */
const TIMES_CAP_HEIGHT_RATIO = 0.662;
const MM_PER_POINT = 25.4 / 72;

/** How many body lines the opening capital spans. */
const CAP_LINES = 3;
/** Breathing room between the capital and the text wrapped beside it. */
const CAP_GUTTER = 2.5;
/** Book convention is an opening capital, not one per paragraph. Flip to taste. */
const CAP_ON_EVERY_PARAGRAPH = false;

const BODY_SIZE = 11.5;
const LINE_HEIGHT = 6.2;
const PARAGRAPH_GAP = 4.5;

/**
 * The app icon, as a data URI jsPDF can embed.
 *
 * Fetched rather than imported so it stays out of the JS bundle, and resolved
 * through BASE_URL so it survives a non-root deploy. Cached after the first
 * read: a reader exporting three stories should fetch it once.
 *
 * Returns null on any failure — a PDF without its logo is still a PDF, and an
 * export that throws because an icon 404'd would be a poor trade.
 */
const LOGO_PIXELS = 128;

let logoPromise = null;

function loadLogo() {
  if (logoPromise) return logoPromise;

  logoPromise = (async () => {
    try {
      const base = import.meta.env?.BASE_URL ?? "/";
      const response = await fetch(`${base}icons/icon-512.png`);
      if (!response.ok) return null;

      const blob = await response.blob();
      const dataUri = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (!dataUri) return null;

      // Re-encode at the size it is actually drawn. The source icon is
      // 512x512, and jsPDF stores an image's decoded pixels — embedding it
      // whole added 1MB (512 x 512 x 4 bytes) to a one-page text document.
      // An 11mm mark needs ~130px at 300dpi, so 128 is already generous.
      return await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = LOGO_PIXELS;
            canvas.height = LOGO_PIXELS;
            canvas.getContext("2d").drawImage(image, 0, 0, LOGO_PIXELS, LOGO_PIXELS);
            resolve(canvas.toDataURL("image/png"));
          } catch {
            resolve(dataUri); // no canvas (jsdom): the full-size icon still works
          }
        };
        image.onerror = () => resolve(null);
        image.src = dataUri;
      });
    } catch {
      // No network, no FileReader (jsdom), a missing file — all the same here.
      return null;
    }
  })();

  return logoPromise;
}

/** Drops the memoised logo. Exists for tests; nothing in the app calls it. */
export function __resetLogoCache() {
  logoPromise = null;
}

/** The heavy border every page carries. */
function drawFrame(doc) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(1.2);
  doc.rect(FRAME_INSET, FRAME_INSET, PAGE.width - FRAME_INSET * 2, PAGE.height - FRAME_INSET * 2);
}

function drawFooter(doc, pageNumber, appName) {
  const y = PAGE.height - MARGIN - 2;

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y - 4, PAGE.width - MARGIN, y - 4);

  selectFont(doc, "bold", "label");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setCharSpace(0.6);
  doc.text(appName.toUpperCase(), MARGIN, y);
  doc.setCharSpace(0);
  doc.text(String(pageNumber), PAGE.width - MARGIN, y, { align: "right" });
}

/**
 * Build the PDF document. Does not download it — see exportReadingPdf.
 *
 * @param {object}   piece
 * @param {string}   piece.title
 * @param {string[]} piece.paragraphs
 * @param {string}   [piece.level]         - CEFR badge, stories only
 * @param {string}   [piece.languageLabel] - e.g. "Português (Portugal)"
 * @param {string}   [piece.appName]       - footer wordmark
 * @returns {Promise<{doc: object, filename: string}>}
 * @throws {Error} when the text needs glyphs the built-in font does not have
 */
export async function buildReadingPdf({
  title,
  paragraphs = [],
  level = "",
  languageLabel = "",
  appName = "Multi Lingo AI",
}) {
  const unsupported = findUnsupportedCharacters([title, ...paragraphs].join("\n"));
  if (unsupported.length > 0) {
    const error = new Error(
      `[readingPdf] ${unsupported.length} character(s) outside the built-in font: ${unsupported.slice(0, 8).join(" ")}`,
    );
    error.code = "UNSUPPORTED_SCRIPT";
    error.characters = unsupported;
    throw error;
  }

  // Loaded on demand: jsPDF is a few hundred KB, and most sessions never
  // export anything. Vite splits it into its own chunk on this import.
  const { jsPDF } = await import("jspdf");
  // compress: deflates the content streams. Without it a page of text plus
  // one image is megabytes rather than tens of kilobytes.
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  let page = 1;
  drawFrame(doc);

  // ── Masthead: the mark, then the wordmark, above the title ───────────────
  const logo = await loadLogo();
  let headerTop = MARGIN;

  if (logo) {
    const LOGO_SIZE = 11;
    doc.addImage(logo, "PNG", MARGIN, headerTop, LOGO_SIZE, LOGO_SIZE);
    selectFont(doc, "bold", "label");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.setCharSpace(0.8);
    doc.text(appName.toUpperCase(), MARGIN + LOGO_SIZE + 4, headerTop + LOGO_SIZE - 3.5);
    doc.setCharSpace(0);
    headerTop += LOGO_SIZE + 7;
  }

  // ── Title block ──────────────────────────────────────────────────────────
  selectFont(doc, "bold");
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(String(title ?? ""), CONTENT_WIDTH - 12);
  const titleBlockHeight = titleLines.length * 9 + 10;

  doc.setFillColor(...YELLOW);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.rect(MARGIN, headerTop, CONTENT_WIDTH, titleBlockHeight, "FD");

  doc.setTextColor(...INK);
  titleLines.forEach((line, index) => {
    doc.text(line, MARGIN + 6, headerTop + 11 + index * 9);
  });

  let cursorY = headerTop + titleBlockHeight + 9;

  // ── Meta line: language and level, whichever exist ───────────────────────
  const meta = [languageLabel, level].filter(Boolean).join("  ·  ");
  if (meta) {
    selectFont(doc, "bold", "label");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.setCharSpace(0.6);
    doc.text(meta.toUpperCase(), MARGIN, cursorY);
    doc.setCharSpace(0);
    cursorY += 9;
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  selectFont(doc, "normal");
  doc.setFontSize(BODY_SIZE);
  doc.setTextColor(...INK);

  /**
   * Lay the opening capital of `text` and return what still has to be drawn.
   *
   * jsPDF has no float and no text flow, so this is done by hand: size the
   * capital to span CAP_LINES body lines, wrap that many lines at a width
   * narrowed by the capital, then hand the remainder back to be set at full
   * width like any other paragraph.
   *
   * Returns null when it declines — a paragraph that doesn't start with a
   * letter, or one where the split can't be reconstructed. The caller then
   * sets it plainly, which is a fine paragraph rather than a broken one.
   */
  const drawDropCap = (text, startY) => {
    const initial = text.trim().charAt(0);
    if (!/\p{L}/u.test(initial)) return null;

    // Measured at the full span first, so the wrap width does not change when
    // the capital is shrunk to fit a short paragraph below.
    const capSize = (CAP_LINES * LINE_HEIGHT) / (MM_PER_POINT * TIMES_CAP_HEIGHT_RATIO);

    selectFont(doc, "bold");
    doc.setFontSize(capSize);
    const capWidth = doc.getTextWidth(initial);

    const body = text.trim().slice(1);
    const narrowWidth = CONTENT_WIDTH - capWidth - CAP_GUTTER;
    if (narrowWidth < CONTENT_WIDTH * 0.35) return null; // a capital that wide leaves no text

    selectFont(doc, "normal");
    doc.setFontSize(BODY_SIZE);
    const narrowLines = doc.splitTextToSize(body, narrowWidth);
    const beside = narrowLines.slice(0, CAP_LINES);
    // A short opening paragraph yields fewer lines than the capital spans,
    // and a three-line capital beside two lines of text leaves it hanging in
    // a hole. Shrink to what is actually there.
    const spannedLines = Math.min(CAP_LINES, beside.length);

    // splitTextToSize breaks on spaces, so the lines it returns rejoin to the
    // original prefix. If they don't — an unusual break, a double space — the
    // remainder can't be trusted, so decline rather than lose or repeat text.
    const consumed = beside.join(" ");
    let rest = "";
    if (beside.length === CAP_LINES) {
      if (!body.startsWith(consumed)) return null;
      rest = body.slice(consumed.length).trimStart();
    }

    // The capital sits on the baseline of the last line it spans.
    const drawnSize = (spannedLines * LINE_HEIGHT) / (MM_PER_POINT * TIMES_CAP_HEIGHT_RATIO);
    selectFont(doc, "bold");
    doc.setFontSize(drawnSize);
    doc.text(initial, MARGIN, startY + (spannedLines - 1) * LINE_HEIGHT);

    selectFont(doc, "normal");
    doc.setFontSize(BODY_SIZE);
    beside.forEach((line, index) => {
      doc.text(line, MARGIN + capWidth + CAP_GUTTER, startY + index * LINE_HEIGHT);
    });

    return { rest, y: startY + beside.length * LINE_HEIGHT };
  };

  for (const [index, paragraph] of paragraphs.entries()) {
    let text = String(paragraph ?? "");

    // Only the opening paragraph gets a capital — that is the book convention,
    // and one per paragraph on a five-paragraph story reads as decoration
    // rather than as a beginning. CAP_ON_EVERY_PARAGRAPH is the switch.
    if ((CAP_ON_EVERY_PARAGRAPH || index === 0) && text.trim()) {
      const laid = drawDropCap(text, cursorY);
      if (laid) {
        cursorY = laid.y;
        text = laid.rest;
        if (!text) {
          cursorY += PARAGRAPH_GAP;
          continue;
        }
      }
    }

    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);

    for (const line of lines) {
      if (cursorY > BODY_BOTTOM) {
        drawFooter(doc, page, appName);
        doc.addPage();
        page += 1;
        drawFrame(doc);
        // addPage resets the graphics state, not the text state — but setting
        // it again keeps this loop honest if the header block above changes.
        selectFont(doc, "normal");
        doc.setFontSize(BODY_SIZE);
        doc.setTextColor(...INK);
        cursorY = MARGIN + 4;
      }

      doc.text(line, MARGIN, cursorY);
      cursorY += LINE_HEIGHT;
    }

    cursorY += PARAGRAPH_GAP;
  }

  drawFooter(doc, page, appName);

  return { doc, filename: `${slugify(title)}.pdf` };
}

/**
 * Build the PDF and hand it to the browser as a download.
 *
 * Split from buildReadingPdf so the document can be produced and inspected
 * without a download being triggered — which is what makes the layout
 * testable at all, since `save()` has no return value to assert on.
 *
 * @param {object} piece - as buildReadingPdf
 * @returns {Promise<string>} the filename written
 */
export async function exportReadingPdf(piece) {
  const { doc, filename } = await buildReadingPdf(piece);
  doc.save(filename);
  return filename;
}
