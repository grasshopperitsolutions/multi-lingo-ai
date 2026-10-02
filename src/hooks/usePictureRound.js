import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { useSessionRecovery } from "./useSessionRecovery";
import { useInterestTopics } from "./useInterestTopics";
import { useSeenConcepts } from "./useSeenConcepts";
import { getPicturePool, requestPicture } from "../services/getImageService";
import { isAiDeclined } from "../services/aiService";
import { ensureConceptTranslation, generateNewConcept, getConceptTranslations } from "../services/getWordService";
import { getGlobalSeenIds } from "../services/userService";
import { isDailyLimit } from "../utils/aiUsage";
import { orderCandidates } from "../utils/pictureRound";

/** How many candidates have their practice-language word read at a time. */
const CANDIDATE_BATCH = 24;
/** Words remembered per language, so the next round leans away from a wrong answer's word. */
const RECENT_LIMIT = 24;
/** New words one round asks for in the background, to keep the next one supplied. */
const BACKGROUND_MAX = 4;
/** How many candidates may be tried (each can cost a few AI calls) for every word needed. */
const ATTEMPTS_PER_WORD = 3;
/** Brand-new concepts that fail one after another before it gives up. */
const MAX_FAILURES_IN_A_ROW = 3;

const recentByLocale = new Map();

function rememberRecent(locale, conceptIds) {
  const merged = [...conceptIds, ...(recentByLocale.get(locale) ?? [])];
  recentByLocale.set(locale, [...new Set(merged)].slice(0, RECENT_LIMIT));
}

/** Forget what was played. Tests use it. */
export function clearRecentWords() {
  recentByLocale.clear();
}

function toRoundWord(concept, translation) {
  return {
    conceptId: concept.id,
    word: translation.word,
    baseForm: translation.baseForm ?? null,
    url: concept.url,
    sourceWord: concept.sourceWord,
    senseKey: concept.senseKey ?? null,
    topicIds: concept.topicIds ?? [],
    width: concept.width,
    height: concept.height,
  };
}

/**
 * The pictured concepts a player of this language can actually use: each one
 * joined with its practice-language word, in the order a round should try them,
 * until `target` have been found or the pool runs out.
 *
 * A **read only**. A concept with no word in this language is simply absent
 * here; getting one a word is growPlayableWords' job, and only when the player
 * has run short.
 *
 * Words are read a batch at a time, so a thin pool costs one batch and a rich
 * one stops as soon as it has enough. Exported for the games that gather their
 * own words (a scene is made from several at once) instead of using a round.
 *
 * @returns {Promise<import("../utils/pictureRound").RoundWord[]|null>} null when cancelled
 */
export async function gatherPlayableWords({
  pictured,
  token,
  locale,
  preferTopicIds = [],
  recentIds = [],
  target,
  isCancelled = () => false,
}) {
  const ordered = orderCandidates(pictured, { preferTopicIds, recentIds });
  const found = [];

  for (let i = 0; i < ordered.length && found.length < target; i += CANDIDATE_BATCH) {
    const batch = ordered.slice(i, i + CANDIDATE_BATCH);
    const translations = await getConceptTranslations(
      batch.map((concept) => concept.id),
      locale,
      token,
    );
    if (isCancelled()) return null;
    for (const concept of batch) {
      const translation = translations.get(concept.id);
      if (translation) found.push(toRoundWord(concept, translation));
    }
  }

  return found;
}

/**
 * Get more words for a player who has run short of ones they have not seen: the
 * "pool exhausted" step every word game has, here with a picture to go with it.
 * In the order that spends least:
 *
 * 1. a pictured concept the player has not seen, **with no word in their
 *    language yet**: one translation call, and it is playable;
 * 2. a concept the pool has but nobody has ever asked a picture for: a
 *    translation if it needs one, then the server draws it (organically, as the
 *    game needs it, and never in bulk);
 * 3. nothing left that is unseen: a **brand-new concept** from the AI, then its
 *    picture. It may come back as one the pool already had (the pool's own
 *    uniqueness check adopts it), so it is checked against what the player has
 *    seen and what is already in hand.
 *
 * Sequential, because each step can be a model call and several at once would
 * compete with whatever the player does next. It never throws: a step that fails
 * counts as an attempt and the next is tried, and it stops outright when the
 * account's day is spent (the daily AI limit, the picture cap, a declined spend
 * prompt). The caller gets whatever was added, which may be nothing.
 *
 * These are ordinary AI calls, counted like any other. The picture games are for
 * tiers with no daily cap, which is why this can run without asking.
 *
 * @param {{
 *   need: number,
 *   token: string,
 *   locale: string,
 *   userDialect: string,
 *   topics?: Array<{id: string, label: string}>,
 *   seen: Set<string>,
 *   pictured: Array<object>,
 *   unpictured: Array<object>,
 *   have?: Set<string>,
 *   preferTopicIds?: string[],
 *   maxAttempts?: number,
 *   isCancelled?: () => boolean,
 * }} params
 * @returns {Promise<import("../utils/pictureRound").RoundWord[]>} the words that were added
 */
