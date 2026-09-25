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
import { isStructuredPracticeSupported } from './structuredPracticeSupport';

export const GRAMMAR_SUPPORTED_DIALECTS = ['pt-PT'];

/**
 * @param {string} [dialect] - BCP-47 learning dialect, e.g. the user's `learningDialect`.
 * @returns {boolean}
 */
export function isGrammarSupported(dialect) {
  return GRAMMAR_SUPPORTED_DIALECTS.includes(dialect);
}

/**
 * Whether one section of the hub works for a given dialect.
 *
 * The list above answers "is there hand-written material for this language",
 * which is the right question for Structures, Tips and the drills — all three
 * read seeded content. It is the **wrong** question for a section that writes
 * something new each time from what the learner typed: Practice Text asserts
 * no rule, it just produces prose to read, so there is nothing unreviewed for
 * it to get wrong about a language nobody has checked.
 *
 * So the gate is per section (`needsLibrary` on GRAMMAR_SECTIONS) rather than
 * on the hub as a whole. Anything new defaults to needing the library, which
 * is the safe direction: a section wrongly marked library-free ships
 * unreviewed grammar, while one wrongly marked as needing it is merely absent.
 *
 * A section marked `availability: "structured-practice"` follows Exam
 * Training's switch instead of the library list (see structuredPracticeSupport):
 * Grammar Practice writes its exercises with AI, like the exams, and the two
 * open to a dialect together.
 *
 * @param {{needsLibrary?: boolean, availability?: string}} section - an entry from GRAMMAR_SECTIONS
 * @param {string} [dialect]
 * @param {Array<object>} [supportedLanguages] - needed for structured-practice sections
 * @param {{ isAdmin?: boolean }} [options] - admins preview structured practice in any dialect
 * @returns {boolean}
 */
export function isGrammarSectionAvailable(section, dialect, supportedLanguages, options) {
  if (section?.availability === "structured-practice") {
    return isStructuredPracticeSupported(dialect, supportedLanguages, options);
  }
  if (section?.needsLibrary === false) return true;
  return isGrammarSupported(dialect);
}
