import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  loginWithGoogle,
  logout as logoutUserService,
} from "../services/authService";
import { getUserProfile, updateDayStreak } from "../services/userService";
import { auth } from "../firebase";
import PropTypes from "prop-types";

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
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [user, setUser] = useState(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const tokenCheckRef = useRef(null);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
  };

  const closeAlert = () => {
    setAlert((prev) => ({ ...prev, show: false }));
  };

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
    setAlert({ show: false, type: "", message: "" });
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
      if (firebaseUser && tokenExpired) {
        // User re-authenticated (e.g. signed in again from another tab)
        setTokenExpired(false);
        setAlert({ show: false, type: "", message: "" });
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Change interface language and persist
  const changeLanguage = (lang) => {
    setInterfaceLang(lang);
    try {
      localStorage.setItem("interfaceLang", lang);
    } catch {
      // localStorage unavailable
    }
  };

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
   * learningDialect, interests, dayStreak, wordsFound) come from Firestore only.
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
      // Returns the current or newly incremented streak value.
      const dayStreak = await updateDayStreak(authUser.token, authUser.uid, profile);

      // Words found — derived from the length of seenConceptIds (no extra read needed)
      const wordsFound = profile?.seenConceptIds?.length ?? 0;

      // Seen exercise IDs — tracked globally for exam training features
      const seenExerciseIds = profile?.seenExerciseIds ?? [];

      setUser((prev) => ({
        ...prev,
        // displayName: Firestore → auth provider → keep previous
        displayName: profile?.displayName || authUser?.displayName || prev?.displayName,
        // photoURL: Firestore → auth provider → keep previous
        photoURL: profile?.photoURL || authUser?.photoURL || prev?.photoURL,
        interfaceLang: lang,
        theme: profile?.theme ?? "light",
        // ── Learning profile fields ──────────────────────────────────────────
        // learningDialect: Firestore → hardcoded default pt-PT
        learningDialect: profile?.learningDialect ?? "pt-PT",
        // interests: Firestore → keep previous → empty array
        interests: profile?.interests ?? prev?.interests ?? [],
        // ── Stats fields ─────────────────────────────────────────────────────
        dayStreak,
        wordsFound,
        seenExerciseIds,
      }));
    } catch (err) {
      showAlert("error", `Could not load your profile: ${err.message}`);
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

  // Sync interfaceLang changes to i18next
  useEffect(() => {
    import("i18next").then((i18nModule) => {
      i18nModule.default.changeLanguage(interfaceLang);
    });
  }, [interfaceLang]);

  // Persistent auth listener — stays alive for the app lifetime so token
  // refreshes, custom-token re-auth, and session changes are always reflected.
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

  const logoutUser = async () => {
    try {
      await logoutUserService();
      setUser(null);
      setIsDarkMode(false);
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
        alert,
        showAlert,
        closeAlert,
        user,
        setUser,
        loginGoogle,
        logoutUser,
        refreshUser,
        tokenExpired,
        handleTokenExpired,
        dismissTokenExpired,
        validateToken,
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
