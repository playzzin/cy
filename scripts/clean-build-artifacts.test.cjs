const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { releaseFixture, makeDirectoryLink } = require('./release-test-fixture.cjs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { confinedPath, buildPlan, applyPlan } = require('./clean-build-artifacts.cjs');

test('cleanup removes only expired generated files, preserving fresh files, sources and tracked outputs', t => {
    const root = releaseFixture(t, 'cy-generated-cleanup-test-');
    const old = new Date(Date.now() - 30 * 86400000);
    const write = (name, text = 'synthetic', stale = true) => {
        const file = path.join(root, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
        if (stale) fs.utimesSync(file, old, old);
        return file;
    };
    execFileSync('git', ['init', '--quiet', root]);
    const cache = 'node_modules/.cache/babel-loader/';
    const expired = write(cache + 'a'.repeat(64) + '.json');
    const changed = write(cache + 'b'.repeat(64) + '.json');
    const fresh = write(cache + 'c'.repeat(64) + '.json', 'fresh', false);
    const source = write('src/important.ts');
    const manual = write(cache + 'notes.txt');
    for (const name of ['old', 'tracked']) {
        write(`tmp/${name}/build/index.html`);
        write(`tmp/${name}/build/asset-manifest.json`, '{}');
        fs.utimesSync(path.join(root, `tmp/${name}/build`), old, old);
    }
    execFileSync('git', ['add', 'tmp/tracked/build'], { cwd: root });
    assert.throws(() => confinedPath(root, '../outside'), /작업 폴더 밖/);
    const plan = buildPlan(root, { builds: true });
    assert.equal(plan.candidates.length, 3);
    fs.writeFileSync(changed, 'recently used');
    const removed = applyPlan(plan);
    assert.equal(removed.files, 3);
    assert.equal(removed.skipped, 1);
    assert.equal(fs.existsSync(expired), false);
    assert.equal(fs.existsSync(path.join(root, 'tmp/old/build')), false);
    for (const file of [fresh, changed, source, manual, path.join(root, 'tmp/tracked/build/index.html')]) assert.equal(fs.existsSync(file), true);
});

test('cleanup preserves an entire expired build containing a real directory link', t => {
    const root = releaseFixture(t, 'cy-linked-cleanup-test-');
    const build = path.join(root, 'tmp', 'linked', 'build');
    const source = path.join(root, 'src');
    fs.mkdirSync(source);
    fs.mkdirSync(build, { recursive: true });
    execFileSync('git', ['init', '--quiet', root]);
    if (!makeDirectoryLink(t, source, path.join(build, 'source'))) return;
    fs.writeFileSync(path.join(source, 'important.ts'), 'synthetic');
    const old = new Date(Date.now() - 30 * 86400000);
    for (const file of ['index.html', 'asset-manifest.json']) {
        fs.writeFileSync(path.join(build, file), '{}');
        fs.utimesSync(path.join(build, file), old, old);
    }
    fs.utimesSync(build, old, old);
    assert.throws(() => confinedPath(root, 'tmp/linked/build/source/important.ts'), /링크/);
    const plan = buildPlan(root, { builds: true });
    assert.equal(plan.candidates.length, 0);
    assert.equal(applyPlan(plan).files, 0);
    assert.equal(fs.existsSync(path.join(build, 'index.html')), true);
    assert.equal(fs.existsSync(path.join(source, 'important.ts')), true);
});
