import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Auth, User } from 'firebase/auth';
import { createDevAdminUser, disableDevAdminSession, isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { loginAccessTracker, writeAuthLog, writeLogoutLog } from '../services/loginAccessTracker';

type FirebaseAuthModule = typeof import('firebase/auth');

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loading: boolean;
}

let firebaseAuthLoader: Promise<{ auth: Auth; authModule: FirebaseAuthModule }> | null = null;

const PUBLIC_AUTH_OBSERVER_DELAY_MS = 5000;

const loadFirebaseAuth = () => {
  firebaseAuthLoader =
    firebaseAuthLoader ||
    Promise.all([
      import('../config/firebaseAuth'),
      import('firebase/auth')
    ]).then(([firebaseAuth, authModule]) => ({
      auth: firebaseAuth.auth,
      authModule
    }));

  return firebaseAuthLoader;
};

const shouldDeferAuthObserver = () => {
  if (typeof window === 'undefined') return false;
  const { pathname } = window.location;

  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/company/landing' ||
    pathname.startsWith('/homepage/client/')
  );
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => createDevAdminUser());
  const [loading, setLoading] = useState(() => !isDevAdminSessionEnabled());

  useEffect(() => {
    const devAdminUser = createDevAdminUser();
    if (devAdminUser) {
      loginAccessTracker.observe(devAdminUser);
      setCurrentUser(devAdminUser);
      setLoading(false);
      return () => undefined;
    }

    let resolved = false;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const observerDelay = shouldDeferAuthObserver() ? PUBLIC_AUTH_OBSERVER_DELAY_MS : 0;

    const timeoutId = window.setTimeout(() => {
      if (resolved || cancelled) return;
      resolved = true;
      setLoading(false);
    }, observerDelay + 8000);

    const startAuthObserver = async () => {
      try {
        const { auth, authModule } = await loadFirebaseAuth();
        if (cancelled) return;

        unsubscribe = authModule.onAuthStateChanged(auth, (user) => {
          if (cancelled) return;
          loginAccessTracker.observe(user);
          resolved = true;
          window.clearTimeout(timeoutId);

          setCurrentUser(user);
          setLoading(false);

          if (user) {
            (async () => {
              try {
                const { userService } = await import('../services/userService');
                await userService.saveUser(user);
              } catch (error) {
                console.error('Failed to save user data:', error);
              }
            })();
          }
        });
      } catch (error) {
        console.error('Failed to initialize Firebase auth:', error);
        resolved = true;
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    const observerTimerId = window.setTimeout(() => {
      void startAuthObserver();
    }, observerDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearTimeout(observerTimerId);
      unsubscribe?.();
    };
  }, []);

  async function login(email: string, password: string) {
    const { auth, authModule } = await loadFirebaseAuth();
    const finishAccess = loginAccessTracker.beginInteractiveLogin();

    try {
      const result = await authModule.signInWithEmailAndPassword(auth, email, password);
      finishAccess(result.user);
      setCurrentUser(result.user);
      setLoading(false);

      void writeAuthLog({
        action: 'login_success',
        provider: 'password',
        method: 'email/password',
        user: result.user,
        email,
      });
    } catch (error) {
      void writeAuthLog({
        action: 'login_failed',
        provider: 'password',
        method: 'email/password',
        email,
        errorCode: (error as { code?: string })?.code || null,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      finishAccess();
    }
  }

  async function signup(email: string, password: string) {
    const { auth, authModule } = await loadFirebaseAuth();
    const finishAccess = loginAccessTracker.beginInteractiveLogin();
    try {
      const result = await authModule.createUserWithEmailAndPassword(auth, email, password);
      finishAccess(result.user);
      setCurrentUser(result.user);
      setLoading(false);
      void writeAuthLog({ action: 'signup_success', provider: 'password', method: 'email/password', user: result.user, email });
    } finally {
      finishAccess();
    }
  }

  async function logout() {
    if (isDevAdminSessionEnabled()) {
      const user = createDevAdminUser();
      await writeLogoutLog({ action: 'logout', provider: 'dev-admin', method: 'manual', user });
      loginAccessTracker.observe(null);
      disableDevAdminSession();
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    const { auth, authModule } = await loadFirebaseAuth();
    const user = auth.currentUser;
    await writeLogoutLog({
      action: 'logout',
      provider: 'firebase',
      method: 'manual',
      user,
      email: user?.email || null,
    });

    if (user?.uid) {
      try {
        const { disableRememberedNotificationDevice } = await import('../features/bank-notifications/bankNotificationService');
        const revokeServerRegistration = disableRememberedNotificationDevice(user.uid);
        const revokeLocalSubscription = (async () => {
          if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(async (registration) => {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) await subscription.unsubscribe();
          }));
        })();
        let timeoutId: number | undefined;
        const completed = await Promise.race([
          Promise.allSettled([revokeServerRegistration, revokeLocalSubscription]).then(() => true),
          new Promise<boolean>((resolve) => {
            timeoutId = window.setTimeout(() => resolve(false), 2000);
          }),
        ]);
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        if (!completed) {
          console.warn('[AuthContext] push revocation timed out; continuing secure sign-out.');
        }
      } catch (error) {
        // Logout must still complete when the device is offline. The server also
        // filters disabled/suspended users and registrations older than 90 days.
        console.warn('[AuthContext] current browser push revocation could not be completed.', error);
      }
    }

    await authModule.signOut(auth);
    loginAccessTracker.observe(null);
    setCurrentUser(null);
    setLoading(false);
  }

  async function loginWithGoogle() {
    const { auth, authModule } = await loadFirebaseAuth();
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const finishAccess = loginAccessTracker.beginInteractiveLogin();

    try {
      const result = await authModule.signInWithPopup(auth, provider);
      finishAccess(result.user);
      setCurrentUser(result.user);
      setLoading(false);

      void writeAuthLog({
        action: 'login_success',
        provider: 'google',
        method: 'popup',
        user: result.user,
        email: result.user.email,
      });
    } catch (error) {
      void writeAuthLog({
        action: 'login_failed',
        provider: 'google',
        method: 'popup',
        errorCode: (error as { code?: string })?.code || null,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      finishAccess();
    }
  }

  const value = {
    currentUser,
    login,
    signup,
    logout,
    loginWithGoogle,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
