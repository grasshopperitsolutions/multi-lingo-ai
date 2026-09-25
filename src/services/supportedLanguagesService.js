/**
 * supportedLanguagesService.js
 *
 * Manages fetching and dynamic seeding of supported languages and writing systems.
 * Uses Firestore for persistence and AI (Gemini) for generating new language metadata.
 */

import { askAI } from "./aiService";
import { seedLanguageTranslations } from "./translationService";
import { getPrompt, renderTemplate } from "./promptService";
import { normalizeCode } from "../utils/languageCode";
import { parseAIJSON } from "../utils/parseAIJSON";
import {
  queryCollection,
  createDocument,
  updateDocument,
  getTokenOrAnonymous,
} from "./firestoreService";

// ---------------------------------------------------------------------------
// Collection names
// ---------------------------------------------------------------------------
const LANGUAGES_COLLECTION = "appConfig/config/languages";
const WRITING_SYSTEMS_COLLECTION = "appConfig/config/writingSystems";

/**
 * Shape for the language-metadata seed call, passed to Gemini as
 * `responseSchema` so the structure is guaranteed by the API instead of
 * requested in the prompt text.
 */
const LANGUAGE_SEED_SCHEMA = {
  type: "object",
  properties: {
    code: { type: "string", description: "Canonical BCP-47 code, e.g. pt-PT." },
    label: { type: "string", description: "Human-readable language name." },
    flag: { type: "string", description: "Flag emoji or ISO region code." },
    examSupported: { type: "boolean" },
    status: { type: "string" },
    rtl: { type: "boolean", description: "True for right-to-left scripts." },
    characters: {
      type: "object",
      properties: {
        default: { type: "array", items: { type: "string" } },
        special: { type: "array", items: { type: "string" } },
      },
      required: ["default", "special"],
    },
  },
  required: ["code", "characters"],
};


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all supported languages from Firestore.
 * @param {string} [token] - Optional Firebase ID token.
 * @returns {Promise<Array<{code:string, label:string, flag:string, examSupported:boolean, status:string, rtl:boolean, writingSystemIds:string[], aiGenerated:boolean}>>}
 */
export async function getLanguages(token) {
  const authToken = token ?? (await getTokenOrAnonymous());
  const result = await queryCollection(LANGUAGES_COLLECTION, {}, {}, authToken);
  return sortLanguages(result?.documents ?? []);
}

/**
 * Alphabetical by the label a reader actually sees.
 *
 * Unsorted, Firestore hands these back in document-id order — which is the
 * BCP-47 code, so the list reads as arranged by something invisible: "Swiss
 * German" lands between "Irish" and "Interlingua" because `gsw` sorts there,
 * nowhere near "German".
 *
 * Sorting by the label is also what makes dialects sit together, with no
 * grouping headings and no taxonomy to maintain: the labels are already
 * "Language (Country)", so Portuguese (Brazil) and Portuguese (Portugal) are
 * neighbours, and all four French variants form a block. Grouping by *country*
 * was the other option and the live data rules it out — 25 languages across 20
 * countries, 16 of them holding a single entry.
 *
 * `Intl.Collator` rather than `localeCompare` per item: one collator for the
 * whole sort, and it orders accented labels the way a dictionary does instead
 * of the way UTF-16 does.
 *
 * Sorted here rather than in the query, because a Firestore `orderBy` silently
 * drops every document missing the field — and `label` is optional.
 *
 * @param {Array<{code?: string, label?: string}>} languages
 * @returns {Array<object>} A new array; the input is left alone.
 */
export function sortLanguages(languages) {
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  return [...languages].sort((a, b) =>
    collator.compare(a.label || a.code || "", b.label || b.code || "")
  );
}

/**
 * Fetch all writing systems from Firestore.
 * @param {string} [token] - Optional Firebase ID token.
 * @returns {Promise<Array<{id:string, name:string, characters:{default:string[], special:string[]}, supportedLanguageCodes:string[]}>>}
 */
