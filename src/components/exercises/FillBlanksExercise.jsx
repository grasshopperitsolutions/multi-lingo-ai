import PropTypes from 'prop-types';

const FillBlanksExercise = ({ blanks, wordBank, answers, onAnswer, showContext, isDarkMode, level }) => {
  const usedWords = new Set(Object.values(answers).filter(Boolean));
  return (
    <div className="flex flex-col gap-3">
      {wordBank.length > 0 && (
        <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
          <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quadro de palavras</p>
          <div className="flex flex-wrap gap-2">
            {wordBank.map((word, i) => {
              const isUsed = usedWords.has(word);
              return (<span key={`${word}-${i}`} className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold ${isUsed ? (isDarkMode ? 'border-slate-700 text-slate-600 bg-slate-800/50 line-through' : 'border-slate-200 text-slate-400 bg-slate-50 line-through') : (isDarkMode ? 'border-amber-600 text-amber-400 bg-amber-900/20' : 'border-amber-500 text-amber-700 bg-amber-50')}`}>{word}</span>);
            })}
          </div>
          {level !== 'A1' && <p className={`mt-2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>* H&aacute; {wordBank.length - blanks.length} palavra(s) a mais</p>}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {blanks.map((blank, i) => (
          <div key={blank.id} className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
            <div className="flex items-start gap-3">
              <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black mt-0.5 ${isDarkMode ? 'border-amber-600 text-amber-400' : 'border-amber-500 text-amber-600'}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                {showContext && blank.context && <p className={`text-sm mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{blank.context}</p>}
                <select value={answers[blank.id] || ''} onChange={(e) => onAnswer(blank.id, e.target.value || null)} className={`w-full rounded-xl border-2 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-0 transition-colors ${answers[blank.id] ? (isDarkMode ? 'bg-amber-900/30 border-amber-600 text-amber-300' : 'bg-amber-50 border-amber-500 text-amber-800') : (isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-300 focus:border-amber-500' : 'bg-white border-slate-300 text-slate-700 focus:border-amber-500')}`}>
                  <option value="">&mdash; {blank.blankLabel || 'Seleciona uma palavra'} &mdash;</option>
                  {wordBank.map((word) => { const isUE = usedWords.has(word) && answers[blank.id] !== word; return <option key={word} value={word} disabled={isUE}>{word}</option>; })}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

FillBlanksExercise.propTypes = {
  blanks: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, context: PropTypes.string, blankLabel: PropTypes.string })).isRequired,
  wordBank: PropTypes.arrayOf(PropTypes.string).isRequired, answers: PropTypes.object.isRequired, onAnswer: PropTypes.func.isRequired,
  showContext: PropTypes.bool, isDarkMode: PropTypes.bool.isRequired, level: PropTypes.string,
};
FillBlanksExercise.defaultProps = { showContext: true, level: 'A1' };

export default FillBlanksExercise;