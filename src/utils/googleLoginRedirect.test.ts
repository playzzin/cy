import { clearGoogleLoginRedirect, normalizeLoginReturnPath, readGoogleLoginRedirect, rememberGoogleLoginRedirect } from './googleLoginRedirect';

beforeEach(() => sessionStorage.clear());
it.each(['https://example.test', '//example.test', '/\\example.test', '/', '/login?from=x'])('rejects external or looping destination %s', value => {
  expect(normalizeLoginReturnPath(value)).toBe('/dashboard');
});
it('keeps the original path, query and fragment through reload without storing credentials', () => {
  rememberGoogleLoginRedirect('/payroll/daily?month=11#summary');
  expect(readGoogleLoginRedirect()?.returnPath).toBe('/payroll/daily?month=11#summary');
  expect(Object.keys(JSON.parse(sessionStorage.getItem('cy_google_login_redirect')!)).sort()).toEqual(['returnPath', 'startedAt']);
  clearGoogleLoginRedirect();
  expect(readGoogleLoginRedirect()).toBeNull();
});
it('ignores expired, malformed and future redirect attempts', () => {
  for (const value of ['{', JSON.stringify({ returnPath: '/dashboard', startedAt: Date.now() - 16 * 60000 }), JSON.stringify({ returnPath: '/dashboard', startedAt: Date.now() + 60000 })]) {
    sessionStorage.setItem('cy_google_login_redirect', value);
    expect(readGoogleLoginRedirect()).toBeNull();
  }
});
