import React, { createContext, useContext, useState, useEffect } from "react";
import { loginWithGoogle, logout as logoutUserService, getCurrentUser } from '../services/authService';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [user, setUser] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
  };

  const closeAlert = () => {
    setAlert({ ...alert, show: false });
  };

  const loginGoogle = async () => {
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        setUser(result.user);
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
      logoutUser
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
