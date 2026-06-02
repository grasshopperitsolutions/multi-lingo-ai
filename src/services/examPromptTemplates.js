/**
 * examPromptTemplates.js
 *
 * Central repository of level-specific AI prompt templates for exam exercise generation.
 * Each function returns a prompt string appropriate for the given CEFR level and exercise type.
 *
 * Usage:
 *   import { getReadingPrompt, getListeningPrompt, getWritingPrompt } from '../services/examPromptTemplates';
 *
 *   const prompt = getReadingPrompt('A1', 'pt-PT', { type: 'true-false' });
 *   const prompt = getListeningPrompt('B1', 'pt-PT', { type: 'matching' });
 */

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
 */
function getGrammarDescription(level) {
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
    'matching': isBeginner
      ? 'Associa um nome a cada imagem.'
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
 * @param {string} options.type - Exercise type: 'multiple-choice' | 'true-false' | 'matching' | 'best-title' | 'ordering' | 'transcription' | 'cloze-options' | 'vocabulary'
 * @param {number} [options.questionCount=4]
 * @param {string} [options.topic] - Optional specific topic
 * @returns {string} The AI prompt
 */
export function getReadingPrompt(level, targetLang, { type = 'multiple-choice', questionCount = 4, topic } = {}) {
  const passageLength = getPassageLength(level);
  const grammar = getGrammarDescription(level);
  const phrasing = getExamPhrasing(type, level);
  const extraItems = (level === 'A1' || level === 'A2') ? 2 : 3;

  const instructions = [];
  instructions.push(`You are a Portuguese language examiner creating a READING exercise for CEFR level ${level} in ${targetLang}.`);
  instructions.push(``);
  instructions.push(`LEVEL ${level} CONSTRAINTS:`);
  instructions.push(grammar);
  instructions.push(`The reading passage should be approximately ${passageLength} words.`);
  if (topic) instructions.push(`Topic: ${topic}`);
  instructions.push(``);

  // Exercise type specific instructions
  switch (type) {
    case 'multiple-choice':
      instructions.push(`Exercise type: Multiple choice comprehension questions.`);
      instructions.push(`Create a reading passage and ${questionCount} multiple-choice questions.`);
      instructions.push(`Each question must have 3-4 options (A/B/C or A/B/C/D).`);
      instructions.push(`Official phrasing: "${phrasing}"`);
      instructions.push(``);
      instructions.push(`Return ONLY a valid JSON object:`);
      instructions.push(`{`);
      instructions.push(`  "type": "multiple-choice",`);
      instructions.push(`  "text": "<passage in ${targetLang}>",`);
      instructions.push(`  "instructions": ["${phrasing}"],`);
      instructions.push(`  "vocabulary": [`);
      instructions.push(`    { "word": "<difficult word>", "definition": "<simple explanation in ${targetLang}>" }`);
      instructions.push(`  ],`);
      instructions.push(`  "questions": [`);
      instructions.push(`    { "id": "r1", "text": "<question>", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A. ..." }`);
      instructions.push(`  ]`);
      instructions.push(`}`);
      break;

    case 'true-false':
      instructions.push(`Exercise type: True/False statements about the text.`);
      instructions.push(`Create a reading passage and ${questionCount} statements.`);
      instructions.push(`Some statements should be true (V) and some false (F), based on the text.`);
      instructions.push(`Official phrasing: "${phrasing}"`);
      instructions.push(``);
      instructions.push(`Return ONLY a valid JSON object:`);
      instructions.push(`{`);
      instructions.push(`  "type": "true-false",`);
      instructions.push(`  "text": "<passage in ${targetLang}>",`);
      instructions.push(`  "instructions": ["${phrasing}"],`);
      instructions.push(`  "vocabulary": [`);
      instructions.push(`    { "word": "<difficult word>", "definition": "<simple explanation>" }`);
      instructions.push(`  ],`);
      instructions.push(`  "statements": [`);
      instructions.push(`    { "id": "tf1", "text": "<statement>", "isTrue": true }`);
      instructions.push(`  ],`);
      instructions.push(`  "questions": [`);
      instructions.push(`    { "id": "r1", "text": "<statement>", "options": ["Verdadeiro", "Falso"], "correctAnswer": "Verdadeiro" }`);
      instructions.push(`  ]`);
      instructions.push(`}`);
      break;

    case 'best-title':
      instructions.push(`Exercise type: Select the best title for the text.`);
      instructions.push(`Create a reading passage and ${questionCount} title options.`);
      instructions.push(`Only one title should be correct/appropriate.`);
      instructions.push(`Official phrasing: "${phrasing}"`);
      instructions.push(``);
      instructions.push(`Return ONLY a valid JSON object:`);
      instructions.push(`{`);
      instructions.push(`  "type": "best-title",`);
      instructions.push(`  "text": "<passage in ${targetLang}>",`);
      instructions.push(`  "instructions": ["${phrasing}"],`);
      instructions.push(`  "vocabulary": [`);
      instructions.push(`    { "word": "<word>", "definition": "<definition>" }`);
      instructions.push(`  ],`);
      instructions.push(`  "titles": [`);
      instructions.push(`    { "id": "t1", "text": "<title 1>", "isCorrect": true },`);
      instructions.push(`    { "id": "t2", "text": "<title 2>", "isCorrect": false }`);
      instructions.push(`  ],`);
      instructions.push(`  "questions": [`);
      instructions.push(`    { "id": "r1", "text": "Qual é o melhor título para o texto?", "options": ["<title 1>", "<title 2>", "<title 3>", "<title 4>"], "correctAnswer": "<title 1>" }`);
      instructions.push(`  ]`);
      instructions.push(`}`);
      break;

    case 'ordering':
      instructions.push(`Exercise type: Paragraph/sentence ordering.`);
      instructions.push(`Create ${questionCount} paragraphs or sentences that form a coherent text when ordered correctly.`);
      instructions.push(`Official phrasing: "${phrasing}"`);
      instructions.push(``);
      instructions.push(`Return ONLY a valid JSON object:`);
      instructions.push(`{`);
      instructions.push(`  "type": "ordering",`);
      instructions.push(`  "instructions": ["${phrasing}"],`);
      instructions.push(`  "items": [`);
      instructions.push(`    { "id": "o1", "text": "<paragraph text>", "correctPosition": 1 }`);
      instructions.push(`  ]`);
      instructions.push(`}`);
      break;

    case 'cloze-options':
      instructions.push(`Exercise type: Cloze with A/B/C/D options for each gap.`);
      instructions.push(`Create a short text with ${questionCount} gaps.`);
      instructions.push(`Each gap must have 3-4 options (A/B/C/D).`);
      instructions.push(`Official phrasing: "${phrasing}"`);
      instructions.push(``);
      instructions.push(`Return ONLY a valid JSON object:`);
      instructions.push(`{`);
      instructions.push(`  "type": "cloze-options",`);
      instructions.push(`  "instructions": ["${phrasing}"],`);
      instructions.push(`  "gaps": [`);
      instructions.push(`    { "id": "c1", "prefix": "Texto antes...", "suffix": "...texto depois.", "options": ["opção A", "opção B", "opção C", "opção D"], "correctAnswer": "opção A" }`);
      instructions.push(`  ]`);
      instructions.push(`}`);
      break;

    case 'matching':
      instructions.push(`Exercise type: Column A → Column B matching.`);
      instructions.push(`Create ${questionCount} pairs of related items and ${extraItems} extra items for column B (distractors).`);
      instructions.push(`Official phrasing: "${phrasing}"`);
      instructions.push(`Há ${extraItems} opções a mais na coluna B.`);
      instructions.push(``);
      instructions.push(`Return ONLY a valid JSON object:`);
      instructions.push(`{`);
      instructions.push(`  "type": "matching",`);
      instructions.push(`  "instructions": ["${phrasing}"],`);
      instructions.push(`  "pairs": [`);
      instructions.push(`    { "id": "m1", "itemA": "<column A text>", "itemB": "<column B correct match>" }`);
      instructions.push(`  ],`);
      instructions.push(`  "extraItems": ["<distractor 1>", "<distractor 2>"]`);
      instructions.push(`}`);
      break;

    default:
      // Fallback to multiple-choice
      instructions.push(`Exercise type: Multiple choice.`);
      instructions.push(`Create a reading passage and ${questionCount} questions.`);
      instructions.push(`Return ONLY a valid JSON object with "text", "instructions", "vocabulary", and "questions" arrays.`);
  }

  instructions.push(``);
  instructions.push(`Rules:`);
  instructions.push(`- All text must be in ${targetLang}.`);
  instructions.push(`- Do NOT include any text outside the JSON object.`);
  instructions.push(`- The vocabulary array should contain 2-4 difficult words with their definitions in ${targetLang}.`);

  return instructions.join('\n');
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
 * @returns {string} The AI prompt
 */
export function getListeningPrompt(level, targetLang, { type = 'multiple-choice', audioFormat = 'dialogue' } = {}) {
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

  const typeLabel = type === 'multiple-choice' ? 'multiple choice'
    : type === 'true-false' ? 'true/false'
    : 'fill in the blanks (select from a word bank)';

  const commonFields = `Return a JSON object with:
  - "transcript": the full audio script in ${targetLang}
  - "tone": "${toneDescriptions[audioFormat] || 'natural conversation'}"
  - "duration": ${duration}
  - "instructions": array of strings`;

  const fieldList = type === 'multiple-choice'
    ? `${commonFields}
  - "questions": array of { id, text, options[], correctAnswer }`
    : type === 'true-false'
      ? `${commonFields}
  - "statements": array of { id, text, isTrue }
  - "questions": array of { id, text, options[], correctAnswer }`
      : `${commonFields}
  - "passage": the same text as the transcript but with key words replaced by ___ (triple underscore)
  - "wordBank": array of words in ${targetLang} (correct answers + plausible distractors)
  - "blanks": array of { id, position, correctAnswer }`;

  return [
    `Generate a listening comprehension exercise in ${targetLang} for CEFR level ${level}.`,
    `CRITICAL: All text content must be written entirely in ${targetLang}.`,
    ``,
    `Audio format: ${formatLabels[audioFormat] || 'a dialogue'}.`,
    `Exercise type: ${typeLabel}.`,
    `Create ${questionCount} items based on the transcript the student will hear.`,
    ``,
    `The "transcript" is the full script the student will listen to via TTS.`,
    `The "tone" describes how the TTS should deliver the audio.`,
    fieldList,
    ``,
    `Return ONLY valid JSON. No markdown, no explanation.`,
  ].join('\n');
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
 * @returns {string} The AI prompt
 */
export function getWritingPrompt(level, targetLang, { textType = 'message', topic } = {}) {
  const { min, max } = getWordCountRange(level);
  const grammar = getGrammarDescription(level);

  const textTypeLabels = {
    'email': 'an email',
    'message': 'a message/letter',
    'story': 'a short story/relato',
    'article': 'a newspaper article',
    'opinion': 'an opinion article',
    'letter': 'a formal/informal letter',
    'essay': 'an argumentative essay',
  };

  const prompt = [
    `You are a Portuguese language examiner creating a WRITING exercise for CEFR level ${level} in ${targetLang}.`,
    `The exercise must be in European Portuguese (pt-PT).`,
    ``,
    `LEVEL ${level} CONSTRAINTS:`,
    grammar,
    ``,
    `Text type: ${textTypeLabels[textType] || 'a text'}.`,
    `The student must write between ${min} and ${max} words.`,
    topic ? `Topic: ${topic}` : '',
    ``,
    `Return ONLY a valid JSON object:`,
    `{`,
    `  "type": "writing",`,
    `  "prompt": "<the scenario/context in ${targetLang}>",`,
    `  "instructions": ["<instruction 1>", "<instruction 2>", ...],`,
    `  "minWords": ${min},`,
    `  "maxWords": ${max}`,
    `}`,
    ``,
    `Rules:`,
    `- The prompt and instructions must be in European Portuguese (pt-PT).`,
    `- Include 3-5 bullet-point instructions guiding what to include.`,
    `- Make the scenario realistic and age-appropriate.`,
    `- Do NOT include any text outside the JSON object.`,
  ].filter(Boolean).join('\n');

  return prompt;
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
 * @returns {string} The AI prompt
 */
export function getOralPrompt(level, targetLang, { type = 'conversation' } = {}) {
  const grammar = getGrammarDescription(level);
  const prepTime = { A1: 5, A2: 10, B1: 15, B2: 20, C1: 25, C2: 30 }[level] || 15;
  const duration = { A1: 3, A2: 5, B1: 7, B2: 10, C1: 12, C2: 15 }[level] || 5;

  const typeLabels = {
    'conversation': 'a guided conversation with the examiner',
    'roleplay': 'a role-play scenario with the examiner',
    'description': 'a description of an image or situation',
    'opinion': 'an opinion discussion on a given topic',
    'presentation': 'a short presentation followed by questions',
  };

  const prompt = [
    `You are a Portuguese language examiner creating an ORAL EXPRESSION exercise for CEFR level ${level} in ${targetLang}.`,
    ``,
    `LEVEL ${level} CONSTRAINTS:`,
    grammar,
    `Preparation time: ${prepTime} minutes.`,
    `Speaking time: ${duration} minutes.`,
    ``,
    `Exercise type: ${typeLabels[type] || 'a guided conversation'}.`,
    ``,
    `Return ONLY a valid JSON object:`,
    `{`,
    `  "type": "oral",`,
    `  "oralType": "${type}",`,
    `  "prompt": "<the task description in ${targetLang}>",`,
    `  "instructions": ["<instruction 1>", "<instruction 2>", ...],`,
    `  "prepTimeMinutes": ${prepTime},`,
    `  "speakingTimeMinutes": ${duration},`,
    `  "topics": ["<topic 1>", "<topic 2>"],`,
    `  "followUpQuestions": ["<question 1>", "<question 2>", "<question 3>"]`,
    `}`,
    ``,
    `Rules:`,
    `- All text must be in ${targetLang}.`,
    `- The prompt should clearly describe the task.`,
    `- Include 2-4 follow-up questions the examiner can ask.`,
    `- Do NOT include any text outside the JSON object.`,
  ].join('\n');

  return prompt;
}