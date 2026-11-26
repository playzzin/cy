const { spawnSync } = require('node:child_process');
const { root } = require('./release-manifest.cjs');
const { releaseFetch, discardBody, networkProblem } = require('./hosting-network.cjs');
const githubUrl = 'https://github.com/playzzin/cy.git';
const mainRef = 'refs/heads/main';
const githubRefUrl = 'https://api.github.com/repos/playzzin/cy/git/ref/heads/main';
const githubRepository = 'playzzin/cy';

function publishedRemote(originUrl) {
  return /^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)playzzin\/cy(?:\.git)?\/?$/i.test(originUrl)
    ? 'origin' : githubUrl;
}

function gitProblem(result) {
  const detail = result.stderr || '';
  if (/getaddrinfo|could not resolve|could not be resolved|name resolution/i.test(detail)) return 'DNS 이름 조회 실패';
  if (/authentication failed|permission denied \(publickey\)|could not read username|repository not found/i.test(detail)) return '저장소 접근 또는 인증 실패';
  if (/certificate|SSL|TLS/i.test(detail)) return 'TLS 연결 실패';
  if (result.error) return networkProblem(result.error);
  return `원격 참조 조회 실패 (종료 코드 ${result.status ?? '?'})`;
}

async function readPublishedMain({ git = spawnSync, request = releaseFetch, env = process.env } = {}) {
  const options = { cwd: root, encoding: 'utf8', timeout: 12000, env: { ...env, GIT_TERMINAL_PROMPT: '0' } };
  const origin = git('git', ['remote', 'get-url', 'origin'], options);
  const result = git('git', ['ls-remote', '--exit-code', publishedRemote(origin.stdout?.trim() || ''), mainRef], options);
  const match = /^([a-f0-9]{40})\s+refs\/heads\/main$/.exec(result.stdout?.trim() || '');
  if (!result.error && result.status === 0 && match) return match[1];
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'cy-hosting-release', 'Cache-Control': 'no-cache' };
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  let problem;
  try {
    response = await request(githubRefUrl, { headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const ref = await response.json();
      if (ref.ref === mainRef && ref.object?.type === 'commit' && /^[a-f0-9]{40}$/.test(ref.object.sha)) return ref.object.sha;
      problem = 'main 참조 응답 불일치';
    } else {
      problem = `HTTP ${response.status}`;
      await discardBody(response);
    }
  } catch (error) { problem = response?.ok ? 'main 참조 응답 형식 오류' : networkProblem(error); }
  throw new Error(`GitHub main 확인 실패 · github.com Git: ${gitProblem(result)} · api.github.com HTTPS: ${problem}`);
}

async function assertPublishedMain(commit, readMain = readPublishedMain) {
  const published = await readMain();
  if (commit !== published) throw new Error(`배포 중단. 로컬 ${commit.slice(0, 8)}, GitHub main ${published.slice(0, 8)}. 커밋과 푸시 상태를 확인하세요.`);
}

async function assertGitHubQualityGate(commit, { request = releaseFetch, env = process.env } = {}) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== githubRepository
      || env.GITHUB_REF !== mainRef || !env.GH_TOKEN || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('GitHub의 운영 브랜치 배포에서만 자동 검사 결과를 사용할 수 있습니다.');
  }
  const url = new URL(`https://api.github.com/repos/${githubRepository}/actions/workflows/quality.yml/runs`);
  url.search = new URLSearchParams({ branch: 'main', event: 'push', status: 'success', head_sha: commit });
  const response = await request(url.href, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GH_TOKEN}` },
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    await discardBody(response);
    throw new Error(`GitHub Quality Gate 조회 실패 (HTTP ${response.status}).`);
  }
  const { workflow_runs: runs } = await response.json();
  if (!Array.isArray(runs) || !runs.some(run => run.head_sha === commit && run.head_branch === 'main'
      && run.event === 'push' && run.conclusion === 'success' && run.head_repository?.full_name === githubRepository)) {
    throw new Error('이 main 커밋의 Quality Gate 성공 기록이 필요합니다.');
  }
}

async function verifyMainBuild(expected, release, readMain = readPublishedMain) {
  if (!expected) return;
  if (release.dirty !== false || expected !== release.commit) throw new Error('빌드한 커밋이 검사한 운영 커밋과 다릅니다.');
  await assertPublishedMain(expected, readMain);
}

module.exports = { publishedRemote, readPublishedMain, assertPublishedMain, assertGitHubQualityGate, verifyMainBuild };
