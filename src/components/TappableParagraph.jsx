import PropTypes from "prop-types";
import { useLongPress } from "../hooks/useLongPress";
import { tokenizeWords } from "../utils/tokenizeWords";
import { sentenceAt } from "../utils/sentenceAt";

/**
 * One tappable word. Its own component because the tap/hold gesture needs a
 * hook, and hooks cannot be called from inside the token map.
 */
const TappableWord = ({ text, onTap, onHold, isDarkMode }) => {
  const handlers = useLongPress({ onClick: onTap, onLongPress: onHold });

  return (
    // A tab stop per word would make a paragraph unusable for keyboard users —
    // tabIndex={-1} keeps it clickable/tappable and reachable by a screen
    // reader's virtual cursor without adding to the tab order.
    // select-none is what stops a hold raising the text-selection UI over the
    // word being held on touch devices.
    <span
      role="button"
      tabIndex={-1}
      {...handlers}
      className={`rounded transition-colors cursor-pointer select-none ${
        isDarkMode ? "hover:bg-slate-700" : "hover:bg-amber-100"
      }`}
    >
      {text}
    </span>
  );
};

TappableWord.propTypes = {
  text: PropTypes.string.isRequired,
  onTap: PropTypes.func.isRequired,
  onHold: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

/**
 * A paragraph in the practice language whose words can be looked up and
 * banked: tap opens the dictionary sheet, hold (500ms) saves the word.
 *
 * Shared by every reader of practice-language prose: the Tale Creator,
 * Practice Text and the practice-language version of a culture piece. It was
 * the Tale Creator's alone, and the other two showed their text as plain
 * paragraphs a learner could read but not ask about.
 *
 * `onLookup` also receives the sentence the word was tapped in, found with
 * `Intl.Segmenter` (utils/sentenceAt), so the dictionary can describe the
 * sense the reader actually met.
 *
 * **Justified, with hyphenation, in the paragraph's own language.** Long
 * generated text reads as a block; `lang` is what lets the browser hyphenate
 * with the right rules, and without hyphenation a justified column on a phone
 * opens wide gaps between words. Pass `lang` always.
 */
const TappableParagraph = ({ text, lang, onLookup, onBank, isDarkMode, className = "" }) => (
  <p lang={lang} className={`text-justify hyphens-auto ${className}`}>
    {tokenizeWords(text).map((token, i) =>
      token.word ? (
        <TappableWord
          key={i}
          text={token.text}
          onTap={() => onLookup(token.word, sentenceAt(text, token.start, lang))}
          onHold={() => onBank(token.word)}
          isDarkMode={isDarkMode}
        />
      ) : (
        <span key={i}>{token.text}</span>
      ),
    )}
  </p>
);

TappableParagraph.propTypes = {
  text: PropTypes.string.isRequired,
  /** BCP-47 code of the text, e.g. the practice dialect. */
  lang: PropTypes.string,
  /** (word, sentence) — sentence may be null when none could be found. */
  onLookup: PropTypes.func.isRequired,
  /** (word) — toggles the word in the word bank. */
  onBank: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
};

export default TappableParagraph;
