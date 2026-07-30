import PropTypes from "prop-types";
import Breadcrumb from "./Breadcrumb";
import ReportButton from "../ReportButton";

/**
 * FeaturePageShell
 *
 * Shared chrome for routed game/exercise pages: a Breadcrumb, an optional
 * title + ReportButton row, then the feature content.
 *
 * Pass `title` to show the heading row (used by Challenges games); omit it
 * to render just the breadcrumb + content (used by Exam Training exercises,
 * which render their own in-content heading).
 */
const FeaturePageShell = ({ isDarkMode, accentColor, breadcrumbItems, title, reportContext, children }) => (
  <div className="flex flex-col gap-4">
    <Breadcrumb isDarkMode={isDarkMode} accentColor={accentColor} items={breadcrumbItems} />

    {title && (
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}>
          {title}
        </h1>
        {reportContext && <ReportButton isDarkMode={isDarkMode} context={reportContext} />}
      </div>
    )}

    {children}
  </div>
);

FeaturePageShell.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  accentColor: PropTypes.string,
  breadcrumbItems: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func,
    }),
  ).isRequired,
  title: PropTypes.string,
  reportContext: PropTypes.string,
  children: PropTypes.node,
};

export default FeaturePageShell;
