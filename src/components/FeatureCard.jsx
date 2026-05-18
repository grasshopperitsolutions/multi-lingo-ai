import PropTypes from "prop-types";
import Tooltip from "./Tooltip";

const FeatureCard = ({ icon: Icon, title, description, delay, color, isDarkMode, onClick }) => {
  return (
    <Tooltip text={description} isDarkMode={isDarkMode}>
      <button
        onClick={onClick}
        className={`p-6 rounded-2xl border-4 transition-all duration-200 wiggle-hover flex flex-col items-center text-center w-full cursor-pointer ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 neo-shadow-dark text-slate-100 hover:-translate-y-1 active:scale-95"
            : "bg-white border-slate-900 neo-shadow-light text-slate-900 hover:-translate-y-1 active:scale-95"
        }`}
        style={{ animationDelay: delay }}
      >
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 border-2 border-current shadow-[4px_4px_0px_0px_currentColor] float-1 ${color}`}
        >
          <Icon className="w-8 h-8" />
        </div>
        <h3 className="font-extrabold text-xl uppercase">{title}</h3>
      </button>
    </Tooltip>
  );
};

FeatureCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  delay: PropTypes.string,
  color: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  onClick: PropTypes.func,
};

FeatureCard.defaultProps = {
  description: "",
  onClick: undefined,
  delay: undefined,
};

export default FeatureCard;
