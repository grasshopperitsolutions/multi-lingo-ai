/**
 * grammarSeed.ptPT.js
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ TEMPORARY — remove once the corpus has been seeded into Firestore.    │
 * │ Delete this file together with GrammarSeedSection.jsx and its handler │
 * │ in src/pages/AdminPage.jsx.                                           │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Hand-written European Portuguese teaching material, transcribed from years
 * of real lessons. This is the app's differentiator: it is reviewed content,
 * not AI output, which is why the Grammar feature is locked to pt-PT until a
 * language has material of comparable quality (see src/config/grammarSupport.js).
 *
 * Two shapes, matching the Firestore schema in grammarService.js:
 *
 *   TOPICS         — the taxonomy. `key` and `family` are language-neutral, so
 *                    the same keys can describe Spanish or French later; only
 *                    the content underneath is pt-PT specific.
 *   TOPIC_CONTENT  — keyed by topic key. Written in en-US: this is the
 *                    *explanation* language, separate from the language being
 *                    explained. Other explanation locales are AI-filled on
 *                    demand by grammarService.seedTopicContent().
 *   TIPS           — pt-PT specific material that isn't a grammar structure:
 *                    pronunciation laws, expressions, proverbs, mnemonics.
 *
 * Table rows must match their headers in length — the renderer trusts this.
 * Each row is `{ cells: string[] }` rather than a bare array: Firestore
 * rejects an array directly containing another array, so a plain string[][]
 * would fail to write.
 */

export const SEED_TARGET_LANG = 'pt-PT';
export const SEED_EXPLANATION_LOCALE = 'en-US';

// ---------------------------------------------------------------------------
// Topic taxonomy
// ---------------------------------------------------------------------------

export const GRAMMAR_TOPICS = [
  {
    "key": "verbs-past-simple",
    "family": "verbs",
    "order": 10
  },
  {
    "key": "verbs-past-imperfect",
    "family": "verbs",
    "order": 20
  },
  {
    "key": "verbs-future-ir",
    "family": "verbs",
    "order": 30
  },
  {
    "key": "verbs-conditional",
    "family": "verbs",
    "order": 40
  },
  {
    "key": "verbs-haver",
    "family": "verbs",
    "order": 50
  },
  {
    "key": "verbs-gerund",
    "family": "verbs",
    "order": 60
  },
  {
    "key": "verbs-subjunctive-que",
    "family": "verbs",
    "order": 70
  },
  {
    "key": "verbs-with-prepositions",
    "family": "verbs",
    "order": 80
  },
  {
    "key": "pronouns-subject",
    "family": "pronouns",
    "order": 90
  },
  {
    "key": "pronouns-clitic",
    "family": "pronouns",
    "order": 100
  },
  {
    "key": "pronouns-clitic-position",
    "family": "pronouns",
    "order": 110
  },
  {
    "key": "pronouns-prepositional",
    "family": "pronouns",
    "order": 120
  },
  {
    "key": "possessives",
    "family": "possessives",
    "order": 130
  },
  {
    "key": "articles-contractions",
    "family": "articles",
    "order": 140
  },
  {
    "key": "demonstratives",
    "family": "demonstratives",
    "order": 150
  },
  {
    "key": "place-adverbs",
    "family": "place",
    "order": 160
  },
  {
    "key": "quantifiers-todo",
    "family": "quantifiers",
    "order": 170
  },
  {
    "key": "quantifiers-indefinites",
    "family": "quantifiers",
    "order": 180
  },
  {
    "key": "questions-words",
    "family": "questions",
    "order": 190
  },
  {
    "key": "prepositions-por-para",
    "family": "prepositions",
    "order": 200
  },
  {
    "key": "ser-estar",
    "family": "ser-estar",
    "order": 210
  },
  {
    "key": "comparatives",
    "family": "comparatives",
    "order": 220
  },
  {
    "key": "word-formation-suffixes",
    "family": "word-formation",
    "order": 230
  },
  {
    "key": "numbers-cem-cento",
    "family": "numbers",
    "order": 240
  },
  {
    "key": "time-telling",
    "family": "time",
    "order": 250
  }
];

// ---------------------------------------------------------------------------
// Topic content (en-US explanations of pt-PT grammar)
//
// Table rows are { cells: string[] } rather than a bare string[] — Firestore
// rejects an array that directly contains another array, so this is the
// shape every table must use end to end (seed data, AI response schema,
// the sanitizer, and GrammarTable.jsx).
// ---------------------------------------------------------------------------

