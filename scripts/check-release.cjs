const fs = require('node:fs');
const path = require('node:path');
const { root, hash, sourceState, compareRelease } = require('./release-manifest.cjs');

async function readRemoteJson(base, name) {
  const url = new URL(name, `${base.replace(/\/$/, '')}/`);
  url.searchParams.set('releaseCheck', Date.now().toString());
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store' });
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error(`${name} 확인 실패 (${response.status})`);
  return response.json();
}
async function checkRelease(base) {
  const local = JSON.parse(fs.readFileSync(path.join(root, 'build', 'release.json'), 'utf8'));
  const state = sourceState();
  if (state.dirty || local.dirty || local.commit !== state.commit || Object.keys(state.fingerprints).some(key => state.fingerprints[key] !== local.fingerprints[key])) {
    throw new Error('현재 코드와 배포 파일이 다릅니다. 변경 사항을 커밋한 뒤 다시 빌드해 주세요.');
  }
  const [remote, assets] = await Promise.all([readRemoteJson(base, 'release.json'), readRemoteJson(base, 'asset-manifest.json')]);
  const comparison = compareRelease(local, remote);
  const localAssets = JSON.parse(fs.readFileSync(path.join(root, 'build', 'asset-manifest.json'), 'utf8'));
  // Compare parsed manifests as Hosting may vary JSON whitespace.
  const assetsMatch = hash(JSON.stringify(assets)) === hash(JSON.stringify(localAssets));
  if (!comparison.known || !comparison.hostingMatches || !assetsMatch || comparison.changed.length || local.commit !== remote.commit) {
    throw new Error(`사이트 반영 확인 필요: ${comparison.changed.join(', ') || '웹 파일 또는 버전 차이'}`);
  }
  console.log(`웹 반영 확인 완료: ${remote.commit.slice(0, 8)} · ${base}`);
  console.log('서버 기능·권한 설정은 별도 배포 결과와 동작 점검으로 확인합니다. 웹 기록만으로 서버 반영을 판단하지 않습니다.');
  return remote;
}
module.exports = { checkRelease, readRemoteJson };
if (require.main === module) checkRelease(process.argv[2] || 'https://cyee-9c1e4.web.app').catch(error => { console.error(error.message); process.exitCode = 1; });
