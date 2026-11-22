import { setRequestDraftOwner } from '../utils/requestDraftStore';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Auth, User } from 'firebase/auth';
import { createDevAdminUser, disableDevAdminSession, isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { loginAccessTracker, writeAuthLog, writeLogoutLog } from '../services/loginAccessTracker';
import { isDevPreviewFrame, postPreviewMessage, startDevPreviewAuth } from '../utils/devPreviewRuntime';
import { clearGoogleLoginRedirect, readGoogleLoginRedirect, rememberGoogleLoginRedirect } from '../utils/googleLoginRedirect';
import { getGoogleAuthErrorMessage } from '../utils/firebaseAuthError';
import { clearLocalGoogleLogin, consumeLocalGoogleCredential, startLocalGoogleLogin, usesLocalGoogleLogin } from '../utils/localGoogleLogin';

type FirebaseAuthModule = typeof import('firebase/auth');

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: (options?: { remember?: boolean; returnPath?: string }) => Promise<void>;
  loading: boolean;
  authError: string;
}

let firebaseAuthLoader: Promise<{ auth: Auth; authModule: FirebaseAuthModule }> | null = null;

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

// Share completion across StrictMode remounts so a redirect is logged once.
let googleRedirectCompletion: Promise<void> | null = null;
let googleRedirectAttempt: number | null = null;
const completeGoogleRedirect = (auth: Auth, authModule: FirebaseAuthModule, startedAt: number, flow?: 'local-google'): Promise<void> => {
  if (googleRedirectCompletion && googleRedirectAttempt === startedAt) return googleRedirectCompletion;
  googleRedirectAttempt = startedAt;
  const finishAccess = loginAccessTracker.beginInteractiveLogin();
  googleRedirectCompletion = Promise.resolve().then(() => flow === 'local-google'
    ? authModule.signInWithCredential(auth, authModule.GoogleAuthProvider.credential(consumeLocalGoogleCredential()))
    : authModule.getRedirectResult(auth)).then(result => {
    if (!result) throw Object.assign(new Error('Google sign-in did not complete'), { code: 'auth/redirect-cancelled' });
    finishAccess(result.user);
    void writeAuthLog({ action: 'login_success', provider: 'google', method: 'redirect', user: result.user, email: result.user.email });
  }).catch(error => {
    void writeAuthLog({ action: 'login_failed', provider: 'google', method: 'redirect',
      errorCode: (error as { code?: string })?.code || null, errorMessage: getGoogleAuthErrorMessage(error) });
    throw error;
  }).finally(() => {
    clearGoogleLoginRedirect();
    finishAccess();
  });
  return googleRedirectCompletion;
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
  const [previewError, setPreviewError] = useState('');
  const [authError, setAuthError] = useState('');
  useEffect(() => { setRequestDraftOwner(currentUser?.uid ?? null); }, [currentUser?.uid]);

  useEffect(() => {
    if (isDevPreviewFrame) return startDevPreviewAuth(user => { setCurrentUser(user); setLoading(false); }, message => { setPreviewError(message); setLoading(false); });
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

    const timeoutId = window.setTimeout(() => {
      if (resolved || cancelled) return;
      resolved = true;
      setAuthError('로그인 상태 확인이 지연되고 있습니다. 연결을 확인하고 다시 시도해 주세요.');
      setLoading(false);
    }, 12000);

    const startAuthObserver = async () => {
      try {
        const { auth, authModule } = await loadFirebaseAuth();
        if (cancelled) return;

        const redirect = readGoogleLoginRedirect();
        if (redirect) {
          void completeGoogleRedirect(auth, authModule, redirect.startedAt, redirect.flow).catch(error => {
            if (!cancelled) setAuthError(getGoogleAuthErrorMessage(error));
          });
        }

        unsubscribe = authModule.onAuthStateChanged(auth, (user) => {
          if (cancelled) return;
          loginAccessTracker.observe(user);
          resolved = true;
          window.clearTimeout(timeoutId);

          setCurrentUser(user);
          setLoading(false);
          if (user) setAuthError('');

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
        console.error('Failed to initialize Firebase auth.');
        if (cancelled) return;
        setAuthError('로그인 서비스를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
        resolved = true;
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    void startAuthObserver();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      unsubscribe?.();
    };
  }, []);

  async function login(email: string, password: string, remember = true) {
    if (isDevPreviewFrame) throw new Error('미리보기에서는 로그인 정보를 변경할 수 없습니다.');
    const { auth, authModule } = await loadFirebaseAuth();
    const finishAccess = loginAccessTracker.beginInteractiveLogin();

    try {
      setAuthError('');
      await authModule.setPersistence(auth, remember ? authModule.browserLocalPersistence : authModule.browserSessionPersistence);
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
    if (isDevPreviewFrame) throw new Error('미리보기에서는 계정을 만들 수 없습니다.');
    const { auth, authModule } = await loadFirebaseAuth();
    const finishAccess = loginAccessTracker.beginInteractiveLogin();
    try {
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
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
    clearGoogleLoginRedirect();
    clearLocalGoogleLogin();
    if (isDevPreviewFrame) { postPreviewMessage('cy-preview:exit'); return; }
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

  async function loginWithGoogle({ remember = true, returnPath = '/dashboard' } = {}) {
    if (isDevPreviewFrame) throw new Error('미리보기에서는 로그인 정보를 변경할 수 없습니다.');
    const { auth, authModule } = await loadFirebaseAuth();
    const provider = new authModule.GoogleAuthProvider();
    try {
      setAuthError('');
      await authModule.setPersistence(auth, remember ? authModule.browserLocalPersistence : authModule.browserSessionPersistence);
      if (usesLocalGoogleLogin()) {
        rememberGoogleLoginRedirect(returnPath, 'local-google');
        await startLocalGoogleLogin(auth.app.options.apiKey || '');
      } else {
        rememberGoogleLoginRedirect(returnPath);
        await authModule.signInWithRedirect(auth, provider);
      }
    } catch (error) {
      clearGoogleLoginRedirect();
      clearLocalGoogleLogin();
      void writeAuthLog({
        action: 'login_failed',
        provider: 'google',
        method: 'redirect',
        errorCode: (error as { code?: string })?.code || null,
        errorMessage: getGoogleAuthErrorMessage(error),
      });
      throw error;
    }
  }

  const value = {
    currentUser,
    login,
    signup,
    logout,
    loginWithGoogle,
    loading,
    authError,
  };

  if (isDevPreviewFrame && previewError) return <p role="alert" className="p-6">{previewError}</p>;

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
