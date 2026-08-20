import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { selectedClass, unselectedClass, ACCENT_NAMES } from './exerciseAccents';

const BestTitleExercise = ({ passage, titles, selectedId, onSelect, isDarkMode }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      {passage && (
        <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
          <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('exam.passage_label', 'Text')}</p>
          <p className={`text-sm sm:text-base leading-relaxed font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{passage}</p>
        </div>
      )}
      <div>
        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('exam.best_title_label', 'Best title')}</p>
        <div className="flex flex-col gap-2">
          {titles.map((title) => (
            <button key={title.id} onClick={() => onSelect(title.id)} className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${selectedId === title.id ? selectedClass(isDarkMode) : unselectedClass(isDarkMode)}`}>
              {title.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

BestTitleExercise.propTypes = {
  passage: PropTypes.string, titles: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, text: PropTypes.string.isRequired, isCorrect: PropTypes.bool })).isRequired,
  selectedId: PropTypes.string, onSelect: PropTypes.func.isRequired, isDarkMode: PropTypes.bool.isRequired,
  accent: PropTypes.oneOf(ACCENT_NAMES), level: PropTypes.string,
};
BestTitleExercise.defaultProps = { passage: '', selectedId: null, accent: 'teal', level: 'A1' };

export default BestTitleExercise;
