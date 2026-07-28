import {
  signInWithPopup,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
} from 'firebase/auth';
import { auth } from '../firebase';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Shared social-login flow: Firebase popup sign-in, then proxy verification.
 * First-time users are automatically registered via the API. Whether a given
 * provider is actually available is decided by the backend (`/api/auth`),
 * which may reject unsupported providers — this just wires the flow through.
 * @param {import('firebase/auth').AuthProvider} provider
 * @param {string} action - proxy action name, e.g. 'google', 'apple'
 * @returns {Promise<Object>} User data including uid, email, displayName, token
 */
const socialLogin = async (provider, action) => {
  try {
    const popupResult = await signInWithPopup(auth, provider);
    const idToken = await popupResult.user.getIdToken();

    const response = await fetch(`${PROXY_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, idToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify with proxy');
    }

    const { customToken, ...userData } = await response.json();

    if (customToken) {
      const cred = await signInWithCustomToken(auth, customToken);
      // Get a fresh ID token from the signed-in custom-token session
      const token = await cred.user.getIdToken();
      return { success: true, user: { ...userData, uid: cred.user.uid, token } };
    }

    // Fallback: re-fetch token from current auth state
    const token = await popupResult.user.getIdToken(true);
    return { success: true, user: { ...userData, token } };
  } catch (error) {
    console.error(`${action} login error:`, error);
    throw error;
  }
};

export const loginWithGoogle = () => socialLogin(new GoogleAuthProvider(), 'google');

export const loginWithApple = () => socialLogin(new OAuthProvider('apple.com'), 'apple');

export const loginWithFacebook = () => socialLogin(new FacebookAuthProvider(), 'facebook');

export const loginWithTwitter = () => socialLogin(new TwitterAuthProvider(), 'twitter');

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
