const fs = require('node:fs');
const path = require('node:path');

function readLock(directory) {
  const file = path.join(directory, 'package-lock.json');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
}

function installedDependencyLock(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  for (let dir = root; ; dir = path.dirname(dir)) {
    const modules = path.join(dir, 'node_modules');
    const installed = path.join(modules, '.package-lock.json');
    if (fs.existsSync(installed)) {
      if (dir === root) return installed;
      const expected = readLock(root);
      return expected !== null && expected === readLock(dir) ? installed : null;
    }
    // A partially installed package can shadow the parent's copy.
    if (fs.existsSync(modules) && fs.readdirSync(modules).some(name => name !== '.cache')) return null;
    if (dir === path.dirname(dir)) return null;
  }
}

module.exports = { installedDependencyLock };
