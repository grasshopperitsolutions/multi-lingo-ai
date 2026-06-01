import PropTypes from 'prop-types';

const Card = ({ children, isDarkMode, className = '' }) => (
  <div className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'} ${className}`}>
    {children}
  </div>
);

Card.propTypes = {
  children: PropTypes.node.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
};

Card.defaultProps = { className: '' };

export default Card;