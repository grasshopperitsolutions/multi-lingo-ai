import { Component } from "react";
import PropTypes from "prop-types";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import i18n from "../i18n";
import { Sentry } from "../sentry";
import { isChunkLoadError, isReloadPending, reloadForNewVersion } from "../utils/staleDeploy";

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
    // `updating`: the error is an old copy of the app asking for a file a newer
    // deploy removed, and a reload for the new version is under way.
    this.state = { error: null, updating: false, resetKey: props.resetKey };
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
    return { error: null, updating: false, resetKey: props.resetKey };
  }

  componentDidCatch(error, info) {
    // A stale copy of the app, not a crash: reload once for the new version
    // (utils/staleDeploy). Either main.jsx already started that reload and
    // React tripped over the import it cancelled, or this is the first sign
    // of it. Nothing to report to Sentry either way. If the reload is refused
    // because it was just tried, the deploy itself is broken, and that falls
    // through to the normal screen and the report below.
    if (isReloadPending() || (isChunkLoadError(error) && reloadForNewVersion())) {
      this.setState({ updating: true });
      return;
    }

    console.error("[ErrorBoundary] Uncaught render error:", error, info?.componentStack);

    // React swallows the error once a boundary handles it, so without this
    // the crash never reaches Sentry's global handler — a caught error is
    // invisible unless the boundary reports it itself. The component stack
    // is the part that makes it diagnosable: it names the component that
    // threw, which a minified call stack alone does not.
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info?.componentStack } },
    });
  }

  handleRetry = () => this.setState({ error: null });

  handleReload = () => window.location.reload();

  render() {
    const { error, updating } = this.state;
    const { children, isDarkMode } = this.props;

    if (!error) return children;

    const isDark = isDarkMode ?? savedThemeIsDark();

    if (updating) {
      return (
        <div
          className={`min-h-screen flex flex-col items-center justify-center px-4
            ${isDark ? "bg-slate-900 text-slate-100" : "bg-blue-50 text-slate-900"}`}
          role="status"
        >
          <div
            className={`p-8 rounded-[2rem] border-4 max-w-md w-full text-center space-y-4
              ${isDark
                ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
              }`}
          >
            <RefreshCw size={40} className={`mx-auto motion-safe:animate-spin ${isDark ? "text-yellow-400" : "text-blue-600"}`} />
            <h1 className={`text-2xl font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>
              {safeT("error_boundary.updating_title", "A atualizar")}
            </h1>
            <p className={`font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {safeT("error_boundary.updating_message", "Há uma versão nova da aplicação. Só um momento enquanto a carregamos.")}
            </p>
          </div>
        </div>
      );
    }

    // A file that is still missing after a reload: trying the render again
    // can't fetch it (React keeps the failed import), only a reload can.
    const canRetry = !isChunkLoadError(error);

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
            {canRetry && (
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
            )}

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
