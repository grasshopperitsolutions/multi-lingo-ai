import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginWithGoogle,
  loginWithApple,
  loginWithFacebook,
  loginWithTwitter,
  logout as logoutUserService,
} from "../services/authService";
import { getUserProfile, updateDayStreak, updateUserProfile } from "../services/userService";
import { getLanguages, getWritingSystems } from "../services/supportedLanguagesService";
import { auth } from "../firebase";
import PropTypes from "prop-types";
import { getTranslations, clearTranslationsCache, fillMissingTranslations } from "../services/translationService";
import { loadRemoteTranslations, registerMissingKeyHandler } from "../i18n";
import Loader from "../components/Loader";

const AppContext = createContext();

// ── Token validation interval (50 min — Firebase ID tokens expire after 1 hr)
const TOKEN_CHECK_INTERVAL_MS = 50 * 60 * 1000;

// Helper to get saved theme from localStorage (fallback for non-logged-in users)
const getSavedTheme = () => {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "dark";
  } catch {
    return false;
  }
};

// Helper to save theme to localStorage
const saveThemeToLocalStorage = (isDark) => {
  try {
    localStorage.setItem("theme", isDark ? "dark" : "light");
  } catch {
    // localStorage unavailable (SSG/sandboxed contexts)
  }
};

