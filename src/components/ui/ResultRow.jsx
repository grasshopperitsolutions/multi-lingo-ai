import { useState } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle2, XCircle } from 'lucide-react';
const ResultRow = ({ item, index, isDarkMode, colorScheme = 'emerald' }) => {
  const [expanded, setExpanded] = useState(false);
  const c = isDarkMode ? (colorScheme === 'sky' ? 'text-sky-400' : 'text-emerald-400') : (colorScheme === 'sky' ? 'text-sky-600' : 'text-emerald-600');
  const w = isDarkMode ? 'text-rose-400' : 'text-rose-600';
  const cb = isDarkMode ? (colorScheme === 'sky' ? 'text-sky-400' : 'text-emerald-400') : (colorScheme === 'sky' ? 'text-sky-700' : 'text-emerald-700');
  const wb = isDarkMode ? 'text-rose-400' : 'text-rose-700';
  return (
    <button onClick={() => setExpanded((p) => !p)} className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-50'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black ${isDarkMode ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300 bg-slate-100 text-slate-900'}`}>{index + 1}</span>
          <span className={`font-bold text-sm truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.question}</span>
        </div>
        {item.isCorrect ? <CheckCircle2 size={18} className={`shrink-0 ${c}`} /> : <XCircle size={18} className={`shrink-0 ${w}`} />}
      </div>
      {expanded && (
        <div className="mt-3 flex flex-col gap-1.5">
          {item.userAnswer && <p className={`text-xs font-semibold ${item.isCorrect ? cb : wb}`}>{item.isCorrect ? '\u2713' : '\u2717'} {item.userAnswer}</p>}
          {!item.isCorrect && <p className={`text-xs font-semibold ${cb}`}>\u2713 {item.correctAnswer}</p>}
        </div>
      )}
    </button>
  );
};
ResultRow.propTypes = { item: PropTypes.shape({ questionId: PropTypes.string.isRequired, question: PropTypes.string.isRequired, userAnswer: PropTypes.string, correctAnswer: PropTypes.string.isRequired, isCorrect: PropTypes.bool.isRequired }).isRequired, index: PropTypes.number.isRequired, isDarkMode: PropTypes.bool.isRequired, colorScheme: PropTypes.oneOf(['emerald', 'sky']) };
ResultRow.defaultProps = { colorScheme: 'emerald' };
export default ResultRow;