import PersonalListPage from "../../../components/personal/PersonalListPage";
import { PERSONAL_KINDS } from "../../../services/personalService";

/**
 * Phrases you wrote down yourself.
 *
 * Deliberately separate from the word bank: that holds single words tapped out
 * of a story, this holds whole phrases somebody chose to keep — usually
 * something a tutor said that is worth having verbatim.
 */
const PhrasebookPage = () => (
  <PersonalListPage
    kind={PERSONAL_KINDS.PHRASE}
    titleKey="personal.phrasebook_title"
    emptyKey="personal.phrasebook_empty"
    reportContext="PhrasebookPage"
    fields={[
      {
        name: "phrase",
        labelKey: "personal.phrasebook_field_phrase",
        placeholderKey: "personal.phrasebook_field_phrase_placeholder",
      },
      {
        name: "translation",
        labelKey: "personal.phrasebook_field_translation",
        placeholderKey: "personal.phrasebook_field_translation_placeholder",
      },
      {
        name: "note",
        labelKey: "personal.phrasebook_field_note",
        placeholderKey: "personal.phrasebook_field_note_placeholder",
        required: false,
      },
    ]}
  />
);

export default PhrasebookPage;
