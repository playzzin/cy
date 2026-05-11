process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
process.env.GENERATE_SOURCEMAP = process.env.GENERATE_SOURCEMAP ?? 'false';

const { patchReactScriptsWebpack } = require('./patchReactScriptsWebpack');

patchReactScriptsWebpack();
require('react-scripts/scripts/build');
