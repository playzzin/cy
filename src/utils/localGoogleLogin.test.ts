import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import { webcrypto } from 'crypto';
import { clearLocalGoogleLogin, consumeLocalGoogleCredential, prepareLocalGoogleLogin, usesLocalGoogleLogin, usesStagingGooglePopup } from './localGoogleLogin';

const clientId = 'synthetic.apps.googleusercontent.com';
const originalLocation = Object.getOwnPropertyDescriptor(window, 'location')!;
const originalFetch = global.fetch;
const originalCrypto = Object.getOwnPropertyDescriptor(global, 'crypto');
const attempt = () => ({ state: 's'.repeat(64), nonce: 'n'.repeat(64), clientId, startedAt: Date.now() });
const token = (changes = {}) => `fixture.${btoa(JSON.stringify({ iss: 'https://accounts.google.com', aud: clientId, nonce: 'n'.repeat(64), exp: Date.now() / 1000 + 600, ...changes }))}.fixture`;
beforeAll(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: { origin: 'http://localhost:3000', assign: jest.fn() } });
  Object.defineProperty(global, 'crypto', { configurable: true, value: webcrypto });
});
afterAll(() => {
  Object.defineProperty(window, 'location', originalLocation); global.fetch = originalFetch;
  if (originalCrypto) Object.defineProperty(global, 'crypto', originalCrypto);
  else Reflect.deleteProperty(global, 'crypto');
});
beforeEach(() => { sessionStorage.clear(); jest.clearAllMocks(); });

it('uses the local flow only for the registered local origin', () => {
  expect(usesLocalGoogleLogin()).toBe(true);
  for (const origin of ['https://cyee-9c1e4.web.app', 'http://localhost:3000.attacker.test', 'http://localhost:4000']) expect(usesLocalGoogleLogin(origin)).toBe(false);
});

it('uses the Firebase popup only on the staging preview loopback origin', () => {
  expect(usesStagingGooglePopup('http://127.0.0.1:3000', true)).toBe(true);
  expect(usesStagingGooglePopup('http://127.0.0.1:3000', false)).toBe(false);
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:4000', 'https://cy-erp-staging-9c1e4.web.app']) {
    expect(usesStagingGooglePopup(origin, true)).toBe(false);
  }
});

it('requests only an ID token with independent unpredictable state and nonce', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ authUri: `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}` }) });
  const first = new URL(await prepareLocalGoogleLogin('synthetic-api-key'));
  const second = new URL(await prepareLocalGoogleLogin('synthetic-api-key'));
  expect(first.origin).toBe('https://accounts.google.com');
  expect(first.searchParams.get('redirect_uri')).toBe('http://localhost:3000/__/local-google-auth.html');
  expect(first.searchParams.get('response_type')).toBe('id_token');
  expect(first.searchParams.get('state')).toHaveLength(64);
  expect(first.searchParams.get('nonce')).not.toBe(first.searchParams.get('state'));
  expect(first.searchParams.get('state')).not.toBe(second.searchParams.get('state'));
  expect(JSON.stringify(sessionStorage)).not.toContain('synthetic-api-key');
});

it.each(['https://attacker.test/?client_id=synthetic.apps.googleusercontent.com', 'https://accounts.google.com/?client_id=invalid'])('rejects invalid discovery responses', async authUri => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ authUri }) });
  await expect(prepareLocalGoogleLogin('synthetic-api-key')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
});

it('consumes the response once and erases the temporary credential', () => {
  const idToken = token();
  sessionStorage.setItem('cy_local_google_attempt', JSON.stringify(attempt()));
  sessionStorage.setItem('cy_local_google_result', JSON.stringify({ state: attempt().state, idToken }));
  expect(consumeLocalGoogleCredential()).toBe(idToken);
  expect(sessionStorage.length).toBe(0);
  expect(() => consumeLocalGoogleCredential()).toThrow();
});

