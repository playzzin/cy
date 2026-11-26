const test = require('node:test');
const assert = require('node:assert/strict');
const { checkHostingApi } = require('./hosting-network.cjs');
const { readPublishedMain, assertPublishedMain, assertGitHubQualityGate } = require('./published-main.cjs');
const { main: diagnose } = require('./check-hosting-network.cjs');
const { main: deployStage } = require('./deploy-staging.cjs');
const { main: deployProduction } = require('./deploy-verified.cjs');
const commit = 'a'.repeat(40);
const quiet = () => {};
const unexpected = () => { throw new Error('unexpected operation'); };
const dnsFailure = () => { throw new TypeError('fetch failed', { cause: Object.assign(new Error(), { code: 'ENOTFOUND' }) }); };
const failedGit = (_tool, args) => args[0] === 'remote'
  ? { status: 0, stdout: 'https://github.com/playzzin/cy.git' }
  : { status: 128, stderr: 'getaddrinfo() thread failed to start' };

test('published main prefers Git and falls back only to a live canonical HTTPS commit reference', async () => {
  const git = () => ({ status: 0, stdout: commit + '\trefs/heads/main' });
  assert.equal(await readPublishedMain({ git, request: unexpected }), commit);
  const request = async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/playzzin/cy/git/ref/heads/main');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-value');
    return Response.json({ ref: 'refs/heads/main', object: { type: 'commit', sha: commit } });
  };
  assert.equal(await readPublishedMain({ git: failedGit, request, env: { GH_TOKEN: 'synthetic-test-value' } }), commit);
  await assert.rejects(assertPublishedMain('b'.repeat(40), () => readPublishedMain({ git: failedGit, request, env: { GH_TOKEN: 'synthetic-test-value' } })), /배포 중단/);
  for (const bad of [{ref: 'refs/heads/develop', object:{type:'commit',sha:commit}}, {ref:'refs/heads/main',object:{type:'tag',sha:commit}}, {ref:'refs/heads/main',object:{type:'commit',sha:'short'}}]) {
    await assert.rejects(readPublishedMain({ git: failedGit, request: () => Response.json(bad) }), /main 참조 응답 불일치/);
  }
  await assert.rejects(readPublishedMain({ git: failedGit, request: dnsFailure }), /DNS.*api.github.com.*ENOTFOUND/);
  await assert.rejects(readPublishedMain({ git: failedGit, request: () => Response.json({}, { status: 403 }) }), /HTTP 403/);
});

test('Hosting HTTPS probe sends no credential, accepts Google auth challenges, and bounds retries', async () => {
  for (const status of [200, 401, 403, 404]) {
    await checkHostingApi('demo-site', { wait: unexpected, request: async (url, options) => {
      assert.equal(url, 'https://firebasehosting.googleapis.com/v1beta1/projects/demo-site/sites/demo-site');
      assert.equal(options.headers.Authorization, undefined);
      return Response.json({}, { status });
    } });
  }
  let count = 0;
  await checkHostingApi('demo-site', { wait: quiet, request: () => {
    if (++count === 1) return Response.json({}, { status: 503 });
    return Response.json({}, { status: 401 });
  } });
  assert.equal(count, 2);
  count = 0;
  await assert.rejects(checkHostingApi('demo-site', { wait: quiet, request: () => { count++; dnsFailure(); } }), /firebasehosting.googleapis.com.*DNS.*ENOTFOUND/);
  assert.equal(count, 2);
  await assert.rejects(checkHostingApi('demo-site', { request: () => new Response('proxy response', { status: 403 }), wait: unexpected }), /HTTP 403/);
});

test('both real deploy entrypoints stop before build, tests and upload when Hosting cannot be reached', async () => {
  const sites = [];
  const options = { getState: () => ({ dirty: false, commit }), readMain: () => commit, log: quiet,
    execute: unexpected, readRemote: unexpected, verify: unexpected, verifyRelease: unexpected,
    checkNetwork: async site => { sites.push(site); throw new Error('Hosting probe failed'); } };
  await assert.rejects(deployStage([], options), /Hosting probe failed/);
  await assert.rejects(deployProduction(['--require-main'], options), /Hosting probe failed/);
  assert.deepEqual(sites, ['cy-erp-staging-9c1e4', 'cyee-9c1e4']);
});

