/**
 * pdfText.js
 *
 * Client-side PDF → plain text, used by the Grammar "Ask AI" tool so a learner
 * can ask about a worksheet or handout.
 *
 * Extraction happens in the browser rather than server-side because the
 * backend's /api/ask-ai accepts text only — `askGemini` builds text-only parts
 * and caps prompts at 8000 characters, so a base64 PDF could never be sent.
 * Pulling the words out here keeps the whole feature inside the existing
 * endpoint.
 *
 * pdfjs-dist is imported dynamically: it is a large library, and most users
 * never open a PDF. This keeps it out of the main bundle.
 */

/** Matches the backend's MAX_PROMPT_LENGTH headroom, leaving room for the prompt itself. */
export const MAX_PDF_CHARS = 4000;

/**
 * Extract text from a PDF file.
 *
 * @param {File} file
 * @param {{ maxChars?: number }} [options]
 * @returns {Promise<{ text: string, pages: number, truncated: boolean }>}
 */
export async function extractPdfText(file, { maxChars = MAX_PDF_CHARS } = {}) {
  if (!file) throw new Error('[pdfText] file is required');

  const pdfjs = await import('pdfjs-dist');
  // Vite resolves this to a served URL; without it pdf.js tries to load the
  // worker from a path that doesn't exist in the built app.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const chunks = [];
  let total = 0;
  let truncated = false;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str ?? '').join(' ').replace(/\s+/g, ' ').trim();

    if (!pageText) continue;

    if (total + pageText.length > maxChars) {
      chunks.push(pageText.slice(0, Math.max(0, maxChars - total)));
      truncated = true;
      break;
    }

    chunks.push(pageText);
    total += pageText.length;
  }

  const text = chunks.join('\n\n').trim();

  if (!text) {
    // A scanned PDF is images, not text. Say so rather than sending an empty
    // string and letting the model answer a question about nothing.
    throw new Error('No selectable text found in this PDF. It may be a scan.');
  }

  return { text, pages: doc.numPages, truncated };
}
