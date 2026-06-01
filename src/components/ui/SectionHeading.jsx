import PropTypes from 'prop-types';
const SectionHeading = ({ children, isDarkMode }) => (
  <h2 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{children}</h2>
);
SectionHeading.propTypes = { children: PropTypes.node.isRequired, isDarkMode: PropTypes.bool.isRequired };
export default SectionHeading;