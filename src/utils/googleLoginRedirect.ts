const STORAGE_KEY = 'cy_google_login_redirect';
const MAX_AGE_MS = 15 * 60 * 1000;

export const normalizeLoginReturnPath = (value: string): string => {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  const pathname = value.split(/[?#]/)[0];
  return pathname === '/' || pathname === '/login' ? '/dashboard' : value;
};

export const readGoogleLoginRedirect = (): { returnPath: string; startedAt: number; flow?: 'local-google' } | null => {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (!value || typeof value.returnPath !== 'string' || typeof value.startedAt !== 'number'
      || Date.now() - value.startedAt > MAX_AGE_MS || value.startedAt > Date.now()) return null;
    return { returnPath: normalizeLoginReturnPath(value.returnPath), startedAt: value.startedAt,
      ...(value.flow === 'local-google' ? { flow: 'local-google' as const } : {}) };
  } catch { return null; }
};

export const rememberGoogleLoginRedirect = (returnPath: string, flow?: 'local-google'): void => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      returnPath: normalizeLoginReturnPath(returnPath), startedAt: Date.now(), ...(flow ? { flow } : {}),
    }));
  } catch {
    throw Object.assign(new Error('Login redirect storage is unavailable'), { code: 'auth/web-storage-unsupported' });
  }
};

export const clearGoogleLoginRedirect = (): void => {
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be blocked. */ }
};
