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

  const loadUserProfile = async (authUser) => {
    if (!authUser?.token || !authUser?.uid) return;
    try {
      const profile = await getUserProfile(authUser.token, authUser.uid);
      // Load theme from Firebase profile
      if (profile?.theme) {
        setIsDarkMode(profile.theme === "dark");
        saveThemeToLocalStorage(profile.theme === "dark");
      }
      // Load language from Firebase profile or fallback to localStorage/browser
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
        displayName: profile?.displayName ?? prev?.displayName,
        interfaceLang: lang,
        theme: profile?.theme ?? "light",
        photoURL: profile?.photoURL ?? prev?.photoURL,
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
    setUser((prev) => ({ ...prev, ...authUser }));
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
  // Also loads saved preferences from localStorage on mount.
  useEffect(() => {
    if (!auth) return; // guard for SSG build where Firebase is not initialised
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
        setUser((prev) => ({ ...prev, ...authUser }));
        loadUserProfile(authUser);
      } else {
        setUser(null);
        // On logout, use saved preferences from localStorage instead of hardcoding
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
      if (result.success) {
        setUser(result.user);
        await loadUserProfile(result.user);
      }
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
