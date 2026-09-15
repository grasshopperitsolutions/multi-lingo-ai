import PersonalListPage from "../../../components/personal/PersonalListPage";
import { PERSONAL_KINDS } from "../../../services/personalService";

/**
 * What you said, what it should have been, and why.
 *
 * The most valuable thing a learner with a tutor can keep, and the thing most
 * likely to be lost: a correction arrives mid-conversation and is gone by the
 * end of the lesson unless something catches it.
 */
const MistakeJournalPage = () => (
  <PersonalListPage
    kind={PERSONAL_KINDS.MISTAKE}
    titleKey="personal.mistakes_title"
    emptyKey="personal.mistakes_empty"
    reportContext="MistakeJournalPage"
    fields={[
      {
        name: "said",
        labelKey: "personal.mistakes_field_said",
        placeholderKey: "personal.mistakes_field_said_placeholder",
      },
      {
        name: "correction",
        labelKey: "personal.mistakes_field_correction",
        placeholderKey: "personal.mistakes_field_correction_placeholder",
      },
      {
        name: "why",
        labelKey: "personal.mistakes_field_why",
        placeholderKey: "personal.mistakes_field_why_placeholder",
        multiline: true,
        rows: 3,
        required: false,
      },
    ]}
  />
);

export default MistakeJournalPage;
