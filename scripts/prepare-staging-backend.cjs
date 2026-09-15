// Build the two approved reminder functions from committed source only.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const project = 'cy-erp-staging-9c1e4';
const output = path.join(root, '.firebase/staging-backend');
const functionRoot = path.join(output, 'functions');
const dependencies = path.join(root, 'functions/node_modules');
const sourcePaths = ['functions/src/auth.ts', 'functions/src/smartMemoReminders.ts', 'functions/src/smartMemoReminders.test.ts', 'storage.rules'];
const hash = contents => createHash('sha256').update(contents).digest('hex');

function prepare() {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', ...sourcePaths], { cwd: root, stdio: 'pipe' });
    fs.mkdirSync(path.join(functionRoot, 'src'), { recursive: true });
    if (!fs.existsSync(path.join(functionRoot, 'node_modules'))) fs.symlinkSync(dependencies, path.join(functionRoot, 'node_modules'), 'junction');
    const manifest = { project, commit, sourceFiles: {}, compiledFiles: {} };
    for (const sourcePath of sourcePaths) {
        const contents = execFileSync('git', ['show', `${commit}:${sourcePath}`], { cwd: root });
        const destination = sourcePath === 'storage.rules' ? path.join(output, sourcePath) : path.join(functionRoot, 'src', path.basename(sourcePath));
        fs.writeFileSync(destination, contents);
        manifest.sourceFiles[sourcePath] = hash(contents);
    }
    fs.writeFileSync(path.join(functionRoot, 'src/index.ts'), "import * as admin from 'firebase-admin';\nadmin.initializeApp();\nadmin.firestore().settings({ ignoreUndefinedProperties: true });\nexport { setSmartMemoReminder, dispatchSmartMemoReminders } from './smartMemoReminders';\n");
    const version = name => JSON.parse(fs.readFileSync(path.join(dependencies, name, 'package.json'), 'utf8')).version;
    fs.writeFileSync(path.join(functionRoot, 'package.json'), JSON.stringify({ name: 'cy-staging-reminders', private: true, main: 'lib/index.js', engines: { node: '22' }, dependencies: { 'firebase-admin': version('firebase-admin'), 'firebase-functions': version('firebase-functions') } }, null, 2));
    const ts = require(path.join(dependencies, 'typescript'));
    const program = ts.createProgram(['index.ts', 'auth.ts', 'smartMemoReminders.ts', 'smartMemoReminders.test.ts'].map(file => path.join(functionRoot, 'src', file)), {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: false, noImplicitReturns: true,
        skipLibCheck: true, outDir: path.join(functionRoot, 'lib'), types: ['node'], typeRoots: [path.join(dependencies, '@types')],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
    if (program.emit().emitSkipped) throw new Error('검증 서버 컴파일 실패');
    for (const file of fs.readdirSync(path.join(functionRoot, 'lib'))) manifest.compiledFiles[`functions/lib/${file}`] = hash(fs.readFileSync(path.join(functionRoot, 'lib', file)));
    manifest.compiledFiles['functions/package.json'] = hash(fs.readFileSync(path.join(functionRoot, 'package.json')));
    manifest.compiledFiles['storage.rules'] = hash(fs.readFileSync(path.join(output, 'storage.rules')));
    fs.writeFileSync(path.join(output, 'firebase.json'), JSON.stringify({ functions: { source: 'functions', ignore: ['node_modules', 'src', 'lib/*.test.js', '*.log'] }, storage: { rules: 'storage.rules' } }, null, 2));
    manifest.compiledFiles['firebase.json'] = hash(fs.readFileSync(path.join(output, 'firebase.json')));
    fs.writeFileSync(path.join(output, 'release.json'), JSON.stringify(manifest, null, 2));
    console.log(`검증 서버 배포 준비: ${commit.slice(0, 8)} · 예약 알림 함수 2개 · 파일 접근 규칙`);
    return output;
}

function verify() {
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'release.json'), 'utf8'));
    if (manifest.project !== project) throw new Error('검증 배포 대상 불일치');
    for (const [file, expected] of Object.entries(manifest.compiledFiles)) if (hash(fs.readFileSync(path.join(output, file))) !== expected) throw new Error('검증 배포 파일이 준비 후 변경되었습니다.');
    console.log('검증 서버 배포 파일 일치 확인');
    return output;
}

module.exports = { prepare, verify, project, output };
if (require.main === module) {
    try { process.argv[2] === '--verify' ? verify() : prepare(); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
