import { getDocument, patchDocument } from "./firestoreService";
import { BASE_LOCALE } from "../i18n";
import ptTranslation from "../locales/pt/translation.json";

/**
 * Admin editing for the transactional email copy.
 *
 * These are not a separate template store: they are the `email.*` keys of the
 * ordinary locale document, the same ones the API resolves through
 * lib/email-copy.ts. Keeping them there is what makes them translatable —
 * a standalone template collection would sit outside the AI-fill pipeline and
 * every language but one would go stale.
 *
 * Edits are always written to the base locale (pt-PT), because that is the
 * source every other locale is translated from. Reaching the other languages
 * is then the existing force-resync in the Locales section; nothing here
 * writes to them directly. The trade is deliberate and worth knowing: a
 * resync overwrites hand-tuned per-locale wording.
 */

const LOCALES_COLLECTION = "appConfig/config/locales";

/**
 * The editable fields, in the order they are shown. Grouped by the email they
 * belong to so the admin edits "the welcome email" rather than a flat list of
 * dotted keys.
 *
 * This list is intentionally explicit rather than derived from the bundle:
 * `email.*` also holds shared chrome (footer, greeting) that appears in every
 * message, and showing those beside a specific email's subject line would
 * make it look like editing one changes only that one.
 */
export const TEMPLATE_GROUPS = [
  {
    id: "shared",
    label: "Shared chrome",
    hint: "Appears in every email. Changing one of these changes all of them.",
    keys: [
      "email.common.app_name",
      "email.common.greeting",
      "email.common.greeting_fallback",
      "email.common.button_open",
      "email.common.footer_tagline",
      "email.common.footer_prefs",
      "email.common.footer_transactional",
      "email.common.footer_optional",
    ],
  },
  {
    id: "welcome",
    label: "Welcome",
    hint: "Sent once, on a user's first sign-in.",
    keys: ["email.welcome.subject", "email.welcome.heading", "email.welcome.body", "email.welcome.cta"],
  },
  {
    id: "subscription_activated",
    label: "Subscription activated",
    hint: "Sent when a Stripe checkout completes.",
    keys: [
      "email.subscription_activated.subject",
      "email.subscription_activated.heading",
      "email.subscription_activated.body",
      "email.subscription_activated.cta",
    ],
  },
  {
    id: "subscription_cancel_scheduled",
    label: "Cancellation scheduled",
    hint: "Sent when a user schedules a cancellation, not when it takes effect.",
    keys: [
      "email.subscription_cancel_scheduled.subject",
      "email.subscription_cancel_scheduled.heading",
      "email.subscription_cancel_scheduled.body",
      "email.subscription_cancel_scheduled.cta",
    ],
  },
  {
    id: "subscription_ended",
    label: "Subscription ended",
    hint: "Sent when the subscription actually lapses.",
    keys: [
      "email.subscription_ended.subject",
      "email.subscription_ended.heading",
      "email.subscription_ended.body",
      "email.subscription_ended.cta",
    ],
  },
  {
    id: "payment_failed",
    label: "Payment failed",
    hint: "Sent on a failed invoice. Stripe may also send its own dunning mail.",
    keys: [
      "email.payment_failed.subject",
      "email.payment_failed.heading",
      "email.payment_failed.body",
      "email.payment_failed.cta",
    ],
  },
  {
    id: "account_deleted",
    label: "Account deleted",
    hint: "Sent before the data is destroyed, so it can still be addressed.",
    keys: [
      "email.account_deleted.subject",
      "email.account_deleted.heading",
      "email.account_deleted.body",
      "email.account_deleted.cta",
    ],
  },
];

/** Reads a dotted path out of a nested object. */
function readPath(source, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), source);
}

/**
 * Loads the current value of every editable key.
 *
 * Falls back to the bundled pt-PT file per key rather than wholesale: a
 * locale document that predates a template will have some keys and not
 * others, and a missing one should show its shipped default rather than an
 * empty box that would overwrite it with "" on save.
 */
export async function loadEmailTemplates(token) {
  let stored = {};
  try {
    const doc = await getDocument(LOCALES_COLLECTION, BASE_LOCALE, token);
    stored = doc?.data ?? doc ?? {};
  } catch {
    // No document yet — the bundled file is the whole answer.
  }

  const values = {};
  for (const group of TEMPLATE_GROUPS) {
    for (const key of group.keys) {
      values[key] = readPath(stored, key) ?? readPath(ptTranslation, key) ?? "";
    }
  }
  return values;
}

/**
 * Persists only the keys whose value actually changed.
 *
 * Dot-notation keys go through the same PATCH the translation pipeline uses,
 * so this merges into the locale document rather than replacing it — writing
 * the whole `email` object back would clobber any key not listed in
 * TEMPLATE_GROUPS.
 */
export async function saveEmailTemplates(edited, original, token) {
  const patch = {};
  for (const [key, value] of Object.entries(edited)) {
    if (value !== original[key]) patch[key] = value;
  }

  const changedKeys = Object.keys(patch);
  if (changedKeys.length === 0) return { changed: 0, keys: [] };

  await patchDocument(LOCALES_COLLECTION, BASE_LOCALE, patch, token);
  return { changed: changedKeys.length, keys: changedKeys };
}

/**
 * The variables each string may interpolate, for the editor's hint line.
 * Taken from the {{...}} placeholders actually present in the base locale —
 * an editor that dropped one of these would render a literal "{{tier}}" in a
 * real email, so they are worth showing beside the field.
 */
export const TEMPLATE_VARIABLES = {
  "email.common.greeting": ["name"],
  "email.subscription_activated.subject": ["tier"],
  "email.subscription_activated.heading": ["tier"],
  "email.subscription_activated.body": ["tier"],
  "email.subscription_cancel_scheduled.subject": ["date"],
  "email.subscription_cancel_scheduled.body": ["tier", "date"],
};
