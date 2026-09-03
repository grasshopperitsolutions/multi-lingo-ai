import { Component } from "react";
import PropTypes from "prop-types";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import i18n from "../i18n";

/**
 * Catches render-time exceptions so one broken component can't blank the
 * whole app. React unmounts the entire tree when an error escapes render,
 * which is why an uncaught crash currently leaves a white page with no way
 * back short of the browser's reload button.
 *
 * Deliberately depends on nothing the app provides at runtime — no
 * useAppContext, no useTranslation, no router. The boundary has to keep
 * working precisely when something else is broken, and the outermost
 * instance sits above AppProvider, so the context it would read may be the
 * thing that just threw.
 */

/** Reads the theme the way AppContext's getSavedTheme() does, without the context. */
const savedThemeIsDark = () => {
  try {
    return localStorage.getItem("theme") === "dark";
  } catch {
    return false;
  }
};

/**
 * Translates through the i18next singleton rather than the hook, falling
 * back to the bundled base locale's own wording if i18n is unavailable or
 * is itself the failure.
 */
const safeT = (key, fallback) => {
  try {
    const value = i18n.t(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  /**
   * Clears the error when the caller's resetKey changes — the route-level
   * boundary passes the pathname, so navigating away from a broken page
   * recovers without a full reload. Compared in state rather than keyed on
   * the element so a normal navigation doesn't remount the healthy tree.
   */
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey === state.resetKey) return null;
    return { error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error, info) {
    // The only record of the crash until error monitoring is wired up.
    console.error("[ErrorBoundary] Uncaught render error:", error, info?.componentStack);
  }

  handleRetry = () => this.setState({ error: null });

  handleReload = () => window.location.reload();

  render() {
    const { error } = this.state;
    const { children, isDarkMode } = this.props;

    if (!error) return children;

    const isDark = isDarkMode ?? savedThemeIsDark();

    const buttonClasses = `inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-4
      font-black uppercase tracking-widest text-sm transition-all active:scale-95 hover:-translate-y-1`;

    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center px-4 transition-colors duration-500
          ${isDark ? "bg-slate-900 text-slate-100" : "bg-blue-50 text-slate-900"}`}
      >
        <div
          className={`p-8 rounded-[2rem] border-4 max-w-md w-full text-center space-y-6
            ${isDark
              ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
            }`}
        >
          <div className="flex justify-center">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center border-4
                ${isDark
                  ? "bg-slate-700 border-amber-400 text-amber-400"
                  : "bg-amber-100 border-amber-500 text-amber-600"
                }`}
            >
              <AlertTriangle size={40} />
            </div>
          </div>

          <h1 className={`text-3xl font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>
            {safeT("error_boundary.title", "Algo correu mal")}
          </h1>

          <p className={`font-bold text-lg ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            {safeT(
              "error_boundary.message",
              "Esta parte da aplicação deixou de responder. O teu progresso guardado está seguro."
            )}
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className={`${buttonClasses}
                ${isDark
                  ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[6px_6px_0px_0px_#854d0e]"
                  : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
                }`}
            >
              <RotateCcw size={18} />
              {safeT("error_boundary.retry", "Tentar novamente")}
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className={`${buttonClasses}
                ${isDark
                  ? "bg-slate-700 border-slate-600 text-slate-200 shadow-[6px_6px_0px_0px_#1e293b]"
                  : "bg-white border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
                }`}
            >
              <RefreshCw size={18} />
              {safeT("error_boundary.reload", "Recarregar a página")}
            </button>
          </div>

          {/* Only useful while developing — in production it's noise the user can't act on. */}
          {import.meta.env.DEV && (
            <pre
              className={`text-left text-xs font-mono p-3 rounded-xl overflow-x-auto
                ${isDark ? "bg-slate-900 text-rose-400" : "bg-slate-100 text-rose-600"}`}
            >
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  /** Changing this value clears a caught error — pass the route pathname. */
  resetKey: PropTypes.string,
  /** Falls back to the theme stored in localStorage when the context isn't reachable. */
  isDarkMode: PropTypes.bool,
};

export default ErrorBoundary;
