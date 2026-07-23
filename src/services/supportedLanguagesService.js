/**
 * supportedLanguagesService.js
 *
 * Manages fetching and dynamic seeding of supported languages and writing systems.
 * Uses Firestore for persistence and AI (Gemini) for generating new language metadata.
 */

import { askAI } from "./aiService";
import {
  queryCollection,
  createDocument,
  updateDocument,
} from "./firestoreService";

// ---------------------------------------------------------------------------
// Collection names
// ---------------------------------------------------------------------------
const LANGUAGES_COLLECTION = "supportedLanguages";
const WRITING_SYSTEMS_COLLECTION = "writingSystems";

// ---------------------------------------------------------------------------
// Prompt for AI language generation
// ---------------------------------------------------------------------------
const SEED_PROMPT = (code, humanName) => `You are a linguistics assistant. The user wants to add a language to the system.

User input: "${humanName}"
Possible BCP-47 code hint: "${code}"

Your job:
1. Determine the most appropriate BCP-47 code for this language/dialect.
   - If the hint looks like a valid BCP-47 code (e.g. "en-AU", "pt-BR", "ja-JP"), use it.
   - If the hint is a description (e.g. "australia english", "african portuguese em angola"), derive the correct BCP-47 code yourself.
   - If you cannot determine a precise code, use a sensible best guess (e.g. "en-AU" for Australian English).
2. Generate metadata for that language.

CRITICAL: The "code" field MUST be a valid BCP-47 language tag such as "en-AU", "pt-AO", "pt-BR", etc. Do NOT return a plain description like "australia english".

Return ONLY a JSON object (no markdown, no backticks, no commentary) with exactly these fields:
{
  "code": "<the BCP-47 code you determined>",
  "label": "Full language name in English (e.g. 'Portuguese (Portugal)')",
  "flag": "Single emoji flag for the primary country where this language is spoken",
  "examSupported": boolean (true only for Portuguese pt-PT and pt-BR, false for all others),
  "status": "active",
  "rtl": boolean (true for Arabic, Hebrew, Farsi, Urdu, etc.; false otherwise),
  "characters": {
    "default": ["array of all unique lowercase letters used in this language"],
    "special": ["array of accented / diacritic characters commonly used (empty array if none)"]
  }
}

Rules:
- The code MUST be a valid BCP-47 code (language-region format like "en-AU", "pt-AO", etc.).
- default and special arrays must be deduplicated.
- default should contain at least 20 characters if the language uses a Latin-like script.
- For non-Latin scripts (Cyrillic, Greek, Japanese, Korean, Chinese, etc.), include the relevant characters.
- Do NOT include uppercase letters in default — only lowercase base characters.
- Do NOT include digits, punctuation, or whitespace.
- Return ONLY the JSON object.`;


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all supported languages from Firestore.
 * @param {string} [token] - Optional Firebase ID token.
 * @returns {Promise<Array<{code:string, label:string, flag:string, examSupported:boolean, status:string, rtl:boolean, writingSystemIds:string[], aiGenerated:boolean}>>}
 */
export async function getLanguages(token) {
  const result = await queryCollection(LANGUAGES_COLLECTION, {}, {}, token);
  return result?.documents ?? [];
}

/**
 * Fetch all writing systems from Firestore.
 * @param {string} [token] - Optional Firebase ID token.
 * @returns {Promise<Array<{id:string, name:string, characters:{default:string[], special:string[]}, supportedLanguageCodes:string[]}>>}
 */
export async function getWritingSystems(token) {
  const result = await queryCollection(WRITING_SYSTEMS_COLLECTION, {}, {}, token);
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
 * 5. Return the created language document.
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

  // 1. Ask AI to generate metadata + character sets
  const aiResponse = await askAI(
    token,
    SEED_PROMPT(code, name),
    { provider: "gemini", model: "gemini-3.5-flash-lite", temperature: 0.2 }
  );

  // The API returns the JSON string inside the `text` field
  const aiData = typeof aiResponse?.text === "string" ? JSON.parse(aiResponse.text) : aiResponse;

  if (!aiData?.code || !aiData?.characters) {
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

  // 5. Return the created document (API returns { id, data, collection })
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