/**
 * @fileoverview JSDoc typedef declarations for all challenge services.
 *
 * This file contains NO runtime code — it exists purely to provide type
 * definitions for IDE autocompletion and inline documentation across
 * all challenge service files.
 *
 * Import individual typedefs in consuming files like:
 *   @type {import('./types').WordResult}
 */

// ---------------------------------------------------------------------------
// AI Service Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GeminiParams
 * @property {'gemini'} provider
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [maxOutputTokens]
 * @property {number} [topP]
 * @property {number} [topK]
 * @property {boolean} [jsonMode]
 * @property {Record<string, unknown>} [responseSchema]
 * @property {string} [systemInstruction]
 */

/**
 * @typedef {Object} OpenAIParams
 * @property {'openai'} provider
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [max_tokens]
 */

/**
 * @typedef {Object} PerplexityParams
 * @property {'perplexity'} provider
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [max_tokens]
 * @property {number} [top_p]
 */

/**
 * @typedef {GeminiParams | OpenAIParams | PerplexityParams} ProviderParams
 */

/**
 * @typedef {Object} ChatMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} AskAIRequest
 * @property {string} [prompt] - Single-turn shorthand, wrapped as a user message by the API.
 * @property {ChatMessage[]} [messages] - Full conversation history for multi-turn exchanges.
 * @property {ProviderParams} providerParams
 */

/**
 * @typedef {Object} AskAIResponse
 * @property {string} text
 * @property {string} provider
 * @property {string} model
 */

// ---------------------------------------------------------------------------
// Firestore Service Return Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FirestoreGetOneResult
 * @property {string} id
 * @property {Record<string, unknown>} data
 * @property {string} collection
 */

/**
 * @typedef {Object} FirestoreQueryResult
 * @property {Array<{id: string} & Record<string, unknown>>} documents
 * @property {string} collection
 * @property {boolean} hasMore
 * @property {string|null} lastDocumentId
 */

/**
 * @typedef {Object} FirestoreWriteResult
 * @property {string} id
 * @property {string} collection
 */

/**
 * @typedef {Object} FirestoreMutationResult
 * @property {string} id
 * @property {string} collection
 * @property {boolean} [updated]
 * @property {boolean} [patched]
 * @property {boolean} [deleted]
 */

// ---------------------------------------------------------------------------
// Word Pool Schema Types
// These types describe the Firestore schema for the word pool feature.
// They are challenge-neutral and reusable by any feature that needs
// a dialect-aware vocabulary pool backed by AI fallback.
// ---------------------------------------------------------------------------

/**
 * Fixed category used as the third segment of a wordPool document ID.
 * Document ID pattern: `{challengeId}__{learningDialect}__{category}`
 *
 * @typedef {'general'|'food'|'travel'|'sports'|'tech'|'nature'} WordCategory
 */

/**
 * Identifier for the feature/challenge that owns a word pool.
 * Extend this union as new challenges are introduced.
 *
 * @typedef {'hangman'} ChallengeId
 */

/**
 * Top-level document in the `wordPools` collection.
 * Path: wordPools/{challengeId}__{learningDialect}__{category}
 *
 * @typedef {Object} WordPool
 * @property {ChallengeId} challengeId
 * @property {string} learningDialect - BCP-47 tag, e.g. 'es-MX'
 * @property {WordCategory} category
 * @property {number} totalCount
 * @property {string|null} lastAIRefill - ISO timestamp or null
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Document in the `wordPools/{poolId}/words` subcollection.
 *
 * `hints` is a map keyed by userDialect (BCP-47). If the hint for the
 * requested userDialect is absent, the service generates it via AI
 * and patches it back using patchDocument() with a dot-notation key:
 *   { 'hints.pt-BR': 'Uma fruta redonda...' }
 *
 * @typedef {Object} PoolWord
 * @property {string} word - Vocabulary word in learningDialect
 * @property {Record<string, string>} hints - Keyed by userDialect BCP-47 tag
 * @property {'ai'|'seed'} addedBy
 * @property {number} usedCount
 * @property {string} createdAt
 */

/**
 * Document in `userChallengeProgress/{uid}/challenges/{challengeId}__{learningDialect}`.
 * Tracks which word IDs this user has already seen for a given challenge + dialect pair.
 *
 * @typedef {Object} UserChallengeProgress
 * @property {string[]} seenWordIds - Array of PoolWord document IDs
 * @property {number} totalPlayed
 * @property {string} lastPlayedAt
 */

// ---------------------------------------------------------------------------
// Service Return / Input Types
// ---------------------------------------------------------------------------

/**
 * Returned by every challenge service's getWord() method.
 * `source` indicates whether the word came from the DB pool or fresh AI.
 *
 * @typedef {Object} WordResult
 * @property {string} word
 * @property {string} hint
 * @property {string} wordId
 * @property {'db'|'ai'} source
 */

/**
 * Input parameters shared by all word-based challenge services.
 *
 * @typedef {Object} BaseChallengeServiceParams
 * @property {string} uid
 * @property {string} userDialect - BCP-47 native language, e.g. 'en-US'
 * @property {string} learningDialect - BCP-47 target language, e.g. 'es-MX'
 * @property {WordCategory} category
 */

/**
 * Params for HangmanService.getWord().
 * Extends BaseChallengeServiceParams — add hangman-specific fields here if needed.
 *
 * @typedef {BaseChallengeServiceParams} HangmanServiceParams
 */

export {};
