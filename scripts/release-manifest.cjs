const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { resolveBuildDirectory, outputSuffix, loadBuildEnvironment } = require('./hosting-build-paths.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const groups = {
  hosting: ['src/', 'public/', 'scripts/', 'package.json', 'package-lock.json', 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js'],
  functions: ['functions/src/', 'functions/package.json', 'functions/package-lock.json', 'functions/tsconfig.json'],
  firestore: ['firestore.rules', 'firestore.indexes.json'],
  storage: ['storage.rules'],
  deployment: ['firebase.json', 'firebase.staging.json', '.firebaserc'],
};
const backendGroups = Object.entries(groups).filter(([group]) => group !== 'hosting');
const backendFingerprintFormat = 'git-tree-v1';
const inGroup = (file, prefixes) => prefixes.some(prefix => prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix);
function gitBackendFingerprints(commit, workspaceRoot = root) {
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('서버 소스를 비교할 Git 커밋이 올바르지 않습니다.');
  const paths = backendGroups.flatMap(([, prefixes]) => prefixes);
  const entries = git(['ls-tree', '-r', '-z', '--full-tree', commit, '--', ...paths], workspaceRoot).split('\0').filter(Boolean);
  return Object.fromEntries(backendGroups.map(([group, prefixes]) => {
    const records = entries.filter(entry => inGroup(entry.slice(entry.indexOf('\t') + 1), prefixes));
    return [group, hash(records.join('\0'))];
  }));
}
const buildStartPath = (workspaceRoot, directory) => path.join(workspaceRoot, '.firebase', `release-source-start${outputSuffix(workspaceRoot, directory)}.json`);
function sourceState(workspaceRoot = root) {
  const prefixes = [...new Set(Object.values(groups).flat())];
  // New feature files affect the bundle before they are tracked by Git as well.
  const files = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...prefixes], workspaceRoot).split('\0').filter(Boolean))].sort();
  const untrackedSource = git(['ls-files', '--others', '--exclude-standard', '--', ...prefixes], workspaceRoot);
  const dirty = Boolean(git(['status', '--porcelain', '--untracked-files=no'], workspaceRoot)) || Boolean(untrackedSource);
  const commit = git(['rev-parse', 'HEAD'], workspaceRoot);
  // Clean backend sources are identified by Git paths, modes and blobs so a Windows checkout and CI agree.
  const rawGroups = dirty ? Object.entries(groups) : [['hosting', groups.hosting]];
  const fingerprints = Object.fromEntries(rawGroups.map(([group, prefixes]) => {
    const selected = files.filter(file => inGroup(file, prefixes));
    return [group, hash(selected.map(file => `${file}\0${fs.existsSync(path.join(workspaceRoot, file)) ? hash(fs.readFileSync(path.join(workspaceRoot, file))) : 'deleted'}`).join('\n'))];
  }));
  if (dirty) return { commit, dirty, fingerprints };
  return { commit, dirty, backendFingerprintFormat, fingerprints: { ...fingerprints, ...gitBackendFingerprints(commit, workspaceRoot) } };
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
function sameSourceState(start, end) {
  return start.commit === end.commit && start.dirty === end.dirty
    && Object.keys(groups).every(key => start.fingerprints?.[key] === end.fingerprints?.[key]);
}
function beginBuild(workspaceRoot = root, environment = process.env) {
  const directory = resolveBuildDirectory(workspaceRoot, environment);
  const startPath = buildStartPath(workspaceRoot, directory);
  fs.mkdirSync(path.dirname(startPath), { recursive: true });
  fs.writeFileSync(startPath, JSON.stringify({ ...sourceState(workspaceRoot), directory, deployment: {
    environment: environment.REACT_APP_DEPLOYMENT_ENV || 'production',
    projectId: environment.REACT_APP_FIREBASE_PROJECT_ID,
  } }));
}
function writeManifest(workspaceRoot = root, environment = process.env) {
  const directory = resolveBuildDirectory(workspaceRoot, environment);
  const startPath = buildStartPath(workspaceRoot, directory);
  const state = sourceState(workspaceRoot);
  const started = JSON.parse(fs.readFileSync(startPath, 'utf8'));
  if (started.directory !== directory) throw new Error('빌드 출력 경로가 바뀌었습니다. 다시 빌드해 주세요.');
  if (!sameSourceState(started, state)) throw new Error('빌드 중 코드가 바뀌었습니다. 현재 코드를 다시 빌드해 주세요.');
  const assetManifestHash = hash(fs.readFileSync(path.join(directory, 'asset-manifest.json')));
  const manifest = { schemaVersion: 1, ...state, deployment: started.deployment, builtAt: new Date().toISOString(), assetManifestHash };
  fs.writeFileSync(path.join(directory, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.unlinkSync(startPath);
  console.log(`배포 확인 기록 생성: ${state.commit.slice(0, 8)}${state.dirty ? ' (커밋 전 변경 포함)' : ''}`);
  return manifest;
}
module.exports = { root, hash, sourceState, compareRelease, sameSourceState, beginBuild, writeManifest, gitBackendFingerprints, backendFingerprintFormat };
if (require.main === module) { loadBuildEnvironment(); writeManifest(); }
