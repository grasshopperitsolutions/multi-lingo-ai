import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import PropTypes from "prop-types";
import BarcelosRooster from "./BarcelosRooster";

const GrasshopperLogo = ({ className }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Grasshopper IT Solutions logo"
  >
    <circle cx="100" cy="100" r="90" fill="#0a0a0a" stroke="#00ff41" strokeWidth="2" />
    <path d="M60 120 Q 40 80 80 60" stroke="#00ff41" strokeWidth="4" strokeLinecap="round" />
    <path d="M140 120 Q 160 80 120 60" stroke="#00ff41" strokeWidth="4" strokeLinecap="round" />
    <circle cx="85" cy="90" r="8" fill="#00dbde" />
    <circle cx="115" cy="90" r="8" fill="#00dbde" />
    <path d="M90 120 Q 100 130 110 120" stroke="#00ff41" strokeWidth="3" strokeLinecap="round" />
    <path d="M50 140 L 150 140" stroke="#1e1e1e" strokeWidth="2" strokeLinecap="round" />
    <path d="M80 60 L 60 30" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" />
    <path d="M120 60 L 140 30" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Footer = () => {
  const { isDarkMode } = useAppContext();
  const { t } = useTranslation();

  return (
    <footer
      className={`mt-auto border-t-4
      ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-900"}`}
    >
      {/* Main footer content */}
      <div className="py-12 max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0 font-bold">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border-2 border-slate-900">
            <BarcelosRooster className="w-8 h-8" />
          </div>
          <span className="text-xl uppercase tracking-tighter">
            {t("footer.brand")}
          </span>
        </div>
        <p className="opacity-70">{t('footer.tagline')}</p>
        <div className="flex space-x-6">
          <Link
            to="/privacy"
            className="hover:text-blue-600 hover:-translate-y-1 transition-transform"
          >
            {t('footer.privacy')}
          </Link>
          <Link
            to="/terms"
            className="hover:text-blue-600 hover:-translate-y-1 transition-transform"
          >
            {t('footer.terms')}
          </Link>
          <Link
            to="/contact"
            className="hover:text-blue-600 hover:-translate-y-1 transition-transform"
          >
            {t('footer.contact')}
          </Link>
        </div>
      </div>

      {/* Grasshopper IT Solutions credit strip */}
      <div
        className={`border-t py-3 px-4
        ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50"}`}
      >
        <a
          href="https://grasshoppersolutions.online"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 text-sm font-medium transition-opacity hover:opacity-80
          ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
        >
          <GrasshopperLogo className="w-5 h-5 flex-shrink-0" />
          <span>{t('footer.built_by')}</span>
        </a>
      </div>
    </footer>
  );
};

GrasshopperLogo.propTypes = {
  className: PropTypes.string,
};

export default Footer;
