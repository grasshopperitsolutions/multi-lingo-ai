import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import PropTypes from "prop-types";

/**
 * The compass that replaces the mouse pointer on devices with one.
 *
 * **It tracks the mouse itself, and that is the point of it being here.** The
 * position used to be state in AppLayout, which renders every route — so each
 * mouse move, dozens a second, re-rendered whichever page was open. On a heavy
 * page that is enough to make the compass trail the hand and the page stutter,
 * which is a plausible reading of what some users reported. Held here, a move
 * re-renders one small element and nothing else.
 *
 * It also owns the rule that hides the native pointer, so the two can never
 * disagree: when this is not rendered — a touch device, or a learner who has
 * turned it off in Settings › Appearance — the system cursor is simply back,
 * I-beam in text fields included.
 */
const GlobalCompassCursor = ({ isDarkMode }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const rotation = (position.x + position.y) % 360;
  return (
    <>
      <style>{`* { cursor: none !important; }`}</style>
      <div
        className="fixed pointer-events-none z-[9999] flex items-center justify-center"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <div
          className={`p-1 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? "bg-yellow-400" : "bg-white"}`}
        >
          <Compass size={12} className="text-slate-900" strokeWidth={3} />
        </div>
      </div>
    </>
  );
};

GlobalCompassCursor.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default GlobalCompassCursor;
