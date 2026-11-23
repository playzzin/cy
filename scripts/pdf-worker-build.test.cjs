const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('production PDF worker has no machine-local Babel imports', t => {
  const parent = path.resolve(__dirname, '../.firebase');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'cy-pdf-worker-test-'));
  t.after(() => {
    assert.ok(directory.startsWith(parent + path.sep) && path.basename(directory).startsWith('cy-pdf-worker-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const entry = path.join(directory, 'entry.js');
  fs.writeFileSync(entry, 'globalThis.pdfWorkerUrl = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url);');
  execFileSync(process.execPath, ['-e', `
    process.env.NODE_ENV = 'production';
    require('./scripts/patchReactScriptsWebpack').patchReactScriptsWebpack({ verifiedTypecheck: true });
    const config = require('react-scripts/config/webpack.config')('production');
    const compiler = require('webpack')({ mode: 'production', context: process.cwd(),
      entry: ${JSON.stringify(entry)},
      output: { ...config.output, path: ${JSON.stringify(path.join(directory, 'out'))}, filename: 'main.js' },
      module: config.module, resolve: { ...config.resolve, plugins: [] },
      optimization: { minimize: false }, cache: false, devtool: false,
    });
    compiler.run((error, stats) => compiler.close(() => {
      if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exitCode = 1; }
    }));
  `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
  const media = path.join(directory, 'out/static/media');
  const worker = fs.readdirSync(media).find(file => /^pdf\.worker.*\.mjs$/.test(file));
  assert.ok(worker, 'the standalone worker is emitted');
  const code = fs.readFileSync(path.join(media, worker), 'utf8');
  assert.ok(code.length > 100000, 'the emitted asset contains the real PDF worker');
  assert.doesNotMatch(code, /@babel\/runtime\/helpers/);
  assert.doesNotMatch(code, /(?:from|import)\s*["'][A-Za-z]:[/\\]/);
});
