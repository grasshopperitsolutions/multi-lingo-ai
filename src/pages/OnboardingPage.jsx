import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import NeoDropdown from "../components/NeoDropdown";
import { updateUserProfile } from "../services/userService";
import { seedLanguage } from "../services/supportedLanguagesService";
import { auth } from "../firebase";
import { INTEREST_CATEGORIES } from "../config/supportedLanguages";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";

// ── Interest Pills (reused pattern from SettingsPage) ────────────────────
const InterestPills = ({ selected, onChange, isDarkMode, t }) => {
  const toggle = (value) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("onboarding.step_interests")}>
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

// ── Step Indicator ─────────────────────────────────────────────────────
const StepIndicator = ({ currentStep, totalSteps, isDarkMode }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {Array.from({ length: totalSteps }, (_, i) => (
      <div
        key={i}
        className={`h-2 rounded-full transition-all duration-500 ${
          i === currentStep
            ? "w-8 bg-yellow-400"
            : i < currentStep
              ? "w-2 bg-emerald-400"
              : isDarkMode
                ? "w-2 bg-slate-600"
                : "w-2 bg-slate-300"
        }`}
      />
    ))}
  </div>
);

StepIndicator.propTypes = {
  currentStep: PropTypes.number.isRequired,
  totalSteps:  PropTypes.number.isRequired,
  isDarkMode:  PropTypes.bool.isRequired,
};

