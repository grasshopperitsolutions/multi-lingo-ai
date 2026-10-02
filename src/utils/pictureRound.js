/**
 * pictureRound.js
 *
 * The picking rules of the picture games, as pure functions.
 *
 * Everything that decides *which words go in a round* or *what a turn looks
 * like* is here and takes its randomness as an argument, so each rule can be
 * tested with a fixed sequence instead of by playing the game until it shows.
 * The hooks and components only fetch, hold state and draw.
 *
 * A "round word" is a picture joined with its practice-language word:
 *
 *   { conceptId, word, baseForm, url, sourceWord, senseKey, topicIds, width, height }
 *
 * `sourceWord` is the English label the concept is filed under. It is used to
 * tell two concepts apart and is never shown to a learner.
 */

/** @typedef {{conceptId: string, word: string, baseForm: string|null, url: string, sourceWord: string, senseKey: string|null, topicIds: string[], width?: number, height?: number}} RoundWord */

/** Fisher–Yates, on a copy. */
export function shuffle(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Lower-case and drop the Latin combining accents, so "maçã" matches "maca".
 *
 * Only U+0300–U+036F: stripping every combining mark would turn Japanese が
 * (か + a voicing mark) into か, which is a different word.
 */
export function normalizeForMatch(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// ── Choosing the words of a round ───────────────────────────────────────────

/**
 * Put the concepts in the order a round should try them.
 *
 * Shuffled first, so no two rounds are alike. Then two stable preferences, the
 * second one stronger: words the player has not just seen come before words
 * they have (a round "avoids words from the last few rounds", but repeats are
 * the point of these games, so it is a preference and never an exclusion), and
 * words on the player's interests come before everything else. Nothing is
 * dropped: a pool is never made smaller by who is playing.
 *
 * @template {{id: string, topicIds?: string[]}} T
 * @param {T[]} concepts
 * @param {{ preferTopicIds?: string[], recentIds?: string[], rng?: () => number }} [options]
 * @returns {T[]}
 */
export function orderCandidates(concepts, { preferTopicIds = [], recentIds = [], rng = Math.random } = {}) {
  const recent = new Set(recentIds);
  const wanted = new Set(preferTopicIds);
  const rank = (concept) => {
    const onInterest = (concept.topicIds ?? []).some((id) => wanted.has(id));
    return (onInterest ? 0 : 2) + (recent.has(concept.id) ? 1 : 0);
  };
  // Array.prototype.sort is stable, so equal ranks keep their shuffled order.
  return shuffle(concepts, rng).sort((a, b) => rank(a) - rank(b));
}

// ── Liga a imagem ───────────────────────────────────────────────────────────

/**
 * Whether `candidate` can sit beside `answer` as a wrong option without making
 * the turn unfair.
 *
 * Two different concepts can have one word in a language (a "cup" and a "mug"
 * both being "chávena"), and two can be so alike that either is a fair answer
 * to one picture. A distractor therefore must not share the answer's word, its
 * English label, or — when both have one — its sense key.
 */
function isFairDistractor(answer, candidate) {
  if (candidate.conceptId === answer.conceptId) return false;
  if (normalizeForMatch(candidate.word) === normalizeForMatch(answer.word)) return false;
  if (normalizeForMatch(candidate.sourceWord) === normalizeForMatch(answer.sourceWord)) return false;
  if (answer.senseKey && candidate.senseKey && answer.senseKey === candidate.senseKey) return false;
  return true;
}

/**
 * The turns of one "Liga a imagem" round.
 *
 * Turn 0 shows a word and four pictures; turn 1 shows a picture and four
 * words; and so on, every other turn reversed. Each turn has exactly four
 * options, one right, none unfair against it or against each other. A turn that
 * cannot find three fair wrong options in the pool is dropped rather than
 * shown short.
 *
 * @param {RoundWord[]} words - the answers, in the order to play them
 * @param {RoundWord[]} pool - everything the wrong options may come from
 * @param {{ turns?: number, rng?: () => number }} [options]
 * @returns {Array<{ id: number, direction: "word_to_picture"|"picture_to_word", answer: RoundWord, options: RoundWord[] }>}
 */
export function buildMatchTurns(words, pool, { turns = 8, rng = Math.random } = {}) {
  const built = [];

  for (const answer of words.slice(0, turns)) {
    const chosen = [];
    for (const candidate of shuffle(pool, rng)) {
      if (chosen.length === 3) break;
      if (isFairDistractor(answer, candidate) && chosen.every((other) => isFairDistractor(other, candidate))) {
        chosen.push(candidate);
      }
    }
    if (chosen.length < 3) continue;

    const index = built.length;
    built.push({
      id: index,
      direction: index % 2 === 0 ? "word_to_picture" : "picture_to_word",
      answer,
      options: shuffle([answer, ...chosen], rng),
    });
  }

  return built;
}

// ── Jogo da memória ─────────────────────────────────────────────────────────

/**
 * The cards of a memory game: for each word, one picture card and one word
 * card, shuffled together. A pair is the two cards sharing a `conceptId`.
 *
 * @param {RoundWord[]} words
 * @param {{ rng?: () => number }} [options]
 * @returns {Array<{ key: string, conceptId: string, kind: "picture"|"word", word: RoundWord }>}
 */
export function buildMemoryDeck(words, { rng = Math.random } = {}) {
  return shuffle(
    words.flatMap((word) => [
      { key: `${word.conceptId}:picture`, conceptId: word.conceptId, kind: "picture", word },
      { key: `${word.conceptId}:word`, conceptId: word.conceptId, kind: "word", word },
    ]),
    rng,
  );
}

// ── Qual é o intruso? ───────────────────────────────────────────────────────

/**
 * Group concepts by topic. A concept on several topics is in each group.
 * Concepts with no topics belong to none: an untagged word is not *known* to
 * be on any topic, so it cannot be a trio member or a known outsider.
 *
 * @template {{topicIds?: string[]}} T
 * @param {T[]} concepts
 * @returns {Map<string, T[]>}
 */
export function groupByTopic(concepts) {
  const groups = new Map();
  for (const concept of concepts) {
    for (const topicId of concept.topicIds ?? []) {
      if (!groups.has(topicId)) groups.set(topicId, []);
      groups.get(topicId).push(concept);
    }
  }
  return groups;
}

/**
 * Three words from one topic and one that is not, for one "Qual é o
 * intruso?" turn.
 *
 * The outsider must be tagged (so it is *known* not to be on the topic) and
 * must not be on the trio's topic. The four must also show four different
 * words, or two identical captions would give the game away or confuse it.
 * Null when the pool has no topic with three words and an outsider to go
 * with it.
 *
 * @param {RoundWord[]} pool
 * @param {{ rng?: () => number, avoid?: Set<string>, preferTopicIds?: string[] }} [options]
 *   `avoid` holds keys of turns already played this round (`topic|outsider`).
 * @returns {{ topicId: string, key: string, trio: RoundWord[], intruder: RoundWord, items: RoundWord[] } | null}
 */
export function pickOddOneOut(pool, { rng = Math.random, avoid = new Set(), preferTopicIds = [] } = {}) {
  const groups = groupByTopic(pool);
  const wanted = new Set(preferTopicIds);

  const topics = shuffle(
    [...groups.entries()].filter(([, members]) => members.length >= 3).map(([topicId]) => topicId),
    rng,
  ).sort((a, b) => (wanted.has(a) ? 0 : 1) - (wanted.has(b) ? 0 : 1));

  for (const topicId of topics) {
    const trio = shuffle(groups.get(topicId), rng).slice(0, 3);
    const trioWords = new Set(trio.map((word) => normalizeForMatch(word.word)));

    const outsiders = shuffle(pool, rng).filter(
      (word) =>
        (word.topicIds ?? []).length > 0 &&
        !word.topicIds.includes(topicId) &&
        !trioWords.has(normalizeForMatch(word.word)) &&
        !avoid.has(`${topicId}|${word.conceptId}`),
    );
    const intruder = outsiders[0];
    if (!intruder) continue;

    return {
      topicId,
      key: `${topicId}|${intruder.conceptId}`,
      trio,
      intruder,
      items: shuffle([...trio, intruder], rng),
    };
  }

  return null;
}

/**
 * The turns of one "Qual é o intruso?" round: up to `turns` of pickOddOneOut,
 * never the same trio-and-outsider twice in a round. Fewer when the pool runs
 * out of fresh ones; empty when it has none at all.
 *
 * @param {RoundWord[]} pool
 * @param {{ turns?: number, rng?: () => number, preferTopicIds?: string[] }} [options]
 */
export function buildOddOneOutTurns(pool, { turns = 6, rng = Math.random, preferTopicIds = [] } = {}) {
  const avoid = new Set();
  const built = [];
  for (let i = 0; i < turns; i += 1) {
    const turn = pickOddOneOut(pool, { rng, avoid, preferTopicIds });
    if (!turn) break;
    avoid.add(turn.key);
    built.push({ id: i, ...turn });
  }
  return built;
}

// ── Descreve a imagem ───────────────────────────────────────────────────────

/**
 * The words for a scene: one topic with at least `minCount` pictured words,
 * preferring the player's interests, and up to `count` of them.
 *
 * A scene is drawn from these, and the player is then asked to describe it
 * using their practice-language words, so every concept here must have a
 * translation. The caller passes only such words.
 *
 * @param {RoundWord[]} pool
 * @param {{ preferTopicIds?: string[], rng?: () => number, count?: number, minCount?: number }} [options]
 * @returns {{ topicId: string, words: RoundWord[] } | null}
 */
export function pickSceneWords(pool, { preferTopicIds = [], rng = Math.random, count = 5, minCount = 4 } = {}) {
  const groups = groupByTopic(pool);
  const wanted = new Set(preferTopicIds);

  const topics = shuffle(
    [...groups.entries()].filter(([, members]) => members.length >= minCount).map(([topicId]) => topicId),
    rng,
  ).sort((a, b) => (wanted.has(a) ? 0 : 1) - (wanted.has(b) ? 0 : 1));

  const topicId = topics[0];
  if (!topicId) return null;

  const words = shuffle(groups.get(topicId), rng).slice(0, Math.min(count, 6));
  return { topicId, words };
}

const UNSPACED_SCRIPT = /[฀-๿぀-ヿ㐀-鿿가-힯]/;
const SPLIT = /[^\p{L}\p{N}]+/u;

/**
 * Which of the target words a description uses.
 *
 * Counted in code, never by a model: "found 4 of 6" is a number, and a model's
 * guess at it is the one thing about this feature that must not be wrong. A
 * word is found when the text has it, or its dictionary form (`baseForm`), as a
 * whole word, ignoring case and Latin accents. Scripts written without spaces
 * (Japanese, Chinese, Korean, Thai) match as a substring, since there is no
 * word boundary to respect.
 *
 * An inflected form ("gatos" for "gato") is not found. That is the honest
 * answer to "did they use this word?"; the feedback can still praise the
 * plural.
 *
 * @param {string} text
 * @param {Array<{conceptId: string, word: string, baseForm?: string|null}>} targets
 * @returns {{ found: typeof targets, missed: typeof targets }}
 */
export function findWordsInText(text, targets) {
  const normalized = normalizeForMatch(text);
  const spaced = ` ${normalized.split(SPLIT).filter(Boolean).join(" ")} `;
  const tokens = new Set(normalized.split(SPLIT).filter(Boolean));

  const uses = (form) => {
    const target = normalizeForMatch(form);
    if (!target) return false;
    if (UNSPACED_SCRIPT.test(target)) return normalized.includes(target);
    if (SPLIT.test(target)) return spaced.includes(` ${target.split(SPLIT).filter(Boolean).join(" ")} `);
    return tokens.has(target);
  };

  const found = [];
  const missed = [];
  for (const target of targets) {
    (uses(target.word) || (target.baseForm && uses(target.baseForm)) ? found : missed).push(target);
  }
  return { found, missed };
}