export async function getWritingSystems(token) {
  const authToken = token ?? (await getTokenOrAnonymous());
  const result = await queryCollection(WRITING_SYSTEMS_COLLECTION, {}, {}, authToken);
  return result?.documents ?? [];
}

/**
 * Seed a new language using AI generation, then persist to Firestore.
 *
 * Flow:
 * 1. Call AI to generate language metadata + character sets.
 * 2. Check if a writing system with matching characters already exists.
 * 3. If exists → update its supportedLanguageCodes array.
 *    If not   → create new writing system document.
 * 4. Create the new supportedLanguages document linking the writing system IDs.
 * 5. Start translating the interface into it, in the background.
 * 6. Return the created language document — without waiting for step 5.
 *
 * Step 5 is ~19 AI calls and takes about a minute; the language is usable
 * before it finishes (the interface shows the base-locale text and switches
 * over when the translation lands, via loadRemoteTranslations). So the caller
 * waits only for the one call that identifies the language.
 *
 * @param {string} code     - BCP-47 language code (e.g. "pt-PT").
 * @param {string} name     - Human-readable language name (for AI context).
 * @param {string} token    - Firebase ID token.
 * @returns {Promise<object>} The newly created language document.
 */
export async function seedLanguage(code, name, token) {
  if (!token) {
    throw new Error("[supportedLanguagesService] Firebase ID token is required for seeding");
  }

  console.info(`[supportedLanguagesService] seedLanguage(code="${code}", name="${name}") — starting`);

  // 1. Ask AI to generate metadata + character sets. maxOutputTokens raised
  // from the SDK default (1024) — some scripts (e.g. Chinese, Japanese)
  // produce large "default"/"special" character arrays that can approach it.
  const promptDoc = await getPrompt('language-metadata-seed-prompt');
  const seedPrompt = renderTemplate(promptDoc.template, { code, humanName: name });
  const aiResponse = await askAI(
    token,
    seedPrompt,
    {
      provider: "gemini",
      model: promptDoc.model || "gemini-3.5-flash-lite",
      explorerModel: promptDoc.explorerModel,
      temperature: 0.2,
      jsonMode: true,
      // Enforced by the API rather than asked for in the prompt. `code` and
      // `characters` are required here because the parse below rejects a
      // response missing either — better to constrain generation than to
      // discover the gap after spending the call.
      responseSchema: LANGUAGE_SEED_SCHEMA,
      maxOutputTokens: promptDoc.maxTokens ?? 2048,
      // Adding a language doesn't spend the user's daily allowance.
      purpose: "language-identify",
    },
    // Nor does it ask first: the user already chose to add it, and the call
    // costs them nothing.
    { skipConfirm: true }
  );

  // The API returns the JSON string inside the `text` field
  let aiData;
  try {
    aiData = typeof aiResponse?.text === "string" ? parseAIJSON(aiResponse.text) : aiResponse;
  } catch (err) {
    console.error(`[supportedLanguagesService] seedLanguage("${code}") — failed to parse AI response as JSON: ${err.message}. Raw: ${String(aiResponse?.text).slice(0, 300)}`);
    throw err;
  }

  if (!aiData?.code || !aiData?.characters) {
    console.error(`[supportedLanguagesService] seedLanguage("${code}") — AI response missing required fields: ${JSON.stringify(aiData)}`);
    throw new Error(
      "[supportedLanguagesService] AI response missing required fields. Expected code and characters."
    );
  }

  const {
    code: returnedCode,
    label,
    flag,
    examSupported = false,
    status = "active",
    rtl = false,
    characters,
  } = aiData;

  // The AI derives the proper BCP-47 code from the user's description.
  const canonicalCode = typeof returnedCode === "string" && returnedCode.trim()
    ? returnedCode.trim()
    : code.trim();

  // Guard against creating a duplicate document for a language that already
  // exists under a different casing or bare-vs-region-qualified code (e.g.
  // AI returns "en-GB" while "en-gb" or bare "en" is already seeded).
  const existingLanguages = await getLanguages(token);
  const existingMatch = existingLanguages.find(
    (lang) => normalizeCode(lang.code) === normalizeCode(canonicalCode)
  );
  if (existingMatch) {
    console.info(`[supportedLanguagesService] seedLanguage("${code}") — "${canonicalCode}" normalizes to an existing language "${existingMatch.code}", reusing it instead of creating a duplicate`);
    return existingMatch;
  }

  const defaultChars = Array.isArray(characters?.default)
    ? [...new Set(characters.default.map((c) => String(c).toLowerCase()))]
    : [];
  const specialChars = Array.isArray(characters?.special)
    ? [...new Set(characters.special.map((c) => String(c).toLowerCase()))]
    : [];

  // 2. Look for an existing writing system with matching character sets
  const existingSystems = await getWritingSystems(token);
  const matchingSystem = existingSystems.find((sys) => {
    const sysDefault = Array.isArray(sys?.characters?.default)
      ? sys.characters.default
      : [];
    const sysSpecial = Array.isArray(sys?.characters?.special)
      ? sys.characters.special
      : [];
    return (
      arraysEqual(sorted(sysDefault), sorted(defaultChars)) &&
      arraysEqual(sorted(sysSpecial), sorted(specialChars))
    );
  });

  let writingSystemId;

  if (matchingSystem) {
    // 3a. Update existing writing system — append new language code if missing
    writingSystemId = matchingSystem.id;
    const updatedCodes = Array.isArray(matchingSystem.supportedLanguageCodes)
      ? [...new Set([...matchingSystem.supportedLanguageCodes, canonicalCode])]
      : [canonicalCode];

    await updateDocument(
      WRITING_SYSTEMS_COLLECTION,
      writingSystemId,
      { supportedLanguageCodes: updatedCodes },
      token
    );
  } else {
    // 3b. Create new writing system
    const newSystemId = generateWritingSystemId(canonicalCode, defaultChars, specialChars);
    const newSystem = {
      id: newSystemId,
      name: buildWritingSystemName(canonicalCode, label),
      characters: {
        default: defaultChars,
        special: specialChars,
      },
      supportedLanguageCodes: [canonicalCode],
    };

    await createDocument(WRITING_SYSTEMS_COLLECTION, newSystem, newSystemId, token);
    writingSystemId = newSystemId;
  }

  // 4. Create the supportedLanguage document
  const languageDoc = {
    code: canonicalCode,
    label: label || name,
    flag: flag || "🌐",
    examSupported: Boolean(examSupported),
    status: status || "active",
    rtl: Boolean(rtl),
    writingSystemIds: [writingSystemId],
    aiGenerated: true,
  };

  // Use the canonical BCP-47 code as the document ID
  const created = await createDocument(LANGUAGES_COLLECTION, languageDoc, canonicalCode, token);
  console.info(`[supportedLanguagesService] seedLanguage("${code}") — created language doc "${canonicalCode}"`);

  // 5. Translate the interface into it, in the background. Not awaited: the
  // language is usable now, and a reader who switches to it meanwhile joins
  // this same run (seedLanguageTranslations de-dupes per locale) rather than
  // starting another. A failure is non-fatal and retried automatically the
  // next time this language is loaded as an interface language.
  seedLanguageTranslations(canonicalCode, token).catch((translationErr) => {
    console.warn(
      `[supportedLanguagesService] Language "${canonicalCode}" created but UI translations failed: ${translationErr.message}. ` +
      `It shows the base-locale text until translations are seeded ` +
      `(retried automatically the next time "${canonicalCode}" is loaded as the interface language).`
    );
  });

  // 6. Return the created document (API returns { id, data, collection })
  return created?.data ?? { ...languageDoc, id: canonicalCode };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Sort arrays for deterministic equality comparison */
function sorted(arr) {
  return [...arr].sort();
}

/** Compare two arrays for element equality (order-independent) */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Generate a deterministic but readable writing system ID from the language code
 * and character set fingerprint.
 *
 * Examples: "latin-en", "cyrillic-ru", "japanese-hiragana"
 */
function generateWritingSystemId(code, defaultChars, specialChars) {
  const script = detectScript(defaultChars);
  const region = code.split("-")[1]?.toLowerCase() || "default";
  const fingerprint = [...defaultChars.slice(0, 5), ...specialChars.slice(0, 3)].join("");
  return `${script}-${region}${fingerprint ? `__${fingerprint}` : ""}`;
}


/**
 * Very rough script detector based on Unicode ranges.
 * Returns a lowercase script label.
 */
function detectScript(chars) {
  const has = (range) => chars.some((c) => {
    const code = c.charCodeAt(0);
    return code >= range[0] && code <= range[1];
  });

  // Order matters — check more specific scripts first
  if (has([0x3040, 0x309F]) || has([0x30A0, 0x30FF])) return "japanese";
  if (has([0xAC00, 0xD7AF])) return "korean";
  if (has([0x4E00, 0x9FFF]) || has([0x3400, 0x4DBF])) return "chinese";
  if (has([0x0600, 0x06FF])) return "arabic";
  if (has([0x0590, 0x05FF])) return "hebrew";
  if (has([0x0400, 0x04FF])) return "cyrillic";
  if (has([0x0370, 0x03FF])) return "greek";
  if (has([0x0900, 0x097F])) return "devanagari";
  if (has([0x0E00, 0x0E7F])) return "thai";
  if (has([0x0980, 0x09FF])) return "bengali";
  if (has([0x0A80, 0x0AFF])) return "gujarati";
  if (has([0x0B00, 0x0B7F])) return "odia";
  if (has([0x0C00, 0x0C7F])) return "telugu";
  if (has([0x0C80, 0x0CFF])) return "kannada";
  if (has([0x0D00, 0x0D7F])) return "malayalam";
  if (has([0x10A0, 0x10FF])) return "georgian";
  if (has([0x0530, 0x058F])) return "armenian";
  if (has([0x0E80, 0x0EFF])) return "lao";
  if (has([0x1000, 0x109F])) return "myanmar";
  if (has([0x1780, 0x17FF])) return "khmer";
  if (has([0x1200, 0x137F])) return "ethiopic";

  // Default: Latin (covers most European languages)
  return "latin";
}

/**
 * Build a human-readable writing system name,
 * e.g. "Latin (Portuguese)" or "Cyrillic (Russian)".
 */
function buildWritingSystemName(code, label) {
  const script = detectScriptFromCode(code);
  const languageName = label?.split("(")[1]?.replace(")", "").trim() || label || code;
  return `${script.charAt(0).toUpperCase() + script.slice(1)} (${languageName})`;
}

/**
 * Map common BCP-47 sub-tags to script labels.
 */
function detectScriptFromCode(code) {
  const lower = code.toLowerCase();
  if (lower.includes("ja")) return "Japanese";
  if (lower.includes("ko")) return "Korean";
  if (lower.includes("zh")) return "Chinese";
  if (lower.includes("ar")) return "Arabic";
  if (lower.includes("he")) return "Hebrew";
  if (lower.includes("ru") || lower.includes("uk") || lower.includes("bg"))
    return "Cyrillic";
  if (lower.includes("el")) return "Greek";
  if (lower.includes("hi") || lower.includes("mr") || lower.includes("ne"))
    return "Devanagari";
  if (lower.includes("th")) return "Thai";
  if (lower.includes("bn")) return "Bengali";
  if (lower.includes("gu")) return "Gujarati";
  if (lower.includes("ta")) return "Tamil";
  if (lower.includes("te")) return "Telugu";
  if (lower.includes("kn")) return "Kannada";
  if (lower.includes("ml")) return "Malayalam";
  if (lower.includes("ka")) return "Georgian";
  if (lower.includes("hy")) return "Armenian";
  if (lower.includes("lo")) return "Lao";
  if (lower.includes("my")) return "Myanmar";
  if (lower.includes("km")) return "Khmer";
  if (lower.includes("am")) return "Ethiopic";
  // Most European languages (and many others) use Latin
  return "Latin";
}