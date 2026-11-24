const { spawnSync } = require('node:child_process');
const { root } = require('./release-manifest.cjs');
const githubUrl = 'https://github.com/playzzin/cy.git';

function publishedRemote(originUrl) {
  return /^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)playzzin\/cy(?:\.git)?\/?$/i.test(originUrl)
    ? 'origin' : githubUrl;
}

function readPublishedMain() {
  const origin = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' });
  const result = spawnSync('git', ['ls-remote', '--exit-code', publishedRemote(origin.stdout?.trim() || ''), 'refs/heads/main'],
    { cwd: root, encoding: 'utf8', timeout: 30000 });
  const match = /^([a-f0-9]{40})\s+refs\/heads\/main$/.exec(result.stdout?.trim() || '');
  if (result.error || result.status !== 0 || !match) throw new Error('GitHub main 커밋을 조회하지 못했습니다. GitHub 연결 및 Git 인증을 확인하세요.');
  return match[1];
}

function assertPublishedMain(commit, readMain = readPublishedMain) {
  const published = readMain();
  if (commit !== published) throw new Error(`배포 중단. 로컬 ${commit.slice(0, 8)}, GitHub main ${published.slice(0, 8)}. 커밋과 푸시 상태를 확인하세요.`);
}

function verifyMainBuild(expected, release, readMain = readPublishedMain) {
  if (!expected) return;
  if (release.dirty !== false || expected !== release.commit) throw new Error('빌드한 커밋이 검사한 운영 커밋과 다릅니다.');
  assertPublishedMain(expected, readMain);
}

module.exports = { publishedRemote, readPublishedMain, assertPublishedMain, verifyMainBuild };
