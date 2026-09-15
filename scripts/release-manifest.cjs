const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const groups = {
  hosting: ['src/', 'public/', 'scripts/', 'package.json', 'package-lock.json', 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js'],
  functions: ['functions/src/', 'functions/package.json', 'functions/package-lock.json', 'functions/tsconfig.json'],
  firestore: ['firestore.rules', 'firestore.indexes.json'],
  storage: ['storage.rules'],
  deployment: ['firebase.json', '.firebaserc'],
};
function sourceState() {
  const files = git(['ls-files', '-z']).split('\0').filter(Boolean).sort();
  const fingerprints = Object.fromEntries(Object.entries(groups).map(([group, prefixes]) => {
    const selected = files.filter(file => prefixes.some(prefix => prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix));
    return [group, hash(selected.map(file => `${file}\0${fs.existsSync(path.join(root, file)) ? hash(fs.readFileSync(path.join(root, file))) : 'deleted'}`).join('\n'))];
  }));
  const untrackedSource = git(['ls-files', '--others', '--exclude-standard', '--', 'src', 'public', 'functions/src']);
  return { commit: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain', '--untracked-files=no'])) || Boolean(untrackedSource), fingerprints };
}
function compareRelease(local, remote) {
  if (!remote || remote.schemaVersion !== 1 || !remote.fingerprints || !remote.assetManifestHash) {
    return { known: false, changed: Object.keys(groups), hostingMatches: false };
  }
  return {
    known: true,
    changed: Object.keys(groups).filter(group => local.fingerprints[group] !== remote.fingerprints[group]),
    hostingMatches: local.assetManifestHash === remote.assetManifestHash,
  };
}
function writeManifest() {
  const state = sourceState();
  const assetManifestHash = hash(fs.readFileSync(path.join(root, 'build', 'asset-manifest.json')));
  const manifest = { schemaVersion: 1, ...state, builtAt: new Date().toISOString(), assetManifestHash };
  fs.writeFileSync(path.join(root, 'build', 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`배포 확인 기록 생성: ${state.commit.slice(0, 8)}${state.dirty ? ' (커밋 전 변경 포함)' : ''}`);
  return manifest;
}
module.exports = { root, hash, sourceState, compareRelease, writeManifest };
if (require.main === module) writeManifest();
