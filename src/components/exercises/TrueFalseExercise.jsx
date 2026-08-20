/**
 * TrueFalseExercise.jsx
 *
 * True/false comprehension exercise (reading and listening).
 * Presents an optional passage followed by statements that are either true or false.
 *
 * Props:
 *   passage      {string} - Reading passage text
 *   statements   {Array}  - Array of { id, text, isTrue }
 *   answers      {object} - { [id]: boolean }
 *   corrections  {object} - { [id]: string } (optional corrections)
 *   onAnswer     {func}   - Called with (id, boolean)
 *   onCorrection {func}   - Called with (id, string)
 *   isDarkMode   {bool}
 *   accent       {string} - Section accent: 'sky' | 'teal' | 'amber'
 *   level        {string}
 *   requireCorrection {bool} - Whether to show correction textarea for false answers
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { accentClass, selectedClass, unselectedClass, ACCENT_NAMES } from './exerciseAccents';

const TrueFalseExercise = ({
  passage,
  statements,
  answers,
  corrections,
  onAnswer,
  onCorrection,
  isDarkMode,
  accent,
  requireCorrection,
}) => {
  const { t } = useTranslation();
  const [expandedCorrection, setExpandedCorrection] = useState(null);
  return (
    <div className="flex flex-col gap-4">
      {/*
        The task line is rendered here rather than relying on the generated
        `instructions` array, which the AI often omits — students were being
        shown a bare list of statements with no indication of what to do,
        especially when a correction is also expected.
      */}
      <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
        {requireCorrection
          ? t('exam.true_false_task_correct', 'Decide whether each statement is true or false, then correct the false ones.')
          : t('exam.true_false_task', 'Decide whether each statement is true or false.')}
      </p>

      {/* Passage */}
      {passage && (
        <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
          <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('exam.passage_label', 'Text')}</p>
          <p className={`text-sm sm:text-base leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{passage}</p>
        </div>
      )}

      {/* Statements */}
      <div className="flex flex-col gap-3">
        {statements.map((stmt, i) => {
          const answer = answers[stmt.id];
          return (
            <div
              key={stmt.id}
              className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}
            >
              <p className={`text-sm sm:text-base font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                <span className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-black mr-2 shrink-0 ${accentClass(accent, 'marker', isDarkMode)}`}>
                  {i + 1}
                </span>
                {stmt.text}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => onAnswer(stmt.id, true)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.98] ${
                    answer === true ? selectedClass(isDarkMode) : unselectedClass(isDarkMode)
                  }`}
                >
                  <CheckCircle2 size={16} /> {t('exam.true', 'True')}
                </button>
                <button
                  onClick={() => onAnswer(stmt.id, false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.98] ${
                    answer === false ? selectedClass(isDarkMode) : unselectedClass(isDarkMode)
                  }`}
                >
                  <XCircle size={16} /> {t('exam.false', 'False')}
                </button>
              </div>
              {requireCorrection && answer === false && (
                <div className="mt-3">
                  <button
                    onClick={() => setExpandedCorrection(expandedCorrection === stmt.id ? null : stmt.id)}
                    className={`text-xs font-black uppercase tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {expandedCorrection === stmt.id
                      ? t('common.close', 'Close')
                      : t('exam.correct_statement', 'Correct it')}
                  </button>
                  {expandedCorrection === stmt.id && (
                    <textarea
                      value={corrections?.[stmt.id] || ''}
                      onChange={(e) => onCorrection(stmt.id, e.target.value)}
                      placeholder={t('exam.corrected_version_placeholder', 'Corrected version...')}
                      rows={2}
                      className={`w-full mt-2 rounded-xl border-2 p-3 text-sm font-medium resize-none focus:outline-none focus:ring-0 transition-colors ${accentClass(accent, 'focus', isDarkMode)} ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'}`}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

TrueFalseExercise.propTypes = {
  passage: PropTypes.string,
  statements: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
      // Services normalise this to `correctAnswer`; `isTrue` is the raw AI shape.
      isTrue: PropTypes.bool,
    })
  ).isRequired,
  answers: PropTypes.object.isRequired,
  corrections: PropTypes.object,
  onAnswer: PropTypes.func.isRequired,
  onCorrection: PropTypes.func,
  isDarkMode: PropTypes.bool.isRequired,
  accent: PropTypes.oneOf(ACCENT_NAMES),
  level: PropTypes.string,
  requireCorrection: PropTypes.bool,
};

TrueFalseExercise.defaultProps = {
  passage: '',
  accent: 'sky',
  level: 'A1',
  corrections: {},
  onCorrection: () => {},
  requireCorrection: false,
};

export default TrueFalseExercise;
