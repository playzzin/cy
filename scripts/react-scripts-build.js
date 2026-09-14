process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
process.env.GENERATE_SOURCEMAP = process.env.GENERATE_SOURCEMAP ?? 'false';

// CRA loads .env.production/.env.local here. Validate before webpack starts so
// a bundle that cannot initialize Firebase Auth is never considered deployable.
require('react-scripts/config/env');
const { validateFirebaseBuildEnvironment } = require('./validate-firebase-build-env');

try {
  validateFirebaseBuildEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { patchReactScriptsWebpack } = require('./patchReactScriptsWebpack');

patchReactScriptsWebpack();
require('react-scripts/scripts/build');
