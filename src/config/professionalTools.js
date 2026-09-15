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
 * Formal or informal. The value travels to the model verbatim as the
 * `{{tone}}` template variable — what "formal" *means* for a given language
 * (tu/você/o senhor in pt-PT, du/Sie in German) belongs in the admin-editable
 * prompt, not in a map here that nobody can fix without a deploy.
 */
export const TONES = {
  FORMAL: "formal",
  INFORMAL: "informal",
};

/**
 * Formal wins by default: these tools write documents that go to employers
 * and colleagues. Informal is a deliberate choice, not an accident.
 */
export const DEFAULT_TONE = TONES.FORMAL;

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
