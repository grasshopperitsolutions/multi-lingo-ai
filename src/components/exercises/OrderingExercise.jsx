/**
 * OrderingExercise.jsx
 *
 * Ordering reading comprehension exercise.
 * Presents items (paragraphs, sentences, steps) that students must arrange
 * in the correct logical order.
 *
 * Props:
 *   items        {Array}  - Array of { id, text, correctPosition }
 *   userOrder    {Array}  - Array of item ids in current user order
 *   onReorder    {func}   - Called with array of item ids in new order
 *   isDarkMode   {bool}
 *   level        {string}
 */
import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ArrowUp, ArrowDown } from 'lucide-react';

const OrderingExercise = ({ items, userOrder, onReorder, isDarkMode }) => {
  // Determine display order: use userOrder if provided, otherwise use randomly shuffled
  const [shuffled] = useState(() => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.map((item) => item.id);
  });
  const displayOrder = userOrder?.length > 0 ? userOrder : shuffled;

  const handleMoveUp = useCallback((index) => {
    if (index <= 0) return;
    const newOrder = [...displayOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onReorder(newOrder);
  }, [displayOrder, onReorder]);

  const handleMoveDown = useCallback((index) => {
    if (index >= displayOrder.length - 1) return;
    const newOrder = [...displayOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onReorder(newOrder);
  }, [displayOrder, onReorder]);

  return (
    <div className="flex flex-col gap-3">
      {displayOrder.map((itemId, index) => {
        const item = items.find((i) => i.id === itemId);
        if (!item) return null;
        return (
          <div
            key={item.id}
            className={`rounded-2xl border-4 p-4 sm:p-5 flex items-start gap-3 ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]'
                : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'
            }`}
          >
            {/* Position number */}
            <span className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black ${
              isDarkMode
                ? 'border-violet-600 bg-slate-800 text-violet-400'
                : 'border-violet-500 bg-white text-violet-600'
            }`}>
              {index + 1}
            </span>

            {/* Item text */}
            <p className={`flex-1 text-sm sm:text-base leading-relaxed font-medium ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}>
              {item.text}
            </p>

            {/* Move buttons */}
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className={`p-1 rounded-lg border transition-all active:scale-[0.95] ${
                  index === 0
                    ? 'opacity-30 cursor-not-allowed'
                    : isDarkMode
                      ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
                      : 'border-slate-400 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => handleMoveDown(index)}
                disabled={index === displayOrder.length - 1}
                className={`p-1 rounded-lg border transition-all active:scale-[0.95] ${
                  index === displayOrder.length - 1
                    ? 'opacity-30 cursor-not-allowed'
                    : isDarkMode
                      ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
                      : 'border-slate-400 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

OrderingExercise.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
      correctPosition: PropTypes.number.isRequired,
    })
  ).isRequired,
  userOrder: PropTypes.arrayOf(PropTypes.string),
  onReorder: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  level: PropTypes.string,
};

OrderingExercise.defaultProps = {
  userOrder: [],
  level: 'A1',
};

/**
 * Generate AI prompt for ordering reading exercise
 * @param {string} level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @param {string} targetLang - Target learning language (e.g., 'pt-PT', 'en-US')
 * @returns {string} AI prompt
 */
OrderingExercise.generatePrompt = (level, targetLang) => {
  return [
    `Generate an ordering reading comprehension exercise in ${targetLang} for CEFR level ${level}.`,
    `CRITICAL: All text content must be written entirely in ${targetLang}.`,
    `Create 5-7 items (sentences or short paragraphs) that form a logical sequence — a narrative, process, or timeline.`,
    `Each item should be a complete sentence (10-40 words). Do NOT include ordinal markers (first, second...) that give away the answer.`,
    `Return a JSON object with:`,
    `  - "items": array of { id, text, correctPosition } — correctPosition is 1-based index in the proper sequence`,
    `Return ONLY valid JSON. No markdown, no explanation.`,
  ].join('\n');
};

export default OrderingExercise;