import PropTypes from 'prop-types';

const ClozeExercise = ({ passage, blanks, answers, onAnswer, isDarkMode }) => {
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
              className={`px-2 py-1 rounded-lg border-2 text-sm font-semibold ${answers[blank.id]
                ? isDarkMode
                  ? 'bg-cyan-900/30 border-cyan-600 text-cyan-300'
                  : 'bg-cyan-50 border-cyan-500 text-cyan-800'
                : isDarkMode
                  ? 'bg-slate-700 border-slate-600 text-slate-300'
                  : 'bg-white border-slate-300 text-slate-700'
                }`}
            >
              <option value="">___</option>
              {blank.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
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
      <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Texto</p>
        <p className={`text-sm sm:text-base leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
          {renderPassageWithBlanks()}
        </p>
      </div>
    </div>
  );
};

ClozeExercise.propTypes = {
  passage: PropTypes.string.isRequired,
  blanks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      position: PropTypes.number.isRequired,
      options: PropTypes.arrayOf(PropTypes.string).isRequired,
      correctAnswer: PropTypes.string.isRequired,
    })
  ).isRequired,
  answers: PropTypes.object.isRequired,
  onAnswer: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  level: PropTypes.string,
};

ClozeExercise.defaultProps = {
  level: 'A1',
};

/**
 * Generate AI prompt for cloze reading exercise
 * @param {string} level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @param {string} targetLang - Target learning language (e.g., 'pt-PT', 'en-US')
 * @returns {string} AI prompt
 */
ClozeExercise.generatePrompt = (level, targetLang) => {
  return [
    `Generate a cloze reading comprehension exercise in ${targetLang} for CEFR level ${level}.`,
    `CRITICAL: All text content must be written entirely in ${targetLang}.`,
    `Create a short passage (100-200 words for A1-A2, 200-300 for B1-B2, 300-400 for C1-C2).`,
    `Mark 5-8 key words with ___ (triple underscore) and provide 3-4 multiple choice options per blank.`,
    `Return a JSON object with:`,
    `  - "passage": the passage in ${targetLang} with ___ blanks`,
    `  - "blanks": array of { id, position, options[], correctAnswer }`,
    `Return ONLY valid JSON. No markdown, no explanation.`,
  ].join('\n');
};

export default ClozeExercise;