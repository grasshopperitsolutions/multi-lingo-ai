import PropTypes from "prop-types";
import roosterSvg from "../barcelos-rooster.svg";

const BarcelosRooster = ({ className }) => (
  <img src={roosterSvg} className={className} alt="Barcelos Rooster" />
);

BarcelosRooster.propTypes = {
  className: PropTypes.string,
};

export default BarcelosRooster;
