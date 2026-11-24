const path = require('node:path');

async function start() {
  process.env.BABEL_ENV = 'development';
  process.env.NODE_ENV = 'development';
  let cloudIdentity;
  if (process.argv.includes('--staging')) {
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
  patchReactScriptsWebpackDevServer(cloudIdentity);
  require('react-scripts/scripts/start');
}

start().catch(error => { console.error(error.message); process.exitCode = 1; });
