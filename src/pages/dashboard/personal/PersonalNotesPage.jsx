import PersonalListPage from "../../../components/personal/PersonalListPage";
import { PERSONAL_KINDS } from "../../../services/personalService";

/**
 * Free-form notes. The one page here with no structure imposed on it — a
 * title and whatever you want to write under it.
 */
const PersonalNotesPage = () => (
  <PersonalListPage
    kind={PERSONAL_KINDS.NOTE}
    titleKey="personal.notes_title"
    emptyKey="personal.notes_empty"
    reportContext="PersonalNotesPage"
    fields={[
      {
        name: "title",
        labelKey: "personal.notes_field_title",
        placeholderKey: "personal.notes_field_title_placeholder",
      },
      {
        name: "body",
        labelKey: "personal.notes_field_body",
        placeholderKey: "personal.notes_field_body_placeholder",
        multiline: true,
        rows: 5,
        required: false,
      },
    ]}
  />
);

export default PersonalNotesPage;