export async function growPlayableWords({
  need,
  token,
  locale,
  userDialect,
  topics = [],
  seen,
  pictured,
  unpictured,
  have = new Set(),
  preferTopicIds = [],
  maxAttempts = Math.max(6, need * ATTEMPTS_PER_WORD),
  isCancelled = () => false,
}) {
  const added = [];
  const taken = new Set(have);
  let attempts = 0;

  const finished = () => isCancelled() || added.length >= need || attempts >= maxAttempts;
  /** True when the account's day is spent, so no further attempt can work. */
  const dayIsOver = (err) => {
    console.warn("[usePictureRound] growing the pool:", err?.message);
    return isDailyLimit(err) || isAiDeclined(err);
  };
  const refused = (result) => result.code === "PICTURE_CAP" || result.code === "PICTURE_GUEST";

  // 1. Pictured and unseen, but with no word in this language.
  const needWord = orderCandidates(
    pictured.filter((concept) => !seen.has(concept.id) && !taken.has(concept.id)),
    { preferTopicIds },
  );
  for (const concept of needWord) {
    if (finished()) return added;
    attempts += 1;
    try {
      const translation = await ensureConceptTranslation({
        conceptId: concept.id,
        sourceWord: concept.sourceWord,
        userDialect,
        learningDialect: locale,
        token,
      });
      if (isCancelled()) return added;
      added.push(toRoundWord(concept, translation));
      taken.add(concept.id);
    } catch (err) {
      if (dayIsOver(err)) return added;
    }
  }

  // 2. In the pool, never asked for a picture.
  const fresh = orderCandidates(
    unpictured.filter((concept) => !seen.has(concept.id) && !taken.has(concept.id)),
    { preferTopicIds },
  );
  for (const concept of fresh) {
    if (finished()) return added;
    attempts += 1;
    try {
      // The word first: a picture is the dear call, so it is not spent on a
      // concept this player could not be given a word for.
      const translation = await ensureConceptTranslation({
        conceptId: concept.id,
        sourceWord: concept.sourceWord,
        userDialect,
        learningDialect: locale,
        token,
      });
      if (isCancelled()) return added;
      const result = await requestPicture(concept.id, token);
      if (refused(result)) return added;
      if (result.status === "ready") {
        added.push(toRoundWord({ ...concept, url: result.url, senseKey: null }, translation));
        taken.add(concept.id);
      }
    } catch (err) {
      if (dayIsOver(err)) return added;
    }
  }

  // 3. Everything the pool holds has been seen: a brand-new concept. Each one is
  // a text call and a picture, so a run of failures ends it: something is wrong
  // (the model, the network), and trying again would only spend more.
  let failures = 0;
  while (!finished()) {
    attempts += 1;
    try {
      const generated = await generateNewConcept({ token, userDialect, learningDialect: locale, topics });
      if (isCancelled()) return added;
      if (seen.has(generated.conceptId) || taken.has(generated.conceptId)) continue;
      const result = await requestPicture(generated.conceptId, token);
      if (refused(result)) return added;
      if (result.status === "ready") {
        failures = 0;
        added.push(
          toRoundWord(
            { id: generated.conceptId, sourceWord: generated.sourceWord, topicIds: generated.topicIds, url: result.url },
            { word: generated.word, baseForm: null },
          ),
        );
        taken.add(generated.conceptId);
      } else {
        failures += 1;
      }
    } catch (err) {
      if (dayIsOver(err)) return added;
      failures += 1;
    }
    if (failures >= MAX_FAILURES_IN_A_ROW) return added;
  }

  return added;
}

/**
 * usePictureRound
 *
 * Picks the words of a picture-game round, by the same rules as every other word
 * game.
 *
 * - **The seen rule.** A concept the player got right is on their global
 *   `seenConceptIds` (`markSeen`) and is never an *answer* again, so the games
 *   keep moving through the pool. A wrong answer does not mark it: the word is
 *   still unmet. Wrong *options* may be words already seen, since a word the
 *   player knows is a good thing to be wrong about; only the answer must be new.
 * - **The pool** is every unseen concept with a ready picture *and* a word in the
 *   player's practice language. Interests come first, for every tier. The
 *   words of `pool` beyond the unseen ones are marked `seen: true`.
 * - **Getting more.** Under `minWords` playable unseen words the round waits
 *   (`status: "preparing"`) while growPlayableWords translates, draws or invents
 *   enough to start. Once it has started, a pool with less than two rounds of
 *   unseen words in hand tops itself up in the background (a few at a time), and
 *   the new words are used from the next round. Pictures are only ever drawn this
 *   way, as a game needs them.
 *
 * `want` is how many words the round itself uses; `poolSize` is how many playable
 * words to gather in all (the rest are for wrong options, and for games that need
 * to look across topics). `minWords` is the fewest that makes a game worth
 * starting.
 *
 * @param {{ want: number, poolSize?: number, minWords: number }} options
 * @returns {{
 *   status: "loading"|"preparing"|"ready"|"thin"|"error",
 *   roundId: number,
 *   words: import("../utils/pictureRound").RoundWord[],
 *   pool: import("../utils/pictureRound").RoundWord[],
 *   isFilling: boolean,
 *   error: string|null,
 *   newRound: () => void,
 *   markSeen: (conceptIds: string[]) => void,
 * }}
 */
