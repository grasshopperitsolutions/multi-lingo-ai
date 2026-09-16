import { usePersonalNoteBoard } from "./usePersonalNoteBoard";
import { usePersonalSettings } from "./usePersonalSettings";
import { usePersonalCollection } from "./usePersonalCollection";
import { useWordFavourites } from "./useWordFavourites";
import { PERSONAL_KINDS } from "../services/personalService";
import { daysUntil } from "../utils/dates";

/**
 * usePersonalDashboard
 *
 * Everything the personal dashboard shows, loaded once at the page and passed
 * down, rather than each widget fetching for itself.
 *
 * ## Why this is not optional
 *
 * The lesson counter and the goal both read `personalSettings/main`. If each
 * widget called `usePersonalSettings()` there would be two independent 800ms
 * debounce buffers writing to the same document and two `flush()` calls on
 * unmount. The patches happen to be disjoint today, so POST-with-an-id merges
 * them and nothing breaks — but that is a race built on purpose, and the next
 * field added to that document will not be disjoint.
 *
 * Request count is the lesser reason. Five queries go out on mount (board,
 * settings, and one per list); the word bank and the streak add none, because
 * both read the already-loaded profile. Five is more than one batch read would
 * cost, but there is no batch endpoint and adding one is API-repo work.
 *
 * ## Two footguns, both already paid for once
 *
 * - `usePersonalCollection`'s `add` / `update` / `remove` close over `items`,
 *   so their identity changes on every list mutation. Never put them in a
 *   dependency array, don't `React.memo` a widget that receives one, and never
 *   `useCallback`-wrap one — that captures the first `update`, which closes
 *   over the empty initial `items`, so a single failed write would roll the
 *   list back to `[]`.
 * - `getFavouriteIds` returns a **fresh `[]`** when the profile has no
 *   `favWordIds`, so `wordBank.words` is a new array identity on every render
 *   for a user who has never saved a word. An effect depending on it re-runs
 *   forever. Key on `words.length` or on the joined contents.
 *
 * Sub-hooks are returned whole rather than flattened: flattening would force
 * `questionsAdd` / `phrasesAdd` / `mistakesAdd` renames, and each widget then
 * takes one prop instead of six.
 */
export function usePersonalDashboard() {
  const board = usePersonalNoteBoard();
  const settings = usePersonalSettings();
  const questions = usePersonalCollection(PERSONAL_KINDS.QUESTION);
  const phrases = usePersonalCollection(PERSONAL_KINDS.PHRASE);
  const mistakes = usePersonalCollection(PERSONAL_KINDS.MISTAKE);
  const wordBank = useWordFavourites(); // no request — reads the loaded profile

  // The lesson plan widget shows what is still to ask; done questions are the
  // archive and live on the full page.
  const openQuestions = questions.items.filter((item) => item.done !== true);
  const doneCount = questions.items.length - openQuestions.length;

  const isLoading =
    board.isLoading ||
    settings.isLoading ||
    questions.isLoading ||
    phrases.isLoading ||
    mistakes.isLoading;

  // Drives the first-run card. Deliberately not a stored flag: it has to go
  // away the moment anything exists, including something written on another
  // device, and come back if the user empties everything out.
  const isEmpty =
    !isLoading &&
    !board.text.trim() &&
    !settings.settings.lessonsRemaining &&
    !settings.settings.goalDate &&
    questions.items.length === 0 &&
    phrases.items.length === 0 &&
    mistakes.items.length === 0 &&
    wordBank.words.length === 0;

  return {
    board,
    settings,
    questions,
    phrases,
    mistakes,
    wordBank,
    openQuestions,
    doneCount,
    daysToGoal: daysUntil(settings.settings.goalDate),
    isLoading,
    isEmpty,
  };
}
