/**
 * TEMPORARY — feature seeding.
 *
 * One-off population of appConfig/config/features. Delete this file and the
 * blocks marked `TEMPORARY: feature seeding` in FeaturesSection.jsx and
 * AdminPage.jsx once the collection has been seeded — after that the Features
 * section is read/edit only, and these hardcoded defaults must not stay around
 * where an admin could overwrite live config with them.
 *
 * Grep for `TEMPORARY: feature seeding` to find every touch point.
 *
 * Order runs in tens so features can be slotted between later. Exam and
 * grammar lead deliberately: the pricing cards show the first seven rows and
 * collapse the rest, so those are the shop window.
 */

export const FEATURE_SEED = [
  // ── Exam training ───────────────────────────────────────────────────────
  { key: 'exam_training',      order: 10,  label: 'Exam Training (section)',  labelKey: 'dashboard.exam_training' },
  { key: 'full_exam',          order: 20,  label: 'Full Exam',                labelKey: 'exam.full_exam' },
  { key: 'exam_listening',     order: 30,  label: 'Listening',                labelKey: 'exam.listening' },
  { key: 'exam_reading',       order: 40,  label: 'Reading',                  labelKey: 'exam.reading' },
  { key: 'exam_writing',       order: 50,  label: 'Writing',                  labelKey: 'exam.writing' },

  // ── Grammar ─────────────────────────────────────────────────────────────
  { key: 'grammar',            order: 60,  label: 'Grammar (section)',        labelKey: 'dashboard.grammar' },
  { key: 'grammar_structures', order: 70,  label: 'Grammar Structures',       labelKey: 'grammar.structures' },
  { key: 'grammar_tips',       order: 80,  label: 'Grammar Tips',             labelKey: 'grammar.tips' },
  { key: 'grammar_ask',        order: 90,  label: 'Ask AI (grammar)',         labelKey: 'grammar.ask' },
  { key: 'grammar_practice',   order: 100, label: 'Grammar Practice',         labelKey: 'grammar.practice' },

  // ── Core tools ──────────────────────────────────────────────────────────
  { key: 'translator',         order: 110, label: 'Translator',               labelKey: 'dashboard.translator' },
  { key: 'dictionary',         order: 120, label: 'Dictionary',               labelKey: 'dashboard.dictionary' },

  // ── Content ─────────────────────────────────────────────────────────────
  { key: 'story_generator',    order: 130, label: 'Story Generator',          labelKey: 'dashboard.story_generator' },
  { key: 'history_culture',    order: 140, label: 'History & Culture',        labelKey: 'dashboard.history_culture' },
  { key: 'custom_requests',    order: 150, label: 'Custom AI Requests',       labelKey: 'custom_request.title' },

  // ── Challenges ──────────────────────────────────────────────────────────
  { key: 'challenges',         order: 160, label: 'Challenges (section)',     labelKey: 'dashboard.challenges' },
  { key: 'hangman',            order: 170, label: 'Hangman',                  labelKey: 'challenges.hangman' },
  { key: 'scrambled_word',     order: 180, label: 'Scrambled Word',           labelKey: 'challenges.scrambled_word' },
  { key: 'word_search',        order: 190, label: 'Word Search',              labelKey: 'challenges.word_search' },
  { key: 'word_link',          order: 200, label: 'Word Link',                labelKey: 'challenges.word_link' },
  { key: 'word_ladder',        order: 210, label: 'Word Ladder',              labelKey: 'challenges.word_ladder' },
  { key: 'word_quiz',          order: 220, label: 'Word Quiz',                labelKey: 'challenges.word_quiz' },
  { key: 'crosswords',         order: 230, label: 'Crosswords',               labelKey: 'challenges.crosswords' },

  // ── Not yet released ────────────────────────────────────────────────────
  { key: 'ai_tutor',           order: 240, label: 'AI Tutor',                 labelKey: 'dashboard.ai_tutor' },
  { key: 'real_person_tutor',  order: 250, label: 'Real Person Tutor',        labelKey: 'dashboard.real_person_tutor' },
  { key: 'voice_practice',     order: 260, label: 'Voice Practice',           labelKey: 'dashboard.voice_practice' },
  { key: 'professional_tools', order: 270, label: 'Professional Tools',       labelKey: 'dashboard.professional_tools' },
  { key: 'food',               order: 280, label: 'Food',                     labelKey: 'dashboard.food' },
  { key: 'radio_tv',           order: 290, label: 'Radio & TV',               labelKey: 'dashboard.radio_tv' },
  { key: 'plan_trip',          order: 300, label: 'Plan a Trip',              labelKey: 'dashboard.plan_trip' },
];
