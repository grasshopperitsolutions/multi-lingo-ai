import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import NeoDropdown from "../components/NeoDropdown";
import Avatar from "../components/Avatar";
import FloatingActionButton from "../components/FloatingActionButton";
import ConfirmModal from "../components/ConfirmModal";
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
  Lock,
  BookOpen,
} from "lucide-react";
import { updateUserProfile, uploadProfileImage, deleteAccount } from "../services/userService";
import { auth } from "../firebase";

const LANGUAGES = [
  { value: "en-US", labelKey: "nav.lang_en" },
  { value: "pt-PT", labelKey: "nav.lang_pt" },
  { value: "es-ES", labelKey: "nav.lang_es" },
  { value: "fr-FR", labelKey: "nav.lang_fr" },
];

const INTEREST_CATEGORIES = [
  { value: "general", labelKey: "categories.general" },
  { value: "food",    labelKey: "categories.food" },
  { value: "travel",  labelKey: "categories.travel" },
  { value: "sports",  labelKey: "categories.sports" },
  { value: "tech",    labelKey: "categories.tech" },
  { value: "nature",  labelKey: "categories.nature" },
];

// ── Avatar Upload Widget ─────────────────────────────────────────────────────────
const AvatarUpload = ({ user, isDarkMode, previewUrl, onFileSelect, isUploading, t }) => {
  const fileInputRef = useRef(null);
  const displaySrc = previewUrl || user?.photoURL;

  return (
    <div className="flex items-center gap-5 mb-6">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label={t("settings.change_photo")}
        className="relative shrink-0 group focus:outline-none"
      >
        <Avatar
          src={displaySrc}
          alt={user?.displayName || t("settings.profile_photo_alt")}
          size={80}
          isDarkMode={false}
          className="shadow-[4px_4px_0px_0px_#facc15]"
        />
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
          e.target.value = "";
        }}
      />

      <div className="min-w-0 flex-1">
        <p className={`font-black text-base ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
          {user?.displayName || "—"}
        </p>
        <p className={`text-xs font-bold uppercase tracking-widest break-all ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
          {user?.email || ""}
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`mt-1 text-xs font-black uppercase tracking-widest underline transition-colors
            ${ isDarkMode ? "text-yellow-400 hover:text-yellow-300" : "text-blue-600 hover:text-blue-800" }`}
        >
          {t("settings.change_photo")}
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
  isDarkMode:   PropTypes.bool.isRequired,
  previewUrl:   PropTypes.string,
  onFileSelect: PropTypes.func.isRequired,
  isUploading:  PropTypes.bool.isRequired,
  t:            PropTypes.func.isRequired,
};

