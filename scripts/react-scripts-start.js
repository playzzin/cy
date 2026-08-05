process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

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
