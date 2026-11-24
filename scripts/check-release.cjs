const fs = require('node:fs');
const path = require('node:path');
const { root, hash, sourceState, compareRelease } = require('./release-manifest.cjs');
const { resolveBuildDirectory, loadBuildEnvironment } = require('./hosting-build-paths.cjs');

const transientCodes = new Set([
  'EAI_AGAIN', 'ENOTFOUND', 'ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET', 'TimeoutError',
]);
async function readRemoteJson(base, name, { allowMissing = false, request = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  async function get(file) {
    const url = new URL(file, `${base.replace(/\/$/, '')}/`);
    for (let attempt = 0; ; attempt++) {
      url.searchParams.set('releaseCheck', Date.now().toString());
      try {
        const response = await request(url, { signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store' });
        if (attempt || ![429, 502, 503, 504].includes(response.status)) return response;
        await response.body?.cancel();
      } catch (error) {
        const code = error.cause?.code || error.name;
        if (attempt || !transientCodes.has(code)) throw new Error(`${url.hostname}/${file} 연결 실패 (${code}): ${error.message}`, { cause: error });
      }
      await wait(1000);
    }
  }
  const response = await get(name);
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`${name} 확인 실패 (HTTP ${response.status})`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    // Firebase can serve the SPA's index.html with status 200 for a missing file.
    if (allowMissing && contentType.includes('text/html')) {
      const html = await response.text();
      if (/<div\s+id=["']root["']/.test(html)) {
        const index = await get('index.html');
        if (index.ok && index.headers.get('content-type')?.includes('text/html') && await index.text() === html) return null;
      }
    }
    throw new Error(`${name} 응답 형식 오류 (HTTP ${response.status}, ${contentType || 'Content-Type 없음'})`);
  }
  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${name}에 유효한 JSON 객체가 없습니다.`);
  return data;
}
async function waitForRelease(base, local, localAssets, { read = readRemoteJson, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), delays = [0, 2000, 4000, 8000] } = {}) {
  let lastError;
  for (const delay of delays) {
    if (delay) await wait(delay);
    try {
      const [remote, assets] = await Promise.all([read(base, 'release.json'), read(base, 'asset-manifest.json')]);
      const comparison = compareRelease(local, remote);
      const assetsMatch = hash(JSON.stringify(assets)) === hash(JSON.stringify(localAssets));
      if (!comparison.known || !comparison.hostingMatches || !assetsMatch || comparison.changed.length || local.commit !== remote.commit) {
        throw new Error(`사이트 반영 확인 필요: ${comparison.changed.join(', ') || '웹 파일 또는 버전 차이'}`);
      }
      return remote;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('배포 버전을 확인하지 못했습니다.');
}
async function checkRelease(base) {
  loadBuildEnvironment();
  const directory = resolveBuildDirectory();
  const local = JSON.parse(fs.readFileSync(path.join(directory, 'release.json'), 'utf8'));
  const state = sourceState();
  if (state.dirty || local.dirty || local.commit !== state.commit || Object.keys(state.fingerprints).some(key => state.fingerprints[key] !== local.fingerprints[key])) {
    throw new Error('현재 코드와 배포 파일이 다릅니다. 변경 사항을 커밋한 뒤 다시 빌드해 주세요.');
  }
  const localAssets = JSON.parse(fs.readFileSync(path.join(directory, 'asset-manifest.json'), 'utf8'));
  const remote = await waitForRelease(base, local, localAssets);
  console.log(`웹 반영 확인 완료: ${remote.commit.slice(0, 8)} · ${base}`);
  console.log('서버 기능·권한 설정은 별도 배포 결과와 동작 점검으로 확인합니다. 웹 기록만으로 서버 반영을 판단하지 않습니다.');
  return remote;
}
module.exports = { checkRelease, readRemoteJson, waitForRelease };
if (require.main === module) checkRelease(process.argv[2] || 'https://cyee-9c1e4.web.app').catch(error => { console.error(error.message); process.exitCode = 1; });
