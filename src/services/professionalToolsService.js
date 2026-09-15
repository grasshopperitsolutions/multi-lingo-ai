/**
 * professionalToolsService.js
 *
 * The three professional tools: CV review, email (write / review / translate)
 * and tone rewriting.
 *
 * Follows the shape every other AI service here uses — getPrompt →
 * renderTemplate → askAI with a responseSchema → parseAIJSON → re-validate.
 * See examWritingExerciseService for the closest analogue: it also pairs a
 * "generate" call with an "evaluate" call, which is what a reviewer is.
 *
 * Two things are specific to this file.
 *
 * **The prompt budget.** These are the first features whose input is long
 * enough to hit /api/ask-ai's 8000-character cap. Every call that carries
 * user text goes through fitToPromptBudget, which measures the *rendered*
 * prompt and trims the body until it fits, and reports whether it had to.
 * Callers must surface that — a review of the first half of a CV presented as
 * a review of the CV is worse than no review.
 *
 * **The template may be out of date.** Prompts are admin-edited in Firestore
 * and renderTemplate leaves an unknown placeholder untouched, so a template
 * written before the tone toggle existed would silently ignore it and the
 * feature would look broken rather than unconfigured. `_assertPlaceholders`
 * warns for exactly that, the same guard _generateStory uses for
 * {{requiredWords}} and getTtsService for {{speechPace}}.
 */

import { askAI } from "./aiService";
import { getPrompt } from "./promptService";
import { parseAIJSON } from "../utils/parseAIJSON";
import { fitToPromptBudget } from "../utils/promptBudget";
import { resolveLanguageName } from "../utils/languageCode";
import { EMAIL_MODES } from "../config/professionalTools";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Deterministic work — a review or a translation should not improvise. */
const TEMPERATURE_PRECISE = 0.3;
/** Drafting from a brief genuinely benefits from some room. */
const TEMPERATURE_DRAFT = 0.7;

const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

/**
 * Raised when the prompt document has not been created in this environment.
 * Surfaced distinctly so "nobody ran the seeder here" is diagnosable from a
 * screenshot rather than looking like a model failure.
 */
export class PromptNotConfiguredError extends Error {
  constructor(promptId) {
    super(`[professionalToolsService] Prompt "${promptId}" is not configured`);
    this.name = "PromptNotConfiguredError";
    this.code = "PROMPT_NOT_CONFIGURED";
    this.promptId = promptId;
  }
}

async function _loadPrompt(promptId) {
  try {
    return await getPrompt(promptId);
  } catch (err) {
    // promptService throws a plain Error naming the id when the document is
    // absent. Anything else (a network failure) is a different problem.
    if (String(err?.message ?? "").includes("not found")) {
      throw new PromptNotConfiguredError(promptId);
    }
    throw err;
  }
}

/** A template edited before a variable existed drops it without a word. */
function _assertPlaceholders(template, names, promptId) {
  const missing = names.filter((name) => !String(template).includes(`{{${name}}}`));
  if (missing.length > 0) {
    console.warn(
      `[professionalToolsService] The "${promptId}" template has no ` +
        `${missing.map((n) => `{{${n}}}`).join(", ")} placeholder, so that input ` +
        "will not reach the model. Add it in Admin > Prompts.",
    );
  }
}

/** One variant of a multi-mode prompt, with the same fallback examPromptTemplates uses. */
function _variantTemplate(promptDoc, key) {
  if (!Array.isArray(promptDoc.variants)) return promptDoc.template;
  const variant =
    promptDoc.variants.find((v) => v.key === key) ?? promptDoc.variants[0];
  return variant?.template ?? promptDoc.template;
}

async function _ask(token, prompt, promptDoc, { schema, temperature }) {
  const providerParams = {
    provider: "gemini",
    model: promptDoc.model || GEMINI_MODEL,
    temperature,
    jsonMode: true,
    responseSchema: schema,
    maxOutputTokens: promptDoc.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
  };

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? "");
  if (!parsed || typeof parsed !== "object") {
    throw new Error("[professionalToolsService] AI returned an unusable response");
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CV_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Two or three sentences on the CV overall." },
    strengths: { type: "array", items: { type: "string" } },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", description: "high, medium or low" },
          where: { type: "string", description: "Which part of the CV." },
          problem: { type: "string" },
          fix: { type: "string", description: "A concrete rewrite or action." },
        },
        required: ["where", "problem", "fix"],
      },
    },
    languageNotes: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "issues"],
};

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    translation: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["translation"],
};

