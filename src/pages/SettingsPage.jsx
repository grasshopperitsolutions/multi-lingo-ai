import { useState, useRef } from "react";
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
  Camera,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { updateUserProfile, uploadProfileImage, deleteAccount } from "../services/userService";
import { auth } from "../firebase";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "pt-PT", label: "Portuguese" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];

// ── Placeholder SVG ──────────────────────────────────────────────────────────
const AvatarPlaceholder = ({ size = 64, className = "" }) => (
  <svg
    width={size} height={size} viewBox="0 0 64 64"
    fill="none" xmlns="http://www.w3.org/2000/svg"
    className={className} aria-hidden="true"
  >
    <circle cx="32" cy="32" r="32" fill="#e2e8f0" />
    <circle cx="32" cy="26" r="10" fill="#94a3b8" />
    <ellipse cx="32" cy="50" rx="16" ry="10" fill="#94a3b8" />
  </svg>
);
AvatarPlaceholder.propTypes = { size: PropTypes.number, className: PropTypes.string };

// ── Delete Confirmation Modal ─────────────────────────────────────────────────
const DeleteModal = ({ isDarkMode, onConfirm, onCancel, isDeleting }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"
  >
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    />
    {/* Panel */}
    <div className={`relative z-10 w-full max-w-md p-8 rounded-[2rem] border-4 shadow-[8px_8px_0px_0px_#f43f5e]
      ${ isDarkMode ? "bg-slate-800 border-rose-500" : "bg-white border-rose-500" }`}>

      <button
        onClick={onCancel}
        aria-label="Close"
        className={`absolute top-5 right-5 p-1 rounded-lg transition-colors
          ${ isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900" }`}
      >
        <X size={20} />
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-rose-500 border-4 border-slate-900 flex items-center justify-center shrink-0">
          <AlertTriangle size={24} className="text-white" />
        </div>
        <h2
          id="delete-modal-title"
          className={`text-xl font-black uppercase tracking-tight
            ${ isDarkMode ? "text-white" : "text-slate-900" }`}
        >
          Delete Account
        </h2>
      </div>

      <p className={`font-semibold leading-relaxed mb-4
        ${ isDarkMode ? "text-slate-300" : "text-slate-700" }`}>
        This will <strong>permanently delete</strong> your account and all associated data
        — including your profile, uploaded files, and conversation history.
      </p>
      <p className={`text-sm font-bold uppercase tracking-widest mb-8
        ${ isDarkMode ? "text-rose-400" : "text-rose-600" }`}>
        ⚠ This action cannot be undone.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-4 border-rose-500
            bg-rose-500 text-white font-black uppercase tracking-widest transition-all active:scale-95
            hover:bg-rose-600 hover:border-rose-600 shadow-[4px_4px_0px_0px_#be123c]
            disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isDeleting ? (
            <><Loader2 size={18} className="animate-spin" /> Deleting&hellip;</>
          ) : (
            <><Trash2 size={18} /> Yes, delete my account</>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95
            ${ isDarkMode
              ? "bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              : "bg-white border-slate-900 text-slate-900 hover:bg-slate-100"
            } shadow-[4px_4px_0px_0px_#0f172a] disabled:opacity-60`}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);
DeleteModal.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isDeleting: PropTypes.bool.isRequired,
};

// ── Avatar Upload Widget ──────────────────────────────────────────────────────
const AvatarUpload = ({ user, isDarkMode, previewUrl, onFileSelect, isUploading }) => {
  const fileInputRef = useRef(null);
  const displaySrc = previewUrl || user?.photoURL;

  return (
    <div className="flex items-center gap-5 mb-6">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Change profile photo"
        className="relative shrink-0 group focus:outline-none"
      >
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full border-4 border-slate-900 overflow-hidden shadow-[4px_4px_0px_0px_#facc15]">
          {displaySrc ? (
            <img
              src={displaySrc}
              alt={user?.displayName || "Profile photo"}
              className="w-full h-full object-cover"
            />
          ) : (
            <AvatarPlaceholder size={80} />
          )}
        </div>

        {/* Overlay — camera icon on hover or while uploading */}
        <div className={`absolute inset-0 rounded-full flex items-center justify-center
          transition-opacity duration-200
          ${ isUploading ? "opacity-100 bg-black/50" : "opacity-0 group-hover:opacity-100 bg-black/40" }`}>
          {isUploading
            ? <Loader2 size={24} className="text-white animate-spin" />
            : <Camera size={22} className="text-white" />
          }
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          // Reset so re-selecting same file still fires onChange
          e.target.value = "";
        }}
      />

      <div>
        <p className={`font-black text-base ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
          {user?.displayName || "—"}
        </p>
        <p className={`text-xs font-bold uppercase tracking-widest ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
          {user?.email || ""}
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`mt-1 text-xs font-black uppercase tracking-widest underline transition-colors
            ${ isDarkMode ? "text-yellow-400 hover:text-yellow-300" : "text-blue-600 hover:text-blue-800" }`}
        >
          Change photo
        </button>
      </div>
    </div>
  );
};
AvatarUpload.propTypes = {
  user: PropTypes.shape({
    photoURL: PropTypes.string,
    displayName: PropTypes.string,
    email: PropTypes.string,
  }),
  isDarkMode: PropTypes.bool.isRequired,
  previewUrl: PropTypes.string,
  onFileSelect: PropTypes.func.isRequired,
  isUploading: PropTypes.bool.isRequired,
};

// ── Settings Form ─────────────────────────────────────────────────────────────
const SettingsForm = ({
  user, isDarkMode,
  displayName, setDisplayName,
  interfaceLang, setInterfaceLang,
  draftDarkMode, setDraftDarkMode,
  isSaving, isUploading, handleSave,
  previewUrl, onFileSelect,
}) => {
  const { t } = useTranslation();

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold outline-none transition-all
    ${ isDarkMode
      ? "bg-slate-700 border-slate-600 text-white focus:border-yellow-400 placeholder-slate-400"
      : "bg-white border-slate-900 text-slate-900 focus:border-blue-600 placeholder-slate-400"
    }`;

  const sectionClasses = `p-8 rounded-[2rem] border-4 mb-6
    ${ isDarkMode
      ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
      : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  const labelClasses = `block font-black uppercase text-xs tracking-widest mb-2
    ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`;

  const isBusy = isSaving || isUploading;

  return (
    <form onSubmit={handleSave}>
      {/* Profile */}
      <div className={sectionClasses}>
        <h2 className={`text-lg font-black uppercase tracking-widest mb-6 ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
          {t("settings.profile")}
        </h2>

        <AvatarUpload
          user={user}
          isDarkMode={isDarkMode}
          previewUrl={previewUrl}
          onFileSelect={onFileSelect}
          isUploading={isUploading}
        />

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

      {/* Appearance */}
      <div className={sectionClasses}>
        <h2 className={`text-lg font-black uppercase tracking-widest mb-6 ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
          {t("settings.appearance")}
        </h2>
        <div className="space-y-5">
          <div>
            <label className={labelClasses}>
              {draftDarkMode ? <Moon size={12} className="inline mr-1" /> : <Sun size={12} className="inline mr-1" />}
              {t("settings.app_theme")}
            </label>
            <button
              type="button"
              onClick={() => setDraftDarkMode(!draftDarkMode)}
              className={`w-full flex items-center justify-between px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95
                ${ draftDarkMode
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

      {/* Save */}
      <button
        type="submit"
        disabled={isBusy}
        className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-lg transition-all active:scale-95 mb-6
          ${ isBusy
            ? "opacity-60 cursor-not-allowed bg-slate-400 border-slate-500 text-white"
            : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a] hover:-translate-y-1"
          }`}
      >
        {isBusy
          ? <><Loader2 size={20} className="animate-spin" /> {isUploading ? "Uploading..." : t("settings.saving")}</>
          : <><Save size={20} /> {t("settings.save_settings")}</>
        }
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
  isUploading: PropTypes.bool.isRequired,
  handleSave: PropTypes.func.isRequired,
  previewUrl: PropTypes.string,
  onFileSelect: PropTypes.func.isRequired,
};

// ── Settings Page ─────────────────────────────────────────────────────────────
const SettingsPage = () => {
  const { isDarkMode, setIsDarkMode, user, logoutUser, showAlert, refreshUser, changeLanguage } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [interfaceLang, setInterfaceLang] = useState(user?.interfaceLang || "en");
  const [draftDarkMode, setDraftDarkMode] = useState(isDarkMode);
  const [isSaving, setIsSaving] = useState(false);

  // Avatar upload state
  const [pendingFile, setPendingFile] = useState(null);      // File object waiting to be saved
  const [previewUrl, setPreviewUrl] = useState(null);        // Local blob URL for preview
  const [isUploading, setIsUploading] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync form when context user changes (same pattern as before)
  const [prevSyncKey, setPrevSyncKey] = useState("");
  const syncKey = `${user?.uid || ""}-${user?.displayName || ""}-${user?.interfaceLang || ""}-${isDarkMode}`;
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (user?.displayName) setDisplayName(user.displayName);
    if (user?.interfaceLang) setInterfaceLang(user.interfaceLang);
    setDraftDarkMode(isDarkMode);
  }

  const handleFileSelect = (file) => {
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      showAlert("error", t("settings.errors.not_signed_in"));
      return;
    }
    const token = await firebaseUser.getIdToken();

    try {
      // Upload image first if one was selected
      if (pendingFile) {
        setIsUploading(true);
        try {
          await uploadProfileImage(token, firebaseUser.uid, pendingFile);
          setPendingFile(null);
          setPreviewUrl(null);
        } catch  {
          showAlert("error", "Failed to upload profile image. Please try again.");
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // Save text fields
      setIsSaving(true);
      await updateUserProfile(token, firebaseUser.uid, {
        displayName,
        interfaceLang,
        theme: draftDarkMode ? "dark" : "light",
      });
      changeLanguage(interfaceLang);
      setIsDarkMode(draftDarkMode);
      await refreshUser();
      showAlert("success", t("settings.success_message"));
    } catch (err) {
      const isNetwork = err instanceof TypeError && err.message === "Failed to fetch";
      showAlert("error", isNetwork ? t("settings.errors.network_error") : t("settings.errors.save_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) navigate("/");
  };

  const handleDeleteConfirm = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;
    setIsDeleting(true);
    try {
      const token = await firebaseUser.getIdToken();
      await deleteAccount(token);
      await logoutUser();
      navigate("/");
      showAlert("success", "Your account has been permanently deleted.");
    } catch (err) {
      showAlert("error", err.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const sectionClasses = `p-8 rounded-[2rem] border-4 mb-6
    ${ isDarkMode
      ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
      : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  return (
    <>
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteModal
          isDarkMode={isDarkMode}
          onConfirm={handleDeleteConfirm}
          onCancel={() => !isDeleting && setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <button
          onClick={() => navigate("/dashboard")}
          className={`flex items-center gap-2 mb-8 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1
            ${ isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900" }`}
        >
          <ArrowLeft size={16} />
          {t("settings.back_to_dashboard")}
        </button>

        <h1 className={`text-4xl font-black uppercase tracking-tighter mb-8 ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
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
          isUploading={isUploading}
          handleSave={handleSave}
          previewUrl={previewUrl}
          onFileSelect={handleFileSelect}
        />

        {/* Account Actions */}
        <div className={sectionClasses}>
          <h2 className={`text-lg font-black uppercase tracking-widest mb-6 ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
            {t("settings.account")}
          </h2>
          <div className="space-y-3">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95
                ${ isDarkMode
                  ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b] hover:bg-slate-600"
                  : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:bg-slate-100"
                }`}
            >
              <LogOut size={18} />
              {t("settings.sign_out")}
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 border-rose-500 font-black uppercase tracking-widest text-rose-500 transition-all active:scale-95 hover:bg-rose-500 hover:text-white shadow-[4px_4px_0px_0px_#f43f5e]"
            >
              <Trash2 size={18} />
              {t("settings.delete_account")}
            </button>
          </div>
        </div>
      </main>
    </>
  );
};

export default SettingsPage;
