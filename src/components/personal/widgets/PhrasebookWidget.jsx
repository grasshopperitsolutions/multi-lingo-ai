import PropTypes from "prop-types";
import CaptureListWidget from "./CaptureListWidget";

/** `note` is marked optional, so the compact quick-add drops it. */
const FIELDS = [
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
];

/** Phrases worth keeping, with what they mean. */
const PhrasebookWidget = (props) => (
  <CaptureListWidget
    {...props}
    widgetId="phrasebook"
    fields={FIELDS}
    emptyKey="personal.phrasebook_empty"
    expandTo="/dashboard/personal/phrasebook"
  />
);

PhrasebookWidget.propTypes = {
  items: PropTypes.array.isRequired,
  atLimit: PropTypes.bool,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
};

export default PhrasebookWidget;
