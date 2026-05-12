import React, { useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { Link } from "react-router-dom";
import { Mail, Lock, User } from "lucide-react";
import BarcelosRooster from "../components/BarcelosRooster";

const LoginPage = () => {
  const { isDarkMode, showAlert } = useAppContext();
  const [view, setView] = useState("login"); // 'login', 'signup', 'forgot'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleNotImplemented = (e) => {
    e.preventDefault();
    showAlert("error", "This feature isn't implemented yet");
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold outline-none transition-all
    ${
      isDarkMode
        ? "bg-slate-700 border-slate-600 text-white focus:border-yellow-400 placeholder-slate-400"
        : "bg-white border-slate-900 text-slate-900 focus:border-blue-600 placeholder-slate-500"
    }`;

const SocialLogins = () => {
  const { loginGoogle } = useAppContext();
  
  return (
    <div className="mt-8 pt-8 border-t-4 border-dashed border-slate-300 dark:border-slate-700">
      <p className="text-sm font-black uppercase tracking-widest mb-4 opacity-60">
        Or continue with
      </p>
      <div className="flex gap-3">
        <button onClick={loginGoogle} className={`flex-1 py-3 rounded-xl border-4 flex items-center justify-center transition-all active:scale-90 hover:-translate-y-1 ${isDarkMode ? "bg-slate-700 border-slate-600 shadow-[2px_2px_0px_0px_white]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}>
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </button>
        <button onClick={handleNotImplemented} className={`flex-1 py-3 rounded-xl border-4 flex items-center justify-center transition-all active:scale-90 hover:-translate-y-1 ${isDarkMode ? "bg-slate-700 border-slate-600 shadow-[2px_2px_0px_0px_white]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}>
          <svg className={`w-5 h-5 ${isDarkMode ? "fill-white" : "fill-black"}`} viewBox="0 0 24 24">
            <path d="M17.05 20.28c-.96.95-2.12 1.72-3.48 1.72-1.35 0-1.78-.83-3.34-.83-1.57 0-2.03.81-3.33.81-1.32 0-2.54-.81-3.54-1.84-2.04-2.1-3.6-5.91-1.51-9.56 1.04-1.81 2.9-2.95 4.92-2.95 1.54 0 2.61.9 3.55.9.92 0 2.3-.98 4.09-.98 1.83 0 3.48 1.04 4.34 2.58-3.5 2.1-2.94 6.35.6 7.82-.72 1.81-1.62 3.65-2.8 4.83zM12.03 5.36c-.1.01-.2.01-.29.01-1.63 0-3.15-1.36-2.95-2.9.01-.1.02-.2.02-.29 0-1.5 1.3-2.67 2.8-2.67.1 0 .2 0 .29.01 1.73.11 3.01 1.57 2.76 3.1-.03.42-.18.83-.43 1.17-.32.42-.78.83-1.2 1.56z"/>
          </svg>
        </button>
        <button onClick={handleNotImplemented} className={`flex-1 py-3 rounded-xl border-4 flex items-center justify-center transition-all active:scale-90 hover:-translate-y-1 ${isDarkMode ? "bg-slate-700 border-slate-600 shadow-[2px_2px_0px_0px_white]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}>
          <svg className="w-5 h-5 fill-[#1877F2]" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </button>
        <button onClick={handleNotImplemented} className={`flex-1 py-3 rounded-xl border-4 flex items-center justify-center transition-all active:scale-90 hover:-translate-y-1 ${isDarkMode ? "bg-slate-700 border-slate-600 shadow-[2px_2px_0px_0px_white]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}>
          <svg className={`w-4 h-4 ${isDarkMode ? "fill-white" : "fill-black"}`} viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

const renderContent = () => {
    const { loginEmail, registerUser } = useAppContext();

    const handleLogin = async (e) => {
      e.preventDefault();
      await loginEmail(email, password);
    };

    const handleSignup = async (e) => {
      e.preventDefault();
      await registerUser(email, password, name);
    };

    switch (view) {
      case "signup":
        return (
          <>
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">Create Account</h2>
            <p className="font-bold opacity-70 mb-8 italic">Join the flock today!</p>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20}/>
                <input type="text" placeholder="Your Name" className={`${inputClasses} pl-12`} value={name} onChange={(e) => setName(e.target.value)}/>
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20}/>
                <input type="email" placeholder="Email Address" className={`${inputClasses} pl-12`} value={email} onChange={(e) => setEmail(e.target.value)}/>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20}/>
                <input type="password" placeholder="Password" className={`${inputClasses} pl-12`} value={password} onChange={(e) => setPassword(e.target.value)}/>
              </div>
              <button type="submit" className={`w-full py-4 rounded-xl border-4 font-black uppercase transition-all active:scale-95 ${isDarkMode ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark" : "bg-blue-600 border-slate-900 text-white hover-neo-light"}`}>
                Sign Up Now
              </button>
            </form>
            <SocialLogins />
            <p className="mt-6 font-bold">
              Already have an account?{" "}
              <button onClick={() => setView("login")} className="text-blue-600 underline">Login</button>
            </p>
          </>
        );
      case "forgot":
        return (
          <>
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">Lost your way?</h2>
            <p className="font-bold opacity-70 mb-8 italic">We'll help you get back to the nest.</p>
            <form onSubmit={handleNotImplemented} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20}/>
                <input type="email" placeholder="Email Address" className={`${inputClasses} pl-12`} value={email} onChange={(e) => setEmail(e.target.value)}/>
              </div>
              <button type="submit" className={`w-full py-4 rounded-xl border-4 font-black uppercase transition-all active:scale-95 ${isDarkMode ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark" : "bg-rose-500 border-slate-900 text-white hover-neo-light"}`}>
                Reset Password
              </button>
            </form>
            <button onClick={() => setView("login")} className="mt-6 font-bold flex items-center text-blue-600 mx-auto">
              ← Back to Login
            </button>
          </>
        );
      default:
        return (
          <>
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">Welcome Back</h2>
            <p className="font-bold opacity-70 mb-8 italic">Ready for some Portuguese?</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20}/>
                <input type="email" placeholder="Email Address" className={`${inputClasses} pl-12`} value={email} onChange={(e) => setEmail(e.target.value)}/>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20}/>
                <input type="password" placeholder="Password" className={`${inputClasses} pl-12`} value={password} onChange={(e) => setPassword(e.target.value)}/>
              </div>
              <div className="text-right">
                <button type="button" onClick={() => setView("forgot")} className="font-bold text-sm opacity-70 hover:opacity-100 underline">
                  Forgot Password?
                </button>
              </div>
              <button type="submit" className={`w-full py-4 rounded-xl border-4 font-black uppercase transition-all active:scale-95 ${isDarkMode ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark" : "bg-blue-600 border-slate-900 text-white hover-neo-light"}`}>
                Log In
              </button>
            </form>
            <SocialLogins />
            <p className="mt-6 font-bold">
              New here?{" "}
              <button onClick={() => setView("signup")} className="text-blue-600 underline">Sign Up</button>
            </p>
          </>
        );
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center py-20 px-4">
      <div className={`max-w-md w-full p-8 md:p-12 rounded-[2.5rem] border-4 transition-all text-center ${isDarkMode ? "bg-slate-800 border-slate-700 text-white shadow-[12px_12px_0px_0px_#facc15]" : "bg-white border-slate-900 text-slate-900 shadow-[12px_12px_0px_0px_#0f172a]"}`}>
        <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl border-4 border-slate-900 flex items-center justify-center neo-shadow-light -rotate-6">
          <BarcelosRooster className="w-16 h-16" />
        </div>
        {renderContent()}
        <div className="mt-8 pt-6 border-t-2 border-slate-200 dark:border-slate-700">
          <Link to="/" className="font-bold flex items-center justify-center text-blue-600 mx-auto">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;