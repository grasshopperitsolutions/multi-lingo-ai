import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import roosterSvg from "../barcelos-rooster.svg";

const BarcelosRooster = ({ className }) => {
  const { t } = useTranslation();
  return <img src={roosterSvg} className={className} alt={t("barcelos_rooster.alt")} />;
};

BarcelosRooster.propTypes = {
  className: PropTypes.string,
};

export default BarcelosRooster;
