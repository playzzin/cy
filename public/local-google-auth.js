/* This isolated page runs before the app, analytics, and error reporting. */
(() => {
  const fragment = window.location.hash.slice(1);
  window.history.replaceState(null, '', window.location.pathname);
  try {
    const attempt = JSON.parse(sessionStorage.getItem('cy_local_google_attempt') || 'null');
    const response = new URLSearchParams(fragment);
    if (window.location.origin !== 'http://localhost:3000' || fragment.length > 20000
      || !attempt || typeof attempt.startedAt !== 'number'
      || Date.now() - attempt.startedAt > 10 * 60 * 1000 || attempt.startedAt > Date.now()
      || typeof attempt.state !== 'string' || attempt.state.length !== 64
      || response.get('state') !== attempt.state) throw new Error('Invalid login response');
    const idToken = response.get('id_token');
    if (!response.has('error') && (!idToken || idToken.length > 16384)) throw new Error('Missing login response');
    sessionStorage.setItem('cy_local_google_result', JSON.stringify({
      state: attempt.state, ...(response.has('error') ? { error: true } : { idToken }),
    }));
    // The app consumes and erases this one-time result before Firebase verifies it.
    window.location.replace('/login');
  } catch {
    try { sessionStorage.removeItem('cy_local_google_attempt'); sessionStorage.removeItem('cy_local_google_result'); } catch { /* No storage. */ }
    document.getElementById('status').textContent = 'Google 로그인을 확인하지 못했습니다. 로그인 화면에서 다시 시도해 주세요.';
  }
})();
