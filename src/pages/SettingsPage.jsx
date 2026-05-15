import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import NeoDropdown from "../components/NeoDropdown";
import {
  ArrowLeft,
  User,
  Mail,
  Sun,
  Moon,
  Globe,
  Save,
  LogOut,
  Trash2,
} from "lucide-react";
import { updateUserProfile } from "../services/userService";
import { auth } from "../firebase";

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

// Fully controlled — no internal state, no useEffect.
// All values come from SettingsPage which re-renders whenever context user updates.
const SettingsForm = ({
  user,
  isDarkMode,
  displayName,
  setDisplayName,
  interfaceLang,
  setInterfaceLang,
  draftDarkMode,
  setDraftDarkMode,
  isSaving,
  handleSave,
}) => {
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
    <form onSubmit={handleSave}>
      {/* Profile Section */}
      <div className={sectionClasses}>
        <h2
          className={`text-lg font-black uppercase tracking-widest mb-6 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          Profile
        </h2>

        <div className="space-y-5">
          <div>
            <label className={labelClasses}>
              <User size={12} className="inline mr-1" /> Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClasses}
              placeholder="Your display name"
            />
          </div>
          <div>
            <label className={labelClasses}>
              <Mail size={12} className="inline mr-1" /> Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className={`${inputClasses} opacity-50 cursor-not-allowed`}
            />
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className={sectionClasses}>
        <h2
          className={`text-lg font-black uppercase tracking-widest mb-6 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          Appearance
        </h2>

        <div className="space-y-5">
          <div>
            <label className={labelClasses}>
              {draftDarkMode ? (
                <Moon size={12} className="inline mr-1" />
              ) : (
                <Sun size={12} className="inline mr-1" />
              )}
              App Theme
            </label>
            <button
              type="button"
              onClick={() => setDraftDarkMode(!draftDarkMode)}
              className={`w-full flex items-center justify-between px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 ${
                draftDarkMode
                  ? "bg-slate-700 border-yellow-400 text-yellow-400 shadow-[4px_4px_0px_0px_#ca8a04]"
                  : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <span>{draftDarkMode ? "Dark Mode" : "Light Mode"}</span>
              {draftDarkMode ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>

          <div>
            <label className={labelClasses}>
              <Globe size={12} className="inline mr-1" /> Interface Language
            </label>
            <NeoDropdown
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
        className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-lg transition-all active:scale-95 mb-6 ${
          isSaving
            ? "opacity-60 cursor-not-allowed bg-slate-400 border-slate-500 text-white"
            : isDarkMode
              ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a] hover:-translate-y-1"
              : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a] hover:-translate-y-1"
        }`}
      >
        <Save size={20} />
        {isSaving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
};

SettingsForm.propTypes = {
  user: PropTypes.shape({
    uid: PropTypes.string,
    email: PropTypes.string,
    displayName: PropTypes.string,
    interfaceLang: PropTypes.string,
  }),
  isDarkMode: PropTypes.bool.isRequired,
  displayName: PropTypes.string.isRequired,
  setDisplayName: PropTypes.func.isRequired,
  interfaceLang: PropTypes.string.isRequired,
  setInterfaceLang: PropTypes.func.isRequired,
  draftDarkMode: PropTypes.bool.isRequired,
  setDraftDarkMode: PropTypes.func.isRequired,
  isSaving: PropTypes.bool.isRequired,
  handleSave: PropTypes.func.isRequired,
};

const SettingsPage = () => {
  const {
    isDarkMode,
    setIsDarkMode,
    user,
    logoutUser,
    showAlert,
    refreshUser,
  } = useAppContext();
  const navigate = useNavigate();

  // Lifted form state — initialised from context user at render time.
  // SettingsPage re-renders whenever context user updates, so these are
  // always fresh without needing a useEffect sync.
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [interfaceLang, setInterfaceLang] = useState(user?.interfaceLang || "en");
  // draftDarkMode: local copy of theme that the toggle mutates.
  // Only committed to global context on successful save.
  const [draftDarkMode, setDraftDarkMode] = useState(isDarkMode);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) {
        showAlert("error", "You must be signed in to save settings.");
        return;
      }
      const token = await firebaseUser.getIdToken();
      await updateUserProfile(token, firebaseUser.uid, {
        displayName,
        interfaceLang,
        theme: draftDarkMode ? "dark" : "light",
      });
      // Commit draft theme to global context only after a successful save
      setIsDarkMode(draftDarkMode);
      await refreshUser();
      showAlert("success", "Settings saved successfully!");
    } catch (err) {
      const isNetwork =
        err instanceof TypeError && err.message === "Failed to fetch";
      showAlert(
        "error",
        isNetwork
          ? "Could not reach the server. Please check your connection and try again."
          : err.message || "Failed to save settings. Please try again.",
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

  const sectionClasses = `p-8 rounded-[2rem] border-4 mb-6
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
      <button
        onClick={() => navigate("/dashboard")}
        className={`flex items-center gap-2 mb-8 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1 ${
          isDarkMode
            ? "text-slate-400 hover:text-white"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <h1
        className={`text-4xl font-black uppercase tracking-tighter mb-8 ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        Settings
      </h1>

      <SettingsForm
        user={user}
        isDarkMode={isDarkMode}
        displayName={displayName}
        setDisplayName={setDisplayName}
        interfaceLang={interfaceLang}
        setInterfaceLang={setInterfaceLang}
        draftDarkMode={draftDarkMode}
        setDraftDarkMode={setDraftDarkMode}
        isSaving={isSaving}
        handleSave={handleSave}
      />

      {/* Account Actions */}
      <div className={sectionClasses}>
        <h2
          className={`text-lg font-black uppercase tracking-widest mb-6 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          Account
        </h2>
        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 ${
              isDarkMode
                ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b] hover:bg-slate-600"
                : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:bg-slate-100"
            }`}
          >
            <LogOut size={18} />
            Sign Out
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 border-rose-500 font-black uppercase tracking-widest text-rose-500 transition-all active:scale-95 hover:bg-rose-500 hover:text-white shadow-[4px_4px_0px_0px_#f43f5e]"
          >
            <Trash2 size={18} />
            Delete Account
          </button>
        </div>
      </div>
    </main>
  );
};

export default SettingsPage;
