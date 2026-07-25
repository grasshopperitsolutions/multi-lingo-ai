import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  loginWithGoogle,
  logout as logoutUserService,
} from "../services/authService";
import { getUserProfile, updateDayStreak } from "../services/userService";
import { getLanguages, getWritingSystems } from "../services/supportedLanguagesService";
import { auth } from "../firebase";
import PropTypes from "prop-types";
import i18n from "../i18n";

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
  const [isDarkMode, setIsDarkMode] = useState(getSavedTheme());
  const [interfaceLang, setInterfaceLang] = useState(getSavedLanguage());
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isChangingInterfaceLanguage, setIsChangingInterfaceLanguage] = useState(false);
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
  const refreshSupportedLanguages = useCallback(async () => {
    const firebaseUser = auth?.currentUser;
    const token = firebaseUser?.getIdToken?.() ?? null;
    if (!token) return;

    setIsLoadingLanguages(true);
    setIsLoadingWritingSystems(true);
    try {
      const [langs, writings] = await Promise.all([
        getLanguages(token),
        getWritingSystems(token),
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

  // Load languages on startup (after auth)
  useEffect(() => {
    if (auth?.currentUser) {
      refreshSupportedLanguages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setAlert({
      show: true,
      type: "error",
      message: "__SESSION_EXPIRED__",
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
      if (firebaseUser && tokenExpired) {
        setTokenExpired(false);
        setAlert({ show: false, type: "", message: "", action: null });
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load and register a locale bundle from Firestore (with sessionStorage cache),
   * then switch i18next to that language.
   *
   * - If the bundle is already registered in i18next → just call changeLanguage.
   * - Otherwise → fetch via localeService, register, then change language.
   * - While loading, isChangingInterfaceLanguage is true so UI can show a subtle indicator.
   * - Falls back to en-US silently if the locale cannot be fetched.
   */
  const changeLanguage = useCallback(async (lang) => {
    // Persist the preference immediately so it survives a refresh
    setInterfaceLang(lang);
    try {
      localStorage.setItem("interfaceLang", lang);
    } catch {
      // localStorage unavailable
    }

    // en-US is already bundled — no fetch needed
    if (lang === 'en-US') {
      i18n.changeLanguage(lang);
      return;
    }

    setIsChangingInterfaceLanguage(true);
    try {
      const firebaseUser = auth?.currentUser;
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;
      if (token) {
        const { ensureLocaleLoaded } = await import('../services/localeService');
        await ensureLocaleLoaded(lang, token);
      }
      // Switch language — bundle is now registered (or we fall back to en-US)
      i18n.changeLanguage(lang);
    } catch (err) {
      console.error('[AppContext] Failed to load locale for', lang, err);
      // Don't crash — fall back to en-US
      i18n.changeLanguage('en-US');
    } finally {
      setIsChangingInterfaceLanguage(false);
    }
  }, []);

  /**
   * After auth, load only the user's interfaceLang locale from Firestore.
   * Avoids loading all 5 locales at startup.
   */
  const loadUserInterfaceLocale = useCallback(async (lang, token) => {
    if (!lang || lang === 'en-US' || !token) return;
    try {
      const { ensureLocaleLoaded } = await import('../services/localeService');
      const loaded = await ensureLocaleLoaded(lang, token);
      if (loaded) {
        i18n.changeLanguage(lang);
      }
    } catch (err) {
      console.error('[AppContext] loadUserInterfaceLocale failed:', err);
    }
  }, []);

  // Safe theme setter that persists to localStorage
  const setIsDarkModeWithPersist = (isDark) => {
    setIsDarkMode(isDark);
    saveThemeToLocalStorage(isDark);
  };

  /**
   * Load the Firestore profile and merge it into user state.
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

      // Lazy-load the user's interface locale from Firestore (non-blocking)
      loadUserInterfaceLocale(lang, authUser.token);

      // Day streak
      const { dayStreak, highestDayStreak } = await updateDayStreak(authUser.token, authUser.uid, profile);

      const wordsFound = profile?.seenConceptIds?.length ?? 0;
      const seenExerciseIds = profile?.seenExerciseIds ?? { reading: [], listening: [], writing: [] };

      setUser((prev) => ({
        ...prev,
        displayName: profile?.displayName || authUser?.displayName || prev?.displayName,
        photoURL: profile?.photoURL || authUser?.photoURL || prev?.photoURL,
        interfaceLang: lang,
        theme: profile?.theme ?? "light",
        learningDialect: profile?.learningDialect ?? null,
        interests: profile?.interests ?? prev?.interests ?? [],
        onboardingCompleted: profile?.onboardingCompleted ?? false,
        subscriptionTier: profile?.subscriptionTier ?? "explorer",
        subscriptionStatus: profile?.subscriptionStatus ?? null,
        currentPeriodEnd: profile?.currentPeriodEnd ?? null,
        aiCallsToday: profile?.aiCallsToday ?? 0,
        aiCallsDate: profile?.aiCallsDate ?? null,
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
    setUser((prev) => ({
      ...prev,
      uid: authUser.uid,
      email: authUser.email,
      emailVerified: authUser.emailVerified,
      token: authUser.token,
    }));
    await loadUserProfile(authUser);
  };

  // Persistent auth listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        const authUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          token,
        };
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
      return result;
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

  return (
    <AppContext.Provider
      value={{
        isDarkMode,
        setIsDarkMode: setIsDarkModeWithPersist,
        interfaceLang,
        changeLanguage,
        isChangingInterfaceLanguage,
        alert,
        showAlert,
        closeAlert,
        user,
        setUser,
        isLoadingUser,
        loginGoogle,
        logoutUser,
        refreshUser,
        tokenExpired,
        handleTokenExpired,
        dismissTokenExpired,
        validateToken,
        supportedLanguages,
        writingSystems,
        isLoadingLanguages,
        isLoadingWritingSystems,
        refreshSupportedLanguages,
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
