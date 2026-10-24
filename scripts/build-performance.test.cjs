const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { workspaceCache, configureBuildCache, closeAfterRun } = require('./build-performance.cjs');

function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'cy-build-cache-test-'));
  t.after(() => {
    assert.ok(directory.startsWith(parent + path.sep) && path.basename(directory).startsWith('cy-build-cache-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test('worktrees sharing dependencies keep independent webpack, lint and TypeScript caches', t => {
  const directory = fixture(t);
  const shared = path.join(directory, 'dependencies');
  fs.mkdirSync(shared);
  const roots = ['first', 'second'].map(name => {
    const root = path.join(directory, name);
    fs.mkdirSync(root);
    fs.symlinkSync(shared, path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    fs.mkdirSync(workspaceCache(root), { recursive: true });
    return root;
  });
  assert.notEqual(fs.realpathSync(workspaceCache(roots[0])), fs.realpathSync(workspaceCache(roots[1])));
  class ForkTsCheckerWebpackPlugin { constructor() { this.options = { typescript: {} }; } }
  class ESLintWebpackPlugin { constructor() { this.options = {}; } }
  const config = { context: roots[0], cache: { type: 'filesystem' }, plugins: [new ForkTsCheckerWebpackPlugin(), new ESLintWebpackPlugin()],
    module: { rules: [{ oneOf: [{ loader: require.resolve('babel-loader'), options: { cacheDirectory: true } }] }] } };
  configureBuildCache(config, 'production');
  assert.ok(config.cache.cacheDirectory.startsWith(workspaceCache(roots[0]) + path.sep));
  assert.ok(config.plugins[0].options.typescript.configOverwrite.compilerOptions.tsBuildInfoFile.includes('production'));
  assert.ok(config.plugins[1].options.cacheLocation.includes('production'));
  assert.equal(config.module.rules[0].oneOf[0].options.cacheDirectory, path.join(workspaceCache(roots[0]), 'production', 'babel-loader'));
  const productionCache = config.cache.cacheDirectory;
  configureBuildCache(config, 'development');
  assert.notEqual(config.cache.cacheDirectory, productionCache);
  assert.ok(config.module.rules[0].oneOf[0].options.cacheDirectory.includes('development'));
});

test('run waits for shutdown and propagates compile or cache-write errors', async () => {
  for (const compileError of [null, new Error('compile failed')]) {
    const cacheError = new Error('cache write failed');
    let finish;
    const compiler = closeAfterRun({
      run(callback) { callback(compileError, 'stats'); },
      close(callback) { finish = callback; },
    });
    let completed = false;
    const done = new Promise(resolve => compiler.run((error, stats) => {
      completed = true;
      assert.equal(error, compileError || cacheError);
      assert.equal(stats, 'stats');
      resolve();
    }));
    assert.equal(completed, false);
    finish(cacheError);
    await done;
  }
});

test('production keeps its checker unless a full check was verified; development is unchanged', () => {
  const inspect = (environment, verifiedTypecheck) => Number(execFileSync(process.execPath, ['-e', `
    process.env.NODE_ENV = ${JSON.stringify(environment)};
    process.env.DISABLE_FORK_TS_CHECKER = 'false';
    require('./scripts/patchReactScriptsWebpack').patchReactScriptsWebpack({ verifiedTypecheck: ${verifiedTypecheck} });
    const config = require('react-scripts/config/webpack.config')(${JSON.stringify(environment)});
    console.log(config.plugins.filter(p => p.constructor.name === 'ForkTsCheckerWebpackPlugin').length);
  `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 30000 }).trim());
  assert.equal(inspect('production', false), 1);
  assert.equal(inspect('production', true), 0);
  assert.equal(inspect('development', true), 1);
});

test('separate webpack processes persist and reuse cache, then rebuild changed input', t => {
  const directory = fixture(t);
  const entry = path.join(directory, 'entry.js');
  const runner = path.join(directory, 'run.cjs');
  fs.writeFileSync(entry, 'export const value = "first-version";');
  fs.writeFileSync(runner, `
    const { installWebpackShutdown } = require(${JSON.stringify(require.resolve('./build-performance.cjs'))});
    installWebpackShutdown();
    const webpack = require(${JSON.stringify(require.resolve('webpack'))});
    const { BuildTimingPlugin } = require(${JSON.stringify(require.resolve('./build-timing.cjs'))});
    const path = require('node:path');
    webpack({ mode: 'production', context: __dirname, entry: './entry.js',
      output: { path: path.join(__dirname, 'out'), filename: 'bundle.js', library: { type: 'commonjs2' } },
      cache: { type: 'filesystem', cacheDirectory: path.join(__dirname, 'cache'), buildDependencies: { config: [__filename] } },
      plugins: [new BuildTimingPlugin({ outputPath: path.join(__dirname, 'timing.json'), log() {} })],
      optimization: { minimize: false }, infrastructureLogging: { level: 'none' }
    }).run((error, stats) => {
      if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
      console.log(JSON.stringify({ cachedModules: stats.toJson({ all: false, modules: true, cachedModules: true }).modules.filter(m => m.cached).length }));
    });
  `);
  const run = () => JSON.parse(execFileSync(process.execPath, [runner], { encoding: 'utf8', timeout: 30000 }).trim());
  run();
  const timing = JSON.parse(fs.readFileSync(path.join(directory, 'timing.json'), 'utf8'));
  assert.equal(timing.success, true);
  assert.ok(timing.builtModules > 0);
  assert.ok(timing.phases.some(phase => phase.label === 'cache shutdown'));
  assert.equal(timing.phases.filter(phase => phase.label === 'module graph').length, 1);
  assert.ok(fs.existsSync(path.join(directory, 'cache', 'default-production', 'index.pack')));
  assert.ok(run().cachedModules > 0);
  fs.writeFileSync(entry, 'export const value = "second-version";');
  run();
  const output = fs.readFileSync(path.join(directory, 'out', 'bundle.js'), 'utf8');
  assert.ok(output.includes('second-version'));
  assert.ok(!output.includes('first-version'));
});

test('timing preserves asset-hook results and errors for sync, callback and promise plugins', async t => {
  const directory = fixture(t);
  const webpack = require('webpack');
  const { BuildTimingPlugin } = require('./build-timing.cjs');
  fs.writeFileSync(path.join(directory, 'entry.js'), 'export const value = 1;');
  for (const fail of [false, true]) {
    const events = [];
    const outputPath = path.join(directory, `timing-${fail}.json`);
    const compiler = webpack({
      mode: 'production', context: directory, entry: './entry.js',
      output: { path: path.join(directory, 'out') },
      optimization: { minimize: false },
      plugins: [
        new BuildTimingPlugin({ outputPath, log() {} }),
        { apply(compiler) {
          compiler.hooks.thisCompilation.tap('Fixture', compilation => {
            compilation.hooks.processAssets.tap('sync-fixture', () => { events.push('sync'); });
            compilation.hooks.processAssets.tapAsync('async-fixture', (_assets, callback) => {
              events.push('callback');
              callback();
            });
            compilation.hooks.processAssets.tapPromise('promise-fixture', async () => {
              events.push('promise');
              if (fail) throw new Error('synthetic asset error');
            });
          });
        } },
      ],
    });
    const error = await new Promise(resolve => closeAfterRun(compiler).run(error => resolve(error)));
    assert.deepEqual(events, ['sync', 'callback', 'promise']);
    assert.equal(Boolean(error), fail);
    if (fail) assert.match(error.message, /synthetic asset error/);
    const timing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(timing.success, !fail);
    for (const name of ['sync-fixture', 'async-fixture', 'promise-fixture']) {
      assert.ok(timing.phases.some(phase => phase.label === `assets: ${name}`));
    }
  }
});
