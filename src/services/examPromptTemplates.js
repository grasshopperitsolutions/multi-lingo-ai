/**
 * examPromptTemplates.js
 *
 * Builds level/type-specific AI prompts for exam exercise generation.
 * The instructional copy itself lives in Firestore (appConfig/config/prompts,
 * see promptService.js) — this file only computes the level/type-dependent
 * *variables* (grammar rules, word counts, phrasing, labels) and renders them
 * into the fetched template.
 *
 * Usage:
 *   import { getReadingPrompt, getListeningPrompt, getWritingPrompt } from '../services/examPromptTemplates';
 *
 *   const prompt = await getReadingPrompt('A1', 'pt-PT', { type: 'true-false' });
 *   const prompt = await getListeningPrompt('B1', 'pt-PT', { type: 'matching' });
 */

import { getPrompt, renderTemplate } from './promptService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the appropriate word count range for a given CEFR level.
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

/**
 * Get level-appropriate grammar structures description.
 * Exported for reuse by other prompt-building services (e.g. storyService)
 * that need the same level-to-grammar-constraints mapping.
 */
export function getGrammarDescription(level) {
  const descriptions = {
    A1: 'Use only presente do indicativo (simple present), basic vocabulary (colours, numbers, family, food, daily objects), short simple sentences. No past or future tenses.',
    A2: 'Mainly presente do indicativo with some pretérito perfeito simples (simple past). Basic connectors (e, mas, porque). Concrete vocabulary about routines, weather, clothes, school, etc.',
    B1: 'Mix of presente, pretérito perfeito and pretérito imperfeito. Some future (ir + infinitive). Subjunctive in basic contexts (espero que). Connectors (embora, no entanto, por isso). Abstract topics.',
    B2: 'Full range of indicative tenses, some subjunctive (presente do conjuntivo). Conditional (gostaria de). Complex connectors. Passive voice. Idiomatic expressions.',
    C1: 'Full mastery of indicative, subjunctive, conditional, and compound tenses. Sophisticated connectors (não obstante, todavia, por conseguinte). Academic and nuanced vocabulary. Complex sentence structures.',
  };
  return descriptions[level] ?? descriptions.A1;
}

/**
 * Get level-appropriate passage length (words) for reading.
 */
function getPassageLength(level) {
  const lengths = { A1: 40, A2: 80, B1: 150, B2: 250, C1: 350, C2: 400 };
  return lengths[level] ?? lengths.A1;
}

/**
 * Get level-appropriate audio duration (seconds) for listening.
 */
function getAudioDuration(level) {
  const durations = { A1: 40, A2: 60, B1: 90, B2: 120, C1: 150, C2: 180 };
  return durations[level] ?? durations.A1;
}

/**
 * Get official exam phrasing based on exercise type and level.
 */
function getExamPhrasing(type, level) {
  const isBeginner = level === 'A1' || level === 'A2';

  const phrasings = {
    'multiple-choice': isBeginner
      ? 'Marca com X a resposta correta.'
      : 'Assinale com X a opção correta.',
    'true-false': isBeginner
      ? 'Identifica as frases verdadeiras (V) e as falsas (F), de acordo com o texto.'
      : 'Identifique as frases verdadeiras (V) e as falsas (F), de acordo com o texto.',
    // Reading matching pairs two columns of text — there are no images in this
    // exercise, so the old beginner phrasing ("Associa um nome a cada imagem")
    // told students to do something the UI never showed them.
    'matching': isBeginner
      ? 'Associa cada elemento da coluna A ao elemento correspondente da coluna B.'
      : 'Faça corresponder cada elemento da coluna A ao único elemento da coluna B que permite formar uma afirmação correta.',
    'fill-blanks': isBeginner
      ? 'Preenche cada espaço com a palavra correta do quadro abaixo. Há três palavras a mais.'
      : 'Preencha cada espaço com a palavra correta do quadro abaixo. Há palavras a mais.',
    'cloze-bank': isBeginner
      ? 'Completa as frases com as palavras do quadro.'
      : 'Complete as frases com as palavras do quadro.',
    'cloze-options': 'Complete as frases com a letra da opção correta.',
    'best-title': 'Marca com X o melhor título para o texto.',
    'ordering': 'Ordene os parágrafos de acordo com o sentido do texto.',
    'transcription': 'Copie do texto a frase que corresponde à afirmação seguinte.',
    'notice-sign': isBeginner
      ? 'Completa os avisos com um verbo do quadro abaixo. Há três verbos a mais.'
      : 'Associa cada frase a um único aviso. Há três avisos a mais.',
  };

  return phrasings[type] || phrasings['multiple-choice'];
}

// ---------------------------------------------------------------------------
// Reading Exercise Prompts
// ---------------------------------------------------------------------------

/**
 * Generate a reading exercise prompt.
 *
 * @param {string} level     - CEFR level
 * @param {string} targetLang - Target language
 * @param {object} options
 * @param {string} options.type - Exercise type: 'multiple-choice' | 'true-false' | 'matching' | 'best-title' | 'ordering' | 'cloze-options' | 'fill-blanks' | 'notice-sign'
 * @param {number} [options.questionCount=4]
 * @param {string} [options.topic] - Optional specific topic
 * @returns {Promise<string>} The AI prompt
 */
export async function getReadingPrompt(level, targetLang, { type = 'multiple-choice', questionCount = 4, topic } = {}) {
  const passageLength = getPassageLength(level);
  const grammarDescription = getGrammarDescription(level);
  const examPhrasing = getExamPhrasing(type, level);
  const extraItems = (level === 'A1' || level === 'A2') ? 2 : 3;
  const topicLine = topic ? `Topic: ${topic}` : '';

  const prompt = await getPrompt('exam-reading-prompt');
  const variant = prompt.variants?.find((v) => v.key === type) ?? prompt.variants?.find((v) => v.key === 'multiple-choice');

  return renderTemplate(variant.template, {
    level, targetLang, grammarDescription, passageLength, topicLine, questionCount, examPhrasing, extraItems,
  });
}

