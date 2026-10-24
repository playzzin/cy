const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function workspaceCache(workspaceRoot = process.cwd()) {
  const root = fs.realpathSync(workspaceRoot);
  const id = crypto.createHash('sha256').update(root).digest('hex').slice(0, 20);
  // Release worktrees can share node_modules through a junction. Their sources,
  // TypeScript state and webpack configuration must not share one cache entry.
  return path.join(root, 'node_modules', '.cache', 'cy-workspaces', id);
}

function configureBuildCache(config, environment) {
  const cacheRoot = path.join(workspaceCache(config.context), environment);
  function configureLoaders(rules) {
    for (const rule of rules || []) {
      configureLoaders(rule.oneOf);
      configureLoaders(rule.rules);
      const loaders = [rule, ...(Array.isArray(rule.use) ? rule.use : [])];
      for (const loader of loaders) {
        if (typeof loader?.loader === 'string' && /[\\/]babel-loader[\\/]/.test(loader.loader) && loader.options?.cacheDirectory) {
          loader.options.cacheDirectory = path.join(cacheRoot, 'babel-loader');
        }
      }
    }
  }
  configureLoaders(config.module?.rules);
  if (config.cache && typeof config.cache === 'object') {
    config.cache.cacheDirectory = path.join(cacheRoot, 'webpack');
    config.cache.buildDependencies = {
      ...config.cache.buildDependencies,
      buildPerformance: [__filename],
    };
  }
  for (const plugin of config.plugins || []) {
    if (plugin.constructor.name === 'ForkTsCheckerWebpackPlugin') {
      const typescript = plugin.options.typescript;
      typescript.configOverwrite = {
        ...typescript.configOverwrite,
        compilerOptions: {
          ...typescript.configOverwrite?.compilerOptions,
          tsBuildInfoFile: path.join(cacheRoot, 'build.tsbuildinfo'),
        },
      };
    }
    if (plugin.constructor.name === 'ESLintWebpackPlugin') {
      plugin.options.cacheLocation = path.join(cacheRoot, 'eslint.json');
    }
  }
}

function closeAfterRun(compiler) {
  const run = compiler.run.bind(compiler);
  compiler.run = callback => run((error, stats) => {
    // CRA 5 calls run() without close(). Await shutdown so persistent cache
    // writes finish before CRA reports success (also on compilation errors).
    compiler.close(closeError => callback(error || closeError, stats));
  });
  return compiler;
}

function installWebpackShutdown() {
  const modulePath = require.resolve('webpack');
  const webpack = require(modulePath);
  require.cache[modulePath].exports = new Proxy(webpack, {
    apply(target, thisArg, args) {
      // webpack(config, callback) already closes its compiler internally.
      if (typeof args[1] === 'function') return Reflect.apply(target, thisArg, args);
      return closeAfterRun(Reflect.apply(target, thisArg, args));
    },
  });
}

module.exports = { workspaceCache, configureBuildCache, closeAfterRun, installWebpackShutdown };
