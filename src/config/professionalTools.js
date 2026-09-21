import { FileUser, Mails, WandSparkles } from "lucide-react";

/**
 * professionalTools.js
 *
 * The three tools behind /dashboard/professional-tools, and the register they
 * all share.
 *
 * Kept beside the other config registries rather than inside the menu
 * component, matching favouritableFeatures.js: the hub renders from it, and a
 * fourth tool is one entry here plus a page and a route.
 *
 * React/i18n-free on purpose (titleKey/descKey rather than resolved strings),
 * like dashboardFeatures.js — icons are the only reason this cannot live in
 * Firestore.
 */

/**
 * Three registers. The value travels to the model verbatim as the `{{tone}}`
 * template variable — what it *means* for a given language (tu/você/o senhor
 * in pt-PT, du/Sie in German) belongs in the admin-editable prompt, not in a
 * map here that nobody can fix without a deploy.
 *
 * **It was two, and "formal" was doing the work of both.** Every prompt reads
 * "in a {{tone}} register", so a single formal setting had to cover a cover
 * letter to a hiring committee and a note to a colleague two desks away, and
 * it pitched everything at the first. Splitting it gives the middle — the one
 * most work is actually written in — a name of its own.
 *
 * The values are phrases rather than tokens on purpose: every template
 * interpolates them into a sentence and none of them enumerate the options, so
 * a register that describes itself needs no prompt edit to be understood.
 */
export const TONES = {
  HIGHLY_FORMAL: "highly formal",
  PROFESSIONAL: "professional",
  INFORMAL: "informal",
};

/**
 * The middle one, which is where most professional writing actually sits.
 *
 * This also migrates the old preference for free: `useToneChoice` keeps only a
 * value it still recognises, and the stored `"formal"` is no longer one — so
 * anyone carrying it lands here, which is the setting they wanted when they
 * chose formal.
 */
export const DEFAULT_TONE = TONES.PROFESSIONAL;

/** Where the shared tone preference is kept. See useToneChoice. */
export const TONE_STORAGE_KEY = "mla.proTools.tone";

export const PROFESSIONAL_SECTIONS = [
  {
    id: "cv",
    route: "/dashboard/professional-tools/cv",
    icon: FileUser,
    color: "bg-indigo-400",
    titleKey: "professional.cv_title",
    descKey: "professional.cv_desc",
  },
  {
    id: "email",
    route: "/dashboard/professional-tools/email",
    icon: Mails,
    color: "bg-sky-400",
    titleKey: "professional.email_title",
    descKey: "professional.email_desc",
  },
  {
    id: "tone",
    route: "/dashboard/professional-tools/tone",
    icon: WandSparkles,
    color: "bg-violet-400",
    titleKey: "professional.tone_title",
    descKey: "professional.tone_desc",
  },
];

/**
 * The email tool's three modes. They are variants of one prompt document —
 * `pro-email-prompt` carries a `variants` array keyed by these values, the
 * same way examPromptTemplates picks a variant by key — not three documents.
 */
export const EMAIL_MODES = {
  WRITE: "write",
  REVIEW: "review",
  TRANSLATE: "translate",
};
