import {
  Camera,
  Ticket,
  Flame,
  NotebookPen,
  ListChecks,
  Target,
  Quote,
  CircleAlert,
  BookMarked,
  Brain,
} from "lucide-react";

/**
 * personalWidgets.js
 *
 * The widgets on the personal dashboard, in the order they appear, so the page
 * and the Settings picker read from one list rather than two that drift.
 *
 * Everything a widget's frame needs is here — name, description, icon and
 * chip colour — so `PersonalWidgetCard` takes a `widgetId` and looks the rest
 * up. The alternative had each widget passing its own `title`, `icon` and
 * `color` while the registry held a second copy of the name for Settings, and
 * two copies of a string are two copies to keep in step.
 *
 * `descKey` shows under the name in both places. Six of them already existed
 * as the old menu's card descriptions, which is the voice the three new ones
 * are written in.
 *
 * `span` marks the ones that take both columns at `lg:` — the note board and
 * the word bank because their content is wide (a textarea, a wrapping chip
 * cloud), and the recall card because it sits under the three lists it draws
 * from.
 *
 * **Visibility is stored as the hidden ids, never the shown ones.** With a
 * "shown" list, every widget added later would be invisible to every existing
 * user until they went and enabled it, which is a silent no-ship. With a
 * "hidden" list the default is on, and the only people who miss a new widget
 * are the ones who went out of their way to turn that exact one off.
 */
export const PERSONAL_WIDGETS = [
  { id: "lessons", titleKey: "personal.lessons_title", descKey: "personal.lessons_desc",
    icon: Ticket, color: "bg-emerald-400" },
  { id: "streak", titleKey: "personal.dash_streak_title", descKey: "personal.dash_streak_desc",
    icon: Flame, color: "bg-orange-400" },
  // Near the top because it is the fastest way to fill everything below it:
  // you arrive holding a notebook, not looking for a card.
  { id: "photo", titleKey: "personal.photo_title", descKey: "personal.photo_desc",
    icon: Camera, color: "bg-lime-400" },
  { id: "notes", titleKey: "personal.notes_title", descKey: "personal.notes_desc",
    icon: NotebookPen, color: "bg-violet-400", span: true },
  { id: "plan", titleKey: "personal.plan_title", descKey: "personal.plan_desc",
    icon: ListChecks, color: "bg-sky-400" },
  { id: "goal", titleKey: "personal.goal_title", descKey: "personal.goal_desc",
    icon: Target, color: "bg-yellow-400" },
  { id: "phrasebook", titleKey: "personal.phrasebook_title", descKey: "personal.phrasebook_desc",
    icon: Quote, color: "bg-amber-400" },
  { id: "mistakes", titleKey: "personal.mistakes_title", descKey: "personal.mistakes_desc",
    icon: CircleAlert, color: "bg-rose-400" },
  { id: "words", titleKey: "personal.dash_words_title", descKey: "personal.dash_words_desc",
    icon: BookMarked, color: "bg-teal-400", span: true },
  { id: "recall", titleKey: "personal.dash_recall_title", descKey: "personal.dash_recall_desc",
    icon: Brain, color: "bg-fuchsia-400", span: true },
];

/** Look one up by id. Returns undefined for an id that is not registered. */
export const personalWidgetById = (id) => PERSONAL_WIDGETS.find((w) => w.id === id);

/** The profile field the hidden ids live in. */
export const HIDDEN_WIDGETS_FIELD = "hiddenPersonalWidgets";

export const PERSONAL_WIDGET_IDS = PERSONAL_WIDGETS.map((w) => w.id);
