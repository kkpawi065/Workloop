import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// This file is generated or provided by the platform
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory with fallback to persistent localStorage
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('workloop_access_token') : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Clear stale local token if isSigningIn is false but user authenticated
        cachedAccessToken = null;
        localStorage.removeItem('workloop_access_token');
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('workloop_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('Sign in already in progress. Ignoring duplicate request.');
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('workloop_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMsg = error?.message || '';
    if (
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/popup-blocked' ||
      errorMsg.includes('cancelled-popup-request') ||
      errorMsg.includes('popup-closed-by-user')
    ) {
      console.warn('Firebase login cancelled or blocked by user/system:', errorMsg);
      return null;
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Removes data this app keeps in the browser (sheet copies, AI analyses, Google token) so it is
// not left behind for the next person on a shared computer.
export const clearLocalPrivateData = () => {
  try {
    const prefixes = ['g_sheet_cache_', 'workloop_ai_analysis_', 'workloop_access_token'];
    Object.keys(localStorage)
      .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Could not clear local data:', error);
  }
};

export const anonymousSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    clearLocalPrivateData();
    const result = await signInAnonymously(auth);
    const guestToken = "GUEST_SESSION_TOKEN";
    cachedAccessToken = guestToken;
    localStorage.setItem('workloop_access_token', guestToken);
    return { user: result.user, accessToken: guestToken };
  } catch (error) {
    console.error("Anonymous sign in error:", error);
    throw error;
  }
};

// Firebase ID token for our own /api endpoints (AI features). Empty when nobody is signed in.
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch (error) {
    console.warn('Could not get Firebase ID token:', error);
    return {};
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  clearLocalPrivateData();
};
