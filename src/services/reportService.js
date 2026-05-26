/**
 * reportService.js
 *
 * Handles user report submission via WhatsApp (wa.me Option B).
 * Opens a pre-filled WhatsApp chat in a new tab — no backend needed.
 *
 * Usage:
 *   import { openWhatsAppReport } from '../services/reportService';
 *   openWhatsAppReport({ category: 'Bug', message: 'Something is broken', context: 'ChallengePage' });
 */

const WHATSAPP_NUMBER = '33767834576'; // +33 767834576

/**
 * Builds a formatted WhatsApp message string.
 * Uses plain text + emojis — no Markdown asterisks, which show as raw
 * characters in the wa.me pre-send preview.
 *
 * @param {Object} params
 * @param {string} params.category  - Selected report category
 * @param {string} params.message   - User-written description
 * @param {string} [params.context] - Optional page/component context passed by the parent
 * @returns {string} Encoded wa.me URL
 */
const buildWhatsAppUrl = ({ category, message, context }) => {
  const timestamp = new Date().toLocaleString();

  const lines = [
    '🚨 MULTI LINGO AI — USER REPORT',
    '────────────────────────',
    `📂 Category: ${category}`,
    `🕐 Time: ${timestamp}`,
    context ? `📍 Context: ${context}` : null,
    '────────────────────────',
    `📝 Message:`,
    message.trim(),
  ]
    .filter((line) => line !== null)
    .join('\n');

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines)}`;
};

/**
 * Opens WhatsApp in a new tab with the pre-filled report message.
 * The user still needs to press Send inside WhatsApp.
 *
 * @param {Object} params
 * @param {string} params.category
 * @param {string} params.message
 * @param {string} [params.context]
 */
export const openWhatsAppReport = ({ category, message, context }) => {
  const url = buildWhatsAppUrl({ category, message, context });
  window.open(url, '_blank', 'noopener,noreferrer');
};
