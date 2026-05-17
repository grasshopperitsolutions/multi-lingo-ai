import { createContext, useContext, useState, useEffect } from "react";
import {
  loginWithGoogle,
  logout as logoutUserService,
} from "../services/authService";
import { getUserProfile } from "../services/userService";
import { auth } from "../firebase";
import PropTypes from "prop-types";

const AppContext = createContext();

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
    return saved || "en";
  } catch {
    return "en";
  }
};

export const AppProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(getSavedTheme());
  const [interfaceLang, setInterfaceLang] = useState(getSavedLanguage());
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [user, setUser] = useState(null);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
  };

  const closeAlert = () => {
    setAlert((prev) => ({ ...prev, show: false }));
  };

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
   * All other profile fields (theme, interfaceLang) have no provider fallback
   * and come from Firestore only.
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
        profile?.interfaceLang || localStorage.getItem("interfaceLang") || "en";
      setInterfaceLang(lang);
      try {
        localStorage.setItem("interfaceLang", lang);
      } catch {
        // localStorage unavailable
      }

      setUser((prev) => ({
        ...prev,
        // displayName: Firestore → auth provider → keep previous
        displayName: profile?.displayName || authUser?.displayName || prev?.displayName,
        // photoURL: Firestore → auth provider → keep previous
        photoURL: profile?.photoURL || authUser?.photoURL || prev?.photoURL,
        interfaceLang: lang,
        theme: profile?.theme ?? "light",
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAppContext = () => useContext(AppContext);
