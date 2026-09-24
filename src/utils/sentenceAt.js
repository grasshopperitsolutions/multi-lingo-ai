/**
 * sentenceAt.js
 *
 * The sentence that contains a given position in a paragraph — what a reader
 * was looking at when they tapped a word, sent with the lookup so the
 * dictionary can describe the word as it is used there rather than in general.
 * "foram" is a form of both "ir" and "ser"; only the sentence says which.
 *
 * `Intl.Segmenter` rather than splitting on punctuation: it is the browser's
 * own locale-aware sentence breaking, so it knows that "Sr." is not the end of
 * a sentence in Portuguese and that 。 ends one in Japanese — the same reason
 * TTS accent names and the timezone list come from Intl instead of a table.
 */

/**
 * Longer than any sentence a graded tale should contain. A paragraph with no
 * sentence breaks at all comes back whole, and this keeps that from sending
 * the entire paragraph — the window is centred on the word instead.
 */
const MAX_SENTENCE_CHARS = 400;

/**
 * @param {string} text     - the paragraph
 * @param {number} offset   - character index of the tapped word within it
 * @param {string} [locale] - BCP-47 language of the text
 * @returns {string} the sentence, trimmed; '' for empty text
 */
export function sentenceAt(text, offset, locale) {
  const source = String(text ?? '');
  if (!source.trim()) return '';

  let sentence = source;
  let sentenceStart = 0;

  try {
    const segmenter = new Intl.Segmenter(locale || undefined, { granularity: 'sentence' });
    for (const { segment, index } of segmenter.segment(source)) {
      if (offset >= index && offset < index + segment.length) {
        sentence = segment;
        sentenceStart = index;
        break;
      }
    }
  } catch {
    // No Segmenter, or a locale it rejects: the paragraph is still better
    // context than none, and the window below keeps it bounded.
  }

  if (sentence.length > MAX_SENTENCE_CHARS) {
    const local = Math.max(0, offset - sentenceStart);
    const from = Math.max(0, Math.min(local - MAX_SENTENCE_CHARS / 2, sentence.length - MAX_SENTENCE_CHARS));
    sentence = sentence.slice(from, from + MAX_SENTENCE_CHARS);
  }

  return sentence.trim();
}
