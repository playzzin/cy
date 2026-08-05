const webpackConfigPath = require.resolve('react-scripts/config/webpack.config');
const webpackDevServerConfigPath = require.resolve('react-scripts/config/webpackDevServer.config');

const REACT_DATEPICKER_WARNING = /Critical dependency: the request of a dependency is an expression/;
const REACT_DATEPICKER_MODULE = /[\\/]react-datepicker[\\/]dist[\\/]index(?:\.es)?\.js$/;
const FORK_TS_CHECKER_PLUGIN = 'ForkTsCheckerWebpackPlugin';
const DEFAULT_TYPE_CHECKER_MEMORY_MB = 4096;

function isTruthyEnvironmentValue(value) {
  return /^(?:1|true|yes|on)$/i.test(String(value || '').trim());
}

function getTypeCheckerMemoryLimit() {
  const configured = Number(process.env.FORK_TS_CHECKER_MEMORY_MB);
  if (!Number.isFinite(configured) || configured < 1024) {
    return DEFAULT_TYPE_CHECKER_MEMORY_MB;
  }

  return Math.floor(configured);
}

function configureTypeChecker(config) {
  if (!Array.isArray(config.plugins)) return;

  const isTypeChecker = (plugin) => (
    plugin?.constructor?.name === FORK_TS_CHECKER_PLUGIN
  );

  if (isTruthyEnvironmentValue(process.env.DISABLE_FORK_TS_CHECKER)) {
    config.plugins = config.plugins.filter((plugin) => !isTypeChecker(plugin));
    return;
  }

  const memoryLimit = getTypeCheckerMemoryLimit();
  config.plugins.forEach((plugin) => {
    if (!isTypeChecker(plugin) || !plugin.options?.typescript) return;
    plugin.options.typescript.memoryLimit = memoryLimit;
  });
}

function getModuleResource(warning) {
  if (!warning || typeof warning !== 'object' || !warning.module) {
    return '';
  }

  return typeof warning.module.resource === 'string' ? warning.module.resource : '';
}

function shouldIgnoreReactDatepickerWarning(warning) {
  const message = warning instanceof Error
    ? warning.message
    : typeof warning?.message === 'string'
      ? warning.message
      : String(warning ?? '');

  return REACT_DATEPICKER_WARNING.test(message) && REACT_DATEPICKER_MODULE.test(getModuleResource(warning));
}

function patchReactScriptsWebpack() {
  const createWebpackConfig = require(webpackConfigPath);

  require.cache[webpackConfigPath].exports = (webpackEnv) => {
    const config = createWebpackConfig(webpackEnv);
    const ignoreWarnings = Array.isArray(config.ignoreWarnings) ? [...config.ignoreWarnings] : [];

    ignoreWarnings.push((warning) => shouldIgnoreReactDatepickerWarning(warning));
    config.ignoreWarnings = ignoreWarnings;
    configureTypeChecker(config);

    return config;
  };
}

function patchReactScriptsWebpackDevServer() {
  const createDevServerConfig = require(webpackDevServerConfigPath);

  require.cache[webpackDevServerConfigPath].exports = (...args) => {
    const config = createDevServerConfig(...args);
    const beforeSetup = config.onBeforeSetupMiddleware;
    const afterSetup = config.onAfterSetupMiddleware;
    const existingSetup = config.setupMiddlewares;

    if (!beforeSetup && !afterSetup) {
      return config;
    }

    delete config.onBeforeSetupMiddleware;
    delete config.onAfterSetupMiddleware;

    config.setupMiddlewares = (middlewares, devServer) => {
      if (typeof beforeSetup === 'function') {
        beforeSetup(devServer);
      }

      const nextMiddlewares = typeof existingSetup === 'function'
        ? existingSetup(middlewares, devServer)
        : middlewares;

      if (typeof afterSetup === 'function') {
        afterSetup(devServer);
      }

      return nextMiddlewares;
    };

    return config;
  };
}

module.exports = {
  patchReactScriptsWebpack,
  patchReactScriptsWebpackDevServer,
};
