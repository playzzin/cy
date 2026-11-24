const test = require('node:test');
const assert = require('node:assert/strict');
const { checkHostingApi } = require('./hosting-network.cjs');
const { readPublishedMain, assertPublishedMain } = require('./published-main.cjs');
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

test('cloud production builds emit only the canonical app settings and reject environment-file injection', () => {
  const { productionSettings } = require('./ci-hosting-web-config.cjs');
  const site = 'cyee-9c1e4';
  const config = { projectId: site, authDomain: site + '.firebaseapp.com', storageBucket: site + '.firebasestorage.app',
    apiKey: 'synthetic-web-key', messagingSenderId: '111', appId: '1:111:web:demo', measurementId: 'G-DEMO', unrelated: 'omit' };
  const settings = productionSettings(config);
  assert.equal(settings.REACT_APP_FIREBASE_MEASUREMENT_ID, 'G-DEMO');
  assert.equal(settings.unrelated, undefined);
  assert.throws(() => productionSettings({ ...config, projectId: 'different' }), /운영/);
  assert.throws(() => productionSettings({ ...config, apiKey: 'demo\nOTHER=value' }), /형식/);
});

test('hosted uploads run from verified main, and a combined release waits for successful staging', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const yaml = require('js-yaml');
  const workflow = name => yaml.load(fs.readFileSync(path.join(__dirname, '../.github/workflows', name), 'utf8'));
  const release = workflow('hosting-release.yml'), upload = workflow('hosting-upload.yml');
  assert.deepEqual(Object.keys(release.on).sort(), ['workflow_dispatch','workflow_run']);
  assert.deepEqual(release.on.workflow_run.branches, ['main']);
  assert.match(release.jobs.check.if, /head_repository.full_name == github.repository/);
  assert.match(release.jobs.check.if, /workflow_run.conclusion == 'success'/);
  assert.ok(release.jobs.check.steps.some(s => s.run?.includes('[deploy hosting]') && s.run.includes('git log -1')));
  assert.equal(release.jobs.check.permissions['id-token'], undefined);
  assert.deepEqual(release.jobs.production.needs, ['check','staging']);
  assert.match(release.jobs.production.if, /needs.staging.result == 'success'/);
  assert.deepEqual(Object.keys(upload.on), ['workflow_call']);
  const job = upload.jobs.upload;
  assert.match(job.if, /refs\/heads\/main/);
  assert.equal(job.environment, '${{ inputs.target }}');
  assert.ok(job.steps.find(s => s.name === 'Deploy and verify staging').env.CY_DEPLOY_MAIN_COMMIT);
  assert.ok(job.steps.some(s => s.run === 'npm run deploy:main'));
});
