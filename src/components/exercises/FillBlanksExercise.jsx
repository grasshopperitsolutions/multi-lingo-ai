/**
 * FillBlanksExercise.jsx
 *
 * Fill in the blanks reading comprehension exercise.
 * Presents a passage with blanks that students must fill from a word bank.
 *
 * Props:
 *   passage      {string} - Reading passage with blanks marked as ___
 *   wordBank     {Array}  - Array of words to choose from (includes correct answers + distractors)
 *   blanks       {Array}  - Array of { id, position, correctAnswer }
 *   answers      {object} - { [id]: selectedWord }
 *   onAnswer     {func}   - Called with (id, word)
 *   isDarkMode   {bool}
 *   level        {string}
 */
import PropTypes from 'prop-types';

const FillBlanksExercise = ({ passage, wordBank, blanks, answers, onAnswer, isDarkMode }) => {
  // Replace blanks in passage with interactive elements
  const renderPassageWithBlanks = () => {
    let passageText = passage;
    const blankElements = [];

    blanks.forEach((blank) => {
      const parts = passageText.split('___');
      if (parts.length > 1) {
        blankElements.push(parts[0]);
        blankElements.push(
          <span key={blank.id} className="inline-block mx-1">
            <select
              value={answers[blank.id] || ''}
              onChange={(e) => onAnswer(blank.id, e.target.value)}
              className={`px-2 py-1 rounded-lg border-2 text-sm font-semibold ${
                answers[blank.id]
                  ? isDarkMode
                    ? 'bg-amber-900/30 border-amber-600 text-amber-300'
                    : 'bg-amber-50 border-amber-500 text-amber-800'
                  : isDarkMode
                  ? 'bg-slate-700 border-slate-600 text-slate-300'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <option value="">___</option>
              {wordBank.map((word) => {
                const isUsedByOther = Object.entries(answers).some(
                  ([key, val]) => key !== blank.id && val === word,
                );
                return (
                  <option key={word} value={word} disabled={isUsedByOther}>
                    {word}
                  </option>
                );
              })}
            </select>
          </span>
        );
        passageText = parts.slice(1).join('___');
      }
    });

    if (passageText) {
      blankElements.push(passageText);
    }

    return blankElements;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Word Bank */}
      <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Banco de Palavras</p>
        <div className="flex flex-wrap gap-2">
          {wordBank.map((word) => {
            const isUsed = Object.values(answers).includes(word);
            return (
              <span
                key={word}
                className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold ${
                  isUsed
                    ? isDarkMode
                      ? 'border-slate-600 text-slate-500 bg-slate-700/50 line-through'
                      : 'border-slate-300 text-slate-400 bg-slate-100 line-through'
                    : isDarkMode
                    ? 'border-amber-600 text-amber-400 bg-amber-900/20'
                    : 'border-amber-500 text-amber-700 bg-amber-50'
                }`}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>

      {/* Passage with Blanks */}
      <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Texto</p>
        <p className={`text-sm sm:text-base leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
          {renderPassageWithBlanks()}
        </p>
      </div>
    </div>
  );
};

FillBlanksExercise.propTypes = {
  passage: PropTypes.string.isRequired,
  wordBank: PropTypes.arrayOf(PropTypes.string).isRequired,
  blanks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      position: PropTypes.number.isRequired,
      correctAnswer: PropTypes.string.isRequired,
    })
  ).isRequired,
  answers: PropTypes.object.isRequired,
  onAnswer: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  level: PropTypes.string,
};

FillBlanksExercise.defaultProps = {
  level: 'A1',
};

/**
 * Generate AI prompt for fill-in-the-blanks reading exercise
 * @param {string} level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @param {string} targetLang - Target learning language (e.g., 'pt-PT', 'en-US')
 * @returns {string} AI prompt
 */
FillBlanksExercise.generatePrompt = (level, targetLang) => {
  return [
    `Generate a fill-in-the-blanks reading comprehension exercise in ${targetLang} for CEFR level ${level}.`,
    `CRITICAL: All text content must be written entirely in ${targetLang}.`,
    `Create a short passage (100-200 words for A1-A2, 200-300 for B1-B2, 300-400 for C1-C2).`,
    `Mark 5-8 key words in the passage with ___ (triple underscore).`,
    `Provide a word bank with the correct answers plus 3-5 distractor words.`,
    `Return a JSON object with:`,
    `  - "passage": the passage in ${targetLang} with ___ blanks`,
    `  - "wordBank": array of all words (correct answers + distractors) in ${targetLang}`,
    `  - "blanks": array of { id, position, correctAnswer }`,
    `Return ONLY valid JSON. No markdown, no explanation.`,
  ].join('\n');
};

export default FillBlanksExercise;