import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  { value: "pt-PT", label: "Portuguese" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];

// Placeholder SVG shown when photoURL is unavailable
const AvatarPlaceholder = ({ size = 64, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="32" cy="32" r="32" fill="#e2e8f0" />
    <circle cx="32" cy="26" r="10" fill="#94a3b8" />
    <ellipse cx="32" cy="50" rx="16" ry="10" fill="#94a3b8" />
  </svg>
);

AvatarPlaceholder.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

// Fully controlled — no internal state, no useEffect.
// All values come from SettingsPage which syncs whenever context user updates.
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
  const { t } = useTranslation();

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
          {t("settings.profile")}
        </h2>

        {/* Avatar preview */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "Profile photo"}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full border-4 border-slate-900 object-cover shadow-[3px_3px_0px_0px_#facc15]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-4 border-slate-900 overflow-hidden shadow-[3px_3px_0px_0px_#facc15]">
                <AvatarPlaceholder size={64} />
              </div>
            )}
          </div>
          <div>
            <p className={`font-black text-base ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
              {user?.displayName || "—"}
            </p>
            <p className={`text-xs font-bold uppercase tracking-widest ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
              {user?.email || ""}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className={labelClasses}>
              <User size={12} className="inline mr-1" /> {t("settings.display_name")}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClasses}
              placeholder={t("settings.display_name_placeholder")}
            />
          </div>
          <div>
            <label className={labelClasses}>
              <Mail size={12} className="inline mr-1" /> {t("settings.email")}
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
          {t("settings.appearance")}
        </h2>

        <div className="space-y-5">
          <div>
            <label className={labelClasses}>
              {draftDarkMode ? (
                <Moon size={12} className="inline mr-1" />
              ) : (
                <Sun size={12} className="inline mr-1" />
              )}
              {t("settings.app_theme")}
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
              <span>{draftDarkMode ? t("settings.dark_mode") : t("settings.light_mode")}</span>
              {draftDarkMode ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>

          <div>
            <label className={labelClasses}>
              <Globe size={12} className="inline mr-1" /> {t("settings.interface_language")}
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
        {isSaving ? t("settings.saving") : t("settings.save_settings")}
      </button>
    </form>
  );
};

SettingsForm.propTypes = {
  user: PropTypes.shape({
    uid: PropTypes.string,
    email: PropTypes.string,
    displayName: PropTypes.string,
    photoURL: PropTypes.string,
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
    changeLanguage,
  } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [interfaceLang, setInterfaceLang] = useState(
    user?.interfaceLang || "en",
  );
  // draftDarkMode: local copy of theme that the toggle mutates.
  // Only committed to global context on successful save.
  const [draftDarkMode, setDraftDarkMode] = useState(isDarkMode);
  const [isSaving, setIsSaving] = useState(false);

  // Track a composite key of all context values that should reset the form.
  // When any of these change (e.g. async profile load resolves, header theme toggle),
  // we adjust state during render — the pattern React docs recommend instead of
  // calling setState inside an effect.
  const [prevSyncKey, setPrevSyncKey] = useState("");
  const syncKey = `${user?.uid || ""}-${user?.displayName || ""}-${user?.interfaceLang || ""}-${isDarkMode}`;
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (user?.displayName) setDisplayName(user.displayName);
    if (user?.interfaceLang) setInterfaceLang(user.interfaceLang);
    setDraftDarkMode(isDarkMode);
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) {
        showAlert("error", t("settings.errors.not_signed_in"));
        return;
      }
      const token = await firebaseUser.getIdToken();
      await updateUserProfile(token, firebaseUser.uid, {
        displayName,
        interfaceLang,
        theme: draftDarkMode ? "dark" : "light",
      });
      // Apply language and theme changes immediately to UI
      changeLanguage(interfaceLang);
      setIsDarkMode(draftDarkMode);
      await refreshUser();
      showAlert("success", t("settings.success_message"));
    } catch (err) {
      const isNetwork =
        err instanceof TypeError && err.message === "Failed to fetch";
      showAlert(
        "error",
        isNetwork
          ? t("settings.errors.network_error")
          : t("settings.errors.save_failed"),
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
    showAlert("error", t("settings.delete_not_implemented"));
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
        {t("settings.back_to_dashboard")}
      </button>

      <h1
        className={`text-4xl font-black uppercase tracking-tighter mb-8 ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        {t("settings.title")}
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
          {t("settings.account")}
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
            {t("settings.sign_out")}
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 border-rose-500 font-black uppercase tracking-widest text-rose-500 transition-all active:scale-95 hover:bg-rose-500 hover:text-white shadow-[4px_4px_0px_0px_#f43f5e]"
          >
            <Trash2 size={18} />
            {t("settings.delete_account")}
          </button>
        </div>
      </div>
    </main>
  );
};

export default SettingsPage;