// ---------------------------------------------------------------------------
// Listening Exercise Prompts
// ---------------------------------------------------------------------------

/**
 * Generate a listening exercise prompt.
 *
 * @param {string} level     - CEFR level
 * @param {string} targetLang - Target language
 * @param {object} options
 * @param {string} options.type - Exercise type: 'multiple-choice' | 'true-false' | 'fill-blanks' | 'matching'
 * @param {string} options.audioFormat - 'dialogue' | 'monologue' | 'phone-message' | 'announcement' | 'interview'
 * @returns {Promise<string>} The AI prompt
 */
export async function getListeningPrompt(level, targetLang, { type = 'multiple-choice', audioFormat = 'dialogue' } = {}) {
  const duration = getAudioDuration(level);
  const isBeginner = level === 'A1' || level === 'A2';
  const questionCount = isBeginner ? 3 : 5;

  const formatLabels = {
    'dialogue': 'a natural dialogue between two people',
    'monologue': 'a monologue by one person',
    'phone-message': 'a phone message/recado',
    'announcement': 'a public announcement',
    'interview': 'an interview (questions and answers)',
  };

  const toneDescriptions = {
    'dialogue': 'casual conversation between friends or family members',
    'monologue': 'a person talking to themselves or to an audience',
    'phone-message': 'a recorded phone message with clear articulation',
    'announcement': 'a formal public announcement with clear enunciation',
    'interview': 'a semi-formal interview with questions and answers',
  };

  const audioFormatLabel = formatLabels[audioFormat] || 'a dialogue';
  const toneDescription = toneDescriptions[audioFormat] || 'natural conversation';

  const listeningTypeLabel = type === 'multiple-choice' ? 'multiple choice'
    : type === 'true-false' ? 'true/false'
    : 'fill in the blanks (select from a word bank)';

  const listeningFieldList = type === 'multiple-choice'
    ? `  - "questions": array of { id, text, options[], correctAnswer }`
    : type === 'true-false'
      ? `  - "statements": array of { id, text, isTrue }\n  - "questions": array of { id, text, options[], correctAnswer }`
      : `  - "passage": the same text as the transcript but with key words replaced by ___ (triple underscore)\n  - "wordBank": array of words in ${targetLang} (correct answers + plausible distractors)\n  - "blanks": array of { id, position, correctAnswer }`;

  const prompt = await getPrompt('exam-listening-prompt');

  return renderTemplate(prompt.template, {
    targetLang, level, audioFormatLabel, listeningTypeLabel, questionCount, toneDescription, duration, listeningFieldList,
  });
}

// ---------------------------------------------------------------------------
// Writing Exercise Prompts
// ---------------------------------------------------------------------------

/**
 * Generate a writing exercise prompt.
 *
 * @param {string} level       - CEFR level
 * @param {string} targetLang  - Target language
 * @param {object} options
 * @param {string} options.textType - 'email' | 'message' | 'story' | 'article' | 'opinion' | 'letter' | 'essay'
 * @param {string} [options.topic] - Optional specific topic
 * @returns {Promise<string>} The AI prompt
 */
export async function getWritingPrompt(level, targetLang, { textType = 'message', topic } = {}) {
  const { min, max } = getWordCountRange(level);
  const grammarDescription = getGrammarDescription(level);

  const textTypeLabels = {
    'email': 'an email',
    'message': 'a message/letter',
    'story': 'a short story/relato',
    'article': 'a newspaper article',
    'opinion': 'an opinion article',
    'letter': 'a formal/informal letter',
    'essay': 'an argumentative essay',
  };
  const textTypeLabel = textTypeLabels[textType] || 'a text';
  const topicLine = topic ? `Topic: ${topic}` : '';

  const prompt = await getPrompt('exam-writing-prompt');

  return renderTemplate(prompt.template, {
    level, targetLang, grammarDescription, textTypeLabel, minWords: min, maxWords: max, topicLine,
  });
}

// ---------------------------------------------------------------------------
// Oral Expression Prompts
// ---------------------------------------------------------------------------

/**
 * Generate an oral expression exercise prompt.
 *
 * @param {string} level      - CEFR level
 * @param {string} targetLang - Target language
 * @param {object} options
 * @param {string} options.type - 'conversation' | 'roleplay' | 'description' | 'opinion' | 'presentation'
 * @returns {Promise<string>} The AI prompt
 */
export async function getOralPrompt(level, targetLang, { type = 'conversation' } = {}) {
  const grammarDescription = getGrammarDescription(level);
  const prepTimeMinutes = { A1: 5, A2: 10, B1: 15, B2: 20, C1: 25, C2: 30 }[level] || 15;
  const speakingTimeMinutes = { A1: 3, A2: 5, B1: 7, B2: 10, C1: 12, C2: 15 }[level] || 5;

  const typeLabels = {
    'conversation': 'a guided conversation with the examiner',
    'roleplay': 'a role-play scenario with the examiner',
    'description': 'a description of an image or situation',
    'opinion': 'an opinion discussion on a given topic',
    'presentation': 'a short presentation followed by questions',
  };
  const oralTypeLabel = typeLabels[type] || 'a guided conversation';

  const prompt = await getPrompt('exam-oral-prompt');

  return renderTemplate(prompt.template, {
    level, targetLang, grammarDescription, prepTimeMinutes, speakingTimeMinutes, oralTypeLabel, oralType: type,
  });
}
