import { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


// Force HMR update
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;
    const timeoutId = window.setTimeout(() => {
      if (resolved) return;
      setLoading(false);
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      resolved = true;
      window.clearTimeout(timeoutId);

      setCurrentUser(user);
      setLoading(false);

      if (user) {
        (async () => {
          try {
            // Import dynamically to avoid circular dependency if any,
            // though here it's fine as userService doesn't import AuthContext
            const { userService } = await import('../services/userService');
            await userService.saveUser(user);
          } catch (error) {
            console.error('Failed to save user data:', error);
          }
        })();
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const { loginLogService } = await import('../services/loginLogService');
      await loginLogService.safeCreateLog({
        action: 'login_success',
        provider: 'password',
        method: 'email/password',
        user: result.user,
        email,
      });
    } catch (error) {
      const { loginLogService } = await import('../services/loginLogService');
      await loginLogService.safeCreateLog({
        action: 'login_failed',
        provider: 'password',
        method: 'email/password',
        email,
        errorCode: (error as { code?: string })?.code || null,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async function signup(email: string, password: string) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const { loginLogService } = await import('../services/loginLogService');
    await loginLogService.safeCreateLog({
      action: 'signup_success',
      provider: 'password',
      method: 'email/password',
      user: result.user,
      email,
    });
  }

  async function logout() {
    const user = auth.currentUser;
    const { loginLogService } = await import('../services/loginLogService');
    await loginLogService.safeCreateLog({
      action: 'logout',
      provider: 'firebase',
      method: 'manual',
      user,
      email: user?.email || null,
    });
    await firebaseSignOut(auth);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const { loginLogService } = await import('../services/loginLogService');
      await loginLogService.safeCreateLog({
        action: 'login_success',
        provider: 'google',
        method: 'popup',
        user: result.user,
        email: result.user.email,
      });
    } catch (error) {
      const { loginLogService } = await import('../services/loginLogService');
      await loginLogService.safeCreateLog({
        action: 'login_failed',
        provider: 'google',
        method: 'popup',
        errorCode: (error as { code?: string })?.code || null,
        errorMessage: error instanceof Error ? error.message : String(error),
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
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
