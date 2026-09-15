/**
 * promptSeedService.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE ONCE THE PROMPTS EXIST IN EVERY ENVIRONMENT.
 *
 * The professional tools need four prompt documents in
 * `appConfig/config/prompts`. The Admin panel can edit prompts but has no
 * create affordance, and there is no seeder in either repo — so this exists to
 * create them once, from the Admin page, and then be removed along with the
 * button that calls it.
 *
 * It is not a permissions workaround: that collection is already
 * `{read: 'public', write: 'admin'}` and an admin POST already works. The only
 * thing missing was a button.
 *
 * It never overwrites. A document that already exists is skipped, so running
 * it twice is harmless and an admin's edits to a template are never clobbered
 * by a second press.
 *
 * Removal checklist:
 *   1. delete this file
 *   2. delete the seed button in components/admin/PromptsSection.jsx
 *   3. delete the handler in pages/AdminPage.jsx
 */

import { createDocument } from "./firestoreService";
import { PROMPTS_COLLECTION, getPrompts, clearPromptsCache } from "./promptService";

const COMMON = {
  category: "professional",
  status: "active",
  model: "",
  version: 1,
};

export const PRO_TOOLS_PROMPT_SEEDS = [
  {
    id: "pro-cv-review-prompt",
    name: "Professional — CV review",
    description:
      "Reviews a CV for a target job market and register, returning strengths, concrete issues with fixes, and language notes. Feedback is written in the reader's interface language.",
    sourceFile: "src/services/professionalToolsService.js",
    sourceFunction: "reviewCv",
    maxTokens: 4096,
    ...COMMON,
    template: `You are an experienced recruiter and language editor reviewing a CV written by someone applying for work in a {{targetLang}}-speaking market.

The applicant is aiming for this kind of role: {{roleHint}}

Write every part of your feedback in {{feedbackLanguage}}.

The CV should read in a {{tone}} register for this market. Judge it against what a {{tone}} register actually means in {{targetLang}} — conventions differ by language, and what reads as professional in one reads as cold or presumptuous in another.

Review it for:
- Language errors, awkward phrasing, and anything that reads as translated rather than written.
- Register: is the level of formality right for {{tone}} in {{targetLang}}?
- Structure and omissions a recruiter in that market would notice.
- Claims that are vague where they should be concrete.

Rules:
- Every issue must name where it is and give a concrete fix, not general advice.
- Do not invent experience, dates, employers or qualifications the CV does not contain.
- If the text appears cut off mid-sentence, review what is there and do not remark on the truncation.

CV:
{{cvText}}`,
  },
  {
    id: "pro-translate-register-prompt",
    name: "Professional — translate in register",
    description:
      "Translates a CV or an email into the target language in a chosen formal/informal register, preserving structure and line breaks. Shared by the CV tool and the email tool.",
    sourceFile: "src/services/professionalToolsService.js",
    sourceFunction: "translateDocument",
    maxTokens: 6144,
    ...COMMON,
    template: `Translate the following {{docType}} from {{sourceLang}} into {{targetLang}}.

Write the translation in a {{tone}} register, as that register is actually used in {{targetLang}} for this kind of document.

Rules:
- Preserve the structure exactly: line breaks, ordering, headings and list items stay where they are.
- Translate meaning, not words. Job titles, qualifications and idioms take the equivalent a reader in that market expects, not a literal rendering.
- Keep proper nouns, company names, and contact details unchanged.
- Do not add, remove or embellish any content.
- In the notes, mention only choices a careful reader would want to know about — an equivalent qualification, a title with no direct counterpart, a register decision that could have gone the other way.

Text:
{{text}}`,
  },
  {
    id: "pro-email-prompt",
    name: "Professional — email (write / review)",
    description:
      "Two variants on one document. 'write' drafts an email from a brief; 'review' corrects a draft the user wrote and explains each change. Translation of an email goes through pro-translate-register-prompt instead.",
    sourceFile: "src/services/professionalToolsService.js",
    sourceFunction: "writeEmail / reviewEmail",
    maxTokens: 3072,
    ...COMMON,
    variants: [
      {
        key: "write",
        label: "Write from a brief",
        template: `Write a professional email in {{targetLang}}, in a {{tone}} register as that register is actually used in {{targetLang}}.

Recipient: {{recipient}}
Purpose: {{intent}}

Rules:
- Say what the brief asks and nothing more. No filler openings, no padding.
- Use the greeting and sign-off a native writer would use for this register and this recipient.
- Do not invent names, dates, figures or commitments that are not in the brief. If something essential is missing, leave a clearly marked placeholder in square brackets.
- The subject line must be specific enough to be useful in an inbox.
- In the notes, flag any placeholder you left and any convention a non-native writer would not know.

Brief:
{{brief}}`,
      },
      {
        key: "review",
        label: "Review a draft",
        template: `Correct the following email, written in {{targetLang}} by someone still learning the language.

It should read in a {{tone}} register as that register is actually used in {{targetLang}}.

Write your explanations in {{feedbackLanguage}}.

Rules:
- Return the corrected email in full, ready to send.
- Correct grammar, word choice, register and the conventions of greeting and sign-off.
- Keep the writer's intent and their voice. Do not rewrite it into a different email.
- List each meaningful change with the original wording, what it became, and why. Skip trivial typo fixes.
- If the register is wrong for the stated one, say so plainly in the register note.

Email:
{{draft}}`,
      },
    ],
  },
  {
    id: "pro-tone-rewrite-prompt",
    name: "Professional — tone rewrite",
    description:
      "Rewrites any work message in the chosen formal/informal register, listing what changed. The most general of the three tools.",
    sourceFile: "src/services/professionalToolsService.js",
    sourceFunction: "rewriteTone",
    maxTokens: 3072,
    ...COMMON,
    template: `Rewrite the following message in {{lang}} so that it reads in a {{tone}} register, as that register is actually used in {{lang}}.

Rules:
- Keep the meaning, the facts and the writer's intent exactly. This is a change of register, not of content.
- Adjust what the register actually governs: forms of address, greeting and sign-off, directness, contractions, hedging, and any idiom that belongs to the other register.
- Do not make it longer. A more formal version is not a wordier one.
- List the changes that matter, briefly. Do not list every word you touched.

Message:
{{text}}`,
  },
];

/**
 * Create any missing professional-tools prompt document.
 *
 * @param {string} token - an admin Firebase ID token
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
export async function seedProToolsPrompts(token) {
  if (!token) throw new Error("[promptSeedService] token is required");

  // forceRefresh: a stale cache would report a prompt as missing that was
  // seeded from another tab, and create it a second time.
  const existing = await getPrompts({ forceRefresh: true });
  const existingIds = new Set((existing ?? []).map((prompt) => prompt.id));

  const created = [];
  const skipped = [];

  for (const seed of PRO_TOOLS_PROMPT_SEEDS) {
    if (existingIds.has(seed.id)) {
      skipped.push(seed.id);
      continue;
    }
    await createDocument(PROMPTS_COLLECTION, seed, seed.id, token);
    created.push(seed.id);
  }

  // The prompt cache is whole-list and lives as long as the tab. Without this
  // the admin who just seeded would still be told the prompts do not exist.
  clearPromptsCache();

  return { created, skipped };
}