it.each([{ nonce: 'wrong' }, { aud: 'wrong' }, { iss: 'https://attacker.test' }, { exp: 0 }])('rejects claims not bound to this login request: %o', claims => {
  sessionStorage.setItem('cy_local_google_attempt', JSON.stringify(attempt()));
  sessionStorage.setItem('cy_local_google_result', JSON.stringify({ state: attempt().state, idToken: token(claims) }));
  expect(() => consumeLocalGoogleCredential()).toThrow();
  expect(sessionStorage.length).toBe(0);
});

it.each(['state', 'expired', 'future', 'cancelled'])('rejects %s and removes pending credentials', scenario => {
  const pending = attempt();
  if (scenario === 'expired') pending.startedAt -= 11 * 60000;
  if (scenario === 'future') pending.startedAt += 60000;
  sessionStorage.setItem('cy_local_google_attempt', JSON.stringify(pending));
  sessionStorage.setItem('cy_local_google_result', JSON.stringify({ state: scenario === 'state' ? 'wrong' : pending.state, idToken: token(), error: scenario === 'cancelled' }));
  expect(() => consumeLocalGoogleCredential()).toThrow();
  expect(sessionStorage.length).toBe(0);
});

const callbackScript = readFileSync(join(process.cwd(), 'public/__/local-google-auth.js'), 'utf8');
function callback(fragment: string, origin = 'http://localhost:3000') {
  const replaceState = jest.fn();
  const replace = jest.fn();
  const status = { textContent: '' };
  runInNewContext(callbackScript, {
    window: { location: { origin, pathname: '/__/local-google-auth.html', hash: `#${fragment}`, replace }, history: { replaceState } },
    sessionStorage, URLSearchParams, Date, document: { getElementById: () => status },
  });
  return { replaceState, replace, status };
}

it('clears the sensitive fragment before returning to the app, without placing credentials in the destination URL', () => {
  const idToken = token();
  sessionStorage.setItem('cy_local_google_attempt', JSON.stringify(attempt()));
  const result = callback(new URLSearchParams({ state: attempt().state, id_token: idToken }).toString());
  expect(result.replaceState).toHaveBeenCalledWith(null, '', '/__/local-google-auth.html');
  expect(result.replace).toHaveBeenCalledWith('/login');
  expect(result.replaceState.mock.invocationCallOrder[0]).toBeLessThan(result.replace.mock.invocationCallOrder[0]);
  expect(consumeLocalGoogleCredential()).toBe(idToken);
});

it.each(['state', 'origin', 'expired'])('does not relay a callback with invalid %s', scenario => {
  const pending = attempt();
  if (scenario === 'expired') pending.startedAt -= 11 * 60000;
  sessionStorage.setItem('cy_local_google_attempt', JSON.stringify(pending));
  const result = callback(new URLSearchParams({ state: scenario === 'state' ? 'wrong' : pending.state, id_token: token() }).toString(), scenario === 'origin' ? 'https://attacker.test' : undefined);
  expect(result.replace).not.toHaveBeenCalled();
  expect(result.replaceState).toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
  expect(result.status.textContent).toContain('다시 시도');
});

it('clears temporary data on logout and retry', () => {
  sessionStorage.setItem('cy_local_google_result', 'fixture');
  clearLocalGoogleLogin();
  expect(sessionStorage.length).toBe(0);
});

it('keeps credential callback pages outside app-shell/offline caching in the deployed service worker', () => {
  const listeners: Record<string, (event: unknown) => void> = {};
  runInNewContext(readFileSync(join(process.cwd(), 'public/service-worker.js'), 'utf8'), {
    self: { location: { origin: 'http://localhost:3000' }, addEventListener: (type: string, handler: (event: unknown) => void) => { listeners[type] = handler; } }, URL,
  });
  const respondWith = jest.fn();
  for (const filename of ['local-google-auth.html', 'local-google-auth.js']) {
    listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: `http://localhost:3000/__/${filename}` }, respondWith });
  }
  expect(respondWith).not.toHaveBeenCalled();
});
