export const THEME_STORAGE_KEY = 'cy-cheongyeon-theme';

export type ThemePreference = 'dark' | 'light';

export const resolveDarkModePreference = (
  storedTheme: string | null | undefined,
  defaultDarkMode = true
): boolean => {
  if (storedTheme === 'dark') return true;
  if (storedTheme === 'light') return false;
  return defaultDarkMode;
};
export const getStoredDarkModePreference = (
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
  defaultDarkMode = true
): boolean => {
  if (!storage) return defaultDarkMode;
  return resolveDarkModePreference(storage.getItem(THEME_STORAGE_KEY), defaultDarkMode);
};

export const persistDarkModePreference = (
  isDarkMode: boolean,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined
): ThemePreference => {
  const theme: ThemePreference = isDarkMode ? 'dark' : 'light';
  storage?.setItem(THEME_STORAGE_KEY, theme);
  return theme;
};

export const applyDocumentTheme = (
  isDarkMode: boolean,
  documentRef: Document | undefined = typeof document !== 'undefined' ? document : undefined
): void => {
  if (!documentRef?.documentElement) return;

  const root = documentRef.documentElement;
  root.classList.toggle('dark', isDarkMode);
  root.dataset.theme = isDarkMode ? 'dark' : 'light';
  root.style.colorScheme = isDarkMode ? 'dark' : 'light';
};
