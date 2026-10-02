import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { useSessionRecovery } from "./useSessionRecovery";
import { useInterestTopics } from "./useInterestTopics";
import { fillPictures, getPicturePool } from "../services/getImageService";
import { getConceptTranslations } from "../services/getWordService";
import { orderCandidates } from "../utils/pictureRound";

/**
 * Fewer pictured words than this and the games ask the server for a few more,
 * in the background, while they start with what exists.
 */
export const THIN_POOL = 12;
/** How many pictures one visit asks for. The server caps the account anyway. */
const FILL_MAX = 4;
/** How many candidates have their practice-language word read at a time. */
const CANDIDATE_BATCH = 24;
/** Words remembered per language, so the next round leans away from them. */
const RECENT_LIMIT = 24;

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
 * usePictureRound
 *
 * Picks the words of a picture-game round and keeps a thin pool growing.
 *
 * - **The pool** is every concept with a ready picture *and* a word in the
 *   player's practice language. The word is a read, never a generation: a
 *   translation that is missing means that concept is not used, because
 *   generating one costs an AI call per word.
 * - **Topics.** The player's saved interests come first, for every tier: unlike
 *   the word games, nothing here generates anything, so there is no reason to
 *   hold the preference back from Explorer.
 * - **Repeats are allowed.** Seeing the same word again is the point, so there
 *   is no "seen" exclusion; a round only leans away from the last few rounds'
 *   words.
 * - **A thin pool fills itself.** With fewer than THIN_POOL pictured words the
 *   server is asked for a few more, one at a time like icons. The round starts
 *   with what exists; new pictures are used from the next round.
 *
 * `want` is how many words the round itself uses; `poolSize` is how many
 * playable words to gather in all (the rest are for wrong options, and for
 * games that need to look across topics). `minWords` is the fewest that makes a
 * game worth starting.
 *
 * @param {{ want: number, poolSize?: number, minWords: number }} options
 * @returns {{
 *   status: "loading"|"ready"|"thin"|"error",
 *   roundId: number,
 *   words: import("../utils/pictureRound").RoundWord[],
 *   pool: import("../utils/pictureRound").RoundWord[],
 *   isFilling: boolean,
 *   error: string|null,
 *   newRound: () => void,
 * }}
 */
export function usePictureRound({ want, poolSize, minWords }) {
  const { user } = useAppContext();
  const recoverSession = useSessionRecovery();
  const { topics } = useInterestTopics();

  const token = user?.token;
  const locale = user?.learningDialect ?? "pt-PT";
  const topicKey = topics.map((topic) => topic.id).join("|");
  const target = poolSize ?? want + 8;

  const [roundKey, setRoundKey] = useState(0);
  // `roundId` counts rounds loaded, so a board can be keyed on it and start
  // clean each time instead of resetting a dozen pieces of state by hand.
  const [state, setState] = useState({ status: "loading", roundId: 0, words: [], pool: [], error: null });
  const [isFilling, setIsFilling] = useState(false);
  // The language a fill has been started for, so it happens once per visit.
  const filledForRef = useRef(null);
  // How many pictures the fill has drawn, and whether a thin round has already
  // been retried because of it. The round and the fill start together and
  // finish in either order, so the retry has to be decided from both ends.
  const filledGotRef = useRef(0);
  const retriedRef = useRef(false);
  // The round's outcome, set where it is decided rather than read from state:
  // the fill can finish in the same tick as the round, before React has
  // re-rendered, and a status read at render time would still say "loading".
  const statusRef = useRef("loading");

  const newRound = useCallback(() => {
    statusRef.current = "loading";
    setState((previous) => ({ ...previous, status: "loading" }));
    setRoundKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const preferTopicIds = topicKey ? topicKey.split("|") : [];

    (async () => {
      try {
        const { pictured } = await getPicturePool(token);
        if (cancelled) return;

        const found = await gatherPlayableWords({
          pictured,
          token,
          locale,
          preferTopicIds,
          recentIds: recentByLocale.get(locale) ?? [],
          target,
          isCancelled: () => cancelled,
        });
        if (cancelled || !found) return;

        const words = found.slice(0, want);
        if (found.length >= minWords) rememberRecent(locale, words.map((word) => word.conceptId));
        const status = found.length >= minWords ? "ready" : "thin";
        statusRef.current = status;
        setState((previous) => ({
          status,
          roundId: previous.roundId + 1,
          words,
          pool: found,
          error: null,
        }));
        // The fill finished first and drew something this round could not use
        // yet: look again, once, rather than leaving an empty screen.
        if (status === "thin" && filledGotRef.current > 0 && !retriedRef.current) {
          retriedRef.current = true;
          setRoundKey((key) => key + 1);
        }
      } catch (err) {
        if (cancelled) return;
        if (await recoverSession(err)) return;
        if (cancelled) return;
        statusRef.current = "error";
        setState((previous) => ({ status: "error", roundId: previous.roundId, words: [], pool: [], error: err?.message ?? "" }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, locale, topicKey, roundKey, want, target, minWords, recoverSession]);

  // A thin pool grows in the background. Its own effect, not part of the one
  // above: pressing "play again" reloads the round and must not cut a fill off
  // half way, and it must still happen once under StrictMode's double mount.
  useEffect(() => {
    if (!token || filledForRef.current === locale) return undefined;
    let cancelled = false;
    let finished = false;
    filledForRef.current = locale;
    const preferTopicIds = topicKey ? topicKey.split("|") : [];

    (async () => {
      const { pictured, unpictured } = await getPicturePool(token);
      if (cancelled || pictured.length >= THIN_POOL || unpictured.length === 0) return;

      setIsFilling(true);
      const got = await fillMissingPictures({
        unpictured,
        preferTopicIds,
        locale,
        token,
        isCancelled: () => cancelled,
      });
      if (cancelled) return;
      setIsFilling(false);
      filledGotRef.current += got;
      // Nothing was playable and something now is: try again once, rather than
      // leaving the player on an empty screen. (If the round has not finished
      // yet, it makes the same check itself when it does.)
      if (got > 0 && statusRef.current === "thin" && !retriedRef.current) {
        retriedRef.current = true;
        setRoundKey((key) => key + 1);
      }
    })()
      .catch(() => {})
      .finally(() => {
        finished = true;
        if (!cancelled) setIsFilling(false);
      });

    return () => {
      cancelled = true;
      if (!finished) filledForRef.current = null;
    };
  }, [token, locale, topicKey]);

  return { ...state, isFilling, newRound };
}

/**
 * The pictured concepts a player of this language can actually use: each one
 * joined with its practice-language word, in the order a round should try them,
 * until `target` have been found or the pool runs out.
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
 * Ask for a few pictures, for concepts a player of this language can use.
 *
 * Only concepts that already have a word in the practice language are asked
 * for: a picture nobody here could play with is money spent for someone else.
 */
async function fillMissingPictures({ unpictured, preferTopicIds, locale, token, isCancelled }) {
  const ordered = orderCandidates(unpictured, { preferTopicIds }).slice(0, CANDIDATE_BATCH);
  const translations = await getConceptTranslations(
    ordered.map((concept) => concept.id),
    locale,
    token,
  );
  const askFor = ordered.filter((concept) => translations.has(concept.id)).map((concept) => concept.id);
  return fillPictures(askFor, { token, max: FILL_MAX, isCancelled });
}

export default usePictureRound;
