/**
 * MultipleChoiceExercise.jsx
 *
 * Multiple choice reading comprehension exercise.
 * Presents a passage followed by questions with 3-4 options each.
 *
 * Props:
 *   passage      {string} - Reading passage text
 *   questions    {Array}  - Array of { id, question, options, correctAnswer }
 *   answers      {object} - { [id]: selectedOption }
 *   onAnswer     {func}   - Called with (id, option)
 *   isDarkMode   {bool}
 *   level        {string}
 */
import PropTypes from 'prop-types';

const MultipleChoiceExercise = ({ passage, questions, answers, onAnswer, isDarkMode }) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Passage */}
      {passage && (
        <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
          <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Texto</p>
          <p className={`text-sm sm:text-base leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{passage}</p>
        </div>
      )}

      {/* Questions */}
      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={q.id} className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
            <p className={`text-sm sm:text-base font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              <span className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-black mr-2 shrink-0 ${isDarkMode ? 'border-sky-600 text-sky-400' : 'border-sky-500 text-sky-600'}`}>{i + 1}</span>
              {q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((option) => {
                const isSelected = answers[q.id] === option;
                return (
                  <button
                    key={option}
                    onClick={() => onAnswer(q.id, option)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                      isSelected
                        ? isDarkMode
                          ? 'bg-sky-900/40 border-sky-500 text-sky-300'
                          : 'bg-sky-50 border-sky-500 text-sky-800'
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
    </div>
  );
};

MultipleChoiceExercise.propTypes = {
  passage: PropTypes.string,
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
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

MultipleChoiceExercise.defaultProps = {
  passage: '',
  level: 'A1',
};

/**
 * Generate AI prompt for multiple choice reading exercise
 * @param {string} level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @param {string} targetLang - Target learning language (e.g., 'pt-PT', 'en-US')
 * @returns {string} AI prompt
 */
MultipleChoiceExercise.generatePrompt = (level, targetLang) => {
  return [
    `Generate a multiple choice reading comprehension exercise in ${targetLang} for CEFR level ${level}.`,
    `CRITICAL: All text content must be written entirely in ${targetLang}.`,
    `Create a short passage (100-200 words for A1-A2, 200-300 for B1-B2, 300-400 for C1-C2) followed by 4-6 questions.`,
    `Each question has 4 options with only one correct answer.`,
    `Return a JSON object with:`,
    `  - "passage": the reading passage text in ${targetLang}`,
    `  - "questions": array of { id, question, options[], correctAnswer }`,
    `Return ONLY valid JSON. No markdown, no explanation.`,
  ].join('\n');
};

export default MultipleChoiceExercise;