import { useEffect } from "react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import PropTypes from "prop-types";

const AlertMessage = ({ alert, onClose }) => {
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, onClose]);

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

  return (
    <div className="fixed top-6 right-6 md:top-10 md:right-10 z-[200] animate-in slide-in-from-top-10 fade-in duration-300">
      <div
        className={`flex items-center gap-4 px-6 py-4 rounded-2xl border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] ${currentStyle.bg} ${currentStyle.text}`}
      >
        <Icon size={24} className="flex-shrink-0" />
        <span className="font-black uppercase tracking-tight text-lg">
          {alert.message}
        </span>
        <button
          onClick={onClose}
          className="ml-4 opacity-70 hover:opacity-100 hover:scale-110 transition-all active:scale-90"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

AlertMessage.propTypes = {
  alert: PropTypes.shape({
    show: PropTypes.bool.isRequired,
    type: PropTypes.string,
    message: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AlertMessage;