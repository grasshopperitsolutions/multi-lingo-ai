/**
 * sanitizeSvg.js
 *
 * Turns an untrusted SVG string into one that is safe to inject, or into null.
 *
 * Concept icons are written by an AI model into a shared Firestore collection
 * and then rendered with dangerouslySetInnerHTML, which is an XSS sink: SVG can
 * carry <script>, event-handler attributes, <foreignObject> with arbitrary
 * HTML, and external references that phone home. A model is not an attacker,
 * but the wordPool is shared data that more than one writer can reach, and the
 * cost of being wrong here is script execution in every user's session.
 *
 * So this sanitises on READ, at the point of render, rather than only on write.
 * Sanitising on write alone would protect nothing already stored, nothing
 * written by a future code path, and nothing written by hand in the console.
 *
 * The approach is an allowlist, not a blocklist: anything not explicitly named
 * is dropped. Blocklists lose this game — there are too many ways to spell an
 * event handler.
 */

/** Elements that can draw a flat icon. Everything else is removed. */
const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
]);

/**
 * Attributes that describe geometry or flat colour.
 *
 * Deliberately contains nothing that can reference a URL, which is what keeps
 * `href`, `xlink:href`, `src` and friends out without naming them.
 */
const ALLOWED_ATTRS = new Set([
  "viewbox",
  "d",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "fill-rule",
  "clip-rule",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "points",
  "transform",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
]);

/** Longest markup we will accept, well above a flat 24px icon's needs. */
const MAX_LENGTH = 4000;

/**
 * Paint values that reference something else in the document. Gradients and
 * patterns are not on the allowlist, so a url() reference can only point at
 * something that was stripped — or at an element in the host page.
 */
const REFERENCING_PAINT = /url\s*\(/i;

/**
 * Sanitise an SVG string.
 *
 * @param {string|null|undefined} raw
 * @returns {string|null} Safe markup, or null if it cannot be made safe.
 */
export function sanitizeSvg(raw) {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_LENGTH) return null;
  if (!trimmed.startsWith("<svg")) return null;

  // No DOM (a build step, a test runner): refuse rather than guess. Callers
  // fall back to the emoji, so refusing costs a picture, not a feature.
  if (typeof DOMParser === "undefined") return null;

  let doc;
  try {
    doc = new DOMParser().parseFromString(trimmed, "image/svg+xml");
  } catch {
    return null;
  }

  if (doc.querySelector("parsererror")) return null;

  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return null;

  if (!scrub(root)) return null;

  // Size comes from CSS so one icon works at any cell size. A viewBox is what
  // makes that possible, so an icon without one is not usable here.
  root.removeAttribute("width");
  root.removeAttribute("height");
  if (!root.getAttribute("viewBox")) return null;

  return root.outerHTML;
}

/**
 * Strip an element and its subtree down to the allowlist, in place.
 *
 * @param {Element} el
 * @returns {boolean} false if the element itself must be removed.
 */
function scrub(el) {
  if (!ALLOWED_TAGS.has(el.nodeName.toLowerCase())) return false;

  // Copy first: removing an attribute mutates the live NamedNodeMap, which
  // would make a forward loop skip entries.
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    const value = attr.value ?? "";

    // Namespaced attributes carry their own resolution rules; the icon format
    // needs none of them, so they all go.
    if (name.includes(":") || !ALLOWED_ATTRS.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }

    if ((name === "fill" || name === "stroke") && REFERENCING_PAINT.test(value)) {
      el.removeAttribute(attr.name);
    }
  }

  for (const child of [...el.children]) {
    if (!scrub(child)) child.remove();
  }

  // Text nodes, comments and CDATA carry no drawing information here, and a
  // stray one would render as visible glyphs inside the icon.
  for (const node of [...el.childNodes]) {
    if (node.nodeType !== 1) node.remove();
  }

  return true;
}

export default sanitizeSvg;
