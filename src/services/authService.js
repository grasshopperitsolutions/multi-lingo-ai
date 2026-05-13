import { 
  signInWithPopup,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth } from '../firebase';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Login with Google using Firebase popup and proxy verification.
 * First-time users are automatically registered via the API.
 * @returns {Promise<Object>} User data including uid, email, displayName
 */
export const loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const googleResult = await signInWithPopup(auth, provider);
    const googleIdToken = await googleResult.user.getIdToken();

    const response = await fetch(`${PROXY_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'google', idToken: googleIdToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify with proxy');
    }

    const { customToken, ...userData } = await response.json();

    if (customToken) {
      await signInWithCustomToken(auth, customToken);
    }

    return { success: true, user: userData };
  } catch (error) {
    console.error('Google login error:', error);
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