export function usePictureRound({ want, poolSize, minWords }) {
  const { user } = useAppContext();
  const recoverSession = useSessionRecovery();
  const { topics } = useInterestTopics();
  const { markSeen, seenThisSession } = useSeenConcepts();

  const token = user?.token;
  const uid = user?.uid;
  const locale = user?.learningDialect ?? "pt-PT";
  const userDialect = user?.interfaceLang ?? "en-US";
  const topicKey = topics.map((topic) => topic.id).join("|");
  const target = poolSize ?? want + 8;

  const [roundKey, setRoundKey] = useState(0);
  // `roundId` counts rounds loaded, so a board can be keyed on it and start
  // clean each time instead of resetting a dozen pieces of state by hand.
  const [state, setState] = useState({ status: "loading", roundId: 0, words: [], pool: [], error: null });
  const [isFilling, setIsFilling] = useState(false);
  // A top-up is not cut off by "play again", only by leaving; and only one runs at once.
  const alive = useRef(true);
  const growing = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const newRound = useCallback(() => {
    setState((previous) => ({ ...previous, status: "loading" }));
    setRoundKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const preferTopicIds = topicKey ? topicKey.split("|") : [];
    const recentIds = recentByLocale.get(locale) ?? [];

    (async () => {
      try {
        const [{ pictured, unpictured }, storedSeen] = await Promise.all([
          getPicturePool(token),
          // A seen list that cannot be read must not stop the game: the worst
          // case is a repeat.
          getGlobalSeenIds(token, uid).catch((err) => {
            console.warn("[usePictureRound] seen words unavailable:", err.message);
            return [];
          }),
        ]);
        if (cancelled) return;

        const seen = new Set([...storedSeen, ...seenThisSession()]);
        let found = await gatherPlayableWords({
          pictured: pictured.filter((concept) => !seen.has(concept.id)),
          token,
          locale,
          preferTopicIds,
          recentIds,
          target,
          isCancelled: () => cancelled,
        });
        if (cancelled || !found) return;

        const grow = (need, extra = {}) =>
          growPlayableWords({
            need,
            token,
            locale,
            userDialect,
            topics,
            seen,
            pictured,
            unpictured,
            have: new Set(found.map((word) => word.conceptId)),
            preferTopicIds,
            ...extra,
          });

        // Too few unseen words to start: get some, and say so while it happens.
        if (found.length < minWords) {
          setState((previous) => ({ ...previous, status: "preparing" }));
          const more = await grow(minWords - found.length, { isCancelled: () => cancelled });
          if (cancelled) return;
          found = [...found, ...more];
        }

        // Wrong options may be words already seen; only answers must be new.
        let pool = found;
        if (target > want && found.length < target) {
          const extras = await gatherPlayableWords({
            pictured: pictured.filter((concept) => seen.has(concept.id)),
            token,
            locale,
            preferTopicIds,
            target: target - found.length,
            isCancelled: () => cancelled,
          });
          if (cancelled || !extras) return;
          pool = [...found, ...extras.map((word) => ({ ...word, seen: true }))];
        }

        const words = found.slice(0, want);
        const status = found.length >= minWords ? "ready" : "thin";
        if (status === "ready") rememberRecent(locale, words.map((word) => word.conceptId));
        setState((previous) => ({
          status,
          roundId: previous.roundId + 1,
          words,
          pool,
          error: null,
        }));

        // Keep the next round supplied: fewer than two rounds of unseen words in
        // hand means a few more are fetched now, while this one is played.
        const inHand = found.length;
        if (status === "ready" && inHand < want * 2 && !growing.current) {
          growing.current = true;
          setIsFilling(true);
          grow(Math.min(BACKGROUND_MAX, want * 2 - inHand), { isCancelled: () => !alive.current })
            .catch(() => {})
            .finally(() => {
              growing.current = false;
              if (alive.current) setIsFilling(false);
            });
        }
      } catch (err) {
        if (cancelled) return;
        if (await recoverSession(err)) return;
        if (cancelled) return;
        setState((previous) => ({ status: "error", roundId: previous.roundId, words: [], pool: [], error: err?.message ?? "" }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // `topics`, `seenThisSession` and `userDialect` are read once per load; the
    // key and the language are what should reload a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, uid, locale, topicKey, roundKey, want, target, minWords, recoverSession]);

  return { ...state, isFilling, newRound, markSeen };
}

export default usePictureRound;