const EMAIL_WRITE_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["subject", "body"],
};

const EMAIL_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    corrected: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          replacement: { type: "string" },
          why: { type: "string" },
        },
        required: ["original", "replacement", "why"],
      },
    },
    registerNote: { type: "string" },
  },
  required: ["corrected"],
};

const TONE_REWRITE_SCHEMA = {
  type: "object",
  properties: {
    rewritten: { type: "string" },
    changed: { type: "array", items: { type: "string" } },
  },
  required: ["rewritten"],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Review a CV for a target market and register.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.cvText        - plain text, already extracted
 * @param {string} params.targetLang    - BCP-47 of the market being applied to
 * @param {string} params.interfaceLang - BCP-47 the feedback is written in
 * @param {string} params.tone          - one of TONES
 * @param {string} [params.roleHint]    - the role being applied for
 * @returns {Promise<{summary, strengths, issues, languageNotes, truncated, usedChars, totalChars}>}
 */
export async function reviewCv({ token, cvText, targetLang, interfaceLang, tone, roleHint = "" }) {
  if (!token) throw new Error("[professionalToolsService] token is required");
  if (!cvText?.trim()) throw new Error("[professionalToolsService] cvText is required");

  const promptId = "pro-cv-review-prompt";
  const promptDoc = await _loadPrompt(promptId);
  _assertPlaceholders(promptDoc.template, ["cvText", "tone", "targetLang"], promptId);

  const { prompt, truncated, usedChars, totalChars } = fitToPromptBudget(
    promptDoc.template,
    {
      cvText: cvText.trim(),
      targetLang: resolveLanguageName(targetLang),
      feedbackLanguage: resolveLanguageName(interfaceLang),
      tone,
      roleHint: roleHint.trim() || "(not specified)",
    },
    "cvText",
  );

  const parsed = await _ask(token, prompt, promptDoc, {
    schema: CV_REVIEW_SCHEMA,
    temperature: TEMPERATURE_PRECISE,
  });

  if (!parsed.summary || !Array.isArray(parsed.issues)) {
    throw new Error("[professionalToolsService] CV review came back incomplete");
  }

  return {
    summary: String(parsed.summary),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    issues: parsed.issues.map((issue) => ({
      severity: String(issue?.severity ?? ""),
      where: String(issue?.where ?? ""),
      problem: String(issue?.problem ?? ""),
      fix: String(issue?.fix ?? ""),
    })),
    languageNotes: Array.isArray(parsed.languageNotes) ? parsed.languageNotes.map(String) : [],
    truncated,
    usedChars,
    totalChars,
  };
}

/**
 * Translate a CV or an email into the target language, in the chosen register,
 * preserving structure.
 *
 * @param {object} params
 * @param {"cv"|"email"} params.docType
 * @returns {Promise<{translation: string, notes: string[], truncated: boolean, usedChars: number, totalChars: number}>}
 */
export async function translateDocument({ token, text, sourceLang, targetLang, tone, docType }) {
  if (!token) throw new Error("[professionalToolsService] token is required");
  if (!text?.trim()) throw new Error("[professionalToolsService] text is required");

  const promptId = "pro-translate-register-prompt";
  const promptDoc = await _loadPrompt(promptId);
  _assertPlaceholders(promptDoc.template, ["text", "tone", "targetLang"], promptId);

  const { prompt, truncated, usedChars, totalChars } = fitToPromptBudget(
    promptDoc.template,
    {
      text: text.trim(),
      sourceLang: resolveLanguageName(sourceLang),
      targetLang: resolveLanguageName(targetLang),
      tone,
      docType,
    },
    "text",
  );

  const parsed = await _ask(token, prompt, promptDoc, {
    schema: TRANSLATION_SCHEMA,
    temperature: TEMPERATURE_PRECISE,
  });

  if (!parsed.translation) {
    throw new Error("[professionalToolsService] Translation came back empty");
  }

  return {
    translation: String(parsed.translation),
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
    truncated,
    usedChars,
    totalChars,
  };
}

/**
 * Draft an email from a brief.
 *
 * @returns {Promise<{subject: string, body: string, notes: string[]}>}
 */
export async function writeEmail({ token, brief, targetLang, tone, recipient = "", intent = "" }) {
  if (!token) throw new Error("[professionalToolsService] token is required");
  if (!brief?.trim()) throw new Error("[professionalToolsService] brief is required");

  const promptId = "pro-email-prompt";
  const promptDoc = await _loadPrompt(promptId);
  const template = _variantTemplate(promptDoc, EMAIL_MODES.WRITE);
  _assertPlaceholders(template, ["brief", "tone", "targetLang"], promptId);

  const { prompt } = fitToPromptBudget(
    template,
    {
      brief: brief.trim(),
      targetLang: resolveLanguageName(targetLang),
      tone,
      recipient: recipient.trim() || "(not specified)",
      intent: intent.trim() || "(not specified)",
    },
    "brief",
  );

  const parsed = await _ask(token, prompt, promptDoc, {
    schema: EMAIL_WRITE_SCHEMA,
    temperature: TEMPERATURE_DRAFT,
  });

  if (!parsed.subject || !parsed.body) {
    throw new Error("[professionalToolsService] Email draft came back incomplete");
  }

  return {
    subject: String(parsed.subject),
    body: String(parsed.body),
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
  };
}

/**
 * Correct an email the user already wrote, explaining each change.
 *
 * @returns {Promise<{corrected: string, changes: object[], registerNote: string}>}
 */
export async function reviewEmail({ token, draft, targetLang, interfaceLang, tone }) {
  if (!token) throw new Error("[professionalToolsService] token is required");
  if (!draft?.trim()) throw new Error("[professionalToolsService] draft is required");

  const promptId = "pro-email-prompt";
  const promptDoc = await _loadPrompt(promptId);
  const template = _variantTemplate(promptDoc, EMAIL_MODES.REVIEW);
  _assertPlaceholders(template, ["draft", "tone", "targetLang"], promptId);

  const { prompt } = fitToPromptBudget(
    template,
    {
      draft: draft.trim(),
      targetLang: resolveLanguageName(targetLang),
      feedbackLanguage: resolveLanguageName(interfaceLang),
      tone,
    },
    "draft",
  );

  const parsed = await _ask(token, prompt, promptDoc, {
    schema: EMAIL_REVIEW_SCHEMA,
    temperature: TEMPERATURE_PRECISE,
  });

  if (!parsed.corrected) {
    throw new Error("[professionalToolsService] Email review came back empty");
  }

  return {
    corrected: String(parsed.corrected),
    changes: Array.isArray(parsed.changes)
      ? parsed.changes.map((change) => ({
          original: String(change?.original ?? ""),
          replacement: String(change?.replacement ?? ""),
          why: String(change?.why ?? ""),
        }))
      : [],
    registerNote: String(parsed.registerNote ?? ""),
  };
}

/**
 * Rewrite arbitrary text in the chosen register.
 *
 * @returns {Promise<{rewritten: string, changed: string[]}>}
 */
export async function rewriteTone({ token, text, targetLang, tone }) {
  if (!token) throw new Error("[professionalToolsService] token is required");
  if (!text?.trim()) throw new Error("[professionalToolsService] text is required");

  const promptId = "pro-tone-rewrite-prompt";
  const promptDoc = await _loadPrompt(promptId);
  _assertPlaceholders(promptDoc.template, ["text", "tone"], promptId);

  const { prompt } = fitToPromptBudget(
    promptDoc.template,
    { text: text.trim(), lang: resolveLanguageName(targetLang), tone },
    "text",
  );

  const parsed = await _ask(token, prompt, promptDoc, {
    schema: TONE_REWRITE_SCHEMA,
    temperature: TEMPERATURE_PRECISE,
  });

  if (!parsed.rewritten) {
    throw new Error("[professionalToolsService] Rewrite came back empty");
  }

  return {
    rewritten: String(parsed.rewritten),
    changed: Array.isArray(parsed.changed) ? parsed.changed.map(String) : [],
  };
}
