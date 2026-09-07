import { askAI } from "./aiService";
import { parseTutorUrl, matchKnownPlatform } from "../config/tutorPlatforms";

/**
 * Validates the links on a tutor profile.
 *
 * Two routes, in order of cost:
 *
 * 1. `matchKnownPlatform` — synchronous, free, no network. Covers the links
 *    tutors actually use most (Calendly, Preply, Instagram, a Maps pin).
 * 2. `validateUrlWithAi` — one AI call, only for a host we don't recognise,
 *    and only when the tutor presses the button. Never automatic: it should
 *    be obvious that pressing it is what spends the call.
 *
 * Only Explorer and Voyager have AI quotas (api/ask-ai.ts), and only
 * Maestro/VIP/admin can be tutors, so this is free for everyone who can
 * reach it. That is why a per-link manual check is affordable at all.
 *
 * The AI verdict is advisory. A "no" explains itself and can be retried or
 * overridden by editing the URL — arbitrary links are allowed by design,
 * since we are affiliated with no platform.
 */

export const VALIDATED_BY = {
  KNOWN_PLATFORM: "known-platform",
  AI: "ai",
};

/** Reasons parseTutorUrl can reject, mapped to i18n keys for the UI. */
export const URL_ERROR_KEYS = {
  empty: "tutors.url_error_empty",
  malformed: "tutors.url_error_malformed",
  not_https: "tutors.url_error_not_https",
};

/**
 * The state of one link row, derived from the row itself.
 *
 * Deliberately a pure function of the link rather than something computed in
 * an onBlur handler and stashed in state. The first version did the latter and
 * a recognised host could stay marked "needs validation": the handler closed
 * over the links array from an earlier render, so whether it saw the URL at
 * all depended on event timing. Deriving it during render cannot go stale, and
 * removes the whole class of bug.
 *
 * The AI verdict still has to be stored — it is the result of a network call —
 * but it is only trusted while `validatedUrl` matches the URL as it stands, so
 * editing a URL after validating it drops the tick rather than carrying a
 * stale approval onto a different destination.
 *
 * @param {{ url?: string, label?: string, platform?: string, validatedBy?: string, validatedAt?: string, validatedUrl?: string }} link
 * @returns {{ ok: boolean, platform?: string, validatedBy?: string, needsAi?: boolean, errorKey?: string } | null}
 *   null when the row is blank — an empty row is neither valid nor an error.
 */
export function linkValidation(link) {
  const url = link?.url?.trim();
  if (!url) return null;

  const parsed = parseTutorUrl(url);
  if (!parsed.ok) return { ok: false, errorKey: URL_ERROR_KEYS[parsed.reason] };

  const platform = matchKnownPlatform(url);
  if (platform) {
    return { ok: true, platform, validatedBy: VALIDATED_BY.KNOWN_PLATFORM };
  }

  if (link.validatedAt && link.validatedUrl === url) {
    return { ok: true, platform: link.platform, validatedBy: link.validatedBy };
  }

  return { ok: false, needsAi: true };
}

/**
 * Builds the classification prompt. Kept separate so a test can assert the
 * shape without an AI call, and so the wording lives in one place.
 *
 * Deliberately not built from locale strings: this is a machine-to-machine
 * instruction, not user-facing copy, and translating it would change the
 * model's behaviour per language.
 */
function buildPrompt(url) {
  return [
    "You are validating a link a language tutor wants to show on their public profile.",
    "",
    `URL: ${url}`,
    "",
    "Decide whether this looks like a legitimate destination for a tutor to share:",
    "a personal or professional website, a social or video profile, a booking or",
    "scheduling page, a language-learning marketplace, a map location, or a payment",
    "or newsletter page. Tutors may link to any platform.",
    "",
    "Reject only if the URL looks like malware, adult content, a phishing or",
    "credential-harvesting page, or is plainly unrelated to teaching or contacting",
    "a person.",
    "",
    'Reply with JSON only, no markdown fence: {"ok": true|false, "platform": "<short name or empty>", "reason": "<one short sentence>"}',
  ].join("\n");
}

/**
 * Extracts the JSON verdict from a model reply.
 *
 * Models wrap JSON in prose or a fenced block often enough that parsing the
 * whole reply is unreliable — the first balanced object is what we want.
 */
function parseVerdict(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * The paid check, for hosts `validateLocally` didn't recognise.
 *
 * Never throws: a failed AI call is reported as an un-validated link with a
 * reason, so the tutor can retry rather than being shown a stack trace.
 *
 * @param {string} token - Firebase ID token
 * @param {string} url
 * @returns {Promise<{ ok: boolean, platform?: string, reason?: string, validatedBy?: string, validatedAt?: string }>}
 */
export async function validateUrlWithAi(token, url) {
  const parsed = parseTutorUrl(url);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }

  try {
    const result = await askAI(
      token,
      buildPrompt(parsed.url.toString()),
      { provider: "openai" },
      // The tutor already pressed a button that says "Validate" — a second
      // confirmation dialog on top of that is noise.
      { skipConfirm: true, timeout: 20000 },
    );

    const verdict = parseVerdict(result?.text ?? result?.content ?? result);
    if (!verdict || typeof verdict.ok !== "boolean") {
      return { ok: false, reason: "unreadable_verdict" };
    }

    if (!verdict.ok) {
      return { ok: false, reason: verdict.reason || "rejected" };
    }

    return {
      ok: true,
      platform: verdict.platform || parsed.url.hostname.replace(/^www\./, ""),
      reason: verdict.reason,
      validatedBy: VALIDATED_BY.AI,
      validatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, reason: err?.message || "ai_unavailable" };
  }
}

/**
 * Whether a link row is ready to be saved: validated, and carrying the short
 * description that is shown next to it on the public page.
 *
 * @param {object} link
 * @returns {boolean}
 */
export function isLinkValidated(link) {
  if (!link?.label?.trim()) return false;
  return linkValidation(link)?.ok === true;
}
