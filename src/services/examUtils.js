/**
 * examUtils.js
 *
 * Shared utilities for exam exercise services.
 * Merges the duplicated answer-checking logic from examReadingExerciseService
 * and examListeningExerciseService into one generic helper.
 *
 * Usage:
 *   import { checkAnswers, getScoreColor } from '../services/examUtils';
 *
 *   const result = checkAnswers(userAnswers, questions);
 *   const colorClass = getScoreColor(4, 5, isDarkMode);
 */

// ---------------------------------------------------------------------------
// Answer checking (generic — works for any exercise with id + correctAnswer)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AnswerCheckResult
 * @property {number}  score      - Number of correct answers
 * @property {number}  maxScore   - Total number of questions
 * @property {number}  percentage - Score as percentage
 * @property {Object[]} breakdown - Per-question result
 */

/**
 * Compare user answers against the correct answers.
 * Works for any exercise type whose questions have { id, text, correctAnswer }.
 *
 * @param {Object[]} userAnswers    - Array of { questionId, selectedAnswer }
 * @param {Object[]} questions      - Exercise questions with { id, text, correctAnswer }
 * @returns {AnswerCheckResult}
 */
export function checkAnswers(userAnswers, questions) {
  if (!Array.isArray(userAnswers)) {
    throw new Error('[examUtils] userAnswers must be an array');
  }
  if (!Array.isArray(questions)) {
    throw new Error('[examUtils] questions must be an array');
  }

  const answerMap = new Map(userAnswers.map((a) => [a.questionId, a.selectedAnswer]));

  let correctCount = 0;
  const breakdown = questions.map((q) => {
    const userAnswer = answerMap.get(q.id);
    const isCorrect = userAnswer === q.correctAnswer;
    if (isCorrect) correctCount++;

    return {
      questionId: q.id,
      question: q.text,
      userAnswer: userAnswer || null,
      correctAnswer: q.correctAnswer,
      isCorrect,
    };
  });

  const maxScore = questions.length;
  const percentage = maxScore > 0 ? Math.round((correctCount / maxScore) * 100) : 0;

  return {
    score: correctCount,
    maxScore,
    percentage,
    breakdown,
  };
}

/**
 * Check listening exercise answers (delegates to checkAnswers).
 * Kept as a named export for backward compatibility.
 */
export function checkListeningAnswers(userAnswers, questions) {
  return checkAnswers(userAnswers, questions);
}

/**
 * Check reading exercise answers (delegates to checkAnswers).
 * Kept as a named export for backward compatibility.
 */
export function checkReadingAnswers(userAnswers, questions) {
  return checkAnswers(userAnswers, questions);
}

// ---------------------------------------------------------------------------
// Score colour helper
// ---------------------------------------------------------------------------

/**
 * Return a Tailwind text colour class based on score percentage.
 *
 * @param {number} score       - Raw score achieved
 * @param {number} max         - Maximum possible score
 * @param {boolean} isDarkMode - Whether dark mode is active
 * @returns {string} Tailwind text colour class
 */
export function getScoreColor(score, max, isDarkMode) {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
  if (pct >= 0.5) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
  return isDarkMode ? 'text-rose-400' : 'text-rose-600';
}

/**
 * Listening-specific score colour (uses sky palette).
 */
export function getListeningScoreColor(score, max, isDarkMode) {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return isDarkMode ? 'text-sky-400' : 'text-sky-600';
  if (pct >= 0.5) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
  return isDarkMode ? 'text-rose-400' : 'text-rose-600';
}