import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import NeoDropdown from "../components/NeoDropdown";
import Avatar from "../components/Avatar";
import Loader from "../components/Loader";
import Tooltip from "../components/Tooltip";
import FloatingActionButton from "../components/FloatingActionButton";
import ConfirmModal from "../components/ConfirmModal";
import { openBillingPortal, changeSubscriptionPlan } from "../services/stripeService";
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
  BookOpen,
  CreditCard,
  Star,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useTierAccess } from "../hooks/useTierAccess";
import { updateUserProfile, uploadProfileImage, deleteAccount } from "../services/userService";
import { seedLanguage } from "../services/supportedLanguagesService";
import { auth } from "../firebase";
import { INTEREST_CATEGORIES } from "../config/supportedLanguages";
import { normalizeCode } from "../utils/languageCode";

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
  learningDialect, setLearningDialect,
  interests, setInterests,
  draftDarkMode, setDraftDarkMode,
  isSaving, isUploading, handleSave,
  previewUrl, onFileSelect,
  supportedLanguages,
  isLoadingLanguages,
  showOtherInterface, setShowOtherInterface,
  showOtherLearning, setShowOtherLearning,
  isSeedingInterface, isSeedingLanguage,
  isDirty,
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

  const isBusy = isSaving || isUploading || isSeedingInterface || isSeedingLanguage;

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
            {isLoadingLanguages ? (
              <div className={`p-4 rounded-xl border-4 text-center ${isDarkMode ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-white border-slate-300 text-slate-600"}`}>
                <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                {t("common.loading")}
              </div>
            ) : (
              <>
                <NeoDropdown
                  options={supportedLanguages.map((l) => ({ value: l.code, flagCode: l.code, label: l.label || l.code }))}
                  value={showOtherInterface ? "" : interfaceLang}
                  onChange={(val) => {
                    setShowOtherInterface(false);
                    setInterfaceLang(val);
                  }}
                  showOtherOption
                  otherLabel={t("onboarding.other_option")}
                  onOtherSelect={() => setShowOtherInterface(true)}
                  isDarkMode={isDarkMode}
                  className="w-full"
                />
                {showOtherInterface && (
                  <input
                    type="text"
                    value={interfaceLang}
                    onChange={(e) => setInterfaceLang(e.target.value)}
                    placeholder={t("onboarding.interface_placeholder")}
                    className={`mt-3 w-full p-3 rounded-xl border-4 font-mono text-sm uppercase tracking-widest
                      ${isDarkMode ? "bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"}`}
                  />
                )}
              </>
            )}
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
              <Globe size={12} className="inline mr-1" /> {t("settings.learning_language")}
            </label>
            {isLoadingLanguages ? (
              <div className={`p-4 rounded-xl border-4 text-center ${isDarkMode ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-white border-slate-300 text-slate-600"}`}>
                <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                {t("common.loading")}
              </div>
            ) : (
              <>
                <NeoDropdown
                  options={supportedLanguages.map((l) => ({
                    value: l.code,
                    flagCode: l.code,
                    label: l.label || l.code,
                  }))}
                  value={showOtherLearning ? "" : learningDialect}
                  onChange={(val) => {
                    setShowOtherLearning(false);
                    setLearningDialect(val);
                  }}
                  showOtherOption
                  otherLabel={t("onboarding.other_option")}
                  onOtherSelect={() => setShowOtherLearning(true)}
                  isDarkMode={isDarkMode}
                  className="w-full"
                />
                {showOtherLearning && (
                  <input
                    type="text"
                    value={learningDialect}
                    onChange={(e) => setLearningDialect(e.target.value)}
                    placeholder={t("onboarding.learning_placeholder")}
                    className={`mt-3 w-full p-3 rounded-xl border-4 font-mono text-sm uppercase tracking-widest
                      ${isDarkMode ? "bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"}`}
                  />
                )}
              </>
            )}
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
      <Tooltip text={isDirty ? t("settings.unsaved_changes") : ""} isDarkMode={isDarkMode}>
        <button
          type="submit"
          disabled={isBusy}
          className={`relative w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-lg transition-all active:scale-95 mb-6
            ${ isBusy
              ? "opacity-60 cursor-not-allowed bg-slate-400 border-slate-500 text-white"
              : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a] hover:-translate-y-1"
            }`}
        >
          {isBusy
            ? <><Loader2 size={20} className="animate-spin" /> {
                isUploading
                  ? t("settings.uploading")
                  : (isSeedingInterface || isSeedingLanguage)
                    ? "Adding new language via AI, this may take a moment..."
                    : t("settings.saving")
              }</>
            : <><Save size={20} /> {t("settings.save_settings")}</>
          }
          {isDirty && !isBusy && (
            <span
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-slate-900 animate-pulse"
              aria-hidden="true"
            />
          )}
        </button>
      </Tooltip>
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
  isDarkMode:         PropTypes.bool.isRequired,
  displayName:        PropTypes.string.isRequired,
  setDisplayName:     PropTypes.func.isRequired,
  interfaceLang:      PropTypes.string.isRequired,
  setInterfaceLang:   PropTypes.func.isRequired,
  learningDialect:    PropTypes.string.isRequired,
  setLearningDialect: PropTypes.func.isRequired,
  interests:          PropTypes.arrayOf(PropTypes.string).isRequired,
  setInterests:       PropTypes.func.isRequired,
  draftDarkMode:      PropTypes.bool.isRequired,
  setDraftDarkMode:   PropTypes.func.isRequired,
  isSaving:           PropTypes.bool.isRequired,
  isUploading:        PropTypes.bool.isRequired,
  handleSave:         PropTypes.func.isRequired,
  previewUrl:         PropTypes.string,
  onFileSelect:       PropTypes.func.isRequired,
  supportedLanguages: PropTypes.arrayOf(PropTypes.shape({
    code:    PropTypes.string.isRequired,
    label:   PropTypes.string,
    flag:    PropTypes.string,
  })).isRequired,
  isLoadingLanguages:     PropTypes.bool.isRequired,
  showOtherInterface:     PropTypes.bool.isRequired,
  setShowOtherInterface:  PropTypes.func.isRequired,
  showOtherLearning:      PropTypes.bool.isRequired,
  setShowOtherLearning:   PropTypes.func.isRequired,
  isSeedingInterface:     PropTypes.bool.isRequired,
  isSeedingLanguage:      PropTypes.bool.isRequired,
  isDirty:                PropTypes.bool.isRequired,
};

