process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

const {
  patchReactScriptsWebpack,
  patchReactScriptsWebpackDevServer,
} = require('./patchReactScriptsWebpack');

patchReactScriptsWebpack();
patchReactScriptsWebpackDevServer();
require('react-scripts/scripts/start');
