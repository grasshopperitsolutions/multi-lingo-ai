import { useEffect } from "react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";

const AlertMessage = ({ alert, onClose }) => {
  const { t } = useTranslation();

  const isSessionExpired = alert.message === "__SESSION_EXPIRED__";
  const displayMessage = isSessionExpired
    ? t("session.expired_title")
    : alert.message;

  // Auto-dismiss after 4s unless it has a persistent action or is session expired
  useEffect(() => {
    if (alert.show && !isSessionExpired && !alert.action) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, onClose, isSessionExpired, alert.action]);

  if (!alert.show) return null;

  const styles = {
    error: { bg: "bg-rose-500", text: "text-white", icon: AlertTriangle },
    success: {
      bg: "bg-emerald-400",
      text: "text-slate-900",
      icon: CheckCircle,
    },
    info: { bg: "bg-blue-400", text: "text-slate-900", icon: Info },
  };

  const currentStyle = styles[alert.type] || styles.info;
  const Icon = currentStyle.icon;

  const handleActionClick = () => {
    if (alert.action?.onClick) {
      alert.action.onClick();
    }
    // Dismiss the alert after action is executed
    onClose();
  };

  return (
    <div className="fixed top-6 right-6 md:top-10 md:right-10 z-[200] animate-in slide-in-from-top-10 fade-in duration-300">
      <div
        className={`flex items-center gap-4 px-6 py-4 rounded-2xl border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] ${currentStyle.bg} ${currentStyle.text}`}
      >
        <Icon size={24} className="flex-shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="font-black uppercase tracking-tight text-lg">
            {displayMessage}
          </span>
          {isSessionExpired && (
            <span className="text-sm font-normal normal-case tracking-normal opacity-90">
              {t("session.expired_message")}
            </span>
          )}
        </div>
        {isSessionExpired ? (
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="ml-4 px-4 py-2 rounded-xl bg-white text-rose-500 font-bold uppercase text-sm hover:scale-105 transition-all active:scale-95 whitespace-nowrap"
          >
            {t("session.refresh_button")}
          </button>
        ) : alert.action ? (
          <button
            onClick={handleActionClick}
            className="ml-4 px-4 py-2 rounded-xl bg-white text-rose-500 font-bold uppercase text-sm hover:scale-105 transition-all active:scale-95 whitespace-nowrap"
          >
            {alert.action.label}
          </button>
        ) : (
          <button
            onClick={onClose}
            className="ml-4 opacity-70 hover:opacity-100 hover:scale-110 transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

AlertMessage.propTypes = {
  alert: PropTypes.shape({
    show: PropTypes.bool.isRequired,
    type: PropTypes.string,
    message: PropTypes.string,
    action: PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
    }),
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AlertMessage;