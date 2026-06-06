import PropTypes from 'prop-types';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from './Card';

/**
 * ExamScoreCard
 *
 * Reusable score display card used by ReadingExercise, ListeningExercise,
 * WritingExercise, and the future FullExam component.
 *
 * Props:
 *   score       {number}  - Raw score achieved (e.g. 8)
 *   maxScore    {number}  - Maximum possible score (e.g. 10)
 *   percentage  {number}  - Pre-computed percentage (optional; auto-computed if omitted)
 *   scoreColor  {string}  - Tailwind text colour class from getScoreColor() / getListeningScoreColor()
 *   isDarkMode  {boolean}
 *
 * Writing-only (optional):
 *   wordCount       {number}
 *   minWords        {number}
 *   maxWords        {number}
 *   wordCountPenalty {number}
 */
const ExamScoreCard = ({
  score,
  maxScore,
  percentage,
  scoreColor,
  isDarkMode,
  wordCount,
  minWords,
  maxWords,
  wordCountPenalty,
}) => {
  const { t } = useTranslation();

  const displayPct =
    percentage !== undefined
      ? percentage
      : maxScore > 0
      ? Math.round((score / maxScore) * 100)
      : 0;

  const hasWordCountSection =
    wordCount !== undefined && minWords !== undefined && maxWords !== undefined;

  return (
    <Card isDarkMode={isDarkMode}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p
            className={`text-xs font-black uppercase tracking-widest mb-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {t('exam.score', 'Score')}
          </p>
          <p
            className={`text-5xl font-black tabular-nums leading-none ${scoreColor}`}
          >
            {score}
            <span
              className={`text-2xl ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              /{maxScore}
            </span>
          </p>
          <p
            className={`text-xs font-semibold mt-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {displayPct}%
            {wordCountPenalty > 0 && (
              <span
                className={`ml-2 ${
                  isDarkMode ? 'text-rose-400' : 'text-rose-600'
                }`}
              >
                (
                {t('exam.penalty', '-{{n}} word count penalty', {
                  n: wordCountPenalty,
                })}
                )
              </span>
            )}
          </p>
        </div>
        <CheckCircle2 size={48} className={scoreColor} />
      </div>

      {hasWordCountSection && (
        <div
          className={`mt-3 pt-3 border-t-2 ${
            isDarkMode ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <p
            className={`text-xs font-semibold ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {t('exam.word_count', 'Word count')}:{' '}
            <span className="font-black">{wordCount}</span>
            {' '}(
            {t(
              'exam.word_count_target',
              'Target: {{min}}\u2013{{max}} words',
              { min: minWords, max: maxWords },
            )}
            )
          </p>
        </div>
      )}
    </Card>
  );
};

ExamScoreCard.propTypes = {
  score: PropTypes.number.isRequired,
  maxScore: PropTypes.number.isRequired,
  percentage: PropTypes.number,
  scoreColor: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  // Writing-only extras
  wordCount: PropTypes.number,
  minWords: PropTypes.number,
  maxWords: PropTypes.number,
  wordCountPenalty: PropTypes.number,
};

ExamScoreCard.defaultProps = {
  percentage: undefined,
  wordCount: undefined,
  minWords: undefined,
  maxWords: undefined,
  wordCountPenalty: 0,
};

export default ExamScoreCard;
