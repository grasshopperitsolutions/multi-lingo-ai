/**
 * parseAIJSON.js
 *
 * Shared utility for parsing JSON from AI responses.
 * Strips markdown code fences, parses, and decodes HTML character references.
 */

import { decodeEntitiesDeep } from './decodeHtmlEntities';

/**
 * Parse a JSON string returned by an AI model.
 * Handles common patterns like markdown code fences wrapping the JSON.
 *
 * Decoding happens AFTER JSON.parse, never before: entity references can
 * expand into JSON syntax, so decoding "&quot;" in the raw text would inject a
 * bare quote and break the parse. Walking the parsed value keeps the structure
 * intact and only touches the content.
 *
 * @param {string} raw - The raw response string from the AI
 * @returns {any} The parsed JSON object, with HTML entities decoded
 * @throws {Error} If the string cannot be parsed as JSON
 */
export function parseAIJSON(raw) {
  // If raw is already a parsed object, return it directly
  if (typeof raw !== 'string') {
    if (raw && typeof raw === 'object') return decodeEntitiesDeep(raw);
    throw new Error('Failed to parse AI response');
  }

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error('Empty response');
  }

  return decodeEntitiesDeep(JSON.parse(cleaned));
}