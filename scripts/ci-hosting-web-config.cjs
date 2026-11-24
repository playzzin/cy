const fs = require('node:fs');
const { readRemoteJson } = require('./check-release.cjs');
const { validateFirebaseBuildEnvironment } = require('./validate-firebase-build-env.js');
const site = require('../firebase.json').hosting.site;

function productionSettings(config) {
  if (config.projectId !== site || config.authDomain !== `${site}.firebaseapp.com`
      || ![`${site}.appspot.com`, `${site}.firebasestorage.app`].includes(config.storageBucket)
      || !/^\d+$/.test(config.messagingSenderId) || !String(config.appId).startsWith(`1:${config.messagingSenderId}:web:`)) {
    throw new Error('운영 Hosting과 공개 웹 앱의 프로젝트가 일치하지 않습니다.');
  }
  const settings = {
    REACT_APP_DEPLOYMENT_ENV: 'production', REACT_APP_FIREBASE_PROJECT_ID: config.projectId,
    REACT_APP_FIREBASE_API_KEY: config.apiKey, REACT_APP_FIREBASE_AUTH_DOMAIN: config.authDomain,
    REACT_APP_FIREBASE_APP_ID: config.appId, REACT_APP_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
    REACT_APP_FIREBASE_STORAGE_BUCKET: config.storageBucket, REACT_APP_FIREBASE_MEASUREMENT_ID: config.measurementId || '',
  };
  validateFirebaseBuildEnvironment(settings);
  for (const value of Object.values(settings)) {
    if (typeof value !== 'string' || /[\r\n\0]/.test(value)) throw new Error('공개 웹 설정 값의 형식이 올바르지 않습니다.');
  }
  return settings;
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_ENV) throw new Error('GitHub Actions 환경 파일이 필요합니다.');
  const config = await readRemoteJson(`https://${site}.web.app`, '__/firebase/init.json');
  const settings = productionSettings(config);
  fs.appendFileSync(process.env.GITHUB_ENV, Object.entries(settings).map(([key, value]) => `${key}=${value}\n`).join(''));
}
module.exports = { productionSettings };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
