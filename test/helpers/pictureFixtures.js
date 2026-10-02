/**
 * Fixtures for the picture games: a pool of pictured concepts, their
 * practice-language words, and the signed-in context the games read.
 *
 * Pure data and functions only (no `vi`): the games' services are mocked in each
 * test file, and these are what the mocks return.
 */

import { makeAppContext } from "./appContext";

export const BUCKET_ORIGIN = "https://storage.googleapis.com/my-bucket/";
export const pictureUrl = (id) => `${BUCKET_ORIGIN}conceptPictures/${id}/abc.webp`;
export const sceneUrl = (id) => `${BUCKET_ORIGIN}pictureScenes/${id}/abc.webp`;

/**
 * `count` pictured concepts, `c0`…, each with a topic and a practice-language
 * word `PALAVRA0`…. `topics` cycles through the topic ids.
 */
export function makePool(count, { topics = [] } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    sourceWord: `thing${i}`,
    senseKey: null,
    topicIds: topics.length ? [topics[i % topics.length]] : [],
    url: pictureUrl(`c${i}`),
    width: 512,
    height: 512,
  }));
}

/** The words a player of pt-PT has for a pool: `Map(conceptId → {word, baseForm})`. */
export function translationsFor(pool, { skip = [] } = {}) {
  return new Map(
    pool
      .filter((concept) => !skip.includes(concept.id))
      .map((concept) => [concept.id, { word: `PALAVRA${concept.id.slice(1)}`, baseForm: null }]),
  );
}

/** The word shown for a concept id, as translationsFor writes it. */
export const wordOf = (id) => `PALAVRA${id.slice(1)}`;

/** The concept id behind an image URL from makePool. */
export const idFromUrl = (url) => url.match(/conceptPictures\/([^/]+)\//)?.[1] ?? url.match(/pictureScenes\/([^/]+)\//)?.[1];

/**
 * A signed-in player. `tier` is a tier id; the config grants every picture game
 * to it, and `unlimited` makes its AI allowance infinite (a Maestro).
 */
export function signedInContext({ tier = "maestro", unlimited = true, user = {}, ...rest } = {}) {
  return makeAppContext({
    user: {
      uid: "u1",
      token: "tok",
      displayName: "Test User",
      subscriptionTier: tier,
      learningDialect: "pt-PT",
      interfaceLang: "pt-PT",
      interests: [],
      aiCallsToday: 0,
      ...user,
    },
    tiersConfig: {
      [tier]: {
        id: tier,
        label: tier,
        order: 2,
        isFree: false,
        hidden: false,
        aiCallsPerDay: unlimited ? Infinity : 3,
        features: [
          "picture_games",
          "picture_match",
          "picture_memory",
          "picture_odd_one_out",
          "picture_album",
          "picture_describe",
        ],
      },
    },
    features: [],
    categories: [
      { id: "animals", label: "Animais" },
      { id: "home", label: "Casa" },
    ],
    ...rest,
  });
}
