/**
 * grammarExerciseValidators.js
 *
 * Turns a model's JSON into a Grammar Practice exercise the screen can trust,
 * or says why it cannot.
 *
 * Items are checked one by one and a bad item is dropped rather than failing
 * the whole exercise: one malformed sentence out of eight should cost one
 * sentence, not the learner's AI call. The caller decides whether enough
 * survived (MIN_ITEMS).
 */

import { normalizeAnswer } from "./grammarAnswerCheck";

export const MIN_ITEMS = 4;

const GAP = /_{3,}/g;
const SPAN = /\[\[[^\]]+\]\]/;

const str = (value) => (typeof value === "string" ? value.trim() : "");
const strList = (value) =>
  Array.isArray(value) ? value.map(str).filter(Boolean) : [];
const countGaps = (text) => (str(text).match(GAP) ?? []).length;

/** Is `answer` (normalised) one of `options`? */
const inList = (answer, options) =>
  options.some((option) => normalizeAnswer(option) === normalizeAnswer(answer));

/** Does the answer appear verbatim in text the learner can already read? */
const leaks = (answers, ...texts) => {
  const haystack = normalizeAnswer(texts.filter(Boolean).join(" "));
  return answers.some((answer) => {
    const needle = normalizeAnswer(answer);
    return needle.length > 0 && new RegExp(`(^|\\s)${escapeRegExp(needle)}(\\s|$)`, "u").test(haystack);
  });
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Per-type item cleaning. Each returns the cleaned item, or null to drop it.
 * Reader-language fields (explanation, cueLabel, source, constraint) are kept
 * here and split off into the gloss by the service.
 */
const ITEM_RULES = {
  "choose-option": (raw) => {
    const item = { prompt: str(raw.prompt), options: strList(raw.options), answers: strList(raw.answers).slice(0, 1) };
    if (countGaps(item.prompt) !== 1) return null;
    if (item.options.length < 2 || item.options.length > 4) return null;
    if (item.answers.length !== 1 || !inList(item.answers[0], item.options)) return null;
    return item;
  },
  "multi-select": (raw) => {
    const item = { source: str(raw.source), options: strList(raw.options), answers: strList(raw.answers) };
    if (!item.source || item.options.length < 3) return null;
    // The prompt asks for at least two, but one right answer out of several
    // is still a fair "pick every correct one" item.
    if (item.answers.length < 1 || item.answers.length >= item.options.length) return null;
    if (!item.answers.every((answer) => inList(answer, item.options))) return null;
    return item;
  },
  "judge-correct": (raw) => {
    const item = { prompt: str(raw.prompt), isCorrect: raw.isCorrect === true, answers: strList(raw.answers) };
    if (!item.prompt || typeof raw.isCorrect !== "boolean") return null;
    if (item.isCorrect) item.answers = [];
    else if (item.answers.length === 0) return null;
    return item;
  },
  classify: (raw, exercise) => {
    const item = { prompt: str(raw.prompt), answers: strList(raw.answers).slice(0, 1) };
    if (!item.prompt || item.answers.length !== 1) return null;
    if (!inList(item.answers[0], exercise.labels)) return null;
    return item;
  },
  "word-order": (raw) => {
    const item = { fragments: strList(raw.fragments), answers: strList(raw.answers) };
    if (item.fragments.length < 3 || item.answers.length === 0) return null;
    // The fragments must actually make the first answer, in some order.
    const words = (text) => normalizeAnswer(text).replace(/[.,;:!?¡¿"«»]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
    const joinedSorted = words(item.fragments.join(" "));
    const answerSorted = words(item.answers[0]);
    if (joinedSorted !== answerSorted) return null;
    // Already in order would be no exercise at all.
    if (normalizeAnswer(item.fragments.join(" ")) === normalizeAnswer(item.answers[0])) {
      item.fragments = [...item.fragments.slice(1), item.fragments[0]];
    }
    return item;
  },
  conjugate: (raw) => {
    const item = { prompt: str(raw.prompt), cue: str(raw.cue), answers: strList(raw.answers) };
    if (countGaps(item.prompt) !== 1 || !item.cue || item.answers.length === 0) return null;
    if (leaks(item.answers, item.prompt)) return null;
    return item;
  },
  "conjugate-contrast": (raw) => {
    const item = { groupId: str(raw.groupId) || "g1", prompt: str(raw.prompt), cue: str(raw.cue), answers: strList(raw.answers) };
    if (countGaps(item.prompt) !== 1 || !item.cue || item.answers.length === 0) return null;
    if (leaks(item.answers, item.prompt)) return null;
    return item;
  },
  "gap-by-cue": (raw) => {
    const item = { prompt: str(raw.prompt), answers: strList(raw.answers) };
    if (countGaps(item.prompt) !== 1 || item.answers.length === 0) return null;
    if (!str(raw.cueLabel)) return null;
    if (leaks(item.answers, item.prompt)) return null;
    return item;
  },
  inflect: (raw) => {
    const item = { prompt: str(raw.prompt), answers: strList(raw.answers) };
    if (!item.prompt || item.answers.length === 0 || !str(raw.cueLabel)) return null;
    if (item.answers.some((answer) => normalizeAnswer(answer) === normalizeAnswer(item.prompt))) return null;
    return item;
  },
  "fill-from-bank": (raw, exercise) => {
    const item = { position: Number(raw.position), answers: strList(raw.answers).slice(0, 1) };
    if (!Number.isInteger(item.position) || item.position < 1) return null;
    if (item.answers.length !== 1 || !inList(item.answers[0], exercise.wordBank)) return null;
    return item;
  },
  transform: (raw) => {
    const item = { prompt: str(raw.prompt), answers: strList(raw.answers) };
    if (!SPAN.test(item.prompt) || item.answers.length === 0) return null;
    return item;
  },
  "build-sentence": (raw) => {
    const item = { parts: strList(raw.parts), answers: strList(raw.answers) };
    if (item.parts.length < 2 || item.answers.length === 0) return null;
    return item;
  },
  translate: (raw) => {
    const item = { source: str(raw.source), answers: strList(raw.answers) };
    if (!item.source || item.answers.length === 0) return null;
    return item;
  },
  "open-completion": (raw) => {
    const item = { prompt: str(raw.prompt), sampleAnswers: strList(raw.sampleAnswers), answers: [] };
    if (!item.prompt || !str(raw.constraint) || item.sampleAnswers.length === 0) return null;
    return item;
  },
};

/** Reader-language fields carried per item into the gloss. */
export const ITEM_GLOSS_FIELDS = ["explanation", "cueLabel", "source", "constraint"];
/** Reader-language fields carried per exercise into the gloss. */
export const EXERCISE_GLOSS_FIELDS = ["instructions", "focusLabel", "operation"];

/**
 * @param {string} type
 * @param {object} raw - parsed model output
 * @returns {{ exercise: object|null, problems: string[] }}
 */
export function sanitizeExercise(type, raw) {
  const problems = [];
  const rule = ITEM_RULES[type];
  if (!rule) return { exercise: null, problems: [`unknown type ${type}`] };
  if (!raw || typeof raw !== "object") return { exercise: null, problems: ["no JSON object"] };

  const exercise = {
    topicKey: str(raw.topicKey),
    family: str(raw.family),
    focus: str(raw.focus),
    focusLabel: str(raw.focusLabel),
    instructions: str(raw.instructions),
    operation: str(raw.operation),
    labels: strList(raw.labels),
    passage: str(raw.passage).replace(/_{3,}(?:\s+_{3,})+/g, "___"),
    wordBank: strList(raw.wordBank),
  };

  if (type === "classify" && exercise.labels.length < 2) problems.push("classify needs labels");
  if (type === "fill-from-bank" && (!exercise.passage || exercise.wordBank.length === 0)) {
    problems.push("fill-from-bank needs a passage and a word bank");
  }
  if (problems.length) return { exercise: null, problems };

  const items = [];
  const seenIds = new Set();
  (Array.isArray(raw.items) ? raw.items : []).forEach((rawItem, index) => {
    if (!rawItem || typeof rawItem !== "object") return;
    const cleaned = rule(rawItem, exercise);
    if (!cleaned) {
      problems.push(`item ${index + 1} dropped`);
      return;
    }
    let id = str(rawItem.id) || `i${index + 1}`;
    if (seenIds.has(id)) id = `i${index + 1}_${items.length}`;
    seenIds.add(id);
    const item = { id, ...cleaned };
    for (const field of ITEM_GLOSS_FIELDS) {
      const value = str(rawItem[field]);
      if (value && !(field === "source" && item.source)) item[field] = value;
    }
    items.push(item);
  });

  if (type === "fill-from-bank") {
    // Positions must line up with the blanks actually in the passage.
    const gaps = countGaps(exercise.passage);
    const valid = items.filter((item) => item.position <= gaps);
    const positions = new Set(valid.map((item) => item.position));
    if (valid.length !== gaps || positions.size !== gaps) {
      return { exercise: null, problems: [...problems, "passage gaps and items disagree"] };
    }
    valid.sort((a, b) => a.position - b.position);
    items.length = 0;
    items.push(...valid);
  }

  if (!exercise.topicKey) problems.push("no topicKey");
  exercise.items = items;
  return { exercise, problems };
}