// ── Interest Pills ────────────────────────────────────────────────────────────
const InterestPills = ({ selected, onChange, isDarkMode, t }) => {
  const toggle = (value) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("settings.interests")}>
      {INTEREST_CATEGORIES.map(({ value, labelKey }) => {
        const isSelected = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            aria-pressed={isSelected}
            className={`px-4 py-2 rounded-full border-2 font-black uppercase text-xs tracking-widest
              transition-all active:scale-95
              ${ isSelected
                ? isDarkMode
                  ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[3px_3px_0px_0px_#854d0e]"
                  : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                : isDarkMode
                  ? "bg-transparent border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
                  : "bg-transparent border-slate-300 text-slate-500 hover:border-slate-900 hover:text-slate-900"
              }`}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
};
InterestPills.propTypes = {
  selected:   PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange:   PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  t:          PropTypes.func.isRequired,
};

// ── Settings Form ───────────────────────────────────────────────────────────
const SettingsForm = ({
  user, isDarkMode,
  displayName, setDisplayName,
  interfaceLang, setInterfaceLang,
  interests, setInterests,
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
      {/* ── Profile ── */}
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
          t={t}
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
              className={`${inputClasses} opacity-50 cursor-not-allowed break-all`}
            />
          </div>
        </div>
      </div>

      {/* ── Appearance ── */}
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
              options={LANGUAGES.map((l) => ({ value: l.value, label: t(l.labelKey) }))}
              value={interfaceLang}
              onChange={setInterfaceLang}
              isDarkMode={isDarkMode}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* ── Language Learning ── */}
      <div className={sectionClasses}>
        <h2 className={`text-lg font-black uppercase tracking-widest mb-6 ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
          <BookOpen size={16} className="inline mr-2" />
          {t("settings.language_learning")}
        </h2>
        <div className="space-y-6">
          <div>
            <label className={labelClasses}>
              <Lock size={12} className="inline mr-1" /> {t("settings.learning_language")}
            </label>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-4 cursor-not-allowed
              ${ isDarkMode
                ? "bg-slate-700/50 border-slate-600 text-slate-400"
                : "bg-slate-50 border-slate-200 text-slate-500"
              }`}>
              <span className="text-xl" aria-hidden="true">🇵🇹</span>
              <div>
                <p className={`font-black text-sm ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
                  {t("settings.portuguese_label")}
                </p>
                <p className={`text-xs font-bold uppercase tracking-widest
                  ${ isDarkMode ? "text-slate-500" : "text-slate-400" }`}>
                  pt-PT
                </p>
              </div>
              <Lock size={14} className="ml-auto opacity-40" />
            </div>
            <p className={`mt-2 text-xs font-bold uppercase tracking-widest
              ${ isDarkMode ? "text-slate-600" : "text-slate-400" }`}>
              {t("settings.learning_locked_hint")}
            </p>
          </div>
          <div>
            <label className={labelClasses}>
              {t("settings.interests")}
            </label>
            <p className={`text-xs font-semibold mb-3
              ${ isDarkMode ? "text-slate-500" : "text-slate-400" }`}>
              {t("settings.interests_hint")}
            </p>
            <InterestPills
              selected={interests}
              onChange={setInterests}
              isDarkMode={isDarkMode}
              t={t}
            />
          </div>
        </div>
      </div>

      {/* ── Save ── */}
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
          ? <><Loader2 size={20} className="animate-spin" /> {isUploading ? t("settings.uploading") : t("settings.saving")}</>
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
    learningDialect: PropTypes.string,
    interests: PropTypes.arrayOf(PropTypes.string),
  }),
  isDarkMode:       PropTypes.bool.isRequired,
  displayName:      PropTypes.string.isRequired,
  setDisplayName:   PropTypes.func.isRequired,
  interfaceLang:    PropTypes.string.isRequired,
  setInterfaceLang: PropTypes.func.isRequired,
  interests:        PropTypes.arrayOf(PropTypes.string).isRequired,
  setInterests:     PropTypes.func.isRequired,
  draftDarkMode:    PropTypes.bool.isRequired,
  setDraftDarkMode: PropTypes.func.isRequired,
  isSaving:         PropTypes.bool.isRequired,
  isUploading:      PropTypes.bool.isRequired,
  handleSave:       PropTypes.func.isRequired,
  previewUrl:       PropTypes.string,
  onFileSelect:     PropTypes.func.isRequired,
};

// ── Settings Page ───────────────────────────────────────────────────────────────
const SettingsPage = () => {
  const { isDarkMode, setIsDarkMode, user, logoutUser, showAlert, refreshUser, changeLanguage } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [displayName,   setDisplayName]   = useState(user?.displayName || "");
  const [interfaceLang, setInterfaceLang] = useState(user?.interfaceLang || "en-US");
  const [interests,     setInterests]     = useState(user?.interests || []);
  const [draftDarkMode, setDraftDarkMode] = useState(isDarkMode);
  const [isSaving,      setIsSaving]      = useState(false);

  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl,  setPreviewUrl]  = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting,      setIsDeleting]      = useState(false);

  const [prevSyncKey, setPrevSyncKey] = useState("");
  const syncKey = [
    user?.uid || "",
    user?.displayName || "",
    user?.interfaceLang || "",
    (user?.interests || []).join(","),
    isDarkMode,
  ].join("|");

  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (user?.displayName)   setDisplayName(user.displayName);
    if (user?.interfaceLang) setInterfaceLang(user.interfaceLang);
    setInterests(Array.isArray(user?.interests) ? user.interests : []);
    setDraftDarkMode(isDarkMode);
  }

  const handleFileSelect = (file) => {
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      showAlert("error", t("settings.errors.not_signed_in"));
      return;
    }
    const token = await firebaseUser.getIdToken();

    try {
      if (pendingFile) {
        setIsUploading(true);
        try {
          await uploadProfileImage(token, firebaseUser.uid, pendingFile);
          setPendingFile(null);
          setPreviewUrl(null);
        } catch {
          showAlert("error", t("settings.upload_failed"));
          return;
        } finally {
          setIsUploading(false);
        }
      }

      setIsSaving(true);
      await updateUserProfile(token, firebaseUser.uid, {
        displayName,
        interfaceLang,
        theme: draftDarkMode ? "dark" : "light",
        learningDialect: "pt-PT",
        interests,
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
      showAlert("success", t("settings.account_deleted"));
    } catch (err) {
      showAlert("error", err.message || t("settings.delete_failed"));
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const isBusy = isSaving || isUploading;

  const sectionClasses = `p-8 rounded-[2rem] border-4 mb-6
    ${ isDarkMode
      ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
      : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  return (
    <>
      {showDeleteModal && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={t("settings.delete_confirm_title")}
          message={t("settings.delete_confirm_message")}
          warning={t("settings.delete_confirm_warning")}
          confirmLabel={t("settings.delete_confirm_button")}
          confirmColor="rose"
          icon={<Trash2 size={24} />}
          isLoading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => !isDeleting && setShowDeleteModal(false)}
        />
      )}

      <FloatingActionButton
        onClick={handleSave}
        icon={<Save size={22} />}
        label={t("settings.save_settings")}
        showLabel
        isLoading={isBusy}
        isDarkMode={isDarkMode}
        position="bottom-6 right-6"
      />

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
          interests={interests}
          setInterests={setInterests}
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

        <div className="h-24" aria-hidden="true" />
      </main>
    </>
  );
};

export default SettingsPage;