// ── Onboarding Page ────────────────────────────────────────────────────
const OnboardingPage = () => {
  const {
    isDarkMode,
    user,
    showAlert,
    refreshUser,
    changeLanguage,
    // dynamic language state
    supportedLanguages,
    isLoadingLanguages,
    refreshSupportedLanguages,
  } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [learningDialect, setLearningDialect] = useState("");
  const [interfaceLang, setInterfaceLang] = useState(user?.interfaceLang || "en-US");
  const [interests, setInterests] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeedingLanguage, setIsSeedingLanguage] = useState(false);

  const totalSteps = 3;

  // Redirect if user already completed onboarding
  useEffect(() => {
    if (user?.learningDialect && user?.onboardingCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleNext = async () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      if (!learningDialect) {
        showAlert("error", "Please select a language to learn.");
        return;
      }

      // If the language is not yet supported, seed it dynamically via AI
      const knownLanguage = supportedLanguages.find((lang) => lang.code === learningDialect);
      if (!knownLanguage) {
        setIsSeedingLanguage(true);
        try {
          const token = await auth?.currentUser?.getIdToken();
          if (!token) throw new Error("No authentication token available");
          await seedLanguage(learningDialect, learningDialect, token);
          await refreshSupportedLanguages();
          setStep(2);
        } catch (err) {
          showAlert("error", `Could not add language: ${err.message}`);
        } finally {
          setIsSeedingLanguage(false);
        }
      } else {
        setStep(2);
      }
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;
    setIsSaving(true);
    try {
      const token = await firebaseUser.getIdToken();
      await updateUserProfile(token, firebaseUser.uid, {
        displayName: user?.displayName || "",
        interfaceLang,
        theme: isDarkMode ? "dark" : "light",
        learningDialect,
        interests,
        onboardingCompleted: true,
      });
      changeLanguage(interfaceLang);
      await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      showAlert("error", err.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const containerClasses = `min-h-screen flex flex-col transition-colors duration-500
    ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-blue-50 text-slate-900"}`;

  const cardClasses = `p-8 rounded-[2rem] border-4 max-w-lg mx-auto w-full
    ${isDarkMode
      ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
      : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`;

  const labelClasses = `block font-black uppercase text-xs tracking-widest mb-2
    ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  // ── Step 0: Welcome ──
  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4
          ${isDarkMode
            ? "bg-slate-700 border-yellow-400 text-yellow-400"
            : "bg-yellow-400 border-slate-900 text-slate-900"
          }`}>
          <Sparkles size={48} />
        </div>
      </div>
      <h1 className={`text-4xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {t("onboarding.welcome_title")}
      </h1>
      <p className={`font-bold text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
        {t("onboarding.welcome_subtitle")}
      </p>
      <button
        onClick={() => setStep(1)}
        className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-lg transition-all active:scale-95 hover:-translate-y-1
          ${isDarkMode
            ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[6px_6px_0px_0px_#854d0e]"
            : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
          }`}
      >
        {t("onboarding.next")}
        <ArrowRight size={20} />
      </button>
    </div>
  );

  // ── Step 1: Learning Language ──
  const renderLanguageStep = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-black uppercase tracking-tighter text-center ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {t("onboarding.step_language")}
      </h2>
      <div>
        <label className={labelClasses}>
          {t("settings.learning_language")}
        </label>
        {isLoadingLanguages ? (
          <div className={`p-4 rounded-xl border-4 text-center ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-600"}`}>
            <Loader2 size={20} className="animate-spin mx-auto mb-2" />
            Loading available languages...
          </div>
        ) : (
          <NeoDropdown
            options={supportedLanguages.map((l) => ({
              value: l.code,
              label: `${l.flag || ""} ${l.label || l.code}`,
            }))}
            value={learningDialect}
            onChange={setLearningDialect}
            isDarkMode={isDarkMode}
            className="w-full"
          />
        )}
        <div className="mt-3">
          <label className={`${labelClasses} text-[10px]`}>
            Or enter a BCP-47 code if your language is not listed
          </label>
          <input
            type="text"
            value={learningDialect}
            onChange={(e) => setLearningDialect(e.target.value)}
            placeholder="e.g. it-IT, ja-JP, ru-RU"
            className={`w-full p-3 rounded-xl border-4 font-mono text-sm uppercase tracking-widest
              ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"}`}
          />
        </div>
      </div>
      {isSeedingLanguage && (
        <div className={`p-3 rounded-xl border-4 text-center ${isDarkMode ? "bg-slate-800 border-yellow-400 text-yellow-400" : "bg-white border-yellow-500 text-yellow-700"}`}>
          <Loader2 size={18} className="animate-spin inline mr-2" />
          Adding new language via AI, this may take a moment...
        </div>
      )}
      <div className="flex justify-between pt-4">
        <button
          onClick={handleBack}
          className={`flex items-center gap-2 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1
            ${isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
        >
          <ChevronLeft size={16} />
          {t("onboarding.back")}
        </button>
        <button
          onClick={handleNext}
          disabled={!learningDialect || isSeedingLanguage}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95
            ${learningDialect && !isSeedingLanguage
              ? isDarkMode
                ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[4px_4px_0px_0px_#854d0e]"
                : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
              : isDarkMode
                ? "bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed"
            }`}
        >
          {isSeedingLanguage ? (
            <><Loader2 size={16} className="animate-spin" /> Please wait</>
          ) : (
            <>{t("onboarding.next")} <ChevronRight size={16} /></>
          )}
        </button>
      </div>
    </div>
  );

  // ── Step 2: Interface Language + Interests ──
  const renderInterfaceStep = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-black uppercase tracking-tighter text-center ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {t("onboarding.step_interface")}
      </h2>
      <div>
        <label className={labelClasses}>
          {t("settings.interface_language")}
        </label>
        <NeoDropdown
          options={supportedLanguages.map((l) => ({ value: l.code, label: `${l.flag || ""} ${l.label || l.code}` }))}
          value={interfaceLang}
          onChange={setInterfaceLang}
          isDarkMode={isDarkMode}
          className="w-full"
        />
      </div>

      <div className="pt-4">
        <label className={labelClasses}>
          {t("onboarding.step_interests")}
        </label>
        <p className={`text-xs font-semibold mb-3 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {t("onboarding.interests_hint")}
        </p>
        <InterestPills
          selected={interests}
          onChange={setInterests}
          isDarkMode={isDarkMode}
          t={t}
        />
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={handleBack}
          className={`flex items-center gap-2 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1
            ${isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
        >
          <ChevronLeft size={16} />
          {t("onboarding.back")}
        </button>
        <button
          onClick={handleFinish}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95
            ${isSaving
              ? "opacity-60 cursor-not-allowed bg-slate-400 border-slate-500 text-white"
              : isDarkMode
                ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[4px_4px_0px_0px_#854d0e]"
                : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
            }`}
        >
          {isSaving ? (
            <><Loader2 size={16} className="animate-spin" /> {t("common.saving")}</>
          ) : (
            <>{t("onboarding.finish")} <Sparkles size={16} /></>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className={containerClasses}>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className={cardClasses}>
          <StepIndicator currentStep={step} totalSteps={totalSteps} isDarkMode={isDarkMode} />

          {step === 0 && renderWelcome()}
          {step === 1 && renderLanguageStep()}
          {step === 2 && renderInterfaceStep()}
        </div>
      </main>
    </div>
  );
};

export default OnboardingPage;