/**
 * parseAIJSON.js
 *
 * Shared utility for parsing JSON from AI responses.
 * Strips markdown code fences and parses the result.
 */

/**
 * Parse a JSON string returned by an AI model.
 * Handles common patterns like markdown code fences wrapping the JSON.
 *
 * @param {string} raw - The raw response string from the AI
 * @returns {any} The parsed JSON object
 * @throws {Error} If the string cannot be parsed as JSON
 */
export function parseAIJSON(raw) {
  // If raw is already a parsed object, return it directly
  if (typeof raw !== 'string') {
    if (raw && typeof raw === 'object') return raw;
    throw new Error('Failed to parse AI response');
  }

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error('Empty response');
  }

  return JSON.parse(cleaned);
}