import { useEffect, useRef } from "react";
import PropTypes from "prop-types";

/**
 * AutoGrowTextarea
 *
 * A one-line field that grows instead of scrolling sideways.
 *
 * It is a `<textarea>` rather than an `<input>` for one reason: **an input's
 * placeholder cannot wrap.** It is a single line by spec, so a hint longer
 * than the box is simply cut off — at 360px the next-lesson question's
 * placeholder lost 91 characters' worth in English, and every language that
 * runs longer than English loses more. The typed value has the same problem:
 * an input scrolls horizontally, so a long phrase becomes a keyhole you cannot
 * read back.
 *
 * Starting at one row keeps it looking like the input it replaced, and the
 * height is recomputed from `scrollHeight` on every value change — including
 * when the caller clears the draft after a successful add, which is why this
 * is an effect on `value` rather than something done in `onChange`.
 *
 * Enter submits and Shift+Enter makes a new line, because this is a field in a
 * form, not a document. Without that, converting from an input would have
 * silently turned "press Enter to finish" into "press Enter for a blank line".
 */
const AutoGrowTextarea = ({ value, onChange, onSubmit, className = "", ...rest }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Collapse first: scrollHeight only ever reports the content height when
    // the element is not already taller than its content.
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      // resize-none because the height is owned by the effect above; a drag
      // handle would be overwritten on the next keystroke.
      className={`${className} resize-none overflow-hidden`}
      {...rest}
    />
  );
};

AutoGrowTextarea.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  /** Called on Enter. Omit to let Enter insert a newline. */
  onSubmit: PropTypes.func,
  className: PropTypes.string,
};

export default AutoGrowTextarea;