export const GRAMMAR_TOPIC_CONTENT = {
  "verbs-past-simple": {
    "title": "Past Simple (pretérito perfeito)",
    "summary": "The finished past — something that happened and is over. Endings differ by whether the infinitive ends in -AR, -ER or -IR.",
    "explanation": "The pretérito perfeito describes a completed action: \"I spoke\", \"I ate\", \"I opened\". It is the tense you reach for when the event has a clear end.\n\nLearn it by conjugation group. The -ER and -IR groups share the \"eu\" form (-i) but diverge everywhere else, which is where most mistakes come from.\n\nNote the accent on nós falámos — it distinguishes the past from the present nós falamos. In Brazilian Portuguese that accent is dropped, so the two forms merge; in European Portuguese it is written and pronounced.",
    "tables": [
      {
        "caption": "falar (-AR), comer (-ER), abrir (-IR)",
        "headers": [
          "Pronoun",
          "falar",
          "comer",
          "abrir"
        ],
        "rows": [
          {
            "cells": [
              "Eu",
              "falei",
              "comi",
              "abri"
            ]
          },
          {
            "cells": [
              "Tu",
              "falaste",
              "comeste",
              "abriste"
            ]
          },
          {
            "cells": [
              "Ele",
              "falou",
              "comeu",
              "abriu"
            ]
          },
          {
            "cells": [
              "Nós",
              "falámos",
              "comemos",
              "abrimos"
            ]
          },
          {
            "cells": [
              "Eles",
              "falaram",
              "comeram",
              "abriram"
            ]
          }
        ]
      },
      {
        "caption": "The endings alone",
        "headers": [
          "Pronoun",
          "-AR",
          "-ER",
          "-IR"
        ],
        "rows": [
          {
            "cells": [
              "Eu",
              "-ei",
              "-i",
              "-i"
            ]
          },
          {
            "cells": [
              "Tu",
              "-aste",
              "-este",
              "-iste"
            ]
          },
          {
            "cells": [
              "Ele",
              "-ou",
              "-eu",
              "-iu"
            ]
          },
          {
            "cells": [
              "Nós",
              "-ámos",
              "-emos",
              "-imos"
            ]
          },
          {
            "cells": [
              "Eles",
              "-aram",
              "-eram",
              "-iram"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Eu falei com o meu irmão ontem.",
        "native": "I spoke with my brother yesterday.",
        "note": ""
      },
      {
        "target": "Nós comemos no restaurante novo.",
        "native": "We ate at the new restaurant.",
        "note": ""
      },
      {
        "target": "Eles abriram a porta.",
        "native": "They opened the door.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Dropping the accent in nós falámos — that spells the present tense instead.",
      "Using -ER endings for -IR verbs: it is abriste, not \"abreste\"."
    ]
  },
  "verbs-past-imperfect": {
    "title": "Past Continuous (pretérito imperfeito)",
    "summary": "The unfinished past — what used to happen, or was happening. -ER and -IR verbs share one set of endings.",
    "explanation": "The pretérito imperfeito covers habits and ongoing states in the past: \"I used to speak\", \"I was speaking\". Contrast it with the pretérito perfeito, which closes the action off.\n\nGood news: -ER and -IR verbs take identical endings here, so there are only two patterns to learn instead of three.",
    "tables": [
      {
        "caption": "falar (-AR)",
        "headers": [
          "Pronoun",
          "Form",
          "Ending"
        ],
        "rows": [
          {
            "cells": [
              "Eu",
              "falava",
              "-ava"
            ]
          },
          {
            "cells": [
              "Tu",
              "falavas",
              "-avas"
            ]
          },
          {
            "cells": [
              "Ele",
              "falava",
              "-ava"
            ]
          },
          {
            "cells": [
              "Nós",
              "falávamos",
              "-ávamos"
            ]
          },
          {
            "cells": [
              "Eles",
              "falavam",
              "-avam"
            ]
          }
        ]
      },
      {
        "caption": "comer (-ER) and abrir (-IR) — same endings",
        "headers": [
          "Pronoun",
          "comer",
          "abrir",
          "Ending"
        ],
        "rows": [
          {
            "cells": [
              "Eu",
              "comia",
              "abria",
              "-ia"
            ]
          },
          {
            "cells": [
              "Tu",
              "comias",
              "abrias",
              "-ias"
            ]
          },
          {
            "cells": [
              "Ele",
              "comia",
              "abria",
              "-ia"
            ]
          },
          {
            "cells": [
              "Nós",
              "comíamos",
              "abríamos",
              "-íamos"
            ]
          },
          {
            "cells": [
              "Eles",
              "comiam",
              "abriam",
              "-iam"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Quando era pequeno, falava muito.",
        "native": "When I was little, I used to talk a lot.",
        "note": "Habit in the past."
      },
      {
        "target": "Ela comia enquanto eu estudava.",
        "native": "She was eating while I was studying.",
        "note": "Two ongoing actions."
      }
    ],
    "pitfalls": [
      "Using the perfeito for habits: \"Eu falei muito quando era pequeno\" says you spoke once, not repeatedly."
    ]
  },
  "verbs-future-ir": {
    "title": "Future with ir + infinitive",
    "summary": "The everyday future: conjugate ir in the present and add the plain infinitive.",
    "explanation": "Portuguese has a proper future tense, but in speech the common construction is ir (present) + infinitive — exactly like English \"going to\".\n\nThe infinitive never changes. All the work happens in ir.",
    "tables": [
      {
        "caption": "ir (present) + infinitive",
        "headers": [
          "Pronoun",
          "ir",
          "Example"
        ],
        "rows": [
          {
            "cells": [
              "Eu",
              "vou",
              "Eu vou falar"
            ]
          },
          {
            "cells": [
              "Tu",
              "vais",
              "Tu vais comer"
            ]
          },
          {
            "cells": [
              "Ele",
              "vai",
              "Ele vai abrir"
            ]
          },
          {
            "cells": [
              "Nós",
              "vamos",
              "Nós vamos falar"
            ]
          },
          {
            "cells": [
              "Eles",
              "vão",
              "Eles vão comer"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Eu vou falar com ela amanhã.",
        "native": "I am going to speak with her tomorrow.",
        "note": ""
      },
      {
        "target": "Nós vamos comer fora hoje.",
        "native": "We are going to eat out today.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Conjugating the second verb: it is \"vou falar\", never \"vou falo\"."
    ]
  },
  "verbs-conditional": {
    "title": "Would (condicional)",
    "summary": "Add -ia endings to the whole infinitive — the infinitive stays intact.",
    "explanation": "The conditional translates English \"would\". Unusually, the ending attaches to the complete infinitive rather than to a stem, so falar → falaria keeps falar visible inside the word.",
    "tables": [
      {
        "caption": "Infinitive + conditional ending",
        "headers": [
          "English",
          "Portuguese",
          "Built from"
        ],
        "rows": [
          {
            "cells": [
              "I would like",
              "Eu gostaria",
              "gostar + ia"
            ]
          },
          {
            "cells": [
              "I would speak",
              "Eu falaria",
              "falar + ia"
            ]
          },
          {
            "cells": [
              "I would sleep",
              "Eu dormiria",
              "dormir + ia"
            ]
          },
          {
            "cells": [
              "I would eat",
              "Eu comeria",
              "comer + ia"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Eu gostaria de um café, por favor.",
        "native": "I would like a coffee, please.",
        "note": "Politer than \"eu quero\"."
      }
    ],
    "pitfalls": [
      "Cutting the infinitive ending off first — it is falaria, not \"falia\"."
    ]
  },
  "verbs-haver": {
    "title": "haver — \"there is / there are\"",
    "summary": "Impersonal: always third person singular, whatever follows it.",
    "explanation": "To say something exists, Portuguese uses haver impersonally. It never agrees with what follows — há uma casa and há muitas casas both use há.\n\nIn conversation people often use ter instead (tem uma casa), but haver is the correct written form.",
    "tables": [
      {
        "caption": "haver across tenses",
        "headers": [
          "Portuguese",
          "English",
          "Tense"
        ],
        "rows": [
          {
            "cells": [
              "há",
              "there is / there are",
              "present"
            ]
          },
          {
            "cells": [
              "houve",
              "there was",
              "past simple"
            ]
          },
          {
            "cells": [
              "havia",
              "there used to be",
              "past imperfect"
            ]
          },
          {
            "cells": [
              "haverá",
              "there will be",
              "future"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Há muitas casas nesta rua.",
        "native": "There are many houses on this street.",
        "note": "Singular há with a plural noun."
      },
      {
        "target": "Havia um café aqui.",
        "native": "There used to be a café here.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Making it agree: \"hão muitas casas\" is wrong — haver stays singular."
    ]
  },
  "verbs-gerund": {
    "title": "The -ing form: a + infinitive",
    "summary": "European Portuguese says \"estou a falar\", not \"estou falando\". This is the clearest split from Brazilian Portuguese.",
    "explanation": "To express an action in progress, European Portuguese uses estar + a + infinitive. The -ando/-endo/-indo gerund exists and appears in writing, but the everyday spoken form in Portugal is a + infinitive.\n\nThis single rule will make you sound European rather than Brazilian faster than almost anything else.",
    "tables": [
      {
        "caption": "European vs Brazilian",
        "headers": [
          "English",
          "European (pt-PT)",
          "Brazilian (pt-BR)"
        ],
        "rows": [
          {
            "cells": [
              "I am speaking",
              "Estou a falar",
              "Estou falando"
            ]
          },
          {
            "cells": [
              "I am eating",
              "Estou a comer",
              "Estou comendo"
            ]
          },
          {
            "cells": [
              "I am opening",
              "Estou a abrir",
              "Estou abrindo"
            ]
          }
        ]
      },
      {
        "caption": "Gerund endings by group (written form)",
        "headers": [
          "Group",
          "Ending",
          "Example"
        ],
        "rows": [
          {
            "cells": [
              "-AR",
              "-ando",
              "falando"
            ]
          },
          {
            "cells": [
              "-ER",
              "-endo",
              "comendo"
            ]
          },
          {
            "cells": [
              "-IR",
              "-indo",
              "abrindo"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Estou a estudar português.",
        "native": "I am studying Portuguese.",
        "note": "The standard pt-PT progressive."
      },
      {
        "target": "Ela está a trabalhar agora.",
        "native": "She is working right now.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Forgetting the a: \"estou falar\" is not grammatical. It is estou a falar."
    ]
  },
  "verbs-subjunctive-que": {
    "title": "Subjunctive after que",
    "summary": "When one subject needs another subject to do something, the verb after que goes subjunctive — not infinitive.",
    "explanation": "English happily says \"I need the dog to open (it)\". Portuguese cannot use an infinitive there. Once there is a second subject introduced by que, that verb must be subjunctive.\n\nThe trigger to watch for: a verb of wanting, needing, hoping or doubting, followed by que, followed by a *different* subject.",
    "tables": [
      {
        "caption": "Present subjunctive endings",
        "headers": [
          "Pronoun",
          "-AR (falar)",
          "-ER (comer)",
          "-IR (abrir)"
        ],
        "rows": [
          {
            "cells": [
              "Eu",
              "fale",
              "coma",
              "abra"
            ]
          },
          {
            "cells": [
              "Tu",
              "fales",
              "comas",
              "abras"
            ]
          },
          {
            "cells": [
              "Ele",
              "fale",
              "coma",
              "abra"
            ]
          },
          {
            "cells": [
              "Nós",
              "falemos",
              "comamos",
              "abramos"
            ]
          },
          {
            "cells": [
              "Eles",
              "falem",
              "comam",
              "abram"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Eu preciso que o cão abra a porta.",
        "native": "I need the dog to open the door.",
        "note": "Literally \"that the dog opens\"."
      },
      {
        "target": "Espero que ele fale comigo.",
        "native": "I hope he speaks with me.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Using the infinitive after que: \"preciso que o cão abrir\" is wrong.",
      "Note the endings swap: -AR verbs take -e, while -ER/-IR verbs take -a."
    ]
  },
  "verbs-with-prepositions": {
    "title": "Verbs that need a preposition",
    "summary": "Some verbs carry a fixed preposition that English does not use. Learn the verb and its preposition as one unit.",
    "explanation": "Portuguese attaches prepositions to certain verbs where English uses none. Memorise them together — gostar is never used alone when an object follows.",
    "tables": [
      {
        "caption": "Verb + preposition",
        "headers": [
          "Portuguese",
          "English",
          "Example"
        ],
        "rows": [
          {
            "cells": [
              "gostar de",
              "to like",
              "Eu gosto de café"
            ]
          },
          {
            "cells": [
              "precisar de",
              "to need",
              "Eu preciso de ajuda"
            ]
          },
          {
            "cells": [
              "reparar em",
              "to notice",
              "Reparei no carro"
            ]
          },
          {
            "cells": [
              "notar",
              "to notice",
              "Notei uma diferença"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Eu gosto de aprender línguas.",
        "native": "I like learning languages.",
        "note": "de is obligatory."
      },
      {
        "target": "Ela precisa de mais tempo.",
        "native": "She needs more time.",
        "note": ""
      }
    ],
    "pitfalls": [
      "\"Eu gosto café\" — missing de. It must be gosto de café.",
      "notar takes no preposition, but reparar takes em. Same meaning, different pattern."
    ]
  },
  "pronouns-subject": {
    "title": "Subject pronouns",
    "summary": "Who is doing the action. Portugal uses tu for informal \"you\"; você is more distant, not more polite.",
    "explanation": "Portuguese often drops the subject pronoun because the verb ending already identifies the subject — falo can only be \"I speak\".\n\nA word of warning about você: in Portugal it is not the friendly form it is in Brazil. With friends and family use tu. In formal situations Portuguese speakers tend to avoid the pronoun entirely and use the person's title or name with the third person.",
    "tables": [
      {
        "caption": "Subject pronouns",
        "headers": [
          "Portuguese",
          "English",
          "Pronunciation hint"
        ],
        "rows": [
          {
            "cells": [
              "Eu",
              "I",
              "EH-oo"
            ]
          },
          {
            "cells": [
              "Tu",
              "you (singular, informal)",
              "too"
            ]
          },
          {
            "cells": [
              "Ele / Ela",
              "he / she",
              ""
            ]
          },
          {
            "cells": [
              "Nós",
              "we",
              "NOHSH"
            ]
          },
          {
            "cells": [
              "Eles / Elas",
              "they",
              ""
            ]
          },
          {
            "cells": [
              "Vocês",
              "you (plural)",
              ""
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Falo português todos os dias.",
        "native": "I speak Portuguese every day.",
        "note": "Pronoun dropped — the ending says \"eu\"."
      },
      {
        "target": "Tu falas muito bem.",
        "native": "You speak very well.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Using você with friends in Portugal — it can sound cold. Use tu."
    ]
  },
  "pronouns-clitic": {
    "title": "Object pronouns (clitics)",
    "summary": "Little pronouns that hook onto the verb, normally with a hyphen after it.",
    "explanation": "Object pronouns usually attach to the end of the verb with a hyphen: limpo-me, limpa-se.\n\nTwo spelling changes are worth memorising because they look alarming the first time:\n• After an infinitive, -o/-a become -lo/-la and the infinitive loses its -r: recomendar + o → recomendá-lo.\n• After a nasal ending (-m, -ão), -o/-a become -no/-na: recomendam + o → recomendam-no.\n\nTwo pronouns can also merge: recomendo-o a ele → recomendo-lho.",
    "tables": [
      {
        "caption": "The clitics",
        "headers": [
          "Clitic",
          "Meaning",
          "Example"
        ],
        "rows": [
          {
            "cells": [
              "-me",
              "me / myself",
              "Eu limpo-me"
            ]
          },
          {
            "cells": [
              "-te",
              "you / yourself",
              "Tu limpas-te"
            ]
          },
          {
            "cells": [
              "-se",
              "himself / herself / themselves",
              "Ele limpa-se"
            ]
          },
          {
            "cells": [
              "-o / -a",
              "it / him / her",
              "Eu limpo-o"
            ]
          },
          {
            "cells": [
              "-lhe",
              "to him / to her",
              "Eu limpo-lhe"
            ]
          },
          {
            "cells": [
              "-nos",
              "us / ourselves",
              "Nós limpamo-nos"
            ]
          },
          {
            "cells": [
              "-vos",
              "you (pl) / yourselves",
              "Eu recomendo-vos"
            ]
          },
          {
            "cells": [
              "-lhes",
              "to them",
              "Eu recomendo-lhes"
            ]
          },
          {
            "cells": [
              "-os / -as",
              "them",
              "Eu limpo-os"
            ]
          }
        ]
      },
      {
        "caption": "The two spelling changes",
        "headers": [
          "After",
          "Becomes",
          "Example"
        ],
        "rows": [
          {
            "cells": [
              "an infinitive",
              "-lo / -la",
              "Estou a recomendá-lo"
            ]
          },
          {
            "cells": [
              "-m or -ão",
              "-no / -na",
              "Recomendam-no"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Estou a recomendá-lo.",
        "native": "I am recommending it.",
        "note": "recomendar loses its -r and takes an accent."
      },
      {
        "target": "Recomendo-lho.",
        "native": "I recommend it to him.",
        "note": "Merge of -lhe + -o."
      },
      {
        "target": "A criança levanta-se.",
        "native": "The child gets up.",
        "note": "Reflexive -se."
      }
    ],
    "pitfalls": [
      "Keeping the -r before -lo: it is recomendá-lo, not \"recomendar-lo\".",
      "Forgetting -no/-na after a nasal: \"recomendam-o\" should be recomendam-no."
    ]
  },
  "pronouns-clitic-position": {
    "title": "Where the clitic goes",
    "summary": "Normally after the verb. But certain trigger words pull it in front — the most-missed rule in Portuguese.",
    "explanation": "The default is enclisis: the pronoun follows the verb, hyphenated (recomendo-o).\n\nSome words drag the pronoun before the verb instead (proclisis), and the hyphen disappears. The main triggers:\n• Negation — não, nunca, nada, ninguém\n• Subordinating que\n• quando, se\n• Most question words\n\nThe pattern to internalise: Eu recomendo-o, but Eu não o recomendo.",
    "tables": [
      {
        "caption": "Default vs after a trigger",
        "headers": [
          "Default (after)",
          "With trigger (before)",
          "Trigger"
        ],
        "rows": [
          {
            "cells": [
              "Eu recomendo-o",
              "Eu não o recomendo",
              "não"
            ]
          },
          {
            "cells": [
              "Eu recomendo-te",
              "Eu não te recomendo",
              "não"
            ]
          },
          {
            "cells": [
              "Eu encontro-o",
              "Quando eu o encontrar",
              "quando"
            ]
          },
          {
            "cells": [
              "Eu encontro-me",
              "Se eu me encontrar",
              "se"
            ]
          },
          {
            "cells": [
              "Ele limpa-se",
              "Espero que ele se limpe",
              "que"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Eu não o recomendo.",
        "native": "I do not recommend it.",
        "note": "não pulls the pronoun forward; no hyphen."
      },
      {
        "target": "Quando eu te encontrar, falamos.",
        "native": "When I find you, we will talk.",
        "note": "quando is a trigger."
      }
    ],
    "pitfalls": [
      "Keeping enclisis after a negative: \"Eu não recomendo-o\" is wrong. It is não o recomendo.",
      "Leaving the hyphen in when the pronoun moves in front — there is no hyphen in proclisis."
    ]
  },
  "pronouns-prepositional": {
    "title": "Pronouns after prepositions",
    "summary": "After a preposition you need mim / ti / si, not eu / tu. With com they fuse into single words.",
    "explanation": "Prepositions take a special set of pronouns: para mim, not \"para eu\".\n\ncom is irregular and merges with the pronoun outright — comigo, contigo, connosco. Note connosco with double n: the Brazilian spelling is conosco.",
    "tables": [
      {
        "caption": "After a preposition",
        "headers": [
          "Portuguese",
          "English",
          "Example"
        ],
        "rows": [
          {
            "cells": [
              "para mim",
              "for me",
              "Eu limpo para mim"
            ]
          },
          {
            "cells": [
              "para ti",
              "for you",
              "Tu limpas para ti"
            ]
          },
          {
            "cells": [
              "para si",
              "for himself / herself",
              "Ele limpa para si"
            ]
          },
          {
            "cells": [
              "de si",
              "of himself",
              "Ele não está seguro de si"
            ]
          }
        ]
      },
      {
        "caption": "com + pronoun",
        "headers": [
          "Portuguese",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "comigo",
              "with me"
            ]
          },
          {
            "cells": [
              "contigo",
              "with you"
            ]
          },
          {
            "cells": [
              "consigo",
              "with himself / herself"
            ]
          },
          {
            "cells": [
              "connosco",
              "with us"
            ]
          },
          {
            "cells": [
              "convosco",
              "with you (plural)"
            ]
          },
          {
            "cells": [
              "com ele / com ela",
              "with him / with her"
            ]
          },
          {
            "cells": [
              "com eles / com elas",
              "with them"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Queres vir comigo?",
        "native": "Do you want to come with me?",
        "note": "Never \"com mim\"."
      },
      {
        "target": "Ele não está seguro de si.",
        "native": "He is not sure of himself.",
        "note": ""
      }
    ],
    "pitfalls": [
      "\"com mim\" — the fused form comigo is obligatory.",
      "Writing conosco (Brazilian). European Portuguese is connosco."
    ]
  },
  "possessives": {
    "title": "Possessives",
    "summary": "Possessives normally take an article — o meu carro. Drop the article after the verb ser.",
    "explanation": "Portuguese possessives agree with the thing owned, not the owner: a minha casa is feminine because casa is, regardless of who owns it.\n\nThey normally come with an article: a minha casa, o meu carro. But when the possessive lands after ser, the article disappears: A casa é minha.\n\nBecause seu/sua is ambiguous (his, hers, yours, theirs), speakers often prefer dele/dela to be clear: o carro dele.",
    "tables": [
      {
        "caption": "Possessives",
        "headers": [
          "English",
          "Feminine",
          "Masculine"
        ],
        "rows": [
          {
            "cells": [
              "my",
              "a minha",
              "o meu"
            ]
          },
          {
            "cells": [
              "your (singular)",
              "a tua",
              "o teu"
            ]
          },
          {
            "cells": [
              "his / her",
              "a sua",
              "o seu"
            ]
          },
          {
            "cells": [
              "our",
              "a nossa",
              "o nosso"
            ]
          },
          {
            "cells": [
              "your (plural)",
              "a vossa",
              "o vosso"
            ]
          },
          {
            "cells": [
              "their",
              "a sua",
              "o seu"
            ]
          }
        ]
      },
      {
        "caption": "The article-drop rule",
        "headers": [
          "With article",
          "After ser"
        ],
        "rows": [
          {
            "cells": [
              "A minha casa.",
              "A casa é minha."
            ]
          },
          {
            "cells": [
              "O meu carro.",
              "O carro é meu."
            ]
          }
        ]
      },
      {
        "caption": "Avoiding the seu ambiguity",
        "headers": [
          "Portuguese",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "o carro dele",
              "his car"
            ]
          },
          {
            "cells": [
              "o carro dela",
              "her car"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "A minha casa é pequena.",
        "native": "My house is small.",
        "note": "Article + possessive."
      },
      {
        "target": "O carro é meu.",
        "native": "The car is mine.",
        "note": "No article after ser."
      }
    ],
    "pitfalls": [
      "Dropping the article normally: \"Minha casa é pequena\" is Brazilian. In pt-PT say A minha casa.",
      "Agreeing with the owner instead of the object."
    ]
  },
  "articles-contractions": {
    "title": "Articles and contractions",
    "summary": "Prepositions fuse with articles. These contractions are compulsory, not optional shortenings.",
    "explanation": "When a preposition meets an article, the two merge into one word. This is required — writing \"de o carro\" is simply wrong.\n\nThe one that catches people out is por + o → pelo, because the word changes shape rather than just contracting.",
    "tables": [
      {
        "caption": "Contractions",
        "headers": [
          "English",
          "Feminine",
          "Masculine",
          "Built from"
        ],
        "rows": [
          {
            "cells": [
              "the",
              "a",
              "o",
              "—"
            ]
          },
          {
            "cells": [
              "a / an",
              "uma",
              "um",
              "—"
            ]
          },
          {
            "cells": [
              "to the",
              "à",
              "ao",
              "a + a/o"
            ]
          },
          {
            "cells": [
              "at / in / on the",
              "na",
              "no",
              "em + a/o"
            ]
          },
          {
            "cells": [
              "at / in / on a",
              "numa",
              "num",
              "em + uma/um"
            ]
          },
          {
            "cells": [
              "from / of the",
              "da",
              "do",
              "de + a/o"
            ]
          },
          {
            "cells": [
              "from / of a",
              "duma",
              "dum",
              "de + uma/um"
            ]
          },
          {
            "cells": [
              "by / through the",
              "pela",
              "pelo",
              "por + a/o"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Vou ao supermercado.",
        "native": "I am going to the supermarket.",
        "note": "a + o = ao."
      },
      {
        "target": "Está na mesa.",
        "native": "It is on the table.",
        "note": "em + a = na."
      },
      {
        "target": "Passámos pelo parque.",
        "native": "We went through the park.",
        "note": "por + o = pelo."
      }
    ],
    "pitfalls": [
      "Leaving them uncontracted: \"de o\", \"em a\" and \"a o\" are all errors."
    ]
  },
  "demonstratives": {
    "title": "This and that",
    "summary": "Three distances, not two — and each has a generic form (isto) and a specific form (este).",
    "explanation": "Portuguese splits \"that\" by distance from the speaker *and* the listener:\n• este — near me\n• esse — near you\n• aquele — away from both\n\nEach also has a neutral, invariable form used when you are not naming the thing: isto, isso, aquilo. Use those for an unidentified object or an abstract idea.\n\naquilo/aquele also cover things that are out of reach in a broader sense, not only physically distant.",
    "tables": [
      {
        "caption": "Generic vs specific",
        "headers": [
          "Distance",
          "Generic",
          "Specific (m./f.)",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "near me",
              "isto",
              "este / esta",
              "this"
            ]
          },
          {
            "cells": [
              "near you",
              "isso",
              "esse / essa",
              "that"
            ]
          },
          {
            "cells": [
              "far from both",
              "aquilo",
              "aquele / aquela",
              "that over there"
            ]
          }
        ]
      },
      {
        "caption": "In use",
        "headers": [
          "Portuguese",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "este carro",
              "this car"
            ]
          },
          {
            "cells": [
              "essa casa",
              "that house (near you)"
            ]
          },
          {
            "cells": [
              "aquela nuvem",
              "that cloud (over there)"
            ]
          },
          {
            "cells": [
              "Que é isto?",
              "What is this?"
            ]
          },
          {
            "cells": [
              "Que é aquilo?",
              "What is that over there?"
            ]
          },
          {
            "cells": [
              "De quem é aquele carro?",
              "Whose car is that over there?"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Que é este papel?",
        "native": "What is this paper?",
        "note": "papel is masculine."
      },
      {
        "target": "De quem é aquele carro?",
        "native": "Whose is that car over there?",
        "note": "de quem = whose."
      }
    ],
    "pitfalls": [
      "Using este for something near the listener — that is esse.",
      "Using isto with a named noun: say este papel, not \"isto papel\"."
    ]
  },
  "place-adverbs": {
    "title": "Here and there",
    "summary": "Five words where English has two. The distinction is distance and precision.",
    "explanation": "Portuguese is far more precise about location than English:\n• aqui — here, this exact spot\n• cá — around here, a broader area\n• aí — there, near the person you are talking to\n• lá — there, far away\n• ali — there, further off but visible or pointable\n\naí is the one English speakers forget: on the phone, where the other person is standing is aí, not lá.",
    "tables": [
      {
        "caption": "The five",
        "headers": [
          "Portuguese",
          "English",
          "When"
        ],
        "rows": [
          {
            "cells": [
              "aqui",
              "here",
              "this exact spot"
            ]
          },
          {
            "cells": [
              "cá",
              "around here",
              "a wider area"
            ]
          },
          {
            "cells": [
              "aí",
              "there",
              "near the listener"
            ]
          },
          {
            "cells": [
              "lá",
              "over there",
              "far from both"
            ]
          },
          {
            "cells": [
              "ali",
              "over there",
              "further off but visible"
            ]
          }
        ]
      },
      {
        "caption": "lado — \"side\"",
        "headers": [
          "Portuguese",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "qualquer lado",
              "anywhere"
            ]
          },
          {
            "cells": [
              "algum lado",
              "somewhere"
            ]
          },
          {
            "cells": [
              "todo o lado",
              "everywhere"
            ]
          },
          {
            "cells": [
              "de lado",
              "sideways"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Está frio aí?",
        "native": "Is it cold there (where you are)?",
        "note": "aí = the listener’s location."
      },
      {
        "target": "Vem cá!",
        "native": "Come here!",
        "note": "cá for general direction."
      },
      {
        "target": "Não o encontro em lado nenhum.",
        "native": "I cannot find it anywhere.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Using lá for where the listener is — that is aí."
    ]
  },
  "quantifiers-todo": {
    "title": "todo o vs todos os",
    "summary": "Singular means the whole of one thing; plural means every one of many. The article is compulsory.",
    "explanation": "This pair changes meaning entirely with number:\n• todo o + singular = the whole of that one thing\n• todos os + plural = every one of them\n\ntodo o dia is \"all day long\"; todos os dias is \"every day\".",
    "tables": [
      {
        "caption": "Singular vs plural",
        "headers": [
          "Portuguese",
          "English",
          "Sense"
        ],
        "rows": [
          {
            "cells": [
              "todo o dia",
              "all day",
              "one whole day"
            ]
          },
          {
            "cells": [
              "todos os dias",
              "every day",
              "each day"
            ]
          },
          {
            "cells": [
              "todo o tempo",
              "all the time",
              "the whole duration"
            ]
          },
          {
            "cells": [
              "todas as vezes",
              "every time",
              "each occasion"
            ]
          },
          {
            "cells": [
              "todo o lado",
              "everywhere",
              "the whole area"
            ]
          },
          {
            "cells": [
              "todos os lados",
              "every side",
              "each side"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Estudo português todos os dias.",
        "native": "I study Portuguese every day.",
        "note": ""
      },
      {
        "target": "Chovu todo o dia.",
        "native": "It rained all day.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Dropping the article: \"todos dias\" is wrong — it is todos os dias."
    ]
  },
  "quantifiers-indefinites": {
    "title": "Some, any, none — and the double negative",
    "summary": "Portuguese keeps não in place even with a negative word. Two negatives are correct here.",
    "explanation": "English drops the negative when another negative word appears (\"I do not need anything\"). Portuguese keeps both: Eu não preciso de nada — literally \"I do not need nothing\".\n\nThis is not sloppy speech, it is the rule.",
    "tables": [
      {
        "caption": "The coisa family",
        "headers": [
          "English",
          "Portuguese",
          "Literally"
        ],
        "rows": [
          {
            "cells": [
              "thing",
              "coisa",
              "—"
            ]
          },
          {
            "cells": [
              "anything",
              "qualquer coisa",
              "whatever thing"
            ]
          },
          {
            "cells": [
              "something",
              "alguma coisa",
              "some thing"
            ]
          },
          {
            "cells": [
              "nothing",
              "nada",
              "—"
            ]
          }
        ]
      },
      {
        "caption": "some / any / no",
        "headers": [
          "English",
          "Feminine",
          "Masculine"
        ],
        "rows": [
          {
            "cells": [
              "some",
              "alguma casa",
              "algum carro"
            ]
          },
          {
            "cells": [
              "any",
              "qualquer casa",
              "qualquer carro"
            ]
          },
          {
            "cells": [
              "no",
              "nenhuma casa",
              "nenhum carro"
            ]
          }
        ]
      },
      {
        "caption": "much, many, very",
        "headers": [
          "English",
          "Portuguese",
          "Note"
        ],
        "rows": [
          {
            "cells": [
              "very",
              "muito",
              "invariable before an adjective"
            ]
          },
          {
            "cells": [
              "much",
              "muito / muita",
              "agrees"
            ]
          },
          {
            "cells": [
              "many",
              "muitos / muitas",
              "agrees"
            ]
          },
          {
            "cells": [
              "so (quantity)",
              "tanto",
              "with nouns"
            ]
          },
          {
            "cells": [
              "so (adjective)",
              "tão",
              "with adjectives"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Eu não preciso de nada.",
        "native": "I do not need anything.",
        "note": "Double negative is correct."
      },
      {
        "target": "Não, obrigado.",
        "native": "No, thank you.",
        "note": "obrigada if you are female."
      },
      {
        "target": "Ela é tão simpática!",
        "native": "She is so nice!",
        "note": "tão before an adjective."
      }
    ],
    "pitfalls": [
      "Dropping não: \"Eu preciso de nada\" does not mean \"I need nothing\".",
      "Using tanto before an adjective — that needs tão."
    ]
  },
  "questions-words": {
    "title": "Question words",
    "summary": "Including the que vs o que rule: if a verb follows, you need o que.",
    "explanation": "The question words themselves are straightforward. The rule people miss is when to use que and when o que:\n• A verb after it → o que\n• A noun after it → que\n\nSo: O que tem de conteúdo? but Que conteúdo tem?",
    "tables": [
      {
        "caption": "Question words",
        "headers": [
          "English",
          "Portuguese"
        ],
        "rows": [
          {
            "cells": [
              "what",
              "quê?"
            ]
          },
          {
            "cells": [
              "why",
              "porquê?"
            ]
          },
          {
            "cells": [
              "where",
              "onde?"
            ]
          },
          {
            "cells": [
              "when",
              "quando?"
            ]
          },
          {
            "cells": [
              "which",
              "qual?"
            ]
          },
          {
            "cells": [
              "who",
              "quem?"
            ]
          },
          {
            "cells": [
              "how",
              "como?"
            ]
          },
          {
            "cells": [
              "whose",
              "de quem?"
            ]
          }
        ]
      },
      {
        "caption": "how much / how many",
        "headers": [
          "Portuguese",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "quanto tempo?",
              "how much time?"
            ]
          },
          {
            "cells": [
              "quanta chuva?",
              "how much rain?"
            ]
          },
          {
            "cells": [
              "quantos dias?",
              "how many days?"
            ]
          },
          {
            "cells": [
              "quantas casas?",
              "how many houses?"
            ]
          },
          {
            "cells": [
              "quão grande?",
              "how big?"
            ]
          },
          {
            "cells": [
              "quão pequeno?",
              "how small?"
            ]
          }
        ]
      },
      {
        "caption": "que vs o que",
        "headers": [
          "Sentence",
          "Why"
        ],
        "rows": [
          {
            "cells": [
              "O que tem de conteúdo?",
              "verb (tem) follows → o que"
            ]
          },
          {
            "cells": [
              "Que conteúdo tem?",
              "noun (conteúdo) follows → que"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "O que é que fazes?",
        "native": "What do you do?",
        "note": "The é que padding is very common in speech."
      },
      {
        "target": "Quantos dias faltam?",
        "native": "How many days are left?",
        "note": "quantos agrees with dias."
      }
    ],
    "pitfalls": [
      "Using que before a verb where o que is required.",
      "Forgetting quanto agrees in gender and number."
    ]
  },
  "prepositions-por-para": {
    "title": "por vs para",
    "summary": "por is the route or the means; para is the destination or the goal.",
    "explanation": "Roughly: para points at where you are heading or what you are aiming for. por covers how you got there, what you passed through, and duration.\n\nRemember that por contracts with articles: por + o = pelo, por + a = pela.",
    "tables": [
      {
        "caption": "Which one",
        "headers": [
          "Preposition",
          "Use",
          "Example"
        ],
        "rows": [
          {
            "cells": [
              "para",
              "destination, goal",
              "Vou para Lisboa"
            ]
          },
          {
            "cells": [
              "para",
              "intended recipient",
              "Isto é para ti"
            ]
          },
          {
            "cells": [
              "por",
              "route, passing through",
              "Passei pelo parque"
            ]
          },
          {
            "cells": [
              "por",
              "duration",
              "Fiquei por duas horas"
            ]
          },
          {
            "cells": [
              "por",
              "means to an end",
              "Obrigado por tudo"
            ]
          },
          {
            "cells": [
              "a",
              "temporary destination",
              "Vou a Lisboa (and back)"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Vou para o Porto.",
        "native": "I am going to Porto.",
        "note": "Suggests staying."
      },
      {
        "target": "Vou ao Porto.",
        "native": "I am going to Porto.",
        "note": "Suggests a short trip."
      },
      {
        "target": "Passámos pela ponte.",
        "native": "We went across the bridge.",
        "note": "por + a = pela."
      }
    ],
    "pitfalls": [
      "Using para for a route — passing through is por."
    ]
  },
  "ser-estar": {
    "title": "ser vs estar",
    "summary": "ser is what something *is*; estar is what it *is right now*. Same adjective, different meaning.",
    "explanation": "Both translate \"to be\". ser marks permanent identity and defining characteristics. estar marks current state, temporary condition and location of movable things.\n\nThe pair that makes the difference vivid: Eu sou frio means \"I am a cold person\". Eu estou frio means \"I am cold right now\".\n\nFor places: a building is ser (A casa é em Lisboa) because it cannot move; a person is estar (Eu estou em Lisboa).",
    "tables": [
      {
        "caption": "Same adjective, different meaning",
        "headers": [
          "Portuguese",
          "English",
          "Sense"
        ],
        "rows": [
          {
            "cells": [
              "Eu sou frio",
              "I am a cold person",
              "character"
            ]
          },
          {
            "cells": [
              "Eu estou frio",
              "I am cold right now",
              "state"
            ]
          },
          {
            "cells": [
              "O meu cabelo é negro",
              "My hair is black",
              "natural colour"
            ]
          },
          {
            "cells": [
              "O meu cabelo está negro",
              "My hair is black (now)",
              "dyed, temporary"
            ]
          },
          {
            "cells": [
              "A casa é em Lisboa",
              "The house is in Lisbon",
              "fixed location"
            ]
          },
          {
            "cells": [
              "Eu estou em Lisboa",
              "I am in Lisbon",
              "current location"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Ela é professora.",
        "native": "She is a teacher.",
        "note": "Profession — ser."
      },
      {
        "target": "Ela está cansada.",
        "native": "She is tired.",
        "note": "Temporary state — estar."
      }
    ],
    "pitfalls": [
      "Using ser for feelings: \"sou cansado\" says you are a tiring person.",
      "Using estar for professions or nationality."
    ]
  },
  "comparatives": {
    "title": "Comparatives",
    "summary": "No -er ending. Portuguese puts mais in front of the adjective.",
    "explanation": "English changes the word (late → later). Portuguese adds mais before the unchanged adjective. There is nothing to memorise beyond the pattern — and a handful of irregulars like melhor and pior.",
    "tables": [
      {
        "caption": "mais + adjective",
        "headers": [
          "Base",
          "Comparative",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "tarde",
              "mais tarde",
              "later"
            ]
          },
          {
            "cells": [
              "fácil",
              "mais fácil",
              "easier"
            ]
          },
          {
            "cells": [
              "pequeno",
              "mais pequeno",
              "smaller"
            ]
          },
          {
            "cells": [
              "bom",
              "melhor",
              "better (irregular)"
            ]
          },
          {
            "cells": [
              "mau",
              "pior",
              "worse (irregular)"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Chego mais tarde hoje.",
        "native": "I am arriving later today.",
        "note": ""
      },
      {
        "target": "Este exercício é mais fácil.",
        "native": "This exercise is easier.",
        "note": ""
      }
    ],
    "pitfalls": [
      "Saying \"mais bom\" — the irregular melhor is required."
    ]
  },
  "word-formation-suffixes": {
    "title": "Word-building patterns",
    "summary": "Predictable endings that convert English words into Portuguese — and tell you the gender for free.",
    "explanation": "A large share of Portuguese vocabulary can be derived from English by swapping the ending. Two of these endings also fix the gender: anything in -ção or -agem is feminine.\n\nA useful oddity: words of Greek origin ending in -a are usually masculine — o dia, o problema.",
    "tables": [
      {
        "caption": "Ending swaps",
        "headers": [
          "English",
          "Portuguese",
          "Example",
          "Gender"
        ],
        "rows": [
          {
            "cells": [
              "-ly",
              "-mente",
              "rapidly → rapidamente",
              "—"
            ]
          },
          {
            "cells": [
              "-tion",
              "-ção",
              "translation → tradução",
              "feminine"
            ]
          },
          {
            "cells": [
              "-ion",
              "-ão",
              "television → televisão",
              "feminine"
            ]
          },
          {
            "cells": [
              "-ity",
              "-dade",
              "city → cidade",
              "feminine"
            ]
          },
          {
            "cells": [
              "-age",
              "-agem",
              "garage → garagem",
              "feminine"
            ]
          }
        ]
      },
      {
        "caption": "Other patterns",
        "headers": [
          "Pattern",
          "Meaning",
          "Example"
        ],
        "rows": [
          {
            "cells": [
              "-inho / -inha",
              "diminutive",
              "casa → casinha"
            ]
          },
          {
            "cells": [
              "-ito / -ita",
              "diminutive",
              "pouco → pouquito"
            ]
          },
          {
            "cells": [
              "des-",
              "negation prefix",
              "conhecido → desconhecido"
            ]
          },
          {
            "cells": [
              "in-",
              "negation prefix",
              "possível → impossível"
            ]
          },
          {
            "cells": [
              "-ado / -ido",
              "past participle as adjective",
              "grelhar → grelhado"
            ]
          },
          {
            "cells": [
              "-L → -is",
              "plural of -l nouns",
              "papel → papéis"
            ]
          }
        ]
      },
      {
        "caption": "Greek-origin masculines",
        "headers": [
          "Portuguese",
          "English",
          "Note"
        ],
        "rows": [
          {
            "cells": [
              "o dia",
              "the day",
              "masculine despite -a"
            ]
          },
          {
            "cells": [
              "o problema",
              "the problem",
              "masculine despite -a"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "A tradução está correta.",
        "native": "The translation is correct.",
        "note": "-ção → feminine."
      },
      {
        "target": "Comprámos uma casinha.",
        "native": "We bought a little house.",
        "note": "Diminutive."
      }
    ],
    "pitfalls": [
      "Treating dia and problema as feminine because they end in -a."
    ]
  },
  "numbers-cem-cento": {
    "title": "cem vs cento",
    "summary": "cem for exactly 100. cento when something follows.",
    "explanation": "Exactly one hundred is cem. As soon as a smaller number follows, it becomes cento: cento e um.\n\nPercentages keep cem: cem porcento, never \"cento por cento\".",
    "tables": [
      {
        "caption": "cem or cento",
        "headers": [
          "Number",
          "Portuguese"
        ],
        "rows": [
          {
            "cells": [
              "100",
              "cem"
            ]
          },
          {
            "cells": [
              "101",
              "cento e um"
            ]
          },
          {
            "cells": [
              "1100",
              "mil e cem"
            ]
          },
          {
            "cells": [
              "1101",
              "mil cento e um"
            ]
          },
          {
            "cells": [
              "100%",
              "cem porcento"
            ]
          },
          {
            "cells": [
              "40%",
              "quarenta porcento"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Custou cem euros.",
        "native": "It cost one hundred euros.",
        "note": "Exactly 100 → cem."
      },
      {
        "target": "Tenho cento e vinte páginas.",
        "native": "I have one hundred and twenty pages.",
        "note": "Something follows → cento."
      }
    ],
    "pitfalls": [
      "Saying \"cento por cento\" for 100% — it is cem porcento."
    ]
  },
  "time-telling": {
    "title": "Telling the time",
    "summary": "São for most hours, é for one o'clock. Past the half hour, count down with faltam.",
    "explanation": "Ask with Que horas são? Answer with São + the hour — except one o'clock, midday and midnight, which take é.\n\nUp to the half hour you add minutes with e. After it, Portuguese counts down to the next hour with faltam (\"there are missing\").\n\nSpecify the part of day with da manhã, da tarde or da noite.",
    "tables": [
      {
        "caption": "Ways to say 9:30",
        "headers": [
          "Portuguese",
          "Register"
        ],
        "rows": [
          {
            "cells": [
              "São nove e meia",
              "most common"
            ]
          },
          {
            "cells": [
              "São nove horas e meia",
              "fuller"
            ]
          },
          {
            "cells": [
              "São nove e trinta",
              "precise"
            ]
          },
          {
            "cells": [
              "São nove horas e trinta minutos",
              "formal"
            ]
          }
        ]
      },
      {
        "caption": "Counting up and down",
        "headers": [
          "Portuguese",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "São dez e um quarto",
              "a quarter past ten"
            ]
          },
          {
            "cells": [
              "Faltam vinte para as dez",
              "twenty to ten"
            ]
          },
          {
            "cells": [
              "Falta um quarto para as dez",
              "a quarter to ten"
            ]
          },
          {
            "cells": [
              "É uma hora",
              "it is one o'clock"
            ]
          },
          {
            "cells": [
              "É meio dia",
              "it is midday"
            ]
          },
          {
            "cells": [
              "É meia noite",
              "it is midnight"
            ]
          }
        ]
      },
      {
        "caption": "Part of the day",
        "headers": [
          "Portuguese",
          "English"
        ],
        "rows": [
          {
            "cells": [
              "da manhã",
              "in the morning"
            ]
          },
          {
            "cells": [
              "da tarde",
              "in the afternoon / evening"
            ]
          },
          {
            "cells": [
              "da noite",
              "at night"
            ]
          }
        ]
      }
    ],
    "examples": [
      {
        "target": "Que horas são?",
        "native": "What time is it?",
        "note": ""
      },
      {
        "target": "São nove e meia da manhã.",
        "native": "It is half past nine in the morning.",
        "note": ""
      },
      {
        "target": "Faltam vinte para as dez.",
        "native": "It is twenty to ten.",
        "note": "Counting down."
      }
    ],
    "pitfalls": [
      "Using são for one o'clock — it is é uma hora.",
      "Saying \"nove e quarenta\" instead of counting down with faltam."
    ]
  }
};

// ---------------------------------------------------------------------------
// Tips — pt-PT specific material that isn''t a grammar structure
// ---------------------------------------------------------------------------

export const GRAMMAR_TIPS = [
  {
    "slug": "vowel-sounds",
    "category": "pronunciation",
    "title": "The five vowel names",
    "body": "Portuguese vowels are pronounced close to their Latin values, not their English ones. Start here before anything else: a = \"AH\", e = \"EH\", i = \"EE\", o = \"OH\", u = \"OO\".",
    "examples": [
      {
        "target": "a, e, i, o, u",
        "native": "AH, EH, EE, OH, OO",
        "note": "The alphabet names."
      }
    ]
  },
  {
    "slug": "s-sounds",
    "category": "pronunciation",
    "title": "When s sounds like \"sh\"",
    "body": "The letter s changes depending on position. At the end of a word or before a consonant it becomes \"sh\" — this is the single most recognisable feature of the European accent. Between two vowels it becomes \"z\". Doubled ss, or ç, stay as a hard \"s\".",
    "examples": [
      {
        "target": "os livros",
        "native": "the books",
        "note": "Both s sound like \"sh\"."
      },
      {
        "target": "casa",
        "native": "house",
        "note": "Between vowels → \"KAH-za\"."
      },
      {
        "target": "passar",
        "native": "to pass",
        "note": "Double ss → hard \"s\"."
      }
    ]
  },
  {
    "slug": "nasal-endings",
    "category": "pronunciation",
    "title": "Nasal endings: -am, -em, -im, -om, -um",
    "body": "A vowel followed by m at the end of a word is nasal — the m is not really pronounced as a consonant, it just routes the vowel through the nose.",
    "examples": [
      {
        "target": "falam",
        "native": "they speak",
        "note": "sounds like \"FAH-laun\""
      },
      {
        "target": "comem",
        "native": "they eat",
        "note": "sounds like \"KOH-mein\""
      },
      {
        "target": "jardim",
        "native": "garden",
        "note": "sounds like \"zhar-DIN\""
      },
      {
        "target": "bom",
        "native": "good",
        "note": "sounds like \"bon\""
      },
      {
        "target": "um",
        "native": "one / a",
        "note": "sounds like \"un\""
      }
    ]
  },
  {
    "slug": "silent-e-es-ex",
    "category": "pronunciation",
    "title": "The silent e in es- and ex-",
    "body": "When a word starts with es- or ex-, the e is swallowed almost entirely — estar comes out closer to \"shtar\". This is a hallmark of the European accent. The exception is the demonstratives este, esta and isto, where the e survives.",
    "examples": [
      {
        "target": "estar",
        "native": "to be",
        "note": "sounds like \"shtar\""
      },
      {
        "target": "escola",
        "native": "school",
        "note": "sounds like \"shKOH-la\""
      },
      {
        "target": "esclarecer",
        "native": "to clarify",
        "note": "sounds like \"shkla-re-SER\""
      },
      {
        "target": "este",
        "native": "this",
        "note": "Exception — the e is pronounced."
      }
    ]
  },
  {
    "slug": "gu-qu-silent-u",
    "category": "pronunciation",
    "title": "When the u in gu and qu is silent",
    "body": "Before e or i, the u in gu and qu is silent and just hardens the consonant. Before a or o it is pronounced as a full \"w\" sound.",
    "examples": [
      {
        "target": "guerra",
        "native": "war",
        "note": "silent u → \"GEH-rra\""
      },
      {
        "target": "quilo",
        "native": "kilo",
        "note": "silent u → \"KEE-lo\""
      },
      {
        "target": "quatro",
        "native": "four",
        "note": "pronounced u → \"KWA-tro\""
      },
      {
        "target": "guardar",
        "native": "to keep",
        "note": "pronounced u → \"gwar-DAR\""
      }
    ]
  },
  {
    "slug": "c-and-g-before-e-i",
    "category": "pronunciation",
    "title": "c and g soften before e and i",
    "body": "c sounds like \"s\" before e or i, and like \"k\" before a, o or u. The cedilla ç exists precisely to give you an \"s\" sound before a, o or u. g follows the same logic: \"zh\" before e or i, hard \"g\" otherwise.",
    "examples": [
      {
        "target": "cedo",
        "native": "early",
        "note": "ce → \"s\""
      },
      {
        "target": "casa",
        "native": "house",
        "note": "ca → \"k\""
      },
      {
        "target": "coração",
        "native": "heart",
        "note": "ç → \"s\" before a"
      },
      {
        "target": "gelo",
        "native": "ice",
        "note": "ge → \"zh\""
      },
      {
        "target": "gato",
        "native": "cat",
        "note": "ga → hard \"g\""
      }
    ]
  },
  {
    "slug": "nh-lh",
    "category": "pronunciation",
    "title": "nh and lh",
    "body": "These two digraphs have no English equivalent. nh is the \"ny\" of canyon. lh is the \"lli\" of million.",
    "examples": [
      {
        "target": "vinho",
        "native": "wine",
        "note": "sounds like \"VEE-nyo\""
      },
      {
        "target": "trabalho",
        "native": "work",
        "note": "sounds like \"tra-BA-lyo\""
      }
    ]
  },
  {
    "slug": "cesta-sesta-sexta",
    "category": "pronunciation",
    "title": "cesta, sesta, sexta — three near-identical words",
    "body": "A minimal trio worth drilling out loud. The differences are small but they are three completely different words.",
    "examples": [
      {
        "target": "cesta",
        "native": "basket",
        "note": "\"SESH-ta\""
      },
      {
        "target": "sesta",
        "native": "nap",
        "note": "\"SEHSH-ta\""
      },
      {
        "target": "sexta",
        "native": "Friday / sixth",
        "note": "\"SAYSH-ta\""
      }
    ]
  },
  {
    "slug": "trabalhar-syllables",
    "category": "pronunciation",
    "title": "Breaking down trabalhar",
    "body": "A useful word to practise slowly because it packs in the rolled r, the lh digraph and a final stressed syllable all at once.",
    "examples": [
      {
        "target": "trabalhar",
        "native": "to work",
        "note": "teh-raa-baa-LYAR"
      }
    ]
  },
  {
    "slug": "tongue-twister-rato",
    "category": "tongue-twister",
    "title": "The classic R tongue twister",
    "body": "The standard Portuguese drill for the rolled r. Start slowly — the point is accuracy, not speed. A longer version exists once the short one is comfortable.",
    "examples": [
      {
        "target": "O rato roeu a rolha da garrafa do rei da Rússia.",
        "native": "The mouse gnawed the cork of the bottle of the king of Russia.",
        "note": "Short version."
      },
      {
        "target": "O raio do rato roeu raivoso e rápido a rolha redonda da garrafa de rum de Roberto, o ruidoso rei da Rússia.",
        "native": "The damned mouse angrily and quickly gnawed the round cork of the rum bottle of Roberto, the noisy king of Russia.",
        "note": "Long version."
      }
    ]
  },
  {
    "slug": "ir-ter-com-alguem",
    "category": "expression",
    "title": "ir ter com alguém",
    "body": "Literally \"to go have with someone\", but it means to go and meet up with them. Extremely common and impossible to guess from the words.",
    "examples": [
      {
        "target": "Fui ter com eles um pouco.",
        "native": "I went to hang out with them for a bit.",
        "note": ""
      }
    ]
  },
  {
    "slug": "hora-e-tal",
    "category": "expression",
    "title": "hora e tal",
    "body": "The vague \"about an hour\". The e tal construction can attach to other quantities too, and roughly means \"and change\".",
    "examples": [
      {
        "target": "Demorou uma hora e tal.",
        "native": "It took about an hour.",
        "note": ""
      }
    ]
  },
  {
    "slug": "que-lata",
    "category": "expression",
    "title": "Que lata!",
    "body": "Literally \"what tin can!\" — it means \"what nerve!\" or \"the cheek of it!\". Said about someone being brazen.",
    "examples": [
      {
        "target": "Ele pediu mais dinheiro? Que lata!",
        "native": "He asked for more money? What nerve!",
        "note": ""
      }
    ]
  },
  {
    "slug": "everyday-expressions",
    "category": "expression",
    "title": "Everyday connectors worth memorising",
    "body": "A handful of short phrases that make speech sound natural rather than translated.",
    "examples": [
      {
        "target": "a caminho",
        "native": "on the way",
        "note": ""
      },
      {
        "target": "mesmo assim",
        "native": "even so",
        "note": ""
      },
      {
        "target": "correr bem",
        "native": "to go well",
        "note": ""
      },
      {
        "target": "assim que...",
        "native": "as soon as...",
        "note": ""
      },
      {
        "target": "que o costume",
        "native": "than usual",
        "note": "also que o habitual"
      },
      {
        "target": "partir do princípio",
        "native": "to assume",
        "note": ""
      },
      {
        "target": "ter a ver com",
        "native": "to have to do with",
        "note": ""
      },
      {
        "target": "vai e vem",
        "native": "comes and goes",
        "note": "Literally \"goes and comes\" — reversed."
      }
    ]
  },
  {
    "slug": "greetings",
    "category": "expression",
    "title": "Greetings by time of day",
    "body": "Note that boa noite covers both \"good evening\" on arrival and \"good night\" on leaving — Portuguese does not split them.",
    "examples": [
      {
        "target": "Bom dia",
        "native": "Good morning",
        "note": ""
      },
      {
        "target": "Boa tarde",
        "native": "Good afternoon",
        "note": ""
      },
      {
        "target": "Boa noite",
        "native": "Good evening / Good night",
        "note": ""
      }
    ]
  },
  {
    "slug": "proverb-quem-corre-por-gosto",
    "category": "proverb",
    "title": "Quem corre por gosto não se cansa",
    "body": "Literally \"whoever runs for pleasure does not get tired\". Said about work someone does willingly — the effort does not count when you enjoy it.",
    "examples": [
      {
        "target": "Quem corre por gosto não se cansa.",
        "native": "When you enjoy it, it is not tiring.",
        "note": ""
      }
    ]
  },
  {
    "slug": "proverb-olhar-com-olhos-de-ver",
    "category": "proverb",
    "title": "Olhar com olhos de ver",
    "body": "Literally \"to look with eyes of seeing\" — to really pay attention, as opposed to looking without noticing.",
    "examples": [
      {
        "target": "Olha com olhos de ver.",
        "native": "Look properly.",
        "note": ""
      }
    ]
  },
  {
    "slug": "the-five-senses",
    "category": "vocabulary",
    "title": "The five senses",
    "body": "Portuguese names the sense itself rather than the act of perceiving, which is why these do not map neatly onto English verbs.",
    "examples": [
      {
        "target": "a vista",
        "native": "sight",
        "note": ""
      },
      {
        "target": "o sabor",
        "native": "taste",
        "note": ""
      },
      {
        "target": "o tacto",
        "native": "touch",
        "note": ""
      },
      {
        "target": "a audição",
        "native": "hearing",
        "note": ""
      },
      {
        "target": "o cheiro",
        "native": "smell",
        "note": ""
      }
    ]
  },
  {
    "slug": "noun-de-noun",
    "category": "vocabulary",
    "title": "The \"weekend rule\": noun + de + noun",
    "body": "Where English stacks nouns together, Portuguese joins them with de and reverses the order. Once you spot the pattern you can build compounds yourself.",
    "examples": [
      {
        "target": "fim de semana",
        "native": "weekend",
        "note": "Literally \"end of week\"."
      },
      {
        "target": "acidente de bicicleta",
        "native": "bike accident",
        "note": "Literally \"accident of bicycle\"."
      },
      {
        "target": "noite de trivia",
        "native": "trivia night",
        "note": "Literally \"night of trivia\"."
      }
    ]
  },
  {
    "slug": "ago-ha-atras",
    "category": "vocabulary",
    "title": "Saying \"ago\"",
    "body": "Portuguese wraps the time expression: há ... atrás. In careful writing one of the two is usually dropped, since together they are redundant — but both are heard constantly in speech.",
    "examples": [
      {
        "target": "há dois dias",
        "native": "two days ago",
        "note": ""
      },
      {
        "target": "há muito tempo atrás",
        "native": "a long time ago",
        "note": "Common in speech."
      }
    ]
  },
  {
    "slug": "mnemonic-cedilla",
    "category": "mnemonic",
    "title": "What did the ç ask the c?",
    "body": "\"Pass me the toilet paper.\" A silly way to remember that the cedilla is just a c with something hanging underneath — and that it turns the hard \"k\" into a soft \"s\".",
    "examples": [
      {
        "target": "coração",
        "native": "heart",
        "note": "ç keeps the \"s\" sound before a."
      }
    ]
  },
  {
    "slug": "mnemonic-quarter-past",
    "category": "mnemonic",
    "title": "The mother-and-daughter time joke",
    "body": "A memory aid for um quarto (\"a quarter\") built on a pun with quarto, which also means \"room\". A mother and daughter living under a bridge: what time is it? Falta um quarto — \"a quarter is missing\", i.e. they lack a room. Living in a hotel: e um quarto — they have a room. Silly, but it fixes the two directions of quarter past and quarter to.",
    "examples": [
      {
        "target": "Falta um quarto para as duas.",
        "native": "It is a quarter to two.",
        "note": "\"A quarter is missing.\""
      },
      {
        "target": "São duas e um quarto.",
        "native": "It is a quarter past two.",
        "note": "\"Two and a quarter.\""
      }
    ]
  }
];

export default { GRAMMAR_TOPICS, GRAMMAR_TOPIC_CONTENT, GRAMMAR_TIPS };
