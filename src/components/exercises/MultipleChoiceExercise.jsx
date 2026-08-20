/**
 * MultipleChoiceExercise.jsx
 *
 * Multiple choice comprehension exercise (reading and listening).
 * Presents an optional passage followed by questions with 3-4 options each.
 *
 * Props:
 *   passage      {string} - Reading passage text
 *   questions    {Array}  - Array of { id, text|question, options, correctAnswer }
 *   answers      {object} - { [id]: selectedOption }
 *   onAnswer     {func}   - Called with (id, option)
 *   isDarkMode   {bool}
 *   accent       {string} - Section accent: 'sky' | 'teal' | 'amber'
 *   level        {string}
 */
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { accentClass, selectedClass, unselectedClass, ACCENT_NAMES } from './exerciseAccents';

const MultipleChoiceExercise = ({ passage, questions, answers, onAnswer, isDarkMode, accent }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {/* Passage */}
      {passage && (
        <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
          <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('exam.passage_label', 'Text')}</p>
          <p className={`text-sm sm:text-base leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{passage}</p>
        </div>
      )}

      {/* Questions */}
      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={q.id} className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
            <p className={`text-sm sm:text-base font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              <span className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-black mr-2 shrink-0 ${accentClass(accent, 'marker', isDarkMode)}`}>{i + 1}</span>
              {/*
                Both exercise services normalise the prompt onto `text` — the
                listening response schema declares it, and the reading service
                aliases `question` to it in _parseAIResponse. Reading only
                `q.question` here left every prompt blank in the Full Exam while
                the options below rendered normally.
              */}
              {q.text ?? q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((option) => {
                const isSelected = answers[q.id] === option;
                return (
                  <button
                    key={option}
                    onClick={() => onAnswer(q.id, option)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                      isSelected ? selectedClass(isDarkMode) : unselectedClass(isDarkMode)
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
      // Either field is accepted — services emit `text`, older stored content
      // may carry `question`.
      text: PropTypes.string,
      question: PropTypes.string,
      options: PropTypes.arrayOf(PropTypes.string).isRequired,
      correctAnswer: PropTypes.string.isRequired,
    })
  ).isRequired,
  answers: PropTypes.object.isRequired,
  onAnswer: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  accent: PropTypes.oneOf(ACCENT_NAMES),
  level: PropTypes.string,
};

MultipleChoiceExercise.defaultProps = {
  passage: '',
  accent: 'sky',
  level: 'A1',
};

export default MultipleChoiceExercise;
