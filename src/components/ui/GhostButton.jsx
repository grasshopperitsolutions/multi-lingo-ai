import PropTypes from 'prop-types';
const GhostButton = ({ children, onClick, disabled, isDarkMode, className = '' }) => (
  <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'} ${isDarkMode ? 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-transparent border-slate-900 text-slate-700 hover:bg-slate-100'} ${className}`}>
    {children}
  </button>
);
GhostButton.propTypes = { children: PropTypes.node.isRequired, onClick: PropTypes.func.isRequired, disabled: PropTypes.bool, isDarkMode: PropTypes.bool.isRequired, className: PropTypes.string };
GhostButton.defaultProps = { disabled: false, className: '' };
export default GhostButton;