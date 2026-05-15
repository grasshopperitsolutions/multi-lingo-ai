import { useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BarcelosRooster from "../components/BarcelosRooster";
import Loader from "../components/Loader";

const LoginPage = () => {
  const { isDarkMode, showAlert, loginGoogle } = useAppContext();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleNotImplemented = (e) => {
    e.preventDefault();
    showAlert("error", "This sign-in method isn't available yet — check back soon!");
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await loginGoogle();
      if (result?.success) {
        navigate("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Full-screen loader overlay during sign-in */}
      {isLoading && (
        <Loader
          fullScreen
          message="Signing in with Google…"
          isDarkMode={isDarkMode}
        />
      )}

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        {/* Back Home arrow — matches Settings page pattern */}
        <div className="w-full max-w-md mb-4">
          <button
            onClick={() => navigate("/")}
            disabled={isLoading}
            className={`flex items-center gap-2 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1 disabled:opacity-40 disabled:pointer-events-none
              ${
                isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
          >
            <ArrowLeft size={16} />
            Back Home
          </button>
        </div>

        {/* Login card */}
        <div
          className={`w-full max-w-md rounded-3xl border-4 p-10 transition-colors
          ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 shadow-[8px_8px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 shadow-[8px_8px_0px_0px_#0f172a]"
          }`}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center border-4 border-slate-900 shadow-[4px_4px_0px_0px_#facc15]">
              <BarcelosRooster className="w-14 h-14" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-4xl font-black uppercase tracking-tighter text-center mb-2">
            Sign In
          </h1>
          <p className="text-center font-bold opacity-60 mb-10 italic">
            Choose your preferred sign-in method to continue.
          </p>

          {/* Social Buttons — icon-only, horizontal row */}
          <div className="flex flex-row justify-center gap-4">
            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={isLoading}
              aria-label="Continue with Google"
              className={`w-16 h-16 flex items-center justify-center rounded-xl border-4 transition-all active:scale-95 hover:-translate-y-1 disabled:opacity-40 disabled:pointer-events-none
              ${
                isDarkMode
                  ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>

            {/* Apple */}
            <button
              onClick={handleNotImplemented}
              disabled={isLoading}
              aria-label="Continue with Apple"
              className={`w-16 h-16 flex items-center justify-center rounded-xl border-4 transition-all active:scale-95 hover:-translate-y-1 disabled:opacity-40 disabled:pointer-events-none
              ${
                isDarkMode
                  ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <svg className={`w-6 h-6 shrink-0 ${isDarkMode ? "fill-white" : "fill-black"}`} viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.96.95-2.12 1.72-3.48 1.72-1.35 0-1.78-.83-3.34-.83-1.57 0-2.03.81-3.33.81-1.32 0-2.54-.81-3.54-1.84-2.04-2.1-3.6-5.91-1.51-9.56 1.04-1.81 2.9-2.95 4.92-2.95 1.54 0 2.61.9 3.55.9.92 0 2.3-.98 4.09-.98 1.83 0 3.48 1.04 4.34 2.58-3.5 2.1-2.94 6.35.6 7.82-.72 1.81-1.62 3.65-2.8 4.83zM12.03 5.36c-.1.01-.2.01-.29.01-1.63 0-3.15-1.36-2.95-2.9.01-.1.02-.2.02-.29 0-1.5 1.3-2.67 2.8-2.67.1 0 .2 0 .29.01 1.73.11 3.01 1.57 2.76 3.1-.03.42-.18.83-.43 1.17-.32.42-.78.83-1.2 1.56z"/>
              </svg>
            </button>

            {/* Facebook */}
            <button
              onClick={handleNotImplemented}
              disabled={isLoading}
              aria-label="Continue with Facebook"
              className={`w-16 h-16 flex items-center justify-center rounded-xl border-4 transition-all active:scale-95 hover:-translate-y-1 disabled:opacity-40 disabled:pointer-events-none
              ${
                isDarkMode
                  ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <svg className="w-6 h-6 shrink-0 fill-[#1877F2]" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>

            {/* X / Twitter */}
            <button
              onClick={handleNotImplemented}
              disabled={isLoading}
              aria-label="Continue with X"
              className={`w-16 h-16 flex items-center justify-center rounded-xl border-4 transition-all active:scale-95 hover:-translate-y-1 disabled:opacity-40 disabled:pointer-events-none
              ${
                isDarkMode
                  ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <svg className={`w-5 h-5 shrink-0 ${isDarkMode ? "fill-white" : "fill-black"}`} viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </button>
          </div>

          {/* Footer note */}
          <p className="mt-10 text-center text-sm font-bold opacity-50">
            By signing in you agree to our{" "}
            <Link to="/terms" className="underline hover:opacity-100">Terms</Link>
            {" "}&amp;{" "}
            <Link to="/privacy" className="underline hover:opacity-100">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
