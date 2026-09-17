import ptTranslation from "../locales/pt/translation.json";

/**
 * The transactional email and push-reminder copy, for the admin panel to
 * show. Read-only, and from the bundled base file only — this module makes
 * no request.
 *
 * It used to load and save the `email.*` keys of a pt-PT locale document in
 * Firestore. That document has been deleted and nothing reads it any more.
 * The short version of why: these strings existed in three places — this
 * bundle, the API's EMAIL_COPY_BASE, and that document — and the database
 * copy was the one no pull request could ever be gated on, which is exactly
 * the copy that drifts. It was also, on inspection, an abandoned partial
 * seed: an exact but stale duplicate of this file, missing eight keys and
 * carrying junk at its root from a restructure years ago.
 *
 * So there are two copies now, in two repos that deploy separately and cannot
 * import each other, and CI fails when they disagree (the API's
 * `npm run check:email-copy`, and this repo's advisory counterpart). Changing
 * a template is a code change in this file followed by a deploy.
 *
 * Editing copy per language is unchanged and still lives in the Locales
 * section: a force resync re-translates every other locale from this file.
 */

/**
 * The displayed fields, in the order they are shown. Grouped by the email they
 * belong to so the panel reads as "the welcome email" rather than a flat list
 * of dotted keys.
 *
 * This list is intentionally explicit rather than derived from the bundle:
 * `email.*` also holds shared chrome (footer, greeting) that appears in every
 * message, and showing those beside a specific email's subject line would make
 * it look like they belong to that one. The cost is that a template added to
 * the base file and forgotten here is copy that ships without ever being
 * visible, which is what the test in test/unit/emailTemplates.test.js guards.
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
    id: "reminders",
    label: "Practice reminders",
    hint:
      "Push notifications, not email — at most one a day per person. " +
      "Subject is the notification title, body the line under it.",
    keys: [
      "email.reminders.streak_rescue_subject",
      "email.reminders.streak_rescue_body",
      "email.reminders.lessons_low_subject",
      "email.reminders.lessons_low_body",
      "email.reminders.weekly_review_subject",
      "email.reminders.weekly_review_body",
      "email.reminders.practice_nudge_subject",
      "email.reminders.practice_nudge_body",
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

/** The shipped value for one key, straight from the bundled base file. */
export function bundledTemplateValue(key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), ptTranslation) ?? "";
}

/**
 * Every displayed key's value, as one flat map.
 *
 * `account_deleted.cta` is legitimately "" — that email has no button — so
 * absence and emptiness are not treated as the same thing anywhere here.
 */
export function loadEmailTemplates() {
  const values = {};
  for (const group of TEMPLATE_GROUPS) {
    for (const key of group.keys) values[key] = bundledTemplateValue(key);
  }
  return values;
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
  "email.reminders.streak_rescue_body": ["days"],
  "email.reminders.lessons_low_body": ["n"],
  "email.reminders.weekly_review_body": ["days", "words"],
};
