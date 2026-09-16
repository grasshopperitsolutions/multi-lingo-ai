import PropTypes from "prop-types";
import CaptureListWidget from "./CaptureListWidget";

/** `why` is marked optional, so the compact quick-add drops it. */
const FIELDS = [
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
];

/** What you said, what you should have said. */
const MistakesWidget = (props) => (
  <CaptureListWidget
    {...props}
    widgetId="mistakes"
    fields={FIELDS}
    emptyKey="personal.mistakes_empty"
    expandTo="/dashboard/personal/mistakes"
  />
);

MistakesWidget.propTypes = {
  items: PropTypes.array.isRequired,
  atLimit: PropTypes.bool,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
};

export default MistakesWidget;
