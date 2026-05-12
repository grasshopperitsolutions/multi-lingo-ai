import { 
  signInWithPopup, 
  signInWithCustomToken,
  signOut as firebaseSignOut,
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth } from '../firebase';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Login with Google using Firebase popup and proxy verification
 * @returns {Promise<Object>} User data including uid, email, displayName
 */
export const loginWithGoogle = async () => {
  try {
    // Step 1: Sign in with Google popup to get Google ID token
    const provider = new GoogleAuthProvider();
    const googleResult = await signInWithPopup(auth, provider);
    
    // Get the Google ID token
    const googleIdToken = await googleResult.user.getIdToken();
    
    // Step 2: Send ID token to proxy for verification and get custom token
    const response = await fetch(`${PROXY_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'google',
        idToken: googleIdToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify with proxy');
    }

    const { customToken, ...userData } = await response.json();

    // Step 3: Sign in with custom token to establish Firebase session
    // This ensures the user is properly authenticated in the Firebase client
    if (customToken) {
      await signInWithCustomToken(auth, customToken);
    }

    return {
      success: true,
      user: userData,
    };
  } catch (error) {
    console.error('Google login error:', error);
    throw error;
  }
};

/**
 * Login with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} User data
 */
export const loginWithEmail = async (email, password) => {
  try {
    const response = await fetch(`${PROXY_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'login',
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const { customToken, ...userData } = await response.json();

    // Sign in with custom token if provided
    if (customToken) {
      await signInWithCustomToken(auth, customToken);
    }

    return {
      success: true,
      user: userData,
    };
  } catch (error) {
    console.error('Email login error:', error);
    throw error;
  }
};

/**
 * Register a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} displayName - User's display name
 * @returns {Promise<Object>} User data
 */
export const register = async (email, password, displayName) => {
  try {
    const response = await fetch(`${PROXY_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'register',
        email,
        password,
        displayName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    const { customToken, ...userData } = await response.json();

    // Sign in with custom token if provided
    if (customToken) {
      await signInWithCustomToken(auth, customToken);
    }

    return {
      success: true,
      user: userData,
    };
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

/**
 * Logout the current user
 * @returns {Promise<void>}
 */
export const logout = async () => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

/**
 * Check if user is currently authenticated
 * @returns {Promise<Object|null>} Current user or null
 */
export const getCurrentUser = () => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      unsubscribe();
      if (firebaseUser) {
        // Get fresh ID token
        const token = await firebaseUser.getIdToken();
        resolve({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          token,
        });
      } else {
        resolve(null);
      }
    });
  });
};