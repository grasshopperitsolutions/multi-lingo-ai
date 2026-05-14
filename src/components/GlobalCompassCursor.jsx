import { Compass } from "lucide-react";
import PropTypes from "prop-types";

const GlobalCompassCursor = ({ x, y, isDarkMode }) => {
  const rotation = (x + y) % 360;
  return (
    <div
      className="fixed pointer-events-none z-[9999] flex items-center justify-center"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        transition: "transform 0.1s ease-out",
      }}
    >
      <div
        className={`p-2 rounded-full border-4 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? "bg-yellow-400" : "bg-white"}`}
      >
        <Compass size={24} className="text-slate-900" strokeWidth={3} />
      </div>
    </div>
  );
};

GlobalCompassCursor.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default GlobalCompassCursor;
