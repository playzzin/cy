const https = require('node:https');
const hostingApi = 'https://firebasehosting.googleapis.com';

// Firebase CLI honors proxy settings. Use the same route for release reads.
async function releaseFetch(url, options) {
  if (process.env.NODE_USE_ENV_PROXY === '1' || !(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy)) {
    return fetch(url, options);
  }
  const { default: fetchThroughAgent } = await import('node-fetch');
  const agent = new https.Agent({ proxyEnv: process.env });
  return fetchThroughAgent(url, { ...options, agent });
}

async function discardBody(response) {
  if (response.body?.cancel) await response.body.cancel();
  else response.body?.destroy?.();
}

function networkProblem(error) {
  const cause = error.cause || error;
  const code = cause.code || cause.errors?.[0]?.code || cause.name;
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return `DNS 이름 조회 실패 (${code})`;
  if (['EACCES', 'EPERM'].includes(code)) return `네트워크 접근 차단 (${code})`;
  if (['TimeoutError', 'AbortError', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) return '연결 시간 초과';
  return /^[A-Z][A-Z0-9_]+$/.test(code || '') ? `HTTPS 연결 실패 (${code})` : 'HTTPS 연결 실패';
}

async function checkHostingApi(project, { request = releaseFetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const url = `${hostingApi}/v1beta1/projects/${encodeURIComponent(project)}/sites/${encodeURIComponent(project)}`;
  let failure;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await request(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8000) });
    } catch (error) {
      failure = networkProblem(error);
    }
    if (response) {
      await discardBody(response);
      // This read sends no credentials. The normal Firebase command checks IAM.
      if ((response.ok || [401, 403, 404].includes(response.status)) && response.headers.get('content-type')?.includes('application/json')) return;
      failure = `HTTP ${response.status}`;
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    }
    if (attempt === 0) await wait(600);
  }
  throw new Error(`Firebase Hosting API 연결 점검 실패 · firebasehosting.googleapis.com · ${failure}`);
}

module.exports = { releaseFetch, discardBody, networkProblem, checkHostingApi };
