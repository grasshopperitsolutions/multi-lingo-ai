import PropTypes from 'prop-types';

const BestTitleExercise = ({ passage, titles, selectedId, onSelect, isDarkMode }) => (
  <div className="flex flex-col gap-3">
    {passage && (
      <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Texto</p>
        <p className={`text-sm sm:text-base leading-relaxed font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{passage}</p>
      </div>
    )}
    <div>
      <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Melhor t&iacute;tulo</p>
      <div className="flex flex-col gap-2">
        {titles.map((title) => (
          <button key={title.id} onClick={() => onSelect(title.id)} className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${selectedId === title.id ? (isDarkMode ? 'bg-rose-900/40 border-rose-500 text-rose-300' : 'bg-rose-50 border-rose-500 text-rose-800') : (isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700/50' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}`}>
            {title.text}
          </button>
        ))}
      </div>
    </div>
  </div>
);

BestTitleExercise.propTypes = {
  passage: PropTypes.string, titles: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, text: PropTypes.string.isRequired, isCorrect: PropTypes.bool })).isRequired,
  selectedId: PropTypes.string, onSelect: PropTypes.func.isRequired, isDarkMode: PropTypes.bool.isRequired, level: PropTypes.string,
};
BestTitleExercise.defaultProps = { passage: '', selectedId: null, level: 'A1' };

/**
 * Generate AI prompt for best title reading exercise
 * @param {string} level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @param {string} targetLang - Target learning language (e.g., 'pt-PT', 'en-US')
 * @returns {string} AI prompt
 */
BestTitleExercise.generatePrompt = (level, targetLang) => {
  return [
    `Generate a "choose the best title" reading comprehension exercise in ${targetLang} for CEFR level ${level}.`,
    `CRITICAL: All text content must be written entirely in ${targetLang}.`,
    `Create a short passage (100-200 words for A1-A2, 200-300 for B1-B2, 300-400 for C1-C2).`,
    `Provide 4-5 possible titles — only one should perfectly capture the main idea.`,
    `Return a JSON object with:`,
    `  - "passage": the reading passage text in ${targetLang}`,
    `  - "titles": array of { id, text, isCorrect } — only one title should have isCorrect: true`,
    `Return ONLY valid JSON. No markdown, no explanation.`,
  ].join('\n');
};

export default BestTitleExercise;