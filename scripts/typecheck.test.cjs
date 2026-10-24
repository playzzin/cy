const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { typecheckIdentity, proofPath, hasVerifiedTypecheck, runTypecheck } = require('./typecheck.cjs');

test('only a successful unchanged full check can suppress duplicate build checking', t => {
  const parent = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'cy-typecheck-test-'));
  t.after(() => {
    assert.ok(directory.startsWith(parent + path.sep) && path.basename(directory).startsWith('cy-typecheck-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  execFileSync('git', ['init', '--quiet', directory]);
  execFileSync('git', ['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.test', 'commit', '--quiet', '--allow-empty', '-m', 'fixture'], { cwd: directory });
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(path.join(directory, '.gitignore'), 'node_modules/\n');
  fs.writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: true, types: [] }, include: ['src'] }));
  fs.mkdirSync(path.join(directory, 'node_modules'));
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(directory, 'node_modules/typescript'), process.platform === 'win32' ? 'junction' : 'dir');
  const source = path.join(directory, 'src/example.ts');
  fs.writeFileSync(source, 'export const value: number = 1;');
  assert.equal(hasVerifiedTypecheck(directory), false);
  runTypecheck([], directory);
  assert.equal(hasVerifiedTypecheck(directory), true);

  fs.writeFileSync(source, 'export const value: number = "wrong";');
  assert.equal(hasVerifiedTypecheck(directory), false);
  assert.throws(() => runTypecheck([], directory), /TypeScript 검사 실패/);
  assert.equal(hasVerifiedTypecheck(directory), false);

  fs.writeFileSync(source, 'export const value: number = 2;');
  runTypecheck([], directory);
  assert.equal(hasVerifiedTypecheck(directory), true);
  fs.writeFileSync(path.join(directory, 'package-lock.json'), '{}');
  assert.equal(hasVerifiedTypecheck(directory), false);

  const proof = proofPath(directory);
  fs.writeFileSync(proof, JSON.stringify({ identity: { ...typecheckIdentity(directory), node: 'different-runtime' } }));
  assert.equal(hasVerifiedTypecheck(directory), false);
  fs.writeFileSync(proof, 'invalid JSON');
  assert.equal(hasVerifiedTypecheck(directory), false);
  runTypecheck(['--noCheck'], directory);
  assert.equal(hasVerifiedTypecheck(directory), false);
});
