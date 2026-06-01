import PropTypes from 'prop-types';
import { FileText } from 'lucide-react';

const TranscriptionExercise = ({ text, prompt, userInput, onChange, isDarkMode }) => (
  <div className="flex flex-col gap-3">
    <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
      <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}><FileText size={14} className="inline mr-1" /> Texto</p>
      <p className={`text-sm sm:text-base leading-relaxed font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{text}</p>
    </div>
    <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
      <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tarefa</p>
      <p className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{prompt}</p>
      <textarea value={userInput} onChange={(e) => onChange(e.target.value)} placeholder="Copia aqui a frase do texto..." rows={3} className={`w-full rounded-xl border-4 p-3 text-sm font-medium resize-none focus:outline-none focus:ring-0 transition-colors ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500 focus:border-purple-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-purple-600'}`} />
    </div>
  </div>
);

TranscriptionExercise.propTypes = {
  text: PropTypes.string.isRequired, prompt: PropTypes.string.isRequired, userInput: PropTypes.string, onChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired, level: PropTypes.string,
};
TranscriptionExercise.defaultProps = { userInput: '', level: 'B1' };

export default TranscriptionExercise;