// Helper to get saved language from localStorage (fallback for non-logged-in users)
const getSavedLanguage = () => {
  try {
    const saved = localStorage.getItem("interfaceLang");
    return saved || "en-US";
  } catch {
    return "en-US";
  }
};

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(getSavedTheme());
  const [interfaceLang, setInterfaceLang] = useState(getSavedLanguage());
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(true);
  const [alert, setAlert] = useState({ show: false, type: "", message: "", action: null });
  const [user, setUser] = useState(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const tokenCheckRef = useRef(null);

  // ── Supported Languages & Writing Systems state ───────────────────────────
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [writingSystems, setWritingSystems] = useState([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [isLoadingWritingSystems, setIsLoadingWritingSystems] = useState(false);

  // ── Full Exam session state ────────────────────────────────────────────
  const [examSession, setExamSession] = useState(null);

  const showAlert = useCallback((type, message, action = null) => {
    setAlert({ show: true, type, message, action });
  }, []);

  const closeAlert = useCallback(() => {
    setAlert((prev) => ({ ...prev, show: false, action: null }));
  }, []);

  // ── Fetch supported languages and writing systems ───────────────────────
  // Runs for guests too — getLanguages()/getWritingSystems() fall back to an
  // anonymous Firebase session (getTokenOrAnonymous()) when nobody's signed in.
  const refreshSupportedLanguages = useCallback(async () => {
    setIsLoadingLanguages(true);
    setIsLoadingWritingSystems(true);
    try {
      const [langs, writings] = await Promise.all([
        getLanguages(),
        getWritingSystems(),
      ]);
      setSupportedLanguages(langs);
      setWritingSystems(writings);
    } catch (err) {
      showAlert("error", `Could not load supported languages: ${err.message}`);
    } finally {
      setIsLoadingLanguages(false);
      setIsLoadingWritingSystems(false);
    }
  }, [showAlert]);

  // Load languages on startup
  useEffect(() => {
    refreshSupportedLanguages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick-switcher language list (Header/MobileMenuDrawer/Dashboard) — always
  // has at least English, even before Firestore has loaded/seeded anything.
  // Settings/Onboarding intentionally use the raw supportedLanguages instead,
  // since they have their own "Other"-seeding empty-state UX.
  const interfaceLanguageOptions = useMemo(() => {
    const fallback = { code: "en-US", label: "English", flag: "🇺🇸" };
    if (!supportedLanguages || supportedLanguages.length === 0) return [fallback];
    const hasEnglish = supportedLanguages.some((l) => l.code === fallback.code);
    return hasEnglish ? supportedLanguages : [fallback, ...supportedLanguages];
  }, [supportedLanguages]);

  const updateExamSection = useCallback((section, patch) =>
    setExamSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: {
            ...prev.sections[section],
            ...patch,
          },
        },
      };
    }), []);

  /**
   * Attempt to force-refresh the Firebase ID token.
   * Returns the fresh token on success, or null on failure (session expired).
   */
  const validateToken = useCallback(async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return null;
    try {
      const freshToken = await firebaseUser.getIdToken(true);
      return freshToken;
    } catch {
      return null;
    }
  }, []);

  /**
   * Called when we detect the token can no longer be refreshed.
   * Marks the session as expired and shows a persistent warning.
   */
  const handleTokenExpired = useCallback(() => {
    setTokenExpired(true);
    // Use a non-auto-dismissing alert so the user sees the warning
    setAlert({
      show: true,
      type: "error",
      message: "__SESSION_EXPIRED__", // sentinel; AlertMessage will resolve via i18n
    });
  }, []);

  /**
   * Dismiss the expired-session banner and attempt to recover by
   * re-validating the token (e.g. after the user re-authenticates).
   */
  const dismissTokenExpired = useCallback(() => {
    setTokenExpired(false);
    setAlert({ show: false, type: "", message: "", action: null });
  }, []);

  // ── Periodic token validation ──────────────────────────────────────────
  // Every TOKEN_CHECK_INTERVAL_MS, try to force-refresh the ID token.
  // If the refresh fails the session is considered expired.
  useEffect(() => {
    if (!auth) return;

    const startTokenCheck = () => {
      tokenCheckRef.current = setInterval(async () => {
        const token = await validateToken();
        if (!token && auth.currentUser) {
          handleTokenExpired();
        }
      }, TOKEN_CHECK_INTERVAL_MS);
    };

    startTokenCheck();

    return () => {
      if (tokenCheckRef.current) clearInterval(tokenCheckRef.current);
    };
  }, [validateToken, handleTokenExpired]);

  // ── Listen for auth state → clear expired flag when user re-auths ──────
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser && !firebaseUser.isAnonymous && tokenExpired) {
        // User re-authenticated (e.g. signed in again from another tab)
        setTokenExpired(false);
        setAlert({ show: false, type: "", message: "", action: null });
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load translations for the current interface language ───────────────
  const loadTranslationsForLang = useCallback(async (lang, token) => {
    if (!lang) return;

    setIsLoadingTranslations(true);
    try {
      // Clear cache so we get fresh data
      clearTranslationsCache();

      // Fetch translations from Firestore (falls back to local en-US)
      const translations = await getTranslations(lang, token);

      // Register with i18next
      loadRemoteTranslations(lang, translations);

      // Change i18next language
      const i18nModule = await import("i18next");
      i18nModule.default.changeLanguage(lang);

      // Check for missing translation keys and fill them (non-blocking)
      if (token && lang !== "en-US") {
        fillMissingTranslations(lang, token).catch((err) =>
          console.warn(`[AppContext] fillMissingTranslations failed for "${lang}": ${err.message}`)
        );
      }
    } catch (err) {
      console.error(`[AppContext] Failed to load translations for "${lang}": ${err.message}`);
      // Navigate to app-unavailable on Firestore failure
      navigate("/app-unavailable", { replace: true });
      return;
    } finally {
      setIsLoadingTranslations(false);
    }
  }, [navigate]);

  // Register the fillMissingTranslations function with i18next so it
  // can be called when a translation key is missing at runtime
  useEffect(() => {
    registerMissingKeyHandler((locale) => {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) return Promise.resolve();
      return firebaseUser.getIdToken().then((token) =>
        fillMissingTranslations(locale, token)
      );
    });
  }, []);

  // Change interface language and persist
  const changeLanguage = useCallback(async (lang) => {
    setInterfaceLang(lang);
    try {
      localStorage.setItem("interfaceLang", lang);
    } catch {
      // localStorage unavailable
    }

    // Load translations for the new language
    const firebaseUser = auth?.currentUser;
    const token = firebaseUser ? await firebaseUser.getIdToken() : null;
    await loadTranslationsForLang(lang, token);

    // Persist to the profile for real (non-anonymous) logged-in users only —
    // guests/anonymous sessions stay local-only (localStorage above).
    if (firebaseUser && !firebaseUser.isAnonymous) {
      try {
        await updateUserProfile(token, firebaseUser.uid, { interfaceLang: lang });
        setUser((prev) => (prev ? { ...prev, interfaceLang: lang } : prev));
      } catch (err) {
        showAlert("error", `Could not save language preference: ${err.message}`);
      }
    }
  }, [loadTranslationsForLang, showAlert]);

  // Safe theme setter that persists to localStorage
  const setIsDarkModeWithPersist = (isDark) => {
    setIsDarkMode(isDark);
    saveThemeToLocalStorage(isDark);
  };

  /**
   * Load the Firestore profile and merge it into user state.
   *
   * Priority for displayName and photoURL:
   *   1. Firestore value  — set by the user in Settings (custom name / uploaded avatar)
   *   2. Auth provider    — Google / Facebook / Apple / X display name and photo
   *
   * All other profile fields (theme, interfaceLang,
   * learningDialect, interests, dayStreak, wordsFound,
   * highestDayStreak) come from Firestore only.
   *
   * @param {object} authUser - The raw Firebase Auth user object fields + token.
   *                            Used as fallback source for displayName and photoURL.
   */
  const loadUserProfile = async (authUser) => {
    if (!authUser?.token || !authUser?.uid) return;
    try {
      const profile = await getUserProfile(authUser.token, authUser.uid);

      // Theme — Firestore is source of truth; localStorage is fallback for guests
      if (profile?.theme) {
        setIsDarkMode(profile.theme === "dark");
        saveThemeToLocalStorage(profile.theme === "dark");
      }

      // Language — Firestore → localStorage → default
      const lang =
        profile?.interfaceLang || localStorage.getItem("interfaceLang") || "en-US";
      setInterfaceLang(lang);
      try {
        localStorage.setItem("interfaceLang", lang);
      } catch {
        // localStorage unavailable
      }

      // Day streak — update in Firestore (no-op if already updated today)
      // Returns { dayStreak, highestDayStreak } — current or newly updated values.
      const { dayStreak, highestDayStreak } = await updateDayStreak(authUser.token, authUser.uid, profile);

      // Words found — derived from the length of seenConceptIds (no extra read needed)
      const wordsFound = profile?.seenConceptIds?.length ?? 0;

      // Seen exercise IDs — tracked per type for exam training features
      const seenExerciseIds = profile?.seenExerciseIds ?? { reading: [], listening: [], writing: [] };

      setUser((prev) => ({
        ...prev,
        // displayName: Firestore → auth provider → keep previous
        displayName: profile?.displayName || authUser?.displayName || prev?.displayName,
        // photoURL: Firestore → auth provider → keep previous
        photoURL: profile?.photoURL || authUser?.photoURL || prev?.photoURL,
        interfaceLang: lang,
        theme: profile?.theme ?? "light",
        // ── Learning profile fields ──────────────────────────────────────────
        // learningDialect: Firestore value only — null means onboarding not completed
        learningDialect: profile?.learningDialect ?? null,
        // interests: Firestore → keep previous → empty array
        interests: profile?.interests ?? prev?.interests ?? [],
        // onboardingCompleted: Firestore flag — used by RequireOnboarding guard
        onboardingCompleted: profile?.onboardingCompleted ?? false,
        // ── Subscription / tier fields ───────────────────────────────────────
        subscriptionTier: profile?.subscriptionTier ?? "explorer",
        subscriptionStatus: profile?.subscriptionStatus ?? null,
        currentPeriodEnd: profile?.currentPeriodEnd ?? null,
        aiCallsToday: profile?.aiCallsToday ?? 0,
        aiCallsDate: profile?.aiCallsDate ?? null,
        // ── Stats fields ─────────────────────────────────────────────────────
        dayStreak,
        highestDayStreak,
        wordsFound,
        seenExerciseIds,
      }));
    } catch (err) {
      showAlert("error", `Could not load your profile: ${err.message}`);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const refreshUser = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken(true);
    const authUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      token,
    };
    // Only set non-profile fields immediately — displayName and photoURL
    // are resolved by loadUserProfile (Firestore first, auth provider fallback)
    setUser((prev) => ({
      ...prev,
      uid: authUser.uid,
      email: authUser.email,
      emailVerified: authUser.emailVerified,
      token: authUser.token,
    }));
    await loadUserProfile(authUser);
  };

  // Sync interfaceLang changes to i18next and load remote translations
  useEffect(() => {
    const loadInitialTranslations = async () => {
      const firebaseUser = auth?.currentUser;
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;
      await loadTranslationsForLang(interfaceLang, token);
    };
    loadInitialTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistent auth listener — stays alive for the app lifetime so token
  // refreshes, custom-token re-auth, and session changes are always reflected.
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      // Anonymous sessions (used to let guests read public data like
      // translations) must never be treated as a real logged-in user.
      if (firebaseUser && !firebaseUser.isAnonymous) {
        const token = await firebaseUser.getIdToken();
        const authUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          token,
        };
        // Only set non-profile fields immediately — displayName and photoURL
        // are resolved by loadUserProfile (Firestore first, auth provider fallback)
        setUser((prev) => ({
          ...prev,
          uid: authUser.uid,
          email: authUser.email,
          emailVerified: authUser.emailVerified,
          token: authUser.token,
        }));
        loadUserProfile(authUser);
      } else {
        setUser(null);
        setIsLoadingUser(false);
        const savedTheme = getSavedTheme();
        setIsDarkMode(savedTheme);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginGoogle = async () => {
    try {
      const result = await loginWithGoogle();
      // Do NOT call setUser or loadUserProfile here — onAuthStateChanged fires
      // immediately after signInWithCustomToken and handles both.
      return result;
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  const loginApple = async () => {
    try {
      return await loginWithApple();
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  const loginFacebook = async () => {
    try {
      return await loginWithFacebook();
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  const loginTwitter = async () => {
    try {
      return await loginWithTwitter();
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  const logoutUser = async () => {
    try {
      await logoutUserService();
      setUser(null);
      setIsDarkMode(false);
      setExamSession(null);
      return { success: true };
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  // Show full-page loading while translations are being fetched
  if (isLoadingTranslations) {
    return <Loader isDarkMode={isDarkMode} fullScreen message="Loading translations..." />;
  }

  return (
    <AppContext.Provider
      value={{
        isDarkMode,
        setIsDarkMode: setIsDarkModeWithPersist,
        interfaceLang,
        changeLanguage,
        alert,
        showAlert,
        closeAlert,
        user,
        setUser,
        isLoadingUser,
        isLoadingTranslations,
        loginGoogle,
        loginApple,
        loginFacebook,
        loginTwitter,
        logoutUser,
        refreshUser,
        tokenExpired,
        handleTokenExpired,
        dismissTokenExpired,
        validateToken,
        // Supported languages & writing systems
        supportedLanguages,
        interfaceLanguageOptions,
        writingSystems,
        isLoadingLanguages,
        isLoadingWritingSystems,
        refreshSupportedLanguages,
        // Full Exam session
        examSession,
        setExamSession,
        updateExamSection,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(AppContext);


