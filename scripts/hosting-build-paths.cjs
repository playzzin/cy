const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const resolveBuildDirectory = (workspaceRoot = root, environment = process.env) =>
    path.resolve(workspaceRoot, environment.BUILD_PATH || 'build');

function outputSuffix(workspaceRoot, directory) {
    if (directory === path.resolve(workspaceRoot, 'build')) return '';
    return `-${crypto.createHash('sha256').update(directory).digest('hex')}`;
}

// Separate CLI processes (postbuild/verification) must resolve .env BUILD_PATH
// using the same production environment as the compiler.
function loadBuildEnvironment() {
    process.env.NODE_ENV = 'production';
    require('react-scripts/config/env');
}

module.exports = { resolveBuildDirectory, outputSuffix, loadBuildEnvironment };
