import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

const MatchingExercise = ({ pairs, extraItems, matches, onMatch, showExample, example, isDarkMode }) => {
  const [shuffledB] = useState(() => {
    const allB = [...pairs.map((p) => ({ text: p.itemB, isCorrect: true })), ...extraItems.map((text) => ({ text, isCorrect: false }))];
    return allB.sort(() => Math.random() - 0.5);
  });
  const assignedB = useMemo(() => new Set(Object.values(matches)), [matches]);

  return (
    <div className="flex flex-col gap-3">
      {showExample && example && (
        <div className={`rounded-2xl border-4 p-4 sm:p-5 opacity-60 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-900'}`}>
          <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Exemplo</p>
          <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{example.itemA} &mdash; {example.itemB}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Coluna A</p>
          {pairs.map((pair, i) => (
            <div key={pair.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 ${matches[pair.itemA] ? (isDarkMode ? 'bg-indigo-900/30 border-indigo-600' : 'bg-indigo-50 border-indigo-400') : (isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300')}`}>
              <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black ${isDarkMode ? 'border-indigo-600 bg-slate-800 text-indigo-400' : 'border-indigo-500 bg-white text-indigo-600'}`}>{i + 1}</span>
              <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{pair.itemA}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Coluna B</p>
          {shuffledB.map((item, i) => {
            const isAssigned = assignedB.has(item.text);
            return (
              <button key={`${item.text}-${i}`} onClick={() => { const c = Object.entries(matches).find(([, v]) => v === item.text); if (c) onMatch(c[0], null); }} className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${isAssigned ? (isDarkMode ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-indigo-50 border-indigo-500 text-indigo-800') : (isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700/50' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}`}>
                {item.text}
                {!item.isCorrect && <span className={`ml-2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>(extra)</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2 mt-2">
        <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Associa&ccedil;&otilde;es</p>
        {pairs.map((pair) => (
          <div key={pair.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            <span className={`text-sm font-bold shrink-0 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{pair.itemA}</span>
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>&rarr;</span>
            <select value={matches[pair.itemA] || ''} onChange={(e) => onMatch(pair.itemA, e.target.value || null)} className={`flex-1 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-0 transition-colors ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'}`}>
              <option value="">&mdash; Seleciona &mdash;</option>
              {shuffledB.map((item) => (<option key={item.text} value={item.text} disabled={item.text !== matches[pair.itemA] && assignedB.has(item.text)}>{item.text}</option>))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

MatchingExercise.propTypes = {
  pairs: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, itemA: PropTypes.string.isRequired, itemB: PropTypes.string.isRequired })).isRequired,
  extraItems: PropTypes.arrayOf(PropTypes.string), matches: PropTypes.object.isRequired, onMatch: PropTypes.func.isRequired,
  showExample: PropTypes.bool, example: PropTypes.shape({ itemA: PropTypes.string, itemB: PropTypes.string }),
  isDarkMode: PropTypes.bool.isRequired, level: PropTypes.string,
};
MatchingExercise.defaultProps = { extraItems: [], showExample: false, example: null, level: 'A1' };

export default MatchingExercise;