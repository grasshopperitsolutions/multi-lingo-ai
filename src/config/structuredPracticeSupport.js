/**
 * The one switch for AI-written structured practice: Exam Training and Grammar
 * Practice open to a learning dialect together, when its language document in
 * appConfig/config/languages has `examSupported: true` (Admin › Languages).
 *
 * The field keeps its historical name because renaming a stored field would
 * orphan every language document already carrying it. It now means "this
 * dialect's AI-generated practice has been tested", for both features.
 *
 * @param {string} [dialect] - the learner's learningDialect
 * @param {Array<{code: string, examSupported?: boolean}>} [supportedLanguages]
 * @returns {boolean}
 */
export function isStructuredPracticeSupported(dialect, supportedLanguages) {
  if (!dialect) return false;
  return (supportedLanguages ?? []).some((lang) => lang.code === dialect && lang.examSupported);
}
