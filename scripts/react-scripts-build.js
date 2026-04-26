process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const { patchReactScriptsWebpack } = require('./patchReactScriptsWebpack');

patchReactScriptsWebpack();
require('react-scripts/scripts/build');
