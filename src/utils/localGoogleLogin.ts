// localhost cannot share the Firebase-hosted redirect iframe's storage. Use
// Google's ID-token redirect here, then let Firebase verify the credential.
const ATTEMPT_KEY = 'cy_local_google_attempt';
const RESULT_KEY = 'cy_local_google_result';
const MAX_AGE_MS = 10 * 60 * 1000;
const LOCAL_ORIGIN = 'http://localhost:3000';
// /__/ is already excluded by both old and current app service workers.
export const LOCAL_GOOGLE_CALLBACK = '/__/local-google-auth.html';

export const usesLocalGoogleLogin = (origin = window.location.origin): boolean => origin === LOCAL_ORIGIN;
const failure = (code = 'auth/invalid-credential') => Object.assign(new Error('Google login could not be verified'), { code });
const randomValue = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');

export function clearLocalGoogleLogin(): void {
  try { sessionStorage.removeItem(ATTEMPT_KEY); sessionStorage.removeItem(RESULT_KEY); } catch { /* Storage can be unavailable. */ }
}

export async function prepareLocalGoogleLogin(apiKey: string): Promise<string> {
  if (!usesLocalGoogleLogin() || !apiKey) throw failure();
  clearLocalGoogleLogin();
  // Read only the public OAuth client ID configured for this Firebase project.
  // Never put a client secret in the browser or in the local preview server.
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'google.com', continueUri: `${LOCAL_ORIGIN}${LOCAL_GOOGLE_CALLBACK}` }),
  });
  if (!response.ok) throw failure('auth/network-request-failed');
  const configuration = await response.json();
  const configuredUri = new URL(configuration.authUri);
  const clientId = configuredUri.searchParams.get('client_id');
  if (configuredUri.origin !== 'https://accounts.google.com' || !clientId?.endsWith('.apps.googleusercontent.com')) throw failure();
  const attempt = { state: randomValue(), nonce: randomValue(), clientId, startedAt: Date.now() };
  try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt)); }
  catch { throw failure('auth/web-storage-unsupported'); }
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({
    client_id: clientId, redirect_uri: `${LOCAL_ORIGIN}${LOCAL_GOOGLE_CALLBACK}`,
    response_type: 'id_token', scope: 'openid email profile', state: attempt.state, nonce: attempt.nonce,
  }).toString();
  return authorization.toString();
}

export async function startLocalGoogleLogin(apiKey: string): Promise<void> {
  window.location.assign(await prepareLocalGoogleLogin(apiKey));
}

export function consumeLocalGoogleCredential(): string {
  try {
    const attempt = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || 'null');
    const result = JSON.parse(sessionStorage.getItem(RESULT_KEY) || 'null');
    if (!usesLocalGoogleLogin() || !attempt || !result || typeof attempt.startedAt !== 'number'
      || Date.now() - attempt.startedAt > MAX_AGE_MS || attempt.startedAt > Date.now()
      || typeof attempt.nonce !== 'string' || attempt.nonce.length !== 64
      || typeof attempt.clientId !== 'string' || !attempt.clientId.endsWith('.apps.googleusercontent.com')
      || typeof attempt.state !== 'string' || attempt.state.length !== 64 || result.state !== attempt.state) throw failure();
    if (result.error) throw failure('auth/redirect-cancelled');
    const idToken = result.idToken;
    if (typeof idToken !== 'string' || idToken.length > 16384 || idToken.split('.').length !== 3) throw failure();
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)
      || claims.aud !== attempt.clientId || claims.nonce !== attempt.nonce
      || typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) throw failure();
    // These checks bind the response to this tab's request. Firebase's
    // signInWithCredential is still required to verify the signature and user.
    return idToken;
  } catch (error) {
    if ((error as { code?: string })?.code) throw error;
    throw failure();
  } finally { clearLocalGoogleLogin(); }
}
