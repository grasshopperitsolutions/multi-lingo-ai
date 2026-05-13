import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import NeoDropdown from "../components/NeoDropdown";
import { ArrowLeft, User, Mail, Sun, Moon, Globe, Save, LogOut, Trash2 } from "lucide-react";
import { updateUserProfile } from "../services/userService";
import { getCurrentUser } from "../services/authService";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "pt", label: "Portuguese" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "zh", label: "Mandarin" },
  { value: "ja", label: "Japanese" },
  { value: "ar", label: "Arabic" },
];

const SettingsPage = () => {
  const { isDarkMode, setIsDarkMode, user, logoutUser, showAlert, refreshUser } = useAppContext();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [interfaceLang, setInterfaceLang] = useState(user?.interfaceLang || "en");
  const [isSaving, setIsSaving] = useState(false);

  // Sync form fields if context user updates after initial render
  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
    if (user?.interfaceLang) setInterfaceLang(user.interfaceLang);
  }, [user?.displayName, user?.interfaceLang]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const authUser = await getCurrentUser();
      if (!authUser?.token || !authUser?.uid) {
        showAlert("error", "You must be signed in to save settings.");
        return;
      }

      await updateUserProfile(authUser.token, authUser.uid, {
        displayName,
        interfaceLang,
        theme: isDarkMode ? "dark" : "light",
      });

      // Sync updated profile back into context
      await refreshUser();
      showAlert("success", "Settings saved successfully!");
    } catch (err) {
      const isNetwork = err instanceof TypeError && err.message === 'Failed to fetch';
      showAlert(
        "error",
        isNetwork
          ? "Could not reach the server. Please check your connection and try again."
          : err.message || "Failed to save settings. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) {
      navigate("/");
    }
  };

  const handleDeleteAccount = () => {
    showAlert("error", "Account deletion isn't implemented yet.");
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold outline-none transition-all
    ${
      isDarkMode
        ? "bg-slate-700 border-slate-600 text-white focus:border-yellow-400 placeholder-slate-400"
        : "bg-white border-slate-900 text-slate-900 focus:border-blue-600 placeholder-slate-400"
    }`;

  const sectionClasses = `p-8 rounded-[2rem] border-4 mb-6
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  const labelClasses = `block font-black uppercase text-xs tracking-widest mb-2 ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;

  return (
    <main className="flex-grow px-4 md:px-8 py-10 max-w-2xl mx-auto w-full">
      {/* Back navigation */}
      <button
        onClick={() => navigate("/dashboard")}
        className={`flex items-center gap-2 mb-8 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1 active:scale-95
        ${
          isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <h1 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter mb-8 ${
        isDarkMode ? "text-white" : "text-slate-900"
      }`}>
        Settings
      </h1>

      <form onSubmit={handleSave}>
        {/* Profile Section */}
        <div className={sectionClasses}>
          <h2 className={`text-lg font-black uppercase tracking-widest mb-6 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}>
            Profile
          </h2>
          <div className="space-y-5">
            <div>
              <label className={labelClasses}>
                <User size={12} className="inline mr-1" />
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>
                <Mail size={12} className="inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className={`${inputClasses} opacity-50 cursor-not-allowed`}
              />
              <p className={`text-xs font-bold mt-1 ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}>
                Email cannot be changed
              </p>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className={sectionClasses}>
          <h2 className={`text-lg font-black uppercase tracking-widest mb-6 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}>
            Preferences
          </h2>
          <div className="space-y-6">
            {/* Theme toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-black uppercase text-sm tracking-widest ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}>
                  App Theme
                </p>
                <p className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}>
                  {isDarkMode ? "Dark Mode" : "Light Mode"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-3 rounded-full border-4 transition-all active:scale-95 hover:scale-110
                ${
                  isDarkMode
                    ? "bg-slate-700 border-yellow-400 shadow-[3px_3px_0px_0px_#fbbf24]"
                    : "bg-yellow-400 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                }`}
              >
                {isDarkMode ? (
                  <Sun size={20} className="text-yellow-400" />
                ) : (
                  <Moon size={20} className="text-slate-900" />
                )}
              </button>
            </div>

            {/* Interface Language */}
            <div>
              <NeoDropdown
                label="Interface Language"
                icon={Globe}
                options={LANGUAGE_OPTIONS}
                value={interfaceLang}
                onChange={setInterfaceLang}
                isDarkMode={isDarkMode}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className={`w-full py-4 rounded-xl border-4 font-black uppercase tracking-widest text-base transition-all active:scale-95 hover:-translate-y-1 flex items-center justify-center gap-3 mb-6
          ${
            isSaving
              ? "opacity-60 cursor-not-allowed bg-yellow-400 border-slate-900 text-slate-900"
              : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:shadow-[6px_6px_0px_0px_#0f172a]"
          }`}
        >
          <Save size={18} />
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* Account Actions */}
      <div className={sectionClasses}>
        <h2 className={`text-lg font-black uppercase tracking-widest mb-6 ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}>
          Account
        </h2>
        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 hover:-translate-y-0.5
            ${
              isDarkMode
                ? "bg-slate-700 border-slate-600 text-white hover:border-rose-500 shadow-[3px_3px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 text-slate-900 hover:border-rose-500 shadow-[3px_3px_0px_0px_#0f172a]"
            }`}
          >
            <span className="flex items-center gap-3"><LogOut size={16} /> Sign Out</span>
            <ArrowLeft size={16} className="rotate-180" />
          </button>

          {/* Danger Zone */}
          <div className={`mt-4 pt-4 border-t-4 border-dashed ${
            isDarkMode ? "border-slate-700" : "border-slate-200"
          }`}>
            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${
              isDarkMode ? "text-rose-400" : "text-rose-500"
            }`}>
              Danger Zone
            </p>
            <button
              onClick={handleDeleteAccount}
              className="w-full flex items-center justify-between px-5 py-4 rounded-xl border-4 border-rose-500 font-black uppercase tracking-widest text-sm text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95 hover:-translate-y-0.5 shadow-[3px_3px_0px_0px_#f43f5e]"
            >
              <span className="flex items-center gap-3"><Trash2 size={16} /> Delete Account</span>
              <ArrowLeft size={16} className="rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default SettingsPage;
