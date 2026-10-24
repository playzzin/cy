const { spawnSync } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env, GCLOUD_PROJECT:'demo-dev-user-preview', FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099', FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199' };
const target = process.argv[2] === 'browser' ? 'scripts/test-dev-preview-browser.cjs' : 'scripts/test-dev-preview-rules.mjs';
const result = spawnSync(process.execPath,[target],{cwd:path.resolve(__dirname,'..'),env,stdio:'inherit',windowsHide:true});
process.exitCode=result.status ?? 1;
