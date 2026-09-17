import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { usePersonalDashboard } from "../../../hooks/usePersonalDashboard";
import { useHiddenWidgets } from "../../../hooks/useHiddenWidgets";
import { PERSONAL_WIDGETS } from "../../../config/personalWidgets";
import { NOTE_BOARD_MAX_CHARS } from "../../../services/personalService";
import FirstRunCard from "../../../components/personal/FirstRunCard";
import LessonCounterWidget from "../../../components/personal/widgets/LessonCounterWidget";
import PracticeStreakWidget from "../../../components/personal/widgets/PracticeStreakWidget";
import NoteBoardWidget from "../../../components/personal/widgets/NoteBoardWidget";
import NextLessonWidget from "../../../components/personal/widgets/NextLessonWidget";
import GoalWidget from "../../../components/personal/widgets/GoalWidget";
import PhrasebookWidget from "../../../components/personal/widgets/PhrasebookWidget";
import MistakesWidget from "../../../components/personal/widgets/MistakesWidget";
import WordBankWidget from "../../../components/personal/widgets/WordBankWidget";
import RecallWidget from "../../../components/personal/widgets/RecallWidget";
import PhotoCaptureWidget from "../../../components/personal/widgets/PhotoCaptureWidget";
import PhotoReviewModal from "../../../components/personal/PhotoReviewModal";
import { PROPOSAL_KINDS } from "../../../services/photoCaptureService";
import { FeaturePageShell, ErrorBanner, Card, PracticeLanguage } from "../../../components/ui";

/**
 * PersonalDashboard
 *
 * `/dashboard/personal` — everything the user owns, live, on one page.
 *
 * It replaces a menu of six cards. A menu is the right shape for a hub of
 * unrelated tools and the wrong shape for your own material, which you want to
 * see rather than navigate to: the point of a note board is the note, not a
 * card that says "Notas".
 *
 * ## Layout
 *
 * A grid, not the horizontal rails `TodayPanel` uses. Those are right for a set
 * that is unbounded, uniform and glanced at; this one is bounded, heterogeneous
 * and operated, and a rail containing a textarea and a date picker is a page
 * turned sideways.
 *
 * Three classes are load-bearing:
 *
 *   - `items-start` — without it the grid stretches every card to its tallest
 *     row sibling, so a short card grows a void and its 6px hard shadow
 *     detaches from its content.
 *   - `lg:`, not `md:` — the content area is `max-w-5xl`, so it stops widening
 *     at exactly this breakpoint. The second column appears at the same moment
 *     the container stops growing. At `md` each column would be narrower than a
 *     phone card.
 *   - `gap-4` clears the offset shadow. Do not reduce it.
 *
 * And one that is not here on purpose: `TodayPanel`'s `px-2 py-3` exists only
 * because `overflow-x: auto` clips vertically and was eating those shadows. A
 * grid has no overflow context, so copying it would add unexplained inset.
 *
 * No `order-*` classes anywhere: DOM order is the order, so tab order and
 * visual order cannot disagree.
 *
 * ## The sub-pages
 *
 * All six stay routed. Each widget that loses something at this size carries a
 * small expand control to its full page — an icon, not a labelled button, so
 * the menu this replaced does not reappear as a row of links.
 */
