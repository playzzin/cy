const fs = require('node:fs');
const path = require('node:path');

// Only timings and counts are collected: no source, environment values or stats dump.
class BuildTimingPlugin {
  constructor({ outputPath, log = console.log }) {
    this.outputPath = outputPath;
    this.log = log;
  }

  apply(compiler) {
    const name = 'CyBuildTiming';
    const started = performance.now();
    const phases = [];
    let mark = started;
    let builtModules = 0;
    let modules = 0;
    let compilationFailed = false;
    const record = (label, start) => {
      const seconds = (performance.now() - start) / 1000;
      phases.push({ label, seconds: +seconds.toFixed(3) });
      this.log(`[build timing] ${label}: ${seconds.toFixed(1)}s`);
    };
    compiler.hooks.compile.tap(name, () => {
      record('compiler preparation', mark);
      mark = performance.now();
    });
    compiler.hooks.finishMake.tap(name, compilation => {
      // Child compilers inherit this hook; do not count them twice.
      if (compilation.compiler !== compiler) return;
      record('module graph', mark);
      mark = performance.now();
    });
    compiler.hooks.thisCompilation.tap(name, compilation => {
      compilation.hooks.buildModule.tap(name, () => { builtModules++; });
      compilation.hooks.seal.tap(name, () => {
        record('finish modules', mark);
        mark = performance.now();
      });
      compilation.hooks.processAssets.tap({ name, stage: -Infinity }, () => {
        record('optimize and generate', mark);
      });
      compilation.hooks.processAssets.intercept({
        register(tap) {
          if (tap.name === name) return tap;
          const original = tap.fn;
          const label = `assets: ${tap.name}`;
          if (tap.type === 'promise') return { ...tap, fn: async function (...values) {
            const start = performance.now();
            try { return await original.apply(this, values); }
            finally { record(label, start); }
          } };
          if (tap.type === 'async') return { ...tap, fn: function (...values) {
            const callback = values.pop();
            const start = performance.now();
            return original.call(this, ...values, (...result) => {
              record(label, start);
              callback(...result);
            });
          } };
          return { ...tap, fn: function (...values) {
            const start = performance.now();
            try { return original.apply(this, values); }
            finally { record(label, start); }
          } };
        },
      });
      compilation.hooks.afterProcessAssets.tap(name, () => {
        mark = performance.now();
        modules = compilation.modules.size;
      });
    });
    compiler.hooks.failed.tap(name, () => { compilationFailed = true; });
    compiler.hooks.done.tap(name, stats => {
      compilationFailed = stats.hasErrors();
      record('final checks and emit', mark);
    });
    const close = compiler.close.bind(compiler);
    compiler.close = callback => {
      const start = performance.now();
      return close(error => {
        record('cache shutdown', start);
        try {
          fs.mkdirSync(path.dirname(this.outputPath), { recursive: true });
          fs.writeFileSync(this.outputPath, JSON.stringify({
            success: !error && !compilationFailed,
            compilerSeconds: +((performance.now() - started) / 1000).toFixed(3),
            builtModules, modules, phases,
          }, null, 2) + '\n');
        } catch (writeError) {
          // Optional diagnostics must not turn a successful build into a failure.
          this.log(`빌드 시간 기록 저장 실패: ${writeError.code || 'unknown'}`);
        }
        callback(error);
      });
    };
  }
}

module.exports = { BuildTimingPlugin };
