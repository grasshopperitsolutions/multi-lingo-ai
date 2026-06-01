import PropTypes from 'prop-types';
import { AlertTriangle } from 'lucide-react';
const ErrorBanner = ({ error, isDarkMode }) => error ? (
  <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${isDarkMode ? 'bg-rose-900/30 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-700'}`}>
    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
    <p className="text-sm font-semibold">{error}</p>
  </div>
) : null;
ErrorBanner.propTypes = { error: PropTypes.string, isDarkMode: PropTypes.bool.isRequired };
ErrorBanner.defaultProps = { error: null };
export default ErrorBanner;