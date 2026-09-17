import { askAI } from "./aiService";
import { getPrompt, renderTemplate } from "./promptService";
import { parseAIJSON } from "../utils/parseAIJSON";
import { fileToDownscaledImage } from "../utils/imageDownscale";

/**
 * Reads a photo of the student's own notes and proposes what to file where.
 *
 * The photo is a notebook page, an exercise, a piece of corrected homework —
 * their own material, which is what makes "mistakes" possible at all: a
 * wrong→right pair has to come from something they wrote. A menu or a street
 * sign would produce vocabulary and nothing else, and the prompt says so.
 *
 * **Nothing is written by this module.** It returns proposals; the review
 * screen is where a person decides. That split is the whole design: a model
 * reading handwriting will misread some of it, and the cost of a wrong guess
 * has to be a glance and a delete, never a silent write into somebody's own
 * notes.
 *
 * The photo itself is never stored. It goes into the request, is read, and
 * goes out of scope with the response.
 */

export const PROPOSAL_KINDS = {
  NOTE: "note",
  QUESTION: "question",
  MISTAKE: "mistake",
  PHRASE: "phrase",
  WORD: "word",
};

/**
 * Per-kind ceilings on what one photo may propose.
 *
 * A dense page can yield forty words, and a review screen with forty rows is
 * one nobody reads — they approve it wholesale, which is exactly the outcome
 * the review exists to prevent. The prompt asks for the best ones; this is
 * the backstop when it does not listen.
 */
const LIMITS = {
  [PROPOSAL_KINDS.QUESTION]: 5,
  [PROPOSAL_KINDS.MISTAKE]: 8,
  [PROPOSAL_KINDS.PHRASE]: 8,
  [PROPOSAL_KINDS.WORD]: 15,
};

const GEMINI_MODEL = "gemini-3.5-flash";

/** The shape the model must answer in. Field names match the widgets exactly. */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    language: { type: "string" },
    note: { type: "string" },
    questions: {
      type: "array",
      items: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    },
    mistakes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          said: { type: "string" },
          correction: { type: "string" },
          why: { type: "string" },
        },
        required: ["said", "correction"],
      },
    },
    phrases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phrase: { type: "string" },
          translation: { type: "string" },
          note: { type: "string" },
        },
        required: ["phrase", "translation"],
      },
    },
    words: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "note", "questions", "mistakes", "phrases", "words"],
};

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

/** Every proposal carries a stable id so the review screen can key and edit rows. */
let nextId = 0;
const proposal = (kind, fields) => ({ id: `p${(nextId += 1)}`, kind, fields, include: true });

/**
 * Turns the model's JSON into a flat, ordered list of proposals.
 *
 * Flat rather than grouped because the review screen lets a person drop any
 * single row, and a nested shape would make "which of these did they keep?"
 * a walk of five arrays instead of one filter. Grouping for display is the
 * screen's business.
 *
 * Every field is trimmed and collapsed **here**, not asked for in the prompt:
 * an instruction to "return trimmed text" spends tokens on something a
 * `.replace` does perfectly, and it is not what the model is for.
 */
export function toProposals(parsed) {
  const out = [];

  const note = text(parsed?.note);
  if (note) out.push(proposal(PROPOSAL_KINDS.NOTE, { text: note }));

  for (const item of (parsed?.questions ?? []).slice(0, LIMITS[PROPOSAL_KINDS.QUESTION])) {
    const value = text(item?.text);
    if (value) out.push(proposal(PROPOSAL_KINDS.QUESTION, { text: value }));
  }

  for (const item of (parsed?.mistakes ?? []).slice(0, LIMITS[PROPOSAL_KINDS.MISTAKE])) {
    const said = text(item?.said);
    const correction = text(item?.correction);
    // Half a mistake is not a mistake: without both sides the row says
    // nothing, and the widget's own form requires both.
    if (said && correction) {
      out.push(proposal(PROPOSAL_KINDS.MISTAKE, { said, correction, why: text(item?.why) }));
    }
  }

  for (const item of (parsed?.phrases ?? []).slice(0, LIMITS[PROPOSAL_KINDS.PHRASE])) {
    const phrase = text(item?.phrase);
    const translation = text(item?.translation);
    if (phrase && translation) {
      out.push(proposal(PROPOSAL_KINDS.PHRASE, { phrase, translation, note: text(item?.note) }));
    }
  }

  const seen = new Set();
  for (const raw of (parsed?.words ?? []).slice(0, LIMITS[PROPOSAL_KINDS.WORD])) {
    const word = text(raw).toLowerCase();
    // The word bank keys on the word itself, so a page repeating a term
    // would otherwise propose the same chip several times.
    if (word && !seen.has(word)) {
      seen.add(word);
      out.push(proposal(PROPOSAL_KINDS.WORD, { word }));
    }
  }

  return out;
}

/**
 * @returns {Promise<{summary: string, proposals: Array}>}
 */
export async function analysePhoto({ token, file, learningLang, interfaceLang }) {
  const image = await fileToDownscaledImage(file);

  const promptDoc = await getPrompt("photo-notes-extract-prompt");
  const prompt = renderTemplate(promptDoc.template, { learningLang, interfaceLang });

  const providerParams = {
    provider: "gemini",
    model: promptDoc.model || GEMINI_MODEL,
    temperature: 0.2,
    jsonMode: true,
    responseSchema: RESPONSE_SCHEMA,
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  // Confirmed, not exempt: this spends one of the student's daily AI calls on
  // a deliberate action they just took, which is exactly what the spend
  // prompt is for.
  const data = await askAI(token, prompt, providerParams, { images: [image] });

  const raw = data?.text ?? "";
  if (!raw) throw new Error("[photoCaptureService] Empty response returned");

  let parsed;
  try {
    parsed = parseAIJSON(raw);
  } catch {
    throw new Error("[photoCaptureService] Could not parse AI response as JSON");
  }

  return { summary: text(parsed?.summary), proposals: toProposals(parsed) };
}
