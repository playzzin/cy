const path = require('node:path');

async function start() {
  process.env.BABEL_ENV = 'development';
  process.env.NODE_ENV = 'development';
  let cloudIdentity;
  const live = process.argv.includes('--live');
  if (live) {
    if (process.argv.includes('--staging') || process.argv.includes('--cloud-server')) {
      throw new Error('운영 자료 연결은 PC에서 npm run dev:live로 실행해 주세요.');
    }
    const { createServer } = require('node:net');
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', error => reject(error.code === 'EADDRINUSE'
        ? new Error('3000번 포트를 사용 중입니다. 기존 개발 서버를 종료한 후 다시 실행해 주세요.')
        : error));
      probe.listen(3000, '127.0.0.1', () => probe.close(resolve));
    });
    const { readProductionSettings } = require('./ci-hosting-web-config.cjs');
    const settings = await readProductionSettings();
    Object.assign(process.env, settings, {
      REACT_APP_LIVE_DEVELOPMENT: 'true',
      REACT_APP_USE_EMULATORS: 'false',
      REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE: 'firestore',
      REACT_APP_CONSTRUCTION_PLAN_LOCAL_FALLBACK: 'false',
      REACT_APP_CANONICAL_APP_ORIGIN: `https://${settings.REACT_APP_FIREBASE_PROJECT_ID}.web.app`,
      HOST: '127.0.0.1', PORT: '3000', BROWSER: 'none',
    });
    console.log(`CY 운영 자료 연결: http://localhost:3000 · ${settings.REACT_APP_FIREBASE_PROJECT_ID} · 저장한 내용이 운영 ERP에 반영됩니다.`);
  } else if (process.argv.includes('--staging')) {
    const { stagingEnvironment } = require('./staging-environment.cjs');
    const root = path.resolve(__dirname, '..');
    Object.assign(process.env, await stagingEnvironment(root));
    if (process.argv.includes('--cloud-server')) {
      const { execFileSync } = require('node:child_process');
      cloudIdentity = {
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      };
    }
    process.env.HOST ||= '127.0.0.1';
    process.env.PORT ||= '3000';
    process.env.BROWSER ||= 'none';
    console.log(`CY 검증 개발 서버: ${process.env.HOST}:${process.env.PORT} · ${process.env.REACT_APP_FIREBASE_PROJECT_ID}`);
  }
  require('react-scripts/config/env');
  require('./browser-env-security.cjs').stripServerAiCredentials();
  process.env.DISABLE_FORK_TS_CHECKER ??= process.argv.includes('--typecheck') ? 'false' : 'true';
  const { patchReactScriptsWebpack, patchReactScriptsWebpackDevServer } = require('./patchReactScriptsWebpack');
  patchReactScriptsWebpack();
  patchReactScriptsWebpackDevServer(cloudIdentity, live);
  require('react-scripts/scripts/start');
}

start().catch(error => { console.error(error.message); process.exitCode = 1; });
