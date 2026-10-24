process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';
require('react-scripts/config/env');
require('./browser-env-security.cjs').stripServerAiCredentials();

const shouldRunTypeChecker = process.argv.includes('--typecheck');
process.env.DISABLE_FORK_TS_CHECKER =
  process.env.DISABLE_FORK_TS_CHECKER ?? (shouldRunTypeChecker ? 'false' : 'true');

const {
  patchReactScriptsWebpack,
  patchReactScriptsWebpackDevServer,
} = require('./patchReactScriptsWebpack');

patchReactScriptsWebpack();
patchReactScriptsWebpackDevServer();
require('react-scripts/scripts/start');
