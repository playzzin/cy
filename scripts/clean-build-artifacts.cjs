const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function confinedPath(root, filename) {
    const base = fs.realpathSync(root);
    const target = path.resolve(base, filename);
    if (!target.startsWith(base + path.sep)) throw new Error('작업 폴더 밖의 경로는 정리할 수 없습니다.');
    let current = base;
    for (const part of path.relative(base, target).split(path.sep)) {
        current = path.join(current, part);
        if (fs.lstatSync(current).isSymbolicLink()) throw new Error('링크 경로는 정리하지 않습니다.');
    }
    return target;
}

function inspectTree(directory, cutoff) {
    let bytes = 0, files = 0;
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.mtimeMs >= cutoff) return null;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || ['.git', '.env', '.env.local'].includes(entry.name)) return null;
        const filename = path.join(directory, entry.name);
        const child = fs.lstatSync(filename);
        if (child.mtimeMs >= cutoff) return null;
        if (entry.isDirectory()) {
            const result = inspectTree(filename, cutoff);
            if (!result) return null;
            bytes += result.bytes; files += result.files;
        } else { bytes += child.size; files++; }
    }
    return { bytes, files };
}

function isUntracked(root, filename) {
    try {
        const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: path.dirname(filename), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const relative = path.relative(repo, filename).split(path.sep).join('/');
        return execFileSync('git', ['ls-files', '-z', '--', `:(literal)${relative}`], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).length === 0;
    } catch { return false; }
}

function buildPlan(root, { days = 14, now = Date.now(), builds = false } = {}) {
    if (!Number.isFinite(days) || days < 7) throw new Error('보존 기간은 최소 7일이어야 합니다.');
    root = fs.realpathSync(root);
    const cutoff = now - days * 86400000;
    const candidates = [], skipped = [];
    const legacy = 'node_modules/.cache/babel-loader';
    if (fs.existsSync(path.join(root, legacy))) {
        try {
            const directory = confinedPath(root, legacy);
            if (!isUntracked(root, directory)) throw new Error('Git에서 관리하는 캐시 경로는 보존합니다.');
            // Only Babel's known generated cache filenames; never dependencies.
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                if (!entry.isFile() || !/^[a-f0-9]{64}\.json(?:\.gz)?$/.test(entry.name)) continue;
                const filename = path.join(directory, entry.name);
                const stat = fs.lstatSync(filename);
                if (stat.mtimeMs < cutoff) candidates.push({ path: path.relative(root, filename), bytes: stat.size, files: 1, mtimeMs: stat.mtimeMs, kind: 'legacy-babel' });
            }
        } catch (error) { skipped.push({ path: legacy, reason: error.message }); }
    }
    const oldBuilds = [];
    if (builds) {
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (entry.isDirectory() && entry.name.startsWith('.deploy_')) oldBuilds.push(path.join(entry.name, 'build'));
        }
        if (fs.existsSync(path.join(root, 'tmp'))) {
            for (const entry of fs.readdirSync(confinedPath(root, 'tmp'), { withFileTypes: true })) {
                if (entry.isDirectory()) oldBuilds.push(path.join('tmp', entry.name, 'build'));
            }
        }
    }
    for (const relative of oldBuilds) {
        if (!fs.existsSync(path.join(root, relative))) continue;
        try {
            const filename = confinedPath(root, relative);
            // Require the actual CRA output signature, not a directory name alone.
            if (!fs.existsSync(path.join(filename, 'asset-manifest.json')) || !fs.existsSync(path.join(filename, 'index.html'))) continue;
            const stats = inspectTree(filename, cutoff);
            if (stats && isUntracked(root, filename)) candidates.push({ path: relative, ...stats, kind: 'old-build' });
        } catch (error) { skipped.push({ path: relative, reason: error.message }); }
    }
    return { root, days, cutoff, candidates, skipped };
}

function applyPlan(plan, onProgress = () => {}) {
    const result = { bytes: 0, files: 0, skipped: 0, groups: {} };
    if (plan.candidates.some(candidate => candidate.kind === 'legacy-babel')
        && !isUntracked(plan.root, confinedPath(plan.root, 'node_modules/.cache/babel-loader'))) {
        throw new Error('Git에서 관리하는 캐시 경로는 보존합니다.');
    }
    for (const candidate of plan.candidates) {
        try {
            const filename = confinedPath(plan.root, candidate.path);
            if (candidate.kind === 'legacy-babel') {
                if (!/^node_modules[\\/]\.cache[\\/]babel-loader[\\/][a-f0-9]{64}\.json(?:\.gz)?$/.test(candidate.path)) throw new Error('허용되지 않은 캐시 경로');
                const stat = fs.lstatSync(filename);
                if (!stat.isFile() || stat.size !== candidate.bytes || stat.mtimeMs !== candidate.mtimeMs || stat.mtimeMs >= plan.cutoff) { result.skipped++; continue; }
                fs.unlinkSync(filename);
            } else if (candidate.kind === 'old-build') {
                if (!/^(?:\.deploy_[^\\/]+|tmp[\\/][^\\/]+)[\\/]build$/.test(candidate.path)) throw new Error('허용되지 않은 빌드 경로');
                const stats = inspectTree(filename, plan.cutoff);
                if (!stats || stats.bytes !== candidate.bytes || stats.files !== candidate.files || !isUntracked(plan.root, filename)) { result.skipped++; continue; }
                fs.rmSync(filename, { recursive: true });
            } else throw new Error('허용되지 않은 생성 파일 종류');
            result.bytes += candidate.bytes; result.files += candidate.files;
            result.groups[candidate.kind] = (result.groups[candidate.kind] || 0) + candidate.bytes;
            if (result.files % 10000 === 0) onProgress(result.files);
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'EBUSY' || error.code === 'EPERM') result.skipped++;
            else throw error;
        }
    }
    return result;
}

module.exports = { confinedPath, inspectTree, buildPlan, applyPlan };
if (require.main === module) {
    try {
        const root = path.resolve(__dirname, '..');
        const plan = buildPlan(root, { builds: process.argv.includes('--builds') });
        const summary = { checkedAt: new Date().toISOString(), days: plan.days, planned: {
            bytes: plan.candidates.reduce((sum, row) => sum + row.bytes, 0),
            files: plan.candidates.reduce((sum, row) => sum + row.files, 0),
            buildDirectories: plan.candidates.filter(row => row.kind === 'old-build').map(row => row.path),
        }, skipped: plan.skipped };
        console.log(`정리 대상: ${summary.planned.files.toLocaleString()}개 파일, ${(summary.planned.bytes / 2 ** 30).toFixed(2)} GiB. 최근 14일 파일과 현재 작업별 캐시는 보존합니다.`);
        if (process.argv.includes('--apply')) summary.removed = applyPlan(plan, files => console.log(`${files.toLocaleString()}개 생성 파일 정리 완료`));
        else console.log('확인만 수행했습니다. 적용: npm run clean:generated -- --builds --apply');
        fs.mkdirSync(path.join(root, '.firebase'), { recursive: true });
        fs.writeFileSync(path.join(root, '.firebase', 'cleanup-summary.json'), JSON.stringify(summary, null, 2));
        if (summary.removed) console.log(`정리 완료: ${summary.removed.files.toLocaleString()}개, ${(summary.removed.bytes / 2 ** 30).toFixed(2)} GiB 확보.`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
