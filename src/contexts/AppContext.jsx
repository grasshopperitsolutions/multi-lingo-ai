import { createContext, useContext, useState, useEffect } from "react";
import { loginWithGoogle, logout as logoutUserService, getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/userService';
import PropTypes from "prop-types";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [user, setUser] = useState(null);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
  };

  const closeAlert = () => {
    setAlert((prev) => ({ ...prev, show: false }));
  };

  const loadUserProfile = async (authUser) => {
    if (!authUser?.token || !authUser?.uid) return;
    try {
      const profile = await getUserProfile(authUser.token, authUser.uid);
      if (profile?.theme) {
        setIsDarkMode(profile.theme === 'dark');
      }
      setUser((prev) => ({
        ...prev,
        displayName: profile?.displayName ?? prev?.displayName,
        interfaceLang: profile?.interfaceLang ?? 'en',
        theme: profile?.theme ?? 'light',
        photoURL: profile?.photoURL ?? prev?.photoURL,
      }));
    } catch (err) {
      showAlert('error', `Could not load your profile: ${err.message}`);
    }
  };

  const refreshUser = async () => {
    const authUser = await getCurrentUser();
    if (authUser) {
      // Update auth fields (including fresh token) before merging Firestore profile
      setUser((prev) => ({ ...prev, ...authUser }));
      await loadUserProfile(authUser);
    }
  };

  useEffect(() => {
    getCurrentUser().then((authUser) => {
      if (authUser) {
        setUser(authUser);
        loadUserProfile(authUser);
      }
    });
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
      showAlert('error', e.message);
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
      showAlert('error', e.message);
      return { success: false };
    }
  };

  return (
    <AppContext.Provider value={{
      isDarkMode,
      setIsDarkMode,
      alert,
      showAlert,
      closeAlert,
      user,
      setUser,
      loginGoogle,
      logoutUser,
      refreshUser,
    }}>
      {children}
    </AppContext.Provider>
  );
};

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAppContext = () => useContext(AppContext);
