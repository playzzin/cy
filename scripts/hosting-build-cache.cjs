const fs = require('node:fs');
const path = require('node:path');
const { root, hash, sourceState } = require('./release-manifest.cjs');
const { workspaceCache } = require('./build-performance.cjs');

const BUILD_ENV = /^(?:REACT_APP_|NODE_ENV$|NODE_OPTIONS$|PUBLIC_URL$|BUILD_PATH$|GENERATE_SOURCEMAP$|INLINE_RUNTIME_CHUNK$|IMAGE_INLINE_SIZE_LIMIT$|CI$|DISABLE_ESLINT_PLUGIN$|ESLINT_NO_DEV_ERRORS$|TSC_COMPILE_ON_ERROR$|DISABLE_FORK_TS_CHECKER$|FORK_TS_CHECKER_MEMORY_MB$|FAST_REFRESH$)/;

function inputIdentity(workspaceRoot = root, environment = process.env) {
    const installedLock = path.join(workspaceRoot, 'node_modules', '.package-lock.json');
    const buildEnvironment = Object.keys(environment).filter(key => BUILD_ENV.test(key)).sort().map(key => [key, environment[key]]);
    return {
        schemaVersion: 2,
        source: sourceState(workspaceRoot),
        runtime: [process.version, process.platform, process.arch],
        environment: hash(JSON.stringify(buildEnvironment)),
        installedDependencies: fs.existsSync(installedLock) ? hash(fs.readFileSync(installedLock)) : null,
    };
}

function compilationIdentity(identity) {
    // Keep the complete source state in the proof for release verification, but
    // backend-only edits and new commits do not change the compiled web assets.
    return {
        schemaVersion: identity.schemaVersion,
        hosting: identity.source.fingerprints.hosting,
        runtime: identity.runtime,
        environment: identity.environment,
        installedDependencies: identity.installedDependencies,
    };
}

function outputDigest(workspaceRoot = root) {
    const directory = path.join(workspaceRoot, 'build');
    const files = [];
    function visit(relative = '') {
        for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
            const name = path.join(relative, entry.name);
            if (entry.isSymbolicLink()) throw new Error('빌드 출력에 링크가 포함되어 재사용할 수 없습니다.');
            if (entry.isDirectory()) visit(name);
            else if (name !== 'release.json') files.push(name);
        }
    }
    visit();
    if (!files.includes('index.html') || !files.includes('asset-manifest.json') || !files.some(file => /\.js$/.test(file))) {
        throw new Error('완성된 웹 빌드가 없습니다.');
    }
    return hash(files.sort().map(file => `${file}\0${hash(fs.readFileSync(path.join(directory, file)))}`).join('\n'));
}

function proofPath(workspaceRoot = root) {
    return path.join(workspaceCache(workspaceRoot), 'hosting-build-success.json');
}

function invalidateBuild(workspaceRoot = root) {
    fs.rmSync(proofPath(workspaceRoot), { force: true });
}

function recordBuild(identity, workspaceRoot = root, environment = process.env) {
    if (JSON.stringify(identity) !== JSON.stringify(inputIdentity(workspaceRoot, environment))) {
        throw new Error('빌드 중 소스 또는 환경이 바뀌어 재사용 기록을 남기지 않습니다.');
    }
    const destination = proofPath(workspaceRoot);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify({ identity, outputs: outputDigest(workspaceRoot) }));
}

function canReuseBuild(identity, workspaceRoot = root) {
    try {
        if (!identity.installedDependencies) return false;
        const proof = JSON.parse(fs.readFileSync(proofPath(workspaceRoot), 'utf8'));
        const release = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'build/release.json'), 'utf8'));
        return identity.schemaVersion === 2 && proof.identity.schemaVersion === 2
            && JSON.stringify(compilationIdentity(proof.identity)) === JSON.stringify(compilationIdentity(identity))
            && release.schemaVersion === 1
            // The existing manifest must still match the build that produced it.
            // postbuild refreshes both provenance and backend fingerprints.
            && release.commit === proof.identity.source.commit
            && release.dirty === proof.identity.source.dirty
            && Object.entries(proof.identity.source.fingerprints).every(([key, value]) => release.fingerprints?.[key] === value)
            && release.assetManifestHash === hash(fs.readFileSync(path.join(workspaceRoot, 'build/asset-manifest.json')))
            && proof.outputs === outputDigest(workspaceRoot);
    } catch { return false; }
}

module.exports = { inputIdentity, outputDigest, proofPath, invalidateBuild, recordBuild, canReuseBuild };
