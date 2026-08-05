import {
  applyDocumentTheme,
  getStoredDarkModePreference,
  persistDarkModePreference,
  resolveDarkModePreference,
  THEME_STORAGE_KEY,
} from './themeMode';

describe('themeMode', () => {
  it('resolves stored dark and light preferences', () => {
    expect(resolveDarkModePreference('dark')).toBe(true);
    expect(resolveDarkModePreference('light')).toBe(false);
    expect(resolveDarkModePreference(null, true)).toBe(true);
    expect(resolveDarkModePreference(undefined, false)).toBe(false);
  });

  it('reads and persists the theme storage key', () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    expect(getStoredDarkModePreference(mockStorage, true)).toBe(true);
    expect(persistDarkModePreference(false, mockStorage)).toBe('light');
    expect(storage.get(THEME_STORAGE_KEY)).toBe('light');
    expect(getStoredDarkModePreference(mockStorage, true)).toBe(false);
  });

  it('applies root class, dataset and color scheme', () => {
    applyDocumentTheme(true, document);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyDocumentTheme(false, document);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
