const test = require('node:test');
const assert = require('node:assert/strict');
const { assertHostingTarget } = require('./verify-hosting-target.cjs');
const { validateFirebaseBuildEnvironment, REQUIRED_FIREBASE_ENV_KEYS } = require('./validate-firebase-build-env.js');
const stage = { deployment: { environment: 'staging', projectId: 'cy-erp-staging-9c1e4' } };
const fs = require('node:fs');
const path = require('node:path');
const { releaseFixture } = require('./release-test-fixture.cjs');
const { refreshStagingSettings, stagingEnvironment, stagingAppId } = require('./staging-environment.cjs');
const { stagingOrigin, resolveBuildDirectory, targetBuildEnvironment } = require('./hosting-build-paths.cjs');

test('cloud start and staging build use only validated public staging settings, including in a checkout with production dotenv', async t => {
    const root = releaseFixture(t, 'cy-staging-env-');
    const project = stage.deployment.projectId;
    const config = { projectId: project, appId: stagingAppId, apiKey: 'demo-public-fixture',
        authDomain: project + '.firebaseapp.com', messagingSenderId: 'demo-sender', storageBucket: project + '.firebasestorage.app' };
    await refreshStagingSettings(root, async (url, options) => {
        assert.equal(url.origin, stagingOrigin);
        assert.equal(url.pathname, '/__/firebase/init.json');
        assert.equal(options.redirect, 'error');
        return Response.json(config);
    });
    const file = path.join(root, '.firebase/staging-env.json');
    const original = fs.readFileSync(file, 'utf8');
    await assert.rejects(refreshStagingSettings(root, async () => Response.json({ ...config, appId: 'other-app' })), /앱 ID/);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(original), REACT_APP_UNTRUSTED: 'ignored' }));
    fs.writeFileSync(path.join(root, '.env.local'), 'export REACT_APP_EXTERNAL_URL=https://example.invalid\n');
    const env = await stagingEnvironment(root, { REACT_APP_FIREBASE_PROJECT_ID: 'other-project', REACT_APP_PAYMENT_URL: 'ignored', PORT: '4100' });
    assert.equal(env.REACT_APP_FIREBASE_PROJECT_ID, project);
    assert.equal(env.REACT_APP_EXTERNAL_URL, '');
    assert.equal(env.REACT_APP_PAYMENT_URL, '');
    assert.equal(env.REACT_APP_UNTRUSTED, undefined);
    assert.equal(env.PORT, '4100');
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(original), REACT_APP_FIREBASE_AUTH_DOMAIN: 'other-project.firebaseapp.com' }));
    await assert.rejects(stagingEnvironment(root), /다른 프로젝트/);
});

test('staging compilation, Firebase upload and the release checker use a separate Hosting folder', async () => {
    const prod = require('../firebase.json').hosting, staging = require('../firebase.staging.json').hosting;
    assert.notEqual(staging.public, prod.public);
    assert.equal(staging.public.startsWith(prod.public + '/'), false);
    const root = path.resolve(__dirname, '..');
    assert.equal(resolveBuildDirectory(root, targetBuildEnvironment('staging', { BUILD_PATH: prod.public })), path.join(root, staging.public));
    assert.ok(staging.predeploy.includes('node scripts/verify-hosting-build.js staging'));
    const { main } = require('./deploy-staging.cjs');
    const fail = () => { throw new Error('unexpected external operation'); };
    const invocation = await main(['--dry-run'], { getState: fail, execute: fail, verify: fail, log: () => {} });
    for (const [flag, value] of [['--config', path.join(root, 'firebase.staging.json')], ['--project', staging.site], ['--only', 'hosting']]) {
        assert.equal(invocation.args[invocation.args.indexOf(flag) + 1], value);
    }
    await assert.rejects(main([], { getState: () => ({ dirty: true }), execute: fail, verify: fail, log: () => {} }), /커밋/);
});
test('rejects staging assets on production and production assets on staging', () => {
    assert.throws(() => assertHostingTarget(stage, 'production'));
    assert.throws(() => assertHostingTarget({ deployment: { environment: 'production', projectId: 'cyee-9c1e4' } }, 'staging'));
    assert.doesNotThrow(() => assertHostingTarget(stage, 'staging'));
});
test('rejects legacy builds with no deployment identity', () => assert.throws(() => assertHostingTarget({}, 'production')));
test('rejects mixed Firebase projects before compiling', () => {
    const env = Object.fromEntries(REQUIRED_FIREBASE_ENV_KEYS.map(k => [k, 'test']));
    Object.assign(env, { REACT_APP_DEPLOYMENT_ENV: 'staging', REACT_APP_FIREBASE_PROJECT_ID: 'cy-erp-staging-9c1e4', REACT_APP_FIREBASE_AUTH_DOMAIN: 'cy-erp-staging-9c1e4.firebaseapp.com', REACT_APP_FIREBASE_STORAGE_BUCKET: 'cy-erp-staging-9c1e4.firebasestorage.app' });
    assert.doesNotThrow(() => validateFirebaseBuildEnvironment(env));
    assert.throws(() => validateFirebaseBuildEnvironment({ ...env, REACT_APP_FIREBASE_STORAGE_BUCKET: 'cyee-9c1e4.firebasestorage.app' }));
    assert.throws(() => validateFirebaseBuildEnvironment({ ...env, REACT_APP_FIREBASE_PROJECT_ID: 'cyee-9c1e4' }));
    assert.throws(() => validateFirebaseBuildEnvironment({ ...env, REACT_APP_DEPLOYMENT_ENV: 'production' }));
});
