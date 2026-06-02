import PropTypes from 'prop-types';

const NoticeSignExercise = ({ notices, answers, onAnswer, isDarkMode }) => {
  return (
    <div className="flex flex-col gap-4">
      {notices.map((notice, i) => (
        <div
          key={notice.id}
          className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}
        >
          {/* Notice/Sign */}
          <div className={`mb-4 p-4 rounded-xl border-2 ${isDarkMode ? 'bg-yellow-900/20 border-yellow-600' : 'bg-yellow-50 border-yellow-400'}`}>
            <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
              Aviso / Placa {i + 1}
            </p>
            <p className={`text-sm sm:text-base font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              {notice.text}
            </p>
          </div>

          {/* Question */}
          <p className={`text-sm sm:text-base font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            {notice.question}
          </p>

          {/* Options */}
          <div className="flex flex-col gap-2">
            {notice.options.map((option) => {
              const isSelected = answers[notice.id] === option;
              return (
                <button
                  key={option}
                  onClick={() => onAnswer(notice.id, option)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-yellow-900/40 border-yellow-500 text-yellow-300'
                        : 'bg-yellow-50 border-yellow-500 text-yellow-800'
                      : isDarkMode
                        ? 'border-slate-600 text-slate-300 hover:bg-slate-700/50'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

NoticeSignExercise.propTypes = {
  notices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
      question: PropTypes.string.isRequired,
      options: PropTypes.arrayOf(PropTypes.string).isRequired,
      correctAnswer: PropTypes.string.isRequired,
    })
  ).isRequired,
  answers: PropTypes.object.isRequired,
  onAnswer: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  level: PropTypes.string,
};

NoticeSignExercise.defaultProps = {
  level: 'A1',
};

/**
 * Generate AI prompt for notice/sign reading exercise
 * @param {string} level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @param {string} targetLang - Target learning language (e.g., 'pt-PT', 'en-US')
 * @returns {string} AI prompt
 */
NoticeSignExercise.generatePrompt = (level, targetLang) => {
  return [
    `Generate a notice/sign reading comprehension exercise in ${targetLang} for CEFR level ${level}.`,
    `CRITICAL: All text content must be written entirely in ${targetLang}.`,
    `Create 4-6 realistic notices or signs that might appear in public places (schools, offices, streets, shops).`,
    `For each notice, write a comprehension question with 3-4 multiple choice options.`,
    `Return a JSON object with:`,
    `  - "notices": array of { id, text, question, options[], correctAnswer }`,
    `Return ONLY valid JSON. No markdown, no explanation.`,
  ].join('\n');
};

export default NoticeSignExercise;