function ciTestArgs(args) {
  const explicitWorkers = args.some(arg => /^--(?:maxWorkers|runInBand)(?:=|$)/.test(arg)
    || arg === '-i' || arg === '-w' || arg.startsWith('-w='));
  return ['--watchAll=false', ...(!explicitWorkers ? ['--maxWorkers=2'] : []), ...args];
}

module.exports = { ciTestArgs };
if (require.main === module) {
  process.argv = [process.argv[0], require.resolve('react-scripts/scripts/test'), ...ciTestArgs(process.argv.slice(2))];
  require('react-scripts/scripts/test');
}