const PersonalDashboard = () => {
  const { isDarkMode, showAlert } = useAppContext();
  const { canAccess, isReady } = useTierAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    board,
    settings,
    questions,
    phrases,
    mistakes,
    wordBank,
    openQuestions,
    doneCount,
    daysToGoal,
    isEmpty,
  } = usePersonalDashboard();

  const { isHidden } = useHiddenWidgets();
  const boardRef = useRef(null);

  // What the last photo produced, awaiting a person's approval. Null closes
  // the review; nothing is ever written before it is.
  const [review, setReview] = useState(null);

  const isLocked = isReady && !canAccess("personal_tools");

  // In an effect, not during render: navigating while rendering is a side
  // effect React warns about, and the sub-pages' render-time redirect is a
  // pre-existing wart not worth spreading to a new page.
  useEffect(() => {
    if (!isLocked) return;
    navigate("/dashboard", { replace: true });
    showAlert("warning", t("subscription.errors.upgrade_required"), {
      label: t("pricing.upgrade"),
      onClick: () => navigate("/pricing"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  if (isLocked) return null;

  const error = questions.error || phrases.error || mistakes.error;

  // Falls back to the full page rather than doing nothing: the board widget
  // can be switched off in Settings, and a button that silently no-ops is
  // worse than one that takes you somewhere.
  const focusBoard = () => {
    if (!boardRef.current) {
      navigate("/dashboard/personal/notes");
      return;
    }
    boardRef.current.focus();
    boardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Built as a map and rendered from the registry, so the order and the
  // column spans live in one place that Settings reads from too. Every entry
  // is created whether or not it is shown — these are element descriptions,
  // not mounted components, so a hidden one costs nothing.
  /**
   * Writes the rows kept in the photo review into the places they belong.
   *
   * Sequential on purpose. `usePersonalCollection.add` is optimistic and
   * stamps a temporary id from the clock, so firing a batch at once used to
   * collide within a millisecond; awaiting each keeps the ids apart and the
   * list in the order the review showed. Words are the exception and must be
   * the opposite — one write for all of them, because each favourites write
   * PUTs the whole array and a loop would keep only the last word.
   */
  const applyProposals = async (kept) => {
    const of = (kind) => kept.filter((row) => row.kind === kind);

    const noteText = of(PROPOSAL_KINDS.NOTE)
      .map((row) => row.fields.text)
      .filter(Boolean)
      .join("\n\n");
    if (noteText) {
      const next = board.text ? `${board.text}\n\n${noteText}` : noteText;
      // Appending can cross the board's ceiling; the widget enforces it on
      // typing, and this path has to respect the same limit.
      board.setText(next.slice(0, NOTE_BOARD_MAX_CHARS));
    }

    for (const row of of(PROPOSAL_KINDS.QUESTION)) {
      await questions.add({ text: row.fields.text });
    }
    for (const row of of(PROPOSAL_KINDS.MISTAKE)) {
      await mistakes.add({
        said: row.fields.said,
        correction: row.fields.correction,
        ...(row.fields.why ? { why: row.fields.why } : {}),
      });
    }
    for (const row of of(PROPOSAL_KINDS.PHRASE)) {
      await phrases.add({
        phrase: row.fields.phrase,
        translation: row.fields.translation,
        ...(row.fields.note ? { note: row.fields.note } : {}),
      });
    }

    const words = of(PROPOSAL_KINDS.WORD).map((row) => row.fields.word);
    if (words.length > 0) wordBank.addMany(words);

    setReview(null);
    showAlert("success", t("personal.photo_added", { n: kept.length }));
  };

  const WIDGETS = {
    lessons: (
      <LessonCounterWidget
        remaining={settings.settings.lessonsRemaining}
        onSave={settings.save}
        isDarkMode={isDarkMode}
        isLoading={settings.isLoading}
      />
    ),
    streak: <PracticeStreakWidget isDarkMode={isDarkMode} />,
    photo: <PhotoCaptureWidget onAnalysed={setReview} isDarkMode={isDarkMode} />,
    notes: (
      <NoteBoardWidget
        ref={boardRef}
        text={board.text}
        onChange={board.setText}
        status={board.status}
        maxChars={NOTE_BOARD_MAX_CHARS}
        isDarkMode={isDarkMode}
        isLoading={board.isLoading}
      />
    ),
    plan: (
      <NextLessonWidget
        openQuestions={openQuestions}
        doneCount={doneCount}
        total={questions.items.length}
        onAdd={questions.add}
        onToggle={questions.update}
        isDarkMode={isDarkMode}
        isLoading={questions.isLoading}
      />
    ),
    goal: (
      <GoalWidget
        settings={settings.settings}
        daysToGoal={daysToGoal}
        onSave={settings.save}
        isDarkMode={isDarkMode}
        isLoading={settings.isLoading}
      />
    ),
    phrasebook: (
      <PhrasebookWidget
        items={phrases.items}
        atLimit={phrases.atLimit}
        onAdd={phrases.add}
        onRemove={phrases.remove}
        isDarkMode={isDarkMode}
        isLoading={phrases.isLoading}
      />
    ),
    mistakes: (
      <MistakesWidget
        items={mistakes.items}
        atLimit={mistakes.atLimit}
        onAdd={mistakes.add}
        onRemove={mistakes.remove}
        isDarkMode={isDarkMode}
        isLoading={mistakes.isLoading}
      />
    ),
    words: (
      <WordBankWidget
        words={wordBank.words}
        onRemove={wordBank.remove}
        isDarkMode={isDarkMode}
      />
    ),
    // After the three lists it draws from, so it reads as what you do with
    // them rather than as another place to put something.
    recall: (
      <RecallWidget
        phrases={phrases.items}
        mistakes={mistakes.items}
        words={wordBank.words}
        isDarkMode={isDarkMode}
      />
    ),
  };

  const visible = PERSONAL_WIDGETS.filter((widget) => !isHidden(widget.id));

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="violet"
      title={t("dashboard.personal_tools")}
      favouriteId="personal_tools"
      reportContext="PersonalDashboard"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
      ]}
    >
      {/* The first-run card opens with the same idea in more words, so the
          two together read as the page saying it twice. */}
      {(!isEmpty || visible.length === 0) && (
        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
          {t("personal.intro")}
        </p>
      )}

      {/* Above everything, including the first-run card: what language all of
          this is in is the frame the rest of the page sits inside, and it is
          also the one thing a new user most often has set wrong. Not a
          registry widget — it is context rather than content, so it is not
          hideable in Settings alongside the nine that are. */}
      <PracticeLanguage variant="card" isDarkMode={isDarkMode} />

      {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {/* Not when everything is switched off — the all-hidden card below is
          the only message that makes sense then, and two stacked "here's what
          to do" cards read as a broken page. */}
      {isEmpty && visible.length > 0 && (
        <FirstRunCard
          isDarkMode={isDarkMode}
          onWriteNote={focusBoard}
          onSetLessons={() => settings.save({ lessonsRemaining: 1 })}
          onSetGoal={() => navigate("/dashboard/personal/goal")}
        />
      )}

      {visible.length === 0 ? (
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("personal.widgets_all_hidden")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/settings#personalWidgets")}
            className={`mt-3 px-4 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
              isDarkMode
                ? "border-slate-600 text-slate-200 hover:bg-slate-700"
                : "border-slate-900 text-slate-900 hover:bg-slate-100"
            }`}
          >
            {t("personal.widgets_choose")}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-start">
          {visible.map(({ id, span }) => (
            <div key={id} className={span ? "lg:col-span-2" : undefined}>
              {WIDGETS[id]}
            </div>
          ))}
        </div>
      )}

      {/* Outside the grid: it is a modal over the whole page, and mounting it
          inside a cell would put a fixed-position panel inside a stacking
          context it has no reason to share. */}
      {review && (
        <PhotoReviewModal
          summary={review.summary}
          proposals={review.proposals}
          onApply={applyProposals}
          onClose={() => setReview(null)}
          isDarkMode={isDarkMode}
        />
      )}
    </FeaturePageShell>
  );
};

export default PersonalDashboard;