test('read-only diagnostics report the other endpoints even when one fails', async () => {
  const lines = [];
  await assert.rejects(diagnose(['staging'], { readMain: dnsFailure, checkApi: quiet, readRecord: () => ({ commit }), log: line => lines.push(line) }), /점검 실패/);
  assert.equal(lines.length, 3);
  assert.match(lines[2], /cy-erp-staging-9c1e4.web.app.*aaaaaaaa/);
  await assert.rejects(diagnose(['unknown'], { readMain: unexpected }), /사용법/);
});

test('single-site diagnostics contact only the selected site', async () => {
  for (const [target, site] of [['staging', 'cy-erp-staging-9c1e4'], ['production', 'cyee-9c1e4']]) {
    const checks = [];
    await diagnose([target], { readMain: () => commit, log: quiet,
      checkApi: async project => checks.push(project),
      readRecord: async (base, name) => { checks.push(`${base}/${name}`); return { commit }; },
    });
    assert.deepEqual(checks, [site, `https://${site}.web.app/release.json`]);
  }
});

test('production builds and live development load only the canonical Hosting app settings', async () => {
  const { productionSettings, readProductionSettings } = require('./ci-hosting-web-config.cjs');
  const site = 'cyee-9c1e4';
  const config = { projectId: site, authDomain: site + '.firebaseapp.com', storageBucket: site + '.firebasestorage.app',
    apiKey: 'synthetic-web-key', messagingSenderId: '111', appId: '1:111:web:demo', measurementId: 'G-DEMO', unrelated: 'omit' };
  const settings = await readProductionSettings((url, options) => {
    assert.equal(url.origin, 'https://cyee-9c1e4.web.app');
    assert.equal(url.pathname, '/__/firebase/init.json');
    assert.equal(options.redirect, 'error');
    return Response.json(config);
  });
  assert.equal(settings.REACT_APP_DEPLOYMENT_ENV, 'production');
  assert.equal(settings.REACT_APP_FIREBASE_PROJECT_ID, site);
  assert.equal(settings.REACT_APP_FIREBASE_MEASUREMENT_ID, 'G-DEMO');
  assert.equal(settings.unrelated, undefined);
  assert.throws(() => productionSettings({ ...config, projectId: 'different' }), /운영/);
  assert.throws(() => productionSettings({ ...config, apiKey: 'demo\nOTHER=value' }), /형식/);
});

test('hosted releases reuse only a successful push check for this exact canonical main commit', async () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'playzzin/cy', GITHUB_REF: 'refs/heads/main', GH_TOKEN: 'fixture-token' };
  const passed = {
    head_sha: commit, head_branch: 'main', event: 'push', conclusion: 'success',
    head_repository: { full_name: 'playzzin/cy' },
  };
  const stub = runs => async (url, options) => {
    const requestUrl = new URL(url);
    assert.equal(requestUrl.origin, 'https://api.github.com');
    assert.equal(requestUrl.pathname, '/repos/playzzin/cy/actions/workflows/quality.yml/runs');
    assert.deepEqual(Object.fromEntries(requestUrl.searchParams), {
      branch: 'main', event: 'push', status: 'success', head_sha: commit,
    });
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    return Response.json({ workflow_runs: runs });
  };
  await assertGitHubQualityGate(commit, { env, request: stub([passed]) });
  for (const mismatch of [
    { head_sha: 'b'.repeat(40) }, { event: 'pull_request' }, { head_branch: 'develop' },
    { conclusion: 'failure' }, { head_repository: { full_name: 'someone/cy' } },
  ]) {
    await assert.rejects(assertGitHubQualityGate(commit, { env, request: stub([{ ...passed, ...mismatch }]) }), /Quality Gate 성공/);
  }
  await assert.rejects(assertGitHubQualityGate(commit, { env: {}, request: unexpected }), /운영 브랜치 배포/);
});

