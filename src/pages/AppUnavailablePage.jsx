// `Link` / `Home` are commented out with the "Return to Home" button below —
// if the app is unavailable there is no working home to go back to, so the
// button is hidden on purpose. Uncomment all three when restoring the button.
// import { Link } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
// import { Home } from "lucide-react";
import { AlertTriangle } from "lucide-react";

const AppUnavailablePage = () => {
  const { isDarkMode } = useAppContext();

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-4 transition-colors duration-500
        ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-blue-50 text-slate-900"}`}
    >
      <div
        className={`p-8 rounded-[2rem] border-4 max-w-md w-full text-center space-y-6
          ${isDarkMode
            ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
            : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
          }`}
      >
        <div className="flex justify-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center border-4
              ${isDarkMode
                ? "bg-slate-700 border-amber-400 text-amber-400"
                : "bg-amber-100 border-amber-500 text-amber-600"
              }`}
          >
            <AlertTriangle size={40} />
          </div>
        </div>

        <h1 className={`text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          App Unavailable
        </h1>

        <p className={`font-bold text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          The application is temporarily unavailable. This may be due to a
          network issue or the service is undergoing maintenance.
        </p>

        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          Please try again later.
        </p>

        {/* "Return to Home" button deliberately hidden — the app being
            unavailable means there is no working home to navigate to, and
            sending users back in would just show them a broken app. They
            should wait for the service to be restored instead. The button
            is commented out, not deleted, so it can be restored easily:

        <Link
          to="/"
          className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-lg transition-all active:scale-95 hover:-translate-y-1
            ${isDarkMode
              ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[6px_6px_0px_0px_#854d0e]"
              : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
            }`}
        >
          <Home size={20} />
          Return to Home
        </Link>
        */}
      </div>
    </div>
  );
};

export default AppUnavailablePage;