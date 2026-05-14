import PropTypes from "prop-types";
const BarcelosRooster = ({ className }) => (
  <svg
    viewBox="0 0 100 100"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Body */}
    <path
      d="M50 85C30 85 15 70 15 50C15 30 30 15 50 15C70 15 85 30 85 50C85 70 70 85 50 85Z"
      fill="#000000"
      stroke="#000"
      strokeWidth="2"
    />
    {/* Tail Feathers */}
    <path
      d="M15 50C5 45 5 25 20 20C10 15 25 5 35 15"
      fill="none"
      stroke="#E11D48"
      strokeWidth="4"
      strokeLinecap="round"
    />
    {/* Comb (Crista) */} <path d="M45 15C45 5 65 5 65 15" fill="#E11D48" />
    <circle cx="55" cy="8" r="4" fill="#E11D48" />
    <circle cx="62" cy="12" r="3" fill="#E11D48" /> {/* Beak */}
    <path d="M78 35L88 38L78 41Z" fill="#FACC15" /> {/* Eye */}
    <circle cx="70" cy="35" r="3" fill="white" />
    <circle cx="71" cy="35" r="1.5" fill="black" /> {/* Iconic Hearts/Dots */}
    <path
      d="M35 45C35 42 38 40 40 40C42 40 45 42 45 45C45 48 40 52 40 52C40 52 35 48 35 45Z"
      fill="#E11D48"
    />
    <circle cx="55" cy="45" r="3" fill="#FACC15" />
    <circle cx="45" cy="60" r="4" fill="#3B82F6" />
    <path
      d="M55 65C55 62 58 60 60 60C62 60 65 62 65 65C65 68 60 72 60 72C60 72 55 68 55 65Z"
      fill="#E11D48"
    />
    {/* Legs */}
    <path
      d="M45 85V95M55 85V95"
      stroke="#FACC15"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);
BarcelosRooster.propTypes = { className: PropTypes.string.isRequired };
export default BarcelosRooster;