test('Firebase CLI diagnostics report statuses and source locations without raw log data', () => {
  const { diagnostics } = require('./firebase-deploy-diagnostics.cjs');
  assert.deepEqual(diagnostics([
    '[debug] <<< [apiv2][status] GET https://firebase.googleapis.com/v1beta1/projects/cy?key=fixture-private-value 403',
    '[debug] <<< [apiv2][body] {"access_token":"fixture-private-value"}',
    '[debug] TypeError: fixture-private-value',
    '    at run (/runner/node_modules/firebase-tools/lib/requireAuth.js:36:11)',
  ].join('\n')), ['GET firebase.googleapis.com → HTTP 403', 'TypeError', 'firebase-tools/lib/requireAuth.js:36:11']);
});

test('successful main pushes deploy production, and manual retries must verify the selected main commit', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const yaml = require('js-yaml');
  const workflow = name => yaml.load(fs.readFileSync(path.join(__dirname, '../.github/workflows', name), 'utf8'));
  const release = workflow('hosting-release.yml'), upload = workflow('hosting-upload.yml');
  const connectivity = workflow('hosting-connectivity.yml');
  assert.deepEqual(Object.keys(connectivity.on), ['pull_request']);
  assert.deepEqual(connectivity.permissions, { contents: 'read' });
  assert.deepEqual(connectivity.jobs.check.steps.filter(s => s.run).map(s => s.run), ['npm run deploy:check']);
  assert.equal(connectivity.jobs.check.steps[0].with['persist-credentials'], false);
  assert.deepEqual(Object.keys(release.on).sort(), ['workflow_dispatch','workflow_run']);
  assert.deepEqual(release.on.workflow_run.workflows, ['Quality Gate']);
  assert.deepEqual(release.on.workflow_run.types, ['completed']);
  assert.deepEqual(release.on.workflow_run.branches, ['main']);
  assert.deepEqual(release.on.workflow_dispatch.inputs.target.options, ['staging', 'production']);
  assert.equal(release.on.workflow_dispatch.inputs.target.default, 'staging');
  assert.match(release.jobs.check.if, /github\.ref == 'refs\/heads\/main'/);
  assert.match(release.jobs.check.if, /head_repository.full_name == github.repository/);
  assert.match(release.jobs.check.if, /workflow_run.event == 'push'/);
  assert.match(release.jobs.check.if, /workflow_run.conclusion == 'success'/);
  assert.equal(release.jobs.check.permissions['id-token'], undefined);
  const gate = release.jobs.check.steps.find(step => step.id === 'revision');
  assert.equal(gate.env.REVISION, '${{ github.event.workflow_run.head_sha || github.sha }}');
  assert.equal(gate.env.TARGET, "${{ github.event_name == 'workflow_run' && 'production' || inputs.target || 'staging' }}");
  assert.ok(gate.run.includes('"$REVISION" != "$main"'));
  assert.match(gate.run, /workflow_dispatch[\s\S]*quality\.yml\/runs[\s\S]*head_sha="\$REVISION" -f status=success/);
  for (const target of ['staging', 'production']) {
    const job = release.jobs[target];
    assert.equal(job.needs, 'check');
    assert.equal(job.if, `needs.check.outputs.target == '${target}'`);
    assert.deepEqual(job.with, { target, revision: '${{ needs.check.outputs.sha }}' });
  }
  assert.deepEqual(Object.keys(upload.on), ['workflow_call']);
  const job = upload.jobs.upload;
  assert.match(job.if, /refs\/heads\/main/);
  assert.equal(job.environment, '${{ inputs.target }}');
  assert.equal(job.steps.find(step => step.uses?.startsWith('actions/checkout@')).with.ref, '${{ inputs.revision }}');
  assert.ok(job.steps.find(s => s.name === 'Deploy and verify staging').env.CY_DEPLOY_MAIN_COMMIT);
  assert.ok(job.steps.some(s => s.run === 'npm run deploy:main -- --checked-in-github' && s.env?.GH_TOKEN === '${{ github.token }}'));
});
