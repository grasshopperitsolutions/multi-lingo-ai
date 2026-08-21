/**
 * decodeHtmlEntities.js
 *
 * Turns HTML character references in AI output back into real characters.
 *
 * Models generating non-English text sometimes emit entity references instead
 * of literal UTF-8 — "t&acirc;che" rather than "tâche". React escapes by
 * design, so those reach the screen as visible gibberish rather than accents.
 *
 * Delegates to the browser's own HTML parser via a <textarea> element rather
 * than maintaining a hand-rolled entity table. HTML5 defines 2,231 named
 * character references — Greek, Cyrillic, math symbols, arrows — and a custom
 * list only ever covers the subset someone thought to add. The browser's
 * parser already knows all of them, handles the numeric forms, and replicates
 * HTML5's exact (occasionally semicolon-optional) legacy parsing rules, so
 * this needs no maintenance as new scripts or symbols show up in model output.
 *
 * <textarea> specifically — not a <div> or DOMParser — because it has HTML5's
 * "escapable raw text" content model: entity references are decoded, but `<`
 * and `>` inside it are never parsed as tags. A definition containing
 * "a < b" round-trips as literal text instead of losing content, which is
 * exactly the safety property a hand-rolled table was built to preserve.
 */

// A single detached element, reused across every call rather than created and
// thrown away per string. It is never attached to the document, so it costs
// nothing beyond the decode itself.
let _decoder = null;

function _decoderEl() {
  if (!_decoder) _decoder = document.createElement('textarea');
  return _decoder;
}

/**
 * Decode HTML character references in a single string.
 *
 * @param {string} value
 * @returns {string}
 */
export function decodeHtmlEntities(value) {
  if (typeof value !== 'string' || !value.includes('&')) return value;

  const el = _decoderEl();
  el.innerHTML = value;
  return el.value;
}

/**
 * Walk a parsed structure and decode every string it contains, preserving
 * shape. Object keys are decoded too — a model that entity-escapes a value can
 * do the same to a key, and a mangled key silently loses the whole entry.
 *
 * @param {*} node
 * @returns {*} The same shape with strings decoded.
 */
export function decodeEntitiesDeep(node) {
  if (typeof node === 'string') return decodeHtmlEntities(node);
  if (Array.isArray(node)) return node.map(decodeEntitiesDeep);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[decodeHtmlEntities(key)] = decodeEntitiesDeep(value);
    }
    return out;
  }
  return node;
}
