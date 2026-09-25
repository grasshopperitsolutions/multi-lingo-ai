/**
 * examPromptTemplates.js
 *
 * Renders the exam prompts. The wording lives in Firestore
 * (appConfig/config/prompts, see promptService.js) and is edited in Admin;
 * this file only computes **values** from the level and type — word counts,
 * durations, item counts, raw type keys — and renders them into the fetched
 * template.
 *
 * No sentence is built here, in any language. This file used to send the
 * model Portuguese exam instructions ("Marca a resposta correta."), a
 * Portuguese description of each level's grammar ("presente do indicativo",
 * "pretérito perfeito"…) and English labels with Portuguese glosses
 * ("phone message/recado"). All of it was wrong for any other language, and
 * none of it could be edited without a deploy. The templates now say what
 * they need in terms of the values below; see plans/multi-dialect-practice.md.
 *
 * Usage:
 *   import { getReadingPrompt, getListeningPrompt, getWritingPrompt } from '../services/examPromptTemplates';
 *
 *   const prompt = await getReadingPrompt('A1', 'pt-PT', { type: 'true-false' });
 *   const prompt = await getListeningPrompt('B1', 'en-US', { type: 'fill-blanks', audioFormat: 'interview' });
 */

import { getPrompt, renderTemplate } from './promptService';

// ---------------------------------------------------------------------------
// Values per level
// ---------------------------------------------------------------------------

/**
 * Word count range for a writing task at a CEFR level.
 */
export function getWordCountRange(level) {
  const ranges = {
    A1: { min: 60, max: 100 },
    A2: { min: 70, max: 110 },
    B1: { min: 110, max: 140 },
    B2: { min: 140, max: 170 },
    C1: { min: 160, max: 190 },
    C2: { min: 200, max: 250 },
  };
  return ranges[level] ?? ranges.A1;
}

/** Reading passage length in words. */
function getPassageLength(level) {
  const lengths = { A1: 40, A2: 80, B1: 150, B2: 250, C1: 350, C2: 400 };
  return lengths[level] ?? lengths.A1;
}

/** Listening audio duration in seconds. */
function getAudioDuration(level) {
  const durations = { A1: 40, A2: 60, B1: 90, B2: 120, C1: 150, C2: 180 };
  return durations[level] ?? durations.A1;
}

const isBeginner = (level) => level === 'A1' || level === 'A2';

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Render a reading prompt. One variant per exercise type.
 *
 * Variables: level, targetLang, passageLength, questionCount, extraItems.
 *
 * @param {string} level      - CEFR level
 * @param {string} targetLang - the learner's dialect, e.g. 'pt-PT'
 * @param {object} options
 * @param {string} options.type - variant key: 'multiple-choice' | 'true-false' | 'matching' | 'best-title' | 'ordering' | 'cloze-options' | 'fill-blanks' | 'notice-sign'
 * @param {number} [options.questionCount=4]
 * @returns {Promise<string>}
 */
export async function getReadingPrompt(level, targetLang, { type = 'multiple-choice', questionCount = 4 } = {}) {
  const prompt = await getPrompt('exam-reading-prompt');
  const variant = prompt.variants?.find((v) => v.key === type) ?? prompt.variants?.find((v) => v.key === 'multiple-choice');

  return renderTemplate(variant.template, {
    level,
    targetLang,
    passageLength: getPassageLength(level),
    questionCount,
    // Distractors in column B for matching; fewer for beginners.
    extraItems: isBeginner(level) ? 2 : 3,
  });
}

// ---------------------------------------------------------------------------
// Listening
// ---------------------------------------------------------------------------

/**
 * Render the listening prompt. One template for every question type, so the
 * template itself describes the fields each type returns.
 *
 * Variables: targetLang, level, audioFormat, questionType, questionCount, duration.
 *
 * @param {string} level      - CEFR level
 * @param {string} targetLang - the learner's dialect
 * @param {object} options
 * @param {string} options.type        - 'multiple-choice' | 'true-false' | 'fill-blanks'
 * @param {string} options.audioFormat - 'dialogue' | 'monologue' | 'phone-message' | 'announcement' | 'interview'
 * @returns {Promise<string>}
 */
export async function getListeningPrompt(level, targetLang, { type = 'multiple-choice', audioFormat = 'dialogue' } = {}) {
  const prompt = await getPrompt('exam-listening-prompt');

  return renderTemplate(prompt.template, {
    targetLang,
    level,
    audioFormat,
    questionType: type,
    questionCount: isBeginner(level) ? 3 : 5,
    duration: getAudioDuration(level),
  });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Render the writing prompt.
 *
 * Variables: level, targetLang, textType, minWords, maxWords.
 *
 * @param {string} level      - CEFR level
 * @param {string} targetLang - the learner's dialect
 * @param {object} options
 * @param {string} options.textType - 'email' | 'message' | 'story' | 'article' | 'opinion' | 'letter' | 'essay'
 * @returns {Promise<string>}
 */
export async function getWritingPrompt(level, targetLang, { textType = 'message' } = {}) {
  const { min, max } = getWordCountRange(level);
  const prompt = await getPrompt('exam-writing-prompt');

  return renderTemplate(prompt.template, {
    level,
    targetLang,
    textType,
    minWords: min,
    maxWords: max,
  });
}

// ---------------------------------------------------------------------------
// Oral expression (no caller yet)
// ---------------------------------------------------------------------------

/**
 * Render the oral expression prompt.
 *
 * Variables: level, targetLang, prepTimeMinutes, speakingTimeMinutes, oralType.
 *
 * @param {string} level      - CEFR level
 * @param {string} targetLang - the learner's dialect
 * @param {object} options
 * @param {string} options.type - 'conversation' | 'roleplay' | 'description' | 'opinion' | 'presentation'
 * @returns {Promise<string>}
 */
export async function getOralPrompt(level, targetLang, { type = 'conversation' } = {}) {
  const prompt = await getPrompt('exam-oral-prompt');

  return renderTemplate(prompt.template, {
    level,
    targetLang,
    prepTimeMinutes: { A1: 5, A2: 10, B1: 15, B2: 20, C1: 25, C2: 30 }[level] || 15,
    speakingTimeMinutes: { A1: 3, A2: 5, B1: 7, B2: 10, C1: 12, C2: 15 }[level] || 5,
    oralType: type,
  });
}
