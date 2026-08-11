/**
 * Which learning dialects the Grammar feature is available for.
 *
 * Grammar is deliberately narrower than the rest of the app: the structure
 * library and tips are seeded from hand-written European Portuguese material,
 * and shipping an AI-generated library for a language nobody has reviewed
 * would put unverified grammar in front of learners.
 *
 * This mirrors the way Exam Training is gated per language, but uses an
 * explicit list rather than the `examSupported` flag on the language document
 * — the flag would have to be switched on before Grammar appeared at all,
 * and the current rule is simply "pt-PT only".
 *
 * To open Grammar to another dialect: seed its topic content (the AI seeder
 * in grammarService covers a locale that has no hand-written file), then add
 * the dialect code here.
 */
export const GRAMMAR_SUPPORTED_DIALECTS = ['pt-PT'];

/**
 * @param {string} [dialect] - BCP-47 learning dialect, e.g. the user's `learningDialect`.
 * @returns {boolean}
 */
export function isGrammarSupported(dialect) {
  return GRAMMAR_SUPPORTED_DIALECTS.includes(dialect);
}
