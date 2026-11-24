const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { stagingOrigin } = require('./hosting-build-paths.cjs');
const { readRemoteJson } = require('./check-release.cjs');
const { REQUIRED_FIREBASE_ENV_KEYS, validateFirebaseBuildEnvironment } = require('./validate-firebase-build-env.js');
const project = require('../firebase.staging.json').hosting.site;
const appId = '1:78299075398:web:58147a7a35a65f7d8f0b47';
const settingsFile = root => path.join(root, '.firebase', 'staging-env.json');

async function refreshStagingSettings(root, request) {
    const config = await readRemoteJson(stagingOrigin, '__/firebase/init.json', { request });
    if (config.projectId !== project || config.appId !== appId) throw new Error('검증 서버의 프로젝트 또는 앱 ID가 다릅니다.');
    const settings = {
        REACT_APP_DEPLOYMENT_ENV: 'staging', REACT_APP_FIREBASE_PROJECT_ID: config.projectId,
        REACT_APP_FIREBASE_API_KEY: config.apiKey, REACT_APP_FIREBASE_AUTH_DOMAIN: config.authDomain,
        REACT_APP_FIREBASE_APP_ID: config.appId, REACT_APP_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
        REACT_APP_FIREBASE_STORAGE_BUCKET: config.storageBucket || `${project}.firebasestorage.app`,
        REACT_APP_FIREBASE_MEASUREMENT_ID: '', REACT_APP_USE_EMULATORS: 'false',
    };
    validateFirebaseBuildEnvironment(settings);
    const file = settingsFile(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tempFile = file + '.' + randomUUID() + '.tmp';
    try {
        fs.writeFileSync(tempFile, JSON.stringify(settings));
        fs.renameSync(tempFile, file);
    } finally { fs.rmSync(tempFile, { force: true }); }
    return settings;
}

async function stagingEnvironment(root, parent = process.env) {
    const file = settingsFile(root);
    const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : await refreshStagingSettings(root);
    if (settings.REACT_APP_DEPLOYMENT_ENV !== 'staging' || settings.REACT_APP_FIREBASE_APP_ID !== appId) {
        throw new Error('검증 앱 설정이 일치하지 않습니다. npm run staging:config로 갱신해 주세요.');
    }
    validateFirebaseBuildEnvironment(settings);
    const env = { ...parent };
    const keys = new Set(Object.keys(parent));
    // CRA also loads dotenv files in its child process. Empty inherited integration values there.
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile() || !/^\.env(?:\.|$)/.test(entry.name)) continue;
        const dotenv = fs.readFileSync(path.join(root, entry.name), 'utf8');
        for (const match of dotenv.matchAll(/^[ \t]*(?:export[ \t]+)?(REACT_APP_[\w.-]+)[ \t]*=/gim)) keys.add(match[1]);
    }
    for (const key of keys) if (/^REACT_APP_/i.test(key)) env[key] = '';
    for (const key of REQUIRED_FIREBASE_ENV_KEYS) env[key] = settings[key];
    return { ...env, REACT_APP_DEPLOYMENT_ENV: 'staging', REACT_APP_USE_EMULATORS: 'false',
        REACT_APP_FIREBASE_MEASUREMENT_ID: '', REACT_APP_CANONICAL_APP_ORIGIN: stagingOrigin };
}

module.exports = { stagingEnvironment, refreshStagingSettings, stagingAppId: appId };
