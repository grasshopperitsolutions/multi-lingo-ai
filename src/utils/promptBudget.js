import { renderTemplate } from "../services/promptService";

/**
 * promptBudget.js
 *
 * Fits a rendered prompt under the backend's hard character cap.
 *
 * `/api/ask-ai` rejects a prompt longer than MAX_PROMPT_LENGTH (8000) with a
 * 400 — a message the user can do nothing with. The professional tools are the
 * first features that can plausibly hit it: a CV is long, and the template
 * wrapped around it is admin-editable, so a verbose edit in Firestore can push
 * a document that fitted yesterday over the line today.
 *
 * So the budget is measured on the **rendered** string, never estimated from
 * the body alone. Estimating would mean the cap depends on a file this code
 * does not control.
 *
 * Trimming takes from the end of the body. On a CV that costs the oldest jobs
 * and the interests section, which is the right thing to lose; on an email it
 * effectively never triggers.
 */

/**
 * The ceiling this aims at, below the backend's real 8000 so a multi-byte
 * character or a trailing newline cannot tip a "fits" into a 400.
 */
export const PROMPT_BUDGET = 7800;

/**
 * Render `template` with `vars`, trimming `vars[bodyKey]` until the result
 * fits.
 *
 * @param {string} template
 * @param {Record<string, string|number>} vars
 * @param {string} bodyKey - the variable that may be trimmed; everything else
 *   is instruction text and is never touched
 * @param {{ max?: number }} [options]
 * @returns {{ prompt: string, truncated: boolean, usedChars: number, totalChars: number }}
 */
export function fitToPromptBudget(template, vars, bodyKey, { max = PROMPT_BUDGET } = {}) {
  const body = String(vars[bodyKey] ?? "");
  const totalChars = body.length;

  const render = (text) => renderTemplate(template, { ...vars, [bodyKey]: text });

  const full = render(body);
  if (full.length <= max) {
    return { prompt: full, truncated: false, usedChars: totalChars, totalChars };
  }

  // How much has to go, plus a little: re-rendering can change length by more
  // than the trim when a variable appears more than once in the template.
  let keep = Math.max(0, totalChars - (full.length - max));
  let prompt = render(body.slice(0, keep));

  // Converge rather than trusting one subtraction. Bounded, and in practice
  // one or two passes.
  let guard = 0;
  while (prompt.length > max && keep > 0 && guard < 12) {
    keep = Math.max(0, keep - Math.max(64, Math.ceil((prompt.length - max) * 1.1)));
    prompt = render(body.slice(0, keep));
    guard += 1;
  }

  return { prompt, truncated: keep < totalChars, usedChars: keep, totalChars };
}
