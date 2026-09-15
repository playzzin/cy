const test = require('node:test');
const assert = require('node:assert/strict');
const { assertHostingTarget } = require('./verify-hosting-target.cjs');
const { validateFirebaseBuildEnvironment, REQUIRED_FIREBASE_ENV_KEYS } = require('./validate-firebase-build-env.js');
const stage = { deployment: { environment: 'staging', projectId: 'cy-erp-staging-9c1e4' } };
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
