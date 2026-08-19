import PropTypes from 'prop-types';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { accentClass, ACCENT_NAMES } from './exerciseAccents';

const TranscriptionExercise = ({ text, prompt, userInput, onChange, isDarkMode, accent }) => {
  const { t } = useTranslation();

  return (
  <div className="flex flex-col gap-3">
    <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
      <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}><FileText size={14} className="inline mr-1" /> {t('exam.passage_label', 'Text')}</p>
      <p className={`text-sm sm:text-base leading-relaxed font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{text}</p>
    </div>
    <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
      <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('exam.task', 'Your Task')}</p>
      <p className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{prompt}</p>
      <textarea value={userInput} onChange={(e) => onChange(e.target.value)} placeholder={t('exam.transcription_placeholder', 'Copy the sentence from the text here...')} rows={3} className={`w-full rounded-xl border-4 p-3 text-sm font-medium resize-none focus:outline-none focus:ring-0 transition-colors ${accentClass(accent, 'focus', isDarkMode)} ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'}`} />
    </div>
    </div>
  );
};

TranscriptionExercise.propTypes = {
  text: PropTypes.string.isRequired, prompt: PropTypes.string.isRequired, userInput: PropTypes.string, onChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired, accent: PropTypes.oneOf(ACCENT_NAMES), level: PropTypes.string,
};
TranscriptionExercise.defaultProps = { userInput: '', accent: 'teal', level: 'B1' };

export default TranscriptionExercise;