import PropTypes from 'prop-types';
const COLORS = {
  sky: { dark: 'bg-sky-500 border-sky-400 text-slate-900 shadow-[4px_4px_0px_0px_#0c4a6e] hover:bg-sky-400', light: 'bg-sky-500 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:bg-sky-600' },
  emerald: { dark: 'bg-emerald-500 border-emerald-400 text-slate-900 shadow-[4px_4px_0px_0px_#065f46] hover:bg-emerald-400', light: 'bg-emerald-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:bg-emerald-700' },
  teal: { dark: 'bg-teal-500 border-teal-400 text-slate-900 shadow-[4px_4px_0px_0px_#0f766e] hover:bg-teal-400', light: 'bg-teal-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:bg-teal-700' },
  amber: { dark: 'bg-amber-500 border-amber-400 text-slate-900 shadow-[4px_4px_0px_0px_#92400e] hover:bg-amber-400', light: 'bg-amber-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:bg-amber-700' },
};
const PrimaryButton = ({ children, onClick, disabled, loading, isDarkMode, color = 'emerald', className = '' }) => {
  const c = COLORS[color] ?? COLORS.emerald;
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 select-none ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'} ${isDarkMode ? c.dark : c.light} ${className}`}>
      {children}
    </button>
  );
};
PrimaryButton.propTypes = { children: PropTypes.node.isRequired, onClick: PropTypes.func.isRequired, disabled: PropTypes.bool, loading: PropTypes.bool, isDarkMode: PropTypes.bool.isRequired, color: PropTypes.oneOf(['sky', 'emerald', 'teal', 'amber']), className: PropTypes.string };
PrimaryButton.defaultProps = { disabled: false, loading: false, color: 'emerald', className: '' };
export default PrimaryButton;