// ── Settings Page ───────────────────────────────────────────────────────────────
const SettingsPage = () => {
  const { isDarkMode, setIsDarkMode, user, isLoadingUser, logoutUser, showAlert, refreshUser, changeLanguage, supportedLanguages, isLoadingLanguages, refreshSupportedLanguages } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Guests (including anonymous Firebase sessions used for public reads like
  // translations) must not reach account settings.
  useEffect(() => {
    if (!isLoadingUser && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, isLoadingUser, navigate]);
  const { tier, isExplorer, isVoyager, isMaestro, isVip, isAdmin } = useTierAccess();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  // 'voyager' | 'maestro' | null — which plan the confirm modal is offering to switch to
  const [pendingPlanChange, setPendingPlanChange] = useState(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  const handleConfirmPlanChange = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser || !pendingPlanChange) return;
    setIsChangingPlan(true);
    try {
      const token = await firebaseUser.getIdToken();
      await changeSubscriptionPlan(token, pendingPlanChange);
      setPendingPlanChange(null);
      // SubscriptionSuccessPage refreshes the user itself and shows
      // tier-appropriate thank-you copy — no separate toast needed here.
      navigate("/subscription/success");
    } catch (err) {
      showAlert("error", err.message || t("common.error"));
    } finally {
      setIsChangingPlan(false);
    }
  };

  const [displayName,      setDisplayName]      = useState(user?.displayName || "");
  const [interfaceLang,    setInterfaceLang]    = useState(user?.interfaceLang || "en-US");
  const [learningDialect,  setLearningDialect]  = useState(user?.learningDialect || "");
  const [interests,        setInterests]        = useState(user?.interests || []);
  const [draftDarkMode,    setDraftDarkMode]    = useState(isDarkMode);
  const [isSaving,         setIsSaving]         = useState(false);

  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl,  setPreviewUrl]  = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting,      setIsDeleting]      = useState(false);

  const [showOtherInterface, setShowOtherInterface] = useState(false);
  const [showOtherLearning,  setShowOtherLearning]  = useState(false);
  const [isSeedingInterface, setIsSeedingInterface] = useState(false);
  const [isSeedingLanguage,  setIsSeedingLanguage]  = useState(false);

  const [prevSyncKey, setPrevSyncKey] = useState("");
  const syncKey = [
    user?.uid || "",
    user?.displayName || "",
    user?.interfaceLang || "",
    user?.learningDialect || "",
    (user?.interests || []).join(","),
    isDarkMode,
  ].join("|");

  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (user?.displayName)        setDisplayName(user.displayName);
    if (user?.interfaceLang)      setInterfaceLang(user.interfaceLang);
    if (user?.learningDialect)    setLearningDialect(user.learningDialect);
    setInterests(Array.isArray(user?.interests) ? user.interests : []);
    setDraftDarkMode(isDarkMode);
  }

  // ── Unsaved-changes detection ──────────────────────────────────────────
  // Same shape as syncKey, but built from the live draft state instead of
  // the last-saved user profile. Converges back with prevSyncKey right
  // after a successful save (handleSave -> refreshUser() -> new syncKey).
  const draftKey = [
    user?.uid || "",
    displayName,
    interfaceLang,
    learningDialect,
    interests.join(","),
    draftDarkMode,
  ].join("|");
  const isDirty = draftKey !== prevSyncKey || pendingFile !== null;

  if (isLoadingUser) {
    return <Loader fullScreen message={t("common.loading")} isDarkMode={isDarkMode} />;
  }

  if (!user) {
    return null;
  }

  const handleFileSelect = (file) => {
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Seed a new "Other" language via AI if it's not already known, returning
  // the canonical code to persist (the seeded document's id, or the existing
  // known code unchanged).
  const seedIfNeeded = async (code, token) => {
    const known = supportedLanguages.find((l) => normalizeCode(l.code) === normalizeCode(code));
    if (!known) {
      const created = await seedLanguage(code, code, token);
      return created?.id ?? code;
    }
    return known.code;
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      showAlert("error", t("settings.errors.not_signed_in"));
      return;
    }

    if (showOtherInterface && !interfaceLang) {
      showAlert("error", t("onboarding.interface_placeholder"));
      return;
    }
    if (showOtherLearning && !learningDialect) {
      showAlert("error", t("onboarding.learning_placeholder"));
      return;
    }

    const token = await firebaseUser.getIdToken();

    try {
      let finalInterfaceLang = interfaceLang;
      let finalLearningDialect = learningDialect;

      if (showOtherInterface) {
        setIsSeedingInterface(true);
        try {
          finalInterfaceLang = await seedIfNeeded(interfaceLang, token);
        } finally {
          setIsSeedingInterface(false);
        }
      }
      if (showOtherLearning) {
        setIsSeedingLanguage(true);
        try {
          finalLearningDialect = await seedIfNeeded(learningDialect, token);
        } finally {
          setIsSeedingLanguage(false);
        }
      }
      if (showOtherInterface || showOtherLearning) {
        await refreshSupportedLanguages();
        setShowOtherInterface(false);
        setShowOtherLearning(false);
      }

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
        interfaceLang: finalInterfaceLang,
        theme: draftDarkMode ? "dark" : "light",
        learningDialect: finalLearningDialect || null,
        interests,
        onboardingCompleted: user?.onboardingCompleted ?? true,
      });
      setInterfaceLang(finalInterfaceLang);
      setLearningDialect(finalLearningDialect);
      changeLanguage(finalInterfaceLang);
      setIsDarkMode(draftDarkMode);
      await refreshUser();
      showAlert("success", t("settings.success_message"));
    } catch (err) {
      const isNetwork = err instanceof TypeError && err.message === "Failed to fetch";
      showAlert("error", isNetwork ? t("settings.errors.network_error") : (err.message || t("settings.errors.save_failed")));
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

  const isBusy = isSaving || isUploading || isSeedingInterface || isSeedingLanguage;

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

      {pendingPlanChange && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={t("subscription.change_plan_confirm_title")}
          message={
            pendingPlanChange === "maestro"
              ? t("subscription.change_plan_confirm_message_upgrade")
              : t("subscription.change_plan_confirm_message_downgrade")
          }
          confirmLabel={
            pendingPlanChange === "maestro"
              ? t("subscription.upgrade_to_maestro")
              : t("subscription.downgrade_to_voyager")
          }
          confirmColor={pendingPlanChange === "maestro" ? "yellow" : "rose"}
          icon={pendingPlanChange === "maestro" ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          isLoading={isChangingPlan}
          onConfirm={handleConfirmPlanChange}
          onCancel={() => !isChangingPlan && setPendingPlanChange(null)}
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
        isDirty={isDirty}
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
        learningDialect={learningDialect}
        setLearningDialect={setLearningDialect}
        interests={interests}
        setInterests={setInterests}
        draftDarkMode={draftDarkMode}
        setDraftDarkMode={setDraftDarkMode}
        isSaving={isSaving}
        isUploading={isUploading}
        handleSave={handleSave}
        previewUrl={previewUrl}
        onFileSelect={handleFileSelect}
        supportedLanguages={supportedLanguages}
        isLoadingLanguages={isLoadingLanguages}
        showOtherInterface={showOtherInterface}
        setShowOtherInterface={setShowOtherInterface}
        showOtherLearning={showOtherLearning}
        setShowOtherLearning={setShowOtherLearning}
        isSeedingInterface={isSeedingInterface}
        isSeedingLanguage={isSeedingLanguage}
        isDirty={isDirty}
      />

        {/* ── Subscription Section ── */}
        <div className={sectionClasses}>
          <h2 className={`text-lg font-black uppercase tracking-widest mb-6 ${ isDarkMode ? "text-white" : "text-slate-900" }`}>
            <CreditCard size={16} className="inline mr-2" />
            {t("subscription.title")}
          </h2>

          {/* Current Tier Badge */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`px-4 py-1.5 rounded-full border-2 font-black uppercase tracking-wider text-sm ${
                isExplorer
                  ? "border-slate-300 text-slate-500"
                  : isVoyager
                    ? "bg-blue-100 border-blue-500 text-blue-700"
                    : isVip
                      ? "bg-purple-100 border-purple-500 text-purple-700"
                      : isAdmin
                        ? "bg-rose-100 border-rose-500 text-rose-700"
                        : "bg-yellow-100 border-yellow-500 text-yellow-700"
              }`}
            >
              {(tier === "maestro" || isVip || isAdmin) && <Star size={14} className="inline mr-1 fill-current" />}
              {isExplorer ? "Explorer" : isVoyager ? "Voyager" : isVip ? "VIP" : isAdmin ? "Admin" : "Maestro"}
            </span>
            {/* Show subscription status only for paid tiers that have one */}
            {user?.subscriptionStatus && !isExplorer && !isVip && !isAdmin && (
              <span
                className={`px-3 py-1 rounded-full border-2 font-black uppercase tracking-wider text-xs ${
                  user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing"
                    ? "border-emerald-500 text-emerald-600"
                    : user.subscriptionStatus === "past_due"
                      ? "border-rose-500 text-rose-600"
                      : "border-slate-300 text-slate-500"
                }`}
              >
                {user.subscriptionStatus}
              </span>
            )}
          </div>

          {/* Current Period End — only for paid tiers */}
          {user?.currentPeriodEnd && !isExplorer && !isVip && !isAdmin && (
            <p className={`text-sm font-bold mb-4 ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
              {t("subscription.current_period_end", {
                date: new Date(user.currentPeriodEnd).toLocaleDateString(),
              })}
            </p>
          )}

          {/* Past-due notice — only for paid tiers */}
          {user?.subscriptionStatus === "past_due" && !isVip && !isAdmin && (
            <div className={`p-4 rounded-xl border-4 mb-4 ${
              isDarkMode
                ? "bg-rose-900/20 border-rose-500/40 text-rose-400"
                : "bg-rose-50 border-rose-300 text-rose-600"
            }`}>
              <p className="font-black uppercase tracking-widest text-xs mb-3">
                {t("subscription.past_due_message")}
              </p>
              <button
                onClick={async () => {
                  setIsPortalLoading(true);
                  try {
                    const firebaseUser = auth?.currentUser;
                    if (!firebaseUser) return;
                    const token = await firebaseUser.getIdToken();
                    await openBillingPortal(token);
                  } catch {
                    showAlert("error", t("common.error"));
                  } finally {
                    setIsPortalLoading(false);
                  }
                }}
                disabled={isPortalLoading}
                className="px-4 py-2 bg-rose-500 text-white rounded-xl border-2 border-slate-900 font-black uppercase text-xs tracking-widest hover:bg-rose-600 transition-all"
              >
                {isPortalLoading ? t("common.loading") : t("subscription.update_payment")}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {isExplorer ? (
              <button
                onClick={() => navigate("/pricing")}
                className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 ${
                  isDarkMode
                    ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#ca8a04] hover:-translate-y-0.5"
                    : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
                }`}
              >
                <Star size={18} />
                {t("pricing.upgrade")}
              </button>
            ) : isVip ? (
              // VIP — show donation links instead of subscription management
              <div className="space-y-3">
                <p className={`text-xs font-black uppercase tracking-widest text-center mb-2 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}>
                  Support the project &mdash; donate here
                </p>
                <div className="flex gap-3">
                  <a
                    href="https://revolut.me/nunothetraveler"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 hover:-translate-y-0.5 ${
                      isDarkMode
                        ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b] hover:bg-slate-600"
                        : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:bg-slate-100"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                      <path d="M20.94 14.04A8.96 8.96 0 0 1 12 21a9 9 0 0 1-9-9 9 9 0 0 1 9-9 8.96 8.96 0 0 1 8.94 6.96H12a3 3 0 0 0-3 3 3 3 0 0 0 3 3h8.94z"/>
                    </svg>
                    Revolut
                  </a>
                  <a
                    href="https://www.paypal.me/nunoMfmore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 hover:-translate-y-0.5 ${
                      isDarkMode
                        ? "bg-blue-900/30 border-blue-600 text-blue-400 shadow-[4px_4px_0px_0px_#1e3a5f] hover:bg-blue-900/50"
                        : "bg-blue-50 border-blue-600 text-blue-700 shadow-[4px_4px_0px_0px_#1e3a5f] hover:bg-blue-100"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                      <path d="M7.08 2.5c-1.2 0-2.18.98-2.18 2.18v14.64c0 1.2.98 2.18 2.18 2.18h9.84c1.2 0 2.18-.98 2.18-2.18V4.68c0-1.2-.98-2.18-2.18-2.18H7.08zm0 1.5h9.84c.38 0 .68.3.68.68v14.64c0 .38-.3.68-.68.68H7.08c-.38 0-.68-.3-.68-.68V4.68c0-.38.3-.68.68-.68zm1.5 2.5v1.5h6.84V6.5H8.58zm0 3v1.5h6.84V9.5H8.58zm0 3v1.5h6.84v-1.5H8.58z"/>
                    </svg>
                    PayPal
                  </a>
                </div>
              </div>
            ) : isAdmin ? (
              // Admin — no subscription needed
              <div className={`p-4 rounded-xl border-4 text-center ${
                isDarkMode
                  ? "bg-slate-700/50 border-slate-600 text-slate-400"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}>
                <p className="font-black uppercase tracking-widest text-xs">
                  Admin &mdash; No subscription needed
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setPendingPlanChange(isMaestro ? "voyager" : "maestro")}
                  disabled={isPortalLoading || isChangingPlan}
                  className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 ${
                    isDarkMode
                      ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#ca8a04] hover:-translate-y-0.5"
                      : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
                  }`}
                >
                  {isMaestro ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                  {isMaestro ? t("subscription.downgrade_to_voyager") : t("subscription.upgrade_to_maestro")}
                </button>

                <button
                  onClick={async () => {
                    setIsPortalLoading(true);
                    try {
                      const firebaseUser = auth?.currentUser;
                      if (!firebaseUser) return;
                      const token = await firebaseUser.getIdToken();
                      await openBillingPortal(token);
                    } catch {
                      showAlert("error", t("common.error"));
                    } finally {
                      setIsPortalLoading(false);
                    }
                  }}
                  disabled={isPortalLoading}
                  className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 ${
                    isDarkMode
                      ? "bg-slate-700 border-slate-600 text-white shadow-[4px_4px_0px_0px_#1e293b] hover:bg-slate-600"
                      : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:bg-slate-100"
                  }`}
                >
                  {isPortalLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ExternalLink size={18} />
                  )}
                  {isPortalLoading ? t("common.loading") : t("subscription.manage")}
                </button>

                <p className={`text-xs font-bold text-center pt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  {t("subscription.cancel_warning")}
                </p>
              </>
            )}
          </div>
        </div>

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