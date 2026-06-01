import PropTypes from 'prop-types';
const C = { sky: { d: 'border-sky-700 text-sky-400 bg-sky-900/30', l: 'border-sky-300 text-sky-700 bg-sky-50' }, emerald: { d: 'border-emerald-700 text-emerald-400 bg-emerald-900/30', l: 'border-emerald-300 text-emerald-700 bg-emerald-50' }, teal: { d: 'border-teal-700 text-teal-400 bg-teal-900/30', l: 'border-teal-300 text-teal-700 bg-teal-50' }, amber: { d: 'border-amber-700 text-amber-400 bg-amber-900/30', l: 'border-amber-300 text-amber-700 bg-amber-50' } };
const LevelBadge = ({ level, isDarkMode, color = 'emerald' }) => { const c = C[color] ?? C.emerald; return <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg border-2 ${isDarkMode ? c.d : c.l}`}>{level}</span>; };
LevelBadge.propTypes = { level: PropTypes.string.isRequired, isDarkMode: PropTypes.bool.isRequired, color: PropTypes.oneOf(['sky', 'emerald', 'teal', 'amber']) };
LevelBadge.defaultProps = { color: 'emerald' };
export default LevelBadge;