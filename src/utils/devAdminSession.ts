import type { User } from 'firebase/auth';

export const DEV_ADMIN_STORAGE_KEY = 'cy_dev_admin_session';

const isLocalDevelopmentHost = (): boolean => {
  if (typeof window === 'undefined') return false;

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
};

export const isDevAdminAllowed = (): boolean => (
  process.env.NODE_ENV === 'development' && isLocalDevelopmentHost()
);

export const enableDevAdminSession = (): void => {
  if (!isDevAdminAllowed()) return;
  window.localStorage.setItem(DEV_ADMIN_STORAGE_KEY, '1');
};

export const disableDevAdminSession = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEV_ADMIN_STORAGE_KEY);
};

export const isDevAdminSessionEnabled = (): boolean => {
  if (!isDevAdminAllowed()) return false;

  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get('devAdmin');

  if (queryValue === '1') {
    enableDevAdminSession();
    return true;
  }

  if (queryValue === '0') {
    disableDevAdminSession();
    return false;
  }

  return window.localStorage.getItem(DEV_ADMIN_STORAGE_KEY) === '1';
};

export const createDevAdminUser = (): User | null => {
  if (!isDevAdminSessionEnabled()) return null;

  return {
    uid: 'dev-admin',
    email: 'dev-admin@localhost',
    emailVerified: true,
    displayName: '개발자 관리자',
    isAnonymous: false,
    phoneNumber: null,
    photoURL: null,
    providerId: 'dev-admin',
    providerData: [],
    metadata: {},
    refreshToken: 'dev-admin',
    tenantId: null,
    delete: async () => undefined,
    getIdToken: async () => 'dev-admin-token',
    getIdTokenResult: async () => ({
      token: 'dev-admin-token',
      authTime: new Date().toISOString(),
      issuedAtTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      signInProvider: 'custom',
      signInSecondFactor: null,
      claims: {
        role: 'admin',
        position: '사장',
        systemRole: '관리자',
        roles: ['admin', '관리자', '사장', '매니저1', '지원담당'],
        additionalPositions: ['매니저1', '지원담당'],
      },
    }),
    reload: async () => undefined,
    toJSON: () => ({ uid: 'dev-admin', email: 'dev-admin@localhost' }),
  } as User;
};
