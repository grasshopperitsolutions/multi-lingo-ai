import { describe, it, expect } from "vitest";
import {
  shuffle,
  normalizeForMatch,
  orderCandidates,
  buildMatchTurns,
  buildMemoryDeck,
  groupByTopic,
  pickOddOneOut,
  buildOddOneOutTurns,
  pickSceneWords,
  findWordsInText,
} from "../../src/utils/pictureRound";

/**
 * The picking rules of the picture games. Each takes its randomness as an
 * argument, so every case here is a fixed sequence rather than a game played
 * until it shows the thing.
 */

/** A deterministic "random": cycles through the given values. */
const sequence = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const word = (id, over = {}) => ({
  conceptId: id,
  word: id.toUpperCase(),
  baseForm: null,
  url: `https://x/${id}.webp`,
  sourceWord: `src-${id}`,
  senseKey: null,
  topicIds: [],
  ...over,
});

describe("shuffle", () => {
  it("returns every item once, and does not touch the original", () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items, sequence(0.9, 0.1, 0.5, 0.3));
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("normalizeForMatch", () => {
  it("lower-cases and drops Latin accents", () => {
    expect(normalizeForMatch("  Maçã ")).toBe("maca");
    expect(normalizeForMatch("PÃO")).toBe("pao");
  });

  it("leaves Japanese voicing marks alone: が and か are different words", () => {
    expect(normalizeForMatch("が")).toBe("が".normalize("NFD"));
    expect(normalizeForMatch("が")).not.toBe(normalizeForMatch("か"));
  });

  it("copes with nothing", () => {
    expect(normalizeForMatch(undefined)).toBe("");
    expect(normalizeForMatch(null)).toBe("");
  });
});

describe("orderCandidates", () => {
  const pool = [
    { id: "a", topicIds: ["animals"] },
    { id: "b", topicIds: ["food"] },
    { id: "c", topicIds: [] },
    { id: "d", topicIds: ["animals"] },
  ];

  it("puts words on the player's interests first, and never drops one", () => {
    const ordered = orderCandidates(pool, { preferTopicIds: ["animals"], rng: sequence(0.2, 0.7, 0.4) });
    expect(ordered.slice(0, 2).map((c) => c.id).sort()).toEqual(["a", "d"]);
    expect(ordered).toHaveLength(4);
  });

  it("leans away from words just played, but allows them: repeats are the point", () => {
    const ordered = orderCandidates(pool, { recentIds: ["a", "b"], rng: sequence(0.5) });
    const lastTwo = ordered.slice(-2).map((c) => c.id).sort();
    expect(lastTwo).toEqual(["a", "b"]);
    expect(ordered.map((c) => c.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("weighs an interest above having just played the word", () => {
    const ordered = orderCandidates(pool, { preferTopicIds: ["animals"], recentIds: ["a"], rng: sequence(0.5) });
    // a: interest + recent (rank 1); b, c: neither (rank 2). So a still beats b and c.
    expect(ordered.findIndex((c) => c.id === "a")).toBeLessThan(ordered.findIndex((c) => c.id === "b"));
  });
});

describe("buildMatchTurns", () => {
  const words = ["gato", "cao", "casa", "mesa", "livro", "pao"].map((id) => word(id));

  it("builds four options a turn, exactly one of them right", () => {
    const turns = buildMatchTurns(words.slice(0, 3), words, { turns: 3, rng: sequence(0.3, 0.6, 0.1) });
    expect(turns).toHaveLength(3);
    for (const turn of turns) {
      expect(turn.options).toHaveLength(4);
      expect(turn.options.filter((o) => o.conceptId === turn.answer.conceptId)).toHaveLength(1);
      expect(new Set(turn.options.map((o) => o.conceptId)).size).toBe(4);
    }
  });

  it("alternates: a word and four pictures, then a picture and four words", () => {
    const turns = buildMatchTurns(words, words, { turns: 4, rng: sequence(0.4) });
    expect(turns.map((t) => t.direction)).toEqual([
      "word_to_picture",
      "picture_to_word",
      "word_to_picture",
      "picture_to_word",
    ]);
  });

  it("stops at the number of turns asked for", () => {
    expect(buildMatchTurns(words, words, { turns: 2 })).toHaveLength(2);
  });

  it("never offers a wrong option that shares the answer's word: a cup and a mug are both 'chávena'", () => {
    const pool = [
      word("cup", { word: "chávena", sourceWord: "cup" }),
      word("mug", { word: "Chavena", sourceWord: "mug" }),
      word("a", { word: "um" }),
      word("b", { word: "dois" }),
      word("c", { word: "tres" }),
    ];
    for (let i = 0; i < 20; i += 1) {
      const turns = buildMatchTurns([pool[0]], pool, { turns: 1 });
      expect(turns).toHaveLength(1);
      expect(turns[0].options.map((o) => o.conceptId)).not.toContain("mug");
    }
  });

  it("never offers a wrong option with the answer's English label", () => {
    const pool = [
      word("x", { sourceWord: "bat", word: "morcego" }),
      word("y", { sourceWord: "bat", word: "taco" }),
      word("a"),
      word("b"),
      word("c"),
    ];
    const turns = buildMatchTurns([pool[0]], pool, { turns: 1 });
    expect(turns[0].options.map((o) => o.conceptId)).not.toContain("y");
  });

  it("never offers a wrong option sharing the answer's sense key, when both have one", () => {
    const pool = [
      word("dog", { senseKey: "animal", word: "cao" }),
      word("cat", { senseKey: "animal", word: "gato" }),
      word("a", { senseKey: "tool" }),
      word("b", { senseKey: "food" }),
      word("c", { senseKey: null }),
      word("d", { senseKey: null }),
    ];
    for (let i = 0; i < 20; i += 1) {
      const [turn] = buildMatchTurns([pool[0]], pool, { turns: 1 });
      expect(turn.options.map((o) => o.conceptId)).not.toContain("cat");
    }
  });

  it("does not treat two missing sense keys as a shared one", () => {
    const pool = ["a", "b", "c", "d"].map((id) => word(id, { senseKey: null }));
    expect(buildMatchTurns([pool[0]], pool, { turns: 1 })).toHaveLength(1);
  });

  it("drops a turn it cannot make fair rather than showing it short", () => {
    const pool = [word("a"), word("b"), word("c")];
    expect(buildMatchTurns(pool, pool, { turns: 3 })).toEqual([]);
  });

  it("keeps the wrong options fair against each other too", () => {
    const pool = [
      word("a", { word: "um" }),
      word("b", { word: "dois", sourceWord: "two" }),
      word("c", { word: "Dois", sourceWord: "also-two" }),
      word("d", { word: "tres" }),
      word("e", { word: "quatro" }),
    ];
    for (let i = 0; i < 20; i += 1) {
      const [turn] = buildMatchTurns([pool[0]], pool, { turns: 1 });
      const shown = turn.options.map((o) => normalizeForMatch(o.word));
      expect(new Set(shown).size).toBe(4);
    }
  });
});

describe("buildMemoryDeck", () => {
  it("makes a picture card and a word card for every word", () => {
    const words = ["a", "b", "c"].map((id) => word(id));
    const deck = buildMemoryDeck(words, { rng: sequence(0.2, 0.8) });
    expect(deck).toHaveLength(6);
    for (const w of words) {
      const cards = deck.filter((card) => card.conceptId === w.conceptId);
      expect(cards.map((card) => card.kind).sort()).toEqual(["picture", "word"]);
    }
    expect(new Set(deck.map((card) => card.key)).size).toBe(6);
  });
});

describe("groupByTopic", () => {
  it("puts a word on every topic it has, and an untagged word on none", () => {
    const groups = groupByTopic([
      { id: "a", topicIds: ["animals", "home"] },
      { id: "b", topicIds: ["home"] },
      { id: "c", topicIds: [] },
      { id: "d" },
    ]);
    expect([...groups.keys()].sort()).toEqual(["animals", "home"]);
    expect(groups.get("home").map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("pickOddOneOut", () => {
  const pool = [
    word("cat", { topicIds: ["animals"] }),
    word("dog", { topicIds: ["animals"] }),
    word("bird", { topicIds: ["animals"] }),
    word("sofa", { topicIds: ["home"] }),
    word("table", { topicIds: ["home"] }),
    word("lamp", { topicIds: ["home"] }),
  ];

  it("returns three from one topic and one that is not on it", () => {
    const turn = pickOddOneOut(pool, { rng: sequence(0.1, 0.5, 0.9) });
    expect(turn.trio).toHaveLength(3);
    expect(turn.trio.every((w) => w.topicIds.includes(turn.topicId))).toBe(true);
    expect(turn.intruder.topicIds).not.toContain(turn.topicId);
    expect(turn.items).toHaveLength(4);
    expect(turn.items.map((w) => w.conceptId).sort()).toEqual(
      [...turn.trio.map((w) => w.conceptId), turn.intruder.conceptId].sort(),
    );
  });

  it("never uses an untagged word as the outsider: it is not known to be off the topic", () => {
    const untagged = [...pool.slice(0, 3), word("mystery", { topicIds: [] })];
    expect(pickOddOneOut(untagged, { rng: sequence(0.5) })).toBeNull();
  });

  it("is null when no topic has three words", () => {
    expect(pickOddOneOut(pool.slice(0, 2).concat(pool.slice(3, 5)))).toBeNull();
    expect(pickOddOneOut([])).toBeNull();
  });

  it("will not show two identical captions", () => {
    const clash = [
      word("cat", { topicIds: ["animals"], word: "gato" }),
      word("dog", { topicIds: ["animals"], word: "cao" }),
      word("bird", { topicIds: ["animals"], word: "passaro" }),
      word("tom", { topicIds: ["home"], word: "GATO" }),
    ];
    expect(pickOddOneOut(clash, { rng: sequence(0.5) })).toBeNull();
  });

  it("prefers a topic the player is interested in", () => {
    for (let i = 0; i < 12; i += 1) {
      const turn = pickOddOneOut(pool, { rng: sequence((i % 10) / 10, 0.3), preferTopicIds: ["home"] });
      expect(turn.topicId).toBe("home");
    }
  });
});

describe("buildOddOneOutTurns", () => {
  it("never plays the same trio and outsider twice in a round", () => {
    const pool = [
      ...["a1", "a2", "a3", "a4"].map((id) => word(id, { topicIds: ["animals"] })),
      ...["h1", "h2", "h3", "h4"].map((id) => word(id, { topicIds: ["home"] })),
    ];
    const turns = buildOddOneOutTurns(pool, { turns: 6, rng: Math.random });
    expect(turns.length).toBeGreaterThan(0);
    expect(new Set(turns.map((t) => t.key)).size).toBe(turns.length);
  });

  it("is empty when the pool cannot make one", () => {
    expect(buildOddOneOutTurns([word("a")])).toEqual([]);
  });
});

describe("pickSceneWords", () => {
  it("picks four to six words from one topic", () => {
    const pool = ["a", "b", "c", "d", "e", "f", "g"].map((id) => word(id, { topicIds: ["farm"] }));
    const pick = pickSceneWords(pool, { count: 5 });
    expect(pick.topicId).toBe("farm");
    expect(pick.words).toHaveLength(5);
  });

  it("never asks for more than six", () => {
    const pool = Array.from({ length: 12 }, (_, i) => word(`w${i}`, { topicIds: ["farm"] }));
    expect(pickSceneWords(pool, { count: 99 }).words).toHaveLength(6);
  });

  it("prefers the player's interests", () => {
    const pool = [
      ...["a", "b", "c", "d"].map((id) => word(id, { topicIds: ["farm"] })),
      ...["e", "f", "g", "h"].map((id) => word(id, { topicIds: ["kitchen"] })),
    ];
    for (let i = 0; i < 10; i += 1) {
      expect(pickSceneWords(pool, { preferTopicIds: ["kitchen"], rng: sequence(i / 10, 0.4) }).topicId).toBe("kitchen");
    }
  });

  it("is null without a topic that has enough words", () => {
    const pool = ["a", "b", "c"].map((id) => word(id, { topicIds: ["farm"] }));
    expect(pickSceneWords(pool)).toBeNull();
    expect(pickSceneWords([word("a"), word("b"), word("c"), word("d")])).toBeNull();
  });
});

describe("findWordsInText", () => {
  const targets = [
    { conceptId: "1", word: "gato", baseForm: null },
    { conceptId: "2", word: "maçã", baseForm: null },
    { conceptId: "3", word: "foram", baseForm: "ir" },
    { conceptId: "4", word: "gelado de chocolate", baseForm: null },
  ];
  const ids = (list) => list.map((t) => t.conceptId);

  it("finds a word as a whole word, ignoring case", () => {
    const { found, missed } = findWordsInText("Vejo um GATO no jardim.", targets);
    expect(ids(found)).toEqual(["1"]);
    expect(ids(missed)).toEqual(["2", "3", "4"]);
  });

  it("ignores Latin accents either way", () => {
    expect(ids(findWordsInText("Como uma maca.", targets).found)).toEqual(["2"]);
    expect(ids(findWordsInText("Como uma MAÇÃ.", [{ conceptId: "x", word: "maca" }]).found)).toEqual(["x"]);
  });

  it("finds a word by its dictionary form", () => {
    expect(ids(findWordsInText("Eles vão ir ao mercado.", targets).found)).toEqual(["3"]);
  });

  it("does not find a word inside another word", () => {
    expect(ids(findWordsInText("Os gatos dormem. Um agatonado.", targets).found)).toEqual([]);
  });

  it("does not count an inflected form: that is the honest answer to 'did they use this word?'", () => {
    expect(ids(findWordsInText("Dois gatos.", targets).found)).toEqual([]);
  });

  it("finds a two-word target as a phrase", () => {
    expect(ids(findWordsInText("Comi um gelado de chocolate!", targets).found)).toEqual(["4"]);
    expect(ids(findWordsInText("Comi chocolate e gelado.", targets).found)).toEqual([]);
  });

  it("matches punctuation-separated words", () => {
    expect(ids(findWordsInText("gato, maçã; foram.", targets).found)).toEqual(["1", "2", "3"]);
  });

  it("matches scripts without spaces as a substring", () => {
    const japanese = [{ conceptId: "j", word: "ねこ" }, { conceptId: "k", word: "いぬ" }];
    expect(ids(findWordsInText("かわいいねこがいます", japanese).found)).toEqual(["j"]);
  });

  it("counts nothing for an empty description, and every target as missed", () => {
    const { found, missed } = findWordsInText("", targets);
    expect(found).toEqual([]);
    expect(missed).toHaveLength(4);
  });

  it("returns each target exactly once, in either list", () => {
    const { found, missed } = findWordsInText("gato gato gato", targets);
    expect(found.length + missed.length).toBe(targets.length);
  });